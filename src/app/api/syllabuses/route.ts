import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let user_id: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    user_id = user?.id ?? null
  }

  const body = await req.json()
  const { title, subject, grade, image_urls } = body

  const { data, error } = await supabase
    .from('syllabuses')
    .insert({ title, subject, grade, image_urls, user_id, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
