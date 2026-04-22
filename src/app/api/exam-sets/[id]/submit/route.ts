import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { answers, user_id } = await req.json()

  const { data: questions } = await supabase
    .from('questions')
    .select('id, correct_answer')
    .eq('exam_set_id', id)

  if (!questions) return NextResponse.json({ error: 'Không tìm thấy câu hỏi' }, { status: 404 })

  let score = 0
  const results: Record<string, { correct: boolean; correct_answer: string }> = {}

  for (const q of questions) {
    const isCorrect = answers[q.id]?.trim().toUpperCase() === q.correct_answer.trim().toUpperCase()
    if (isCorrect) score++
    results[q.id] = { correct: isCorrect, correct_answer: q.correct_answer }
  }

  if (user_id) {
    await supabase.from('practice_sessions').insert({
      user_id,
      exam_set_id: id,
      answers,
      score,
      total: questions.length,
      completed_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ score, total: questions.length, results })
}
