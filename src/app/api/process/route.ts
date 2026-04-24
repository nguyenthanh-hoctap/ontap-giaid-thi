import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { extractExamQuestionsFromImages } from '@/lib/claude'

const ENABLE_DIAGRAM = process.env.ENABLE_DIAGRAM === 'true'

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

  // 2. Cập nhật status -> processing, set extracted_content ngay để UI chuyển bước
  await supabase.from('syllabuses').update({ status: 'processing', extracted_content: 'processing' }).eq('id', syllabus_id)

  try {
    // 3. Trích xuất câu hỏi trực tiếp từ ảnh (Gemini Vision)
    console.log('[process] Extracting questions from images...')
    let questions: Awaited<ReturnType<typeof extractExamQuestionsFromImages>>
    try {
      questions = await extractExamQuestionsFromImages(
        syllabus.image_urls,
        syllabus.subject,
        syllabus.grade,
      )
    } catch (e) {
      console.error('[process] Extraction FAILED:', String(e))
      throw new Error('Trích xuất câu hỏi thất bại: ' + String(e))
    }
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

    // 6. Xử lý diagram (chỉ khi ENABLE_DIAGRAM=true, dùng cho Firebase)
    const questionsProcessed = await Promise.all(
      questions.filter(q => q.question_text && q.correct_answer).map(async (q, i) => {
        let diagram: unknown = null
        if (ENABLE_DIAGRAM) {
          const { generateSvgFromCrop } = await import('@/lib/gemini')
          const raw = q.diagram
          const parsed = typeof raw === 'string'
            ? (() => { try { return JSON.parse(raw) } catch { return null } })()
            : (typeof raw === 'object' ? raw : null)
          if (parsed?.bbox) {
            const imageUrl = syllabus.image_urls[parsed.image_index ?? 0] ?? syllabus.image_urls[0]
            diagram = await generateSvgFromCrop(imageUrl, parsed.bbox) ?? null
          }
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
