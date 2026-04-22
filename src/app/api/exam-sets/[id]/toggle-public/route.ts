import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  // Verify ownership
  const { data: examSet } = await supabase
    .from('exam_sets')
    .select('is_public, syllabus_id')
    .eq('id', id)
    .single()

  if (!examSet) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  const { data: syllabus } = await supabase
    .from('syllabuses')
    .select('user_id')
    .eq('id', examSet.syllabus_id)
    .single()

  if (syllabus?.user_id !== user.id) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 })

  const { data, error } = await supabase
    .from('exam_sets')
    .update({ is_public: !examSet.is_public })
    .eq('id', id)
    .select('is_public')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ is_public: data.is_public })
}
