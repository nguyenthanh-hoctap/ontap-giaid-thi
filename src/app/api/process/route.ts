import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { extractTextFromImages } from '@/lib/gemini'
import { extractExamQuestions } from '@/lib/claude'

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
    // 3. OCR bằng Claude Vision — luôn chạy lại từ ảnh thực tế
    const extractedContent = await extractTextFromImages(syllabus.image_urls)
    await supabase.from('syllabuses').update({ extracted_content: extractedContent }).eq('id', syllabus_id)

    // 4. Trích xuất câu hỏi từ đề thi
    const questions = await extractExamQuestions(
      extractedContent,
      syllabus.subject,
      syllabus.grade,
    )

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

    // 6. Lưu câu hỏi
    const questionsWithExamId = questions
      .filter((q) => q.question_text && q.correct_answer)
      .map((q, i) => ({ ...q, order_number: i + 1, exam_set_id: examSet.id }))
    const { error: qErr } = await supabase.from('questions').insert(questionsWithExamId)
    if (qErr) throw new Error('Lỗi lưu câu hỏi: ' + qErr.message)

    // 7. Cập nhật status -> done
    await supabase.from('syllabuses').update({ status: 'done' }).eq('id', syllabus_id)

    return NextResponse.json({ exam_set_id: examSet.id })
  } catch (err) {
    await supabase.from('syllabuses').update({ status: 'error' }).eq('id', syllabus_id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
