import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  let query = supabase
    .from('exam_sets')
    .select('*, syllabuses(title, subject, grade, status, image_urls, user_id)')
    .order('created_at', { ascending: false })

  if (userId) {
    // Logged in: show own exams + public exams
    query = query.or(`syllabuses.user_id.eq.${userId},is_public.eq.true`)
  } else {
    // Not logged in: only public exams
    query = query.eq('is_public', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
