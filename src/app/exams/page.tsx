'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, Loader2, ChevronRight } from 'lucide-react'

interface ExamSetWithSyllabus {
  id: string
  title: string
  subject: string
  grade: number
  total_questions: number
  created_at: string
  syllabuses: {
    title: string
    subject: string
    grade: number
    status: string
    image_urls: string[]
  }
}

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamSetWithSyllabus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exam-sets')
      .then(r => r.json())
      .then(data => { setExams(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-indigo-600 hover:underline text-sm">← Trang chủ</Link>
            <h1 className="text-2xl font-bold mt-1">Bộ đề của bạn</h1>
          </div>
          <Link href="/upload">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Tạo đề mới
            </Button>
          </Link>
        </div>

        {exams.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Chưa có bộ đề nào</p>
              <Link href="/upload">
                <Button className="bg-indigo-600 hover:bg-indigo-700">Upload đề cương đầu tiên</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {exams.map(exam => (
              <Link key={exam.id} href={`/exam/${exam.id}`}>
                <Card className="hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{exam.title}</CardTitle>
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
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(exam.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
