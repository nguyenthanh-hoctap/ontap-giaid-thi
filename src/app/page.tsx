import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Upload, Brain, Trophy } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-4 rounded-2xl">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tạo Đề Thi Thông Minh
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Chụp ảnh đề cương ôn thi — AI tự động tạo bộ đề, hướng dẫn giải chi tiết cho học sinh lớp 1 đến lớp 9
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/upload">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-lg px-8 py-6">
                Tạo đề mới
              </Button>
            </Link>
            <Link href="/exams">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Xem đề đã tạo
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <Upload className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Upload đề cương</h3>
              <p className="text-gray-500 text-sm">Chụp ảnh hoặc tải lên file đề cương bất kỳ môn học nào</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <Brain className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">AI tạo đề tự động</h3>
              <p className="text-gray-500 text-sm">20 câu hỏi phân loại theo độ khó, có đáp án và giải thích</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <Trophy className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Luyện tập & chấm điểm</h3>
              <p className="text-gray-500 text-sm">Làm bài trực tiếp, xem điểm số và phân tích kết quả ngay lập tức</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
