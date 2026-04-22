import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  if (!userId) {
    // Chưa đăng nhập: chỉ lấy đề public
    const { data, error } = await supabase
      .from('exam_sets')
      .select('*, syllabuses(title, subject, grade, status, image_urls, user_id)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Đã đăng nhập: lấy đề của mình + đề public, merge và dedup
  const [ownRes, publicRes] = await Promise.all([
    supabase
      .from('exam_sets')
      .select('*, syllabuses!inner(title, subject, grade, status, image_urls, user_id)')
      .eq('syllabuses.user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('exam_sets')
      .select('*, syllabuses(title, subject, grade, status, image_urls, user_id)')
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
  ])

  const own = ownRes.data ?? []
  const pub = publicRes.data ?? []

  // Merge, dedup by id
  const seen = new Set(own.map((e: { id: string }) => e.id))
  const merged = [...own, ...pub.filter((e: { id: string }) => !seen.has(e.id))]
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(merged)
}
