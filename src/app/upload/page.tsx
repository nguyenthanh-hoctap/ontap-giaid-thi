'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { getSubjectsForGrade, Grade } from '@/types'
import { Upload, ImagePlus, Loader2, X, CheckCircle, Circle } from 'lucide-react'
import { toast } from 'sonner'

type ProcessStep = {
  id: string
  label: string
  description: string
  status: 'waiting' | 'running' | 'done' | 'error'
}

const BASE_STEPS: ProcessStep[] = [
  { id: 'upload', label: 'Upload ảnh', description: 'Đang tải ảnh lên máy chủ...', status: 'waiting' },
  { id: 'ocr', label: 'Đọc nội dung', description: 'AI đang đọc và nhận diện chữ trong ảnh...', status: 'waiting' },
  { id: 'generate', label: 'Tạo câu hỏi', description: 'AI đang soạn câu hỏi và đáp án...', status: 'waiting' },
  { id: 'done', label: 'Hoàn thành', description: 'Bộ đề đã sẵn sàng!', status: 'waiting' },
]

const HEIC_CONVERT_STEP: ProcessStep = {
  id: 'convert',
  label: 'Chuyển đổi ảnh iPhone',
  description: 'Đang chuyển ảnh HEIC sang JPEG, có thể mất 10-20 giây...',
  status: 'waiting',
}

