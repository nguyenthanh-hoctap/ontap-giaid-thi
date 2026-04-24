import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { extractTextFromImages, generateSvgFromCrop } from '@/lib/gemini'
import { extractExamQuestionsFromImages } from '@/lib/claude'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { syllabus_id } = await req.json()

  // 1. Lấy thông tin đề cương
  const { data: syllabus, error: sErr } = await supabase
    .from('syllabuses')
    .select('*')
    .eq('id', syllabus_id)
    .single()

  if (sErr || !syllabus) return NextResponse.json({ error: 'Không tìm thấy đề cương' }, { status: 404 })

  // 2. Cập nhật status -> processing
  await supabase.from('syllabuses').update({ status: 'processing' }).eq('id', syllabus_id)

  try {
    // 3. OCR để lưu nội dung text
    const extractedContent = await extractTextFromImages(syllabus.image_urls)
    await supabase.from('syllabuses').update({ extracted_content: extractedContent }).eq('id', syllabus_id)

    // 4. Trích xuất câu hỏi trực tiếp từ ảnh (Gemini Vision thấy hình vẽ, sinh SVG chính xác)
    console.log('[process] Extracting questions from images directly...')
    const questions = await extractExamQuestionsFromImages(
      syllabus.image_urls,
      syllabus.subject,
      syllabus.grade,
    )
    console.log('[process] Extracted questions:', questions.length)

    if (questions.length === 0) {
      throw new Error('AI không trích xuất được câu hỏi nào từ ảnh. Vui lòng kiểm tra lại ảnh chụp (chữ rõ, đủ sáng) và thử lại.')
    }

    // 5. Tạo exam set
    const { data: examSet, error: eErr } = await supabase
      .from('exam_sets')
      .insert({
        syllabus_id,
        title: `Bộ đề: ${syllabus.title}`,
        subject: syllabus.subject,
        grade: syllabus.grade,
        total_questions: questions.length,
      })
      .select()
      .single()

    if (eErr || !examSet) throw new Error('Không thể tạo bộ đề')

    // 6. Crop hình vẽ từ ảnh gốc và upload
    const questionsProcessed = await Promise.all(
      questions.filter(q => q.question_text && q.correct_answer).map(async (q, i) => {
        let diagram = q.diagram
        const parsedDiagram = typeof diagram === 'string'
          ? (() => { try { return JSON.parse(diagram) } catch { return null } })()
          : (typeof diagram === 'object' ? diagram : null)

        if (parsedDiagram?.bbox) {
          const imageUrl = syllabus.image_urls[parsedDiagram.image_index ?? 0] ?? syllabus.image_urls[0]
          const svg = await generateSvgFromCrop(imageUrl, parsedDiagram.bbox)
          diagram = svg ?? null
        }
        return { ...q, diagram, order_number: i + 1, exam_set_id: examSet.id }
      })
    )
    const questionsWithExamId = questionsProcessed

    if (questionsWithExamId.length > 0) {
      const { error: qErr } = await supabase.from('questions').insert(questionsWithExamId)
      if (qErr) throw new Error('Lỗi lưu câu hỏi: ' + qErr.message)
    }

    // 7. Cập nhật status -> done
    await supabase.from('syllabuses').update({ status: 'done' }).eq('id', syllabus_id)

    return NextResponse.json({ exam_set_id: examSet.id })
  } catch (err) {
    await supabase.from('syllabuses').update({ status: 'error' }).eq('id', syllabus_id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
