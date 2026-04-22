import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: examSet, error: eErr } = await supabase
    .from('exam_sets')
    .select('*')
    .eq('id', id)
    .single()

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 404 })

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_set_id', id)
    .order('order_number')

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  return NextResponse.json({ examSet, questions })
}
