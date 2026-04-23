'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ExamSet, Question } from '@/types'
import { CheckCircle, XCircle, Loader2, BookOpen, Clock, Lightbulb, ChevronDown, ChevronUp, Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

function QuestionText({ text }: { text: string }) {
  const passageMatch = text.match(/^\[PASSAGE\]([\s\S]*?)\[\/PASSAGE\]\s*\n*([\s\S]*)$/)
  if (passageMatch) {
    return (
      <div className="space-y-3 flex-1">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide block mb-1">Đoạn văn</span>
          {passageMatch[1].trim()}
        </div>
        <span className="text-base font-medium">{passageMatch[2].trim()}</span>
      </div>
    )
  }
  return <span className="flex-1">{text}</span>
}

type SubmitResult = {
  score: number
  total: number
  results: Record<string, { correct: boolean; correct_answer: string }>
}

type ExamSetWithOwner = ExamSet & { isOwner?: boolean; is_public?: boolean }

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}
const DIFFICULTY_LABEL: Record<string, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' }
const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Trắc nghiệm',
  true_false: 'Đúng/Sai',
  short_answer: 'Tự luận',
  proof: 'Chứng minh',
}

export default function ExamPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [examSet, setExamSet] = useState<ExamSetWithOwner | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

    fetch(`/api/exam-sets/${id}`, { headers })
      .then(r => r.json())
      .then(({ examSet, questions }) => { setExamSet(examSet); setQuestions(questions); setLoading(false) })
      .catch(() => { toast.error('Không thể tải bộ đề'); setLoading(false) })
  }, [id, session])

  function toggleExplanation(qId: string) {
    setOpenExplanations(prev => ({ ...prev, [qId]: !prev[qId] }))
  }

  async function handleTogglePublic() {
    if (!session?.access_token || !examSet) return
    setTogglingPublic(true)
    const res = await fetch(`/api/exam-sets/${id}/toggle-public`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (res.ok) {
      setExamSet(prev => prev ? { ...prev, is_public: data.is_public } : prev)
      toast.success(data.is_public ? 'Đề đã được công khai' : 'Đề đã chuyển về riêng tư')
    }
    setTogglingPublic(false)
  }

  async function handleSubmit() {
    const mcQuestions = questions.filter(q => q.type === 'multiple_choice' || q.type === 'true_false')
    const unanswered = mcQuestions.filter(q => !answers[q.id])
    if (unanswered.length > 0) toast.warning(`Còn ${unanswered.length} câu trắc nghiệm chưa trả lời`)

    setSubmitting(true)
    const res = await fetch(`/api/exam-sets/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    const data = await res.json()
    setResult(data)
    setSubmitting(false)
    const wrongIds: Record<string, boolean> = {}
    Object.entries(data.results as SubmitResult['results']).forEach(([qId, r]) => {
      if (!r.correct) wrongIds[qId] = true
    })
    setOpenExplanations(wrongIds)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
  if (!examSet) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Không tìm thấy bộ đề</p></div>

  const mcQuestions = questions.filter(q => q.type === 'multiple_choice' || q.type === 'true_false')
  const answered = mcQuestions.filter(q => answers[q.id]).length
  const progress = mcQuestions.length > 0 ? Math.round((answered / mcQuestions.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <Link href="/exams" className="text-indigo-600 hover:underline text-sm">← Danh sách đề</Link>
          <div className="flex items-start justify-between mt-2 gap-4">
            <h1 className="text-2xl font-bold">{examSet.title}</h1>
            {examSet.isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                className={examSet.is_public ? 'border-green-400 text-green-700 hover:bg-green-50' : 'border-gray-300 text-gray-600'}
              >
                {togglingPublic ? <Loader2 className="w-4 h-4 animate-spin" /> : examSet.is_public ? <><Globe className="w-4 h-4 mr-1" />Công khai</> : <><Lock className="w-4 h-4 mr-1" />Riêng tư</>}
              </Button>
            )}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="outline">{examSet.subject}</Badge>
            <Badge variant="outline">Lớp {examSet.grade}</Badge>
            <Badge variant="outline"><BookOpen className="w-3 h-3 mr-1" />{examSet.total_questions} câu</Badge>
            {examSet.is_public && !examSet.isOwner && <Badge className="bg-green-100 text-green-700 border-0"><Globe className="w-3 h-3 mr-1" />Công khai</Badge>}
          </div>
        </div>

        {/* Score banner */}
        {result && (
          <Card className={`mb-6 ${result.score / result.total >= 0.8 ? 'border-green-400 bg-green-50' : result.score / result.total >= 0.5 ? 'border-yellow-400 bg-yellow-50' : 'border-red-400 bg-red-50'}`}>
            <CardContent className="py-6 text-center">
              <div className="text-5xl font-bold mb-2">{result.score}/{result.total}</div>
              <p className="text-lg text-gray-600">{Math.round((result.score / result.total) * 100)}% đúng</p>
              <p className="text-sm text-gray-500 mt-1">
                {result.score / result.total >= 0.8 ? 'Xuất sắc! Bạn nắm rất vững kiến thức.' :
                  result.score / result.total >= 0.5 ? 'Tốt! Hãy xem lại lời giải các câu sai.' :
                    'Cần cố gắng hơn! Xem lời giải bên dưới để ôn lại nhé.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {!result && mcQuestions.length > 0 && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />Trắc nghiệm: {answered}/{mcQuestions.length}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, index) => {
            const userAnswer = answers[q.id]
            const res = result?.results[q.id]
            const isOpenType = q.type === 'short_answer' || q.type === 'proof'
            const showExpl = openExplanations[q.id]

            return (
              <Card key={q.id} className={
                result && !isOpenType
                  ? res?.correct ? 'border-green-300' : 'border-red-300'
                  : userAnswer ? 'border-indigo-200' : ''
              }>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium leading-relaxed flex-1">
                      <span className="text-indigo-600 font-bold mr-2">Câu {index + 1}.</span>
                      <QuestionText text={q.question_text} />
                    </CardTitle>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge className={`text-xs ${DIFFICULTY_COLOR[q.difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_LABEL[q.type]}</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {q.diagram && (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 flex justify-center">
                      <div dangerouslySetInnerHTML={{ __html: q.diagram }} />
                    </div>
                  )}

                  {q.options && (
                    <div className="space-y-2">
                      {q.options.map(opt => {
                        const isSelected = userAnswer === opt.key
                        const isCorrect = res?.correct_answer === opt.key
                        const isWrong = result && isSelected && !res?.correct
                        let cls = 'w-full text-left px-4 py-3 rounded-lg border transition-colors '
                        if (result) {
                          if (isCorrect) cls += 'bg-green-100 border-green-400 text-green-800'
                          else if (isWrong) cls += 'bg-red-100 border-red-400 text-red-800'
                          else cls += 'bg-white border-gray-200 text-gray-400'
                        } else {
                          cls += isSelected
                            ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                        }
                        return (
                          <button key={opt.key} className={cls} onClick={() => !result && setAnswers(prev => ({ ...prev, [q.id]: opt.key }))} disabled={!!result}>
                            <span className="font-medium mr-2">{opt.key}.</span>{opt.text}
                            {result && isCorrect && <CheckCircle className="inline w-4 h-4 ml-2 text-green-600" />}
                            {result && isWrong && <XCircle className="inline w-4 h-4 ml-2 text-red-600" />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {isOpenType && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">
                        {q.type === 'proof' ? 'Viết lời chứng minh của bạn:' : 'Viết câu trả lời của bạn:'}
                      </p>
                      <Textarea
                        placeholder={q.type === 'proof' ? 'Trình bày các bước chứng minh...' : 'Nhập câu trả lời...'}
                        value={answers[q.id] || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        rows={q.type === 'proof' ? 6 : 3}
                        className="resize-none font-mono text-sm"
                        disabled={!!result}
                      />
                    </div>
                  )}

                  {q.explanation && (
                    <div>
                      <button
                        onClick={() => toggleExplanation(q.id)}
                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Lightbulb className="w-4 h-4" />
                        {showExpl ? 'Ẩn lời giải' : 'Xem lời giải & hướng dẫn'}
                        {showExpl ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showExpl && (
                        <div className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          {result && !isOpenType && (
                            <p className="text-sm font-semibold text-blue-800 mb-1">
                              Đáp án đúng: <span className="text-green-700">{res?.correct_answer}</span>
                            </p>
                          )}
                          <p className="text-sm font-medium text-blue-800 mb-1">Hướng dẫn giải:</p>
                          <p className="text-sm text-blue-700 whitespace-pre-line">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Submit */}
        {!result ? (
          <div className="mt-8 mb-4">
            <Button size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              Nộp bài
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setAnswers({}); setOpenExplanations({}) }}>
              Làm lại
            </Button>
            <Link href="/upload" className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Tạo đề mới</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