export default function UploadPage() {
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState<Grade>(6)
  const [subject, setSubject] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<ProcessStep[]>(BASE_STEPS)
  const [hasHeic, setHasHeic] = useState(false)
  const [duplicates, setDuplicates] = useState<{ id: string; title: string }[]>([])
  const [showDupDialog, setShowDupDialog] = useState(false)

  const subjects = getSubjectsForGrade(grade)

  function setStepStatus(id: string, status: ProcessStep['status']) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  function handleGradeChange(val: string | null) {
    if (!val) return
    setGrade(parseInt(val) as Grade)
    setSubject('')
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    e.target.value = ''
    const files = Array.from(e.target.files || [])

    const validFiles = files.filter(f => {
      const isHeicFile = f.type === 'image/heic' || f.type === 'image/heif' ||
        f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')
      const ok = f.type === 'image/jpeg' || f.type === 'image/png' || isHeicFile
      if (!ok) toast.error(`${f.name}: chỉ chấp nhận JPG, PNG hoặc ảnh iPhone (HEIC)`)
      return ok
    })

    if (images.length + validFiles.length > 5) {
      toast.error('Tối đa 5 ảnh mỗi đề cương')
      return
    }

    const foundHeic = validFiles.some(f =>
      f.type === 'image/heic' || f.type === 'image/heif' ||
      f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')
    )
    setHasHeic(foundHeic)

    setImages(prev => [...prev, ...validFiles])
    setPreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))])
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function checkDuplicates(): Promise<{ id: string; title: string }[]> {
    if (!session?.access_token) return []
    const res = await fetch('/api/exam-sets', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data
      .filter((e: { grade: number; subject: string; title: string; id: string; syllabuses?: { user_id: string } }) =>
        e.grade === grade &&
        e.subject === subject &&
        e.syllabuses?.user_id === user?.id
      )
      .map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !subject || images.length === 0) {
      toast.error('Vui lòng điền đầy đủ thông tin và upload ít nhất 1 ảnh')
      return
    }

    // Kiểm tra trùng lặp trước khi xử lý
    const dups = await checkDuplicates()
    if (dups.length > 0 && !showDupDialog) {
      setDuplicates(dups)
      setShowDupDialog(true)
      return
    }
    setShowDupDialog(false)

    setLoading(true)

    // Nếu có ảnh HEIC thì thêm bước convert vào đầu
    const initialSteps = hasHeic
      ? [HEIC_CONVERT_STEP, ...BASE_STEPS]
      : [...BASE_STEPS]
    setSteps(initialSteps)

    try {
      let filesToUpload = images

      // Bước 0 (nếu có HEIC): Convert sang JPEG
      if (hasHeic) {
        setStepStatus('convert', 'running')
        const heic2any = (await import('heic2any')).default
        const converted: File[] = []
        for (const f of images) {
          const isHeicFile = f.type === 'image/heic' || f.type === 'image/heif' ||
            f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')
          if (isHeicFile) {
            const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob
            converted.push(new File([blob], f.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' }))
          } else {
            converted.push(f)
          }
        }
        filesToUpload = converted
        setStepStatus('convert', 'done')
      }

      // Bước 1: Upload ảnh
      setStepStatus('upload', 'running')
      const imageUrls: string[] = []
      for (const image of filesToUpload) {
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${image.name}`
        const { error } = await supabase.storage.from('syllabuses').upload(fileName, image)
        if (error) throw error
        const { data } = supabase.storage.from('syllabuses').getPublicUrl(fileName)
        imageUrls.push(data.publicUrl)
      }
      setStepStatus('upload', 'done')

      // Tạo syllabus
      const res = await fetch('/api/syllabuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ title, subject, grade, image_urls: imageUrls }),
      })
      const syllabus = await res.json()
      if (!res.ok) throw new Error(syllabus.error)

      // Bước 2: OCR - server sẽ xử lý, mình poll status
      setStepStatus('ocr', 'running')

      // Gọi process API (bao gồm cả OCR + sinh đề)
      // Dùng polling để biết khi nào OCR xong
      const processPromise = fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabus_id: syllabus.id }),
      })

      // Poll trạng thái để chuyển bước UI
      const pollInterval = setInterval(async () => {
        try {
          const r = await fetch(`/api/syllabuses/${syllabus.id}/status`)
          const { status, has_content } = await r.json()
          if (has_content) {
            setStepStatus('ocr', 'done')
            setStepStatus('generate', 'running')
            clearInterval(pollInterval)
          }
          if (status === 'error') clearInterval(pollInterval)
        } catch { clearInterval(pollInterval) }
      }, 3000)

      const processRes = await processPromise
      clearInterval(pollInterval)
      const result = await processRes.json()
      if (!processRes.ok) throw new Error(result.error)

      setStepStatus('ocr', 'done')
      setStepStatus('generate', 'done')
      setStepStatus('done', 'done')

      await new Promise(r => setTimeout(r, 800))
      router.push(`/exam/${result.exam_set_id}`)
    } catch (err) {
      toast.error('Có lỗi xảy ra: ' + String(err))
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
      setLoading(false)
    }
  }

  if (authLoading || !user) return null

  if (loading) {
    const currentStep = steps.find(s => s.status === 'running') || steps.find(s => s.status === 'error')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">Đang tạo bộ đề...</h2>

          <div className="space-y-4 mb-6">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {s.status === 'done' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {s.status === 'running' && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />}
                  {s.status === 'error' && <CheckCircle className="w-5 h-5 text-red-500" />}
                  {s.status === 'waiting' && <Circle className="w-5 h-5 text-gray-300" />}
                </div>
                <div>
                  <p className={`font-medium text-sm ${s.status === 'done' ? 'text-green-700' : s.status === 'running' ? 'text-indigo-700' : s.status === 'error' ? 'text-red-600' : 'text-gray-400'}`}>
                    {s.label}
                  </p>
                  {s.status === 'running' && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  )}
                </div>
                {i < steps.length - 1 && s.status !== 'running' && (
                  <div className="absolute" />
                )}
              </div>
            ))}
          </div>

          {currentStep && (
            <p className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              {currentStep.id === 'convert' && 'Ảnh iPhone (HEIC) cần chuyển sang JPEG trước khi xử lý, vui lòng chờ 10-20 giây...'}
              {currentStep.id === 'upload' && 'Đang tải ảnh lên máy chủ...'}
              {currentStep.id === 'ocr' && 'AI đang đọc và nhận diện nội dung đề cương, mất khoảng 15-20 giây...'}
              {currentStep.id === 'generate' && 'AI đang soạn câu hỏi, đáp án và hướng dẫn, mất khoảng 30-45 giây...'}
            </p>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a href="/" className="text-indigo-600 hover:underline text-sm">← Trang chủ</a>
          <h1 className="text-3xl font-bold mt-2">Upload Đề Cương</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader><CardTitle>Thông tin đề cương</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Tên đề cương</Label>
                <Input id="title" placeholder="VD: Đề cương ôn thi học kỳ 1 Toán lớp 6" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lớp</Label>
                  <Select value={String(grade)} onValueChange={handleGradeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9].map(g => <SelectItem key={g} value={String(g)}>Lớp {g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Môn học</Label>
                  <Select value={subject} onValueChange={v => v && setSubject(v)}>
                    <SelectTrigger><SelectValue placeholder="Chọn môn" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader><CardTitle>Ảnh đề cương (tối đa 5 ảnh)</CardTitle></CardHeader>
            <CardContent>
              <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <ImagePlus className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-gray-500">Nhấp để chọn ảnh hoặc kéo thả vào đây</span>
                <span className="text-sm text-gray-400">JPG, PNG · Ảnh iPhone sẽ tự động chuyển đổi</span>
              </label>
              <input id="image-upload" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" multiple className="hidden" onChange={handleImageSelect} />

              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {previews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`preview ${i}`} className="w-full h-28 object-cover rounded-lg" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {showDupDialog && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="font-semibold text-amber-800 mb-2">
                ⚠️ Bạn đã có {duplicates.length} bộ đề {subject} lớp {grade}:
              </p>
              <ul className="text-sm text-amber-700 mb-3 space-y-1">
                {duplicates.map(d => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span>•</span>
                    <a href={`/exam/${d.id}`} target="_blank" className="underline hover:text-amber-900">{d.title}</a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-amber-700 mb-3">Bạn vẫn muốn tạo thêm bộ đề mới không?</p>
              <div className="flex gap-2">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setShowDupDialog(false); handleSubmit({ preventDefault: () => {} } as React.FormEvent) }}>
                  Tạo thêm bộ đề mới
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowDupDialog(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700">
            <Upload className="w-5 h-5 mr-2" />
            Tạo bộ đề ngay
          </Button>
        </form>
      </div>
    </div>
  )
}
