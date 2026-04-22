import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, subject, grade, image_urls, user_id } = body

  const { data, error } = await supabase
    .from('syllabuses')
    .insert({ title, subject, grade, image_urls, user_id, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET() {
  const { data, error } = await supabase
    .from('syllabuses')
    .select('*, exam_sets(id, title, total_questions)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
