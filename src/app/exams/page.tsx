'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, Loader2, ChevronRight, Globe, Filter, Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ExamSetWithSyllabus {
  id: string
  title: string
  subject: string
  grade: number
  total_questions: number
  created_at: string
  is_public: boolean
  syllabuses: {
    title: string
    subject: string
    grade: number
    status: string
    image_urls: string[]
    user_id: string
  }
}

export default function ExamsPage() {
  const { session, user } = useAuth()
  const [exams, setExams] = useState<ExamSetWithSyllabus[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
    fetch('/api/exam-sets', { headers })
      .then(r => r.json())
      .then(data => { setExams(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session])

  async function handleDelete(e: React.MouseEvent, examId: string) {
    e.preventDefault()
    if (!confirm('Xóa bộ đề này? Hành động không thể hoàn tác.')) return
    setDeletingId(examId)
    const res = await fetch(`/api/exam-sets/${examId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) setExams(prev => prev.filter(e => e.id !== examId))
    setDeletingId(null)
  }

  const grades = useMemo(() => {
    const g = [...new Set(exams.map(e => e.grade))].sort((a, b) => a - b)
    return g
  }, [exams])

  const subjects = useMemo(() => {
    const filtered = filterGrade === 'all' ? exams : exams.filter(e => e.grade === Number(filterGrade))
    return [...new Set(filtered.map(e => e.subject))].sort()
  }, [exams, filterGrade])

  const filtered = useMemo(() => {
    return exams.filter(e => {
      if (filterGrade !== 'all' && e.grade !== Number(filterGrade)) return false
      if (filterSubject !== 'all' && e.subject !== filterSubject) return false
      return true
    })
  }, [exams, filterGrade, filterSubject])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{user ? 'Bộ đề của bạn' : 'Đề công khai'}</h1>
          {user && (
            <Link href="/upload">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Tạo đề mới
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        {exams.length > 0 && (
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filterGrade} onValueChange={v => { if (v) { setFilterGrade(v); setFilterSubject('all') } }}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue>{filterGrade === 'all' ? 'Tất cả lớp' : `Lớp ${filterGrade}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả lớp</SelectItem>
                {grades.map(g => <SelectItem key={g} value={String(g)}>Lớp {g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSubject} onValueChange={v => v && setFilterSubject(v)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue>{filterSubject === 'all' ? 'Tất cả môn' : filterSubject}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môn</SelectItem>
                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterGrade !== 'all' || filterSubject !== 'all') && (
              <button onClick={() => { setFilterGrade('all'); setFilterSubject('all') }}
                className="text-sm text-indigo-600 hover:underline">
                Xóa filter
              </button>
            )}
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} bộ đề</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {exams.length === 0 ? 'Chưa có bộ đề nào' : 'Không có đề phù hợp với bộ lọc'}
              </p>
              {user && exams.length === 0 && (
                <Link href="/upload">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">Upload đề cương đầu tiên</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(exam => {
              const isOwner = user && exam.syllabuses?.user_id === user.id
              return (
                <div key={exam.id} className="relative group">
                  <Link href={`/exam/${exam.id}`}>
                    <Card className="hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base pr-8">{exam.title}</CardTitle>
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{exam.subject}</Badge>
                          <Badge variant="outline">Lớp {exam.grade}</Badge>
                          <Badge variant="outline">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {exam.total_questions} câu
                          </Badge>
                          {exam.is_public && <Badge className="bg-green-100 text-green-700 border-0 text-xs"><Globe className="w-3 h-3 mr-1" />Công khai</Badge>}
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(exam.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  {isOwner && (
                    <button
                      onClick={e => handleDelete(e, exam.id)}
                      disabled={deletingId === exam.id}
                      className="absolute top-3 right-8 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-500"
                    >
                      {deletingId === exam.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
