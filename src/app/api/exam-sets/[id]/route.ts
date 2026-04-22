import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  const { data: examSet, error: eErr } = await supabase
    .from('exam_sets')
    .select('*, syllabuses(user_id)')
    .eq('id', id)
    .single()

  if (eErr || !examSet) return NextResponse.json({ error: 'Không tìm thấy bộ đề' }, { status: 404 })

  const isOwner = examSet.syllabuses?.user_id === userId
  if (!examSet.is_public && !isOwner) {
    return NextResponse.json({ error: 'Bạn không có quyền xem bộ đề này' }, { status: 403 })
  }

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_set_id', id)
    .order('order_number')

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  return NextResponse.json({ examSet: { ...examSet, isOwner }, questions })
}
