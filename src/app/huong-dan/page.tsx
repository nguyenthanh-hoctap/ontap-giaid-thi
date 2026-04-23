import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  UserPlus, Upload, Brain, BookOpen, Eye, Globe, Trash2,
  Camera, FileImage, ChevronRight, CheckCircle, AlertCircle
} from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    title: 'Đăng ký & đăng nhập',
    color: 'bg-violet-100 text-violet-600',
    content: [
      'Vào trang Đăng ký, điền họ tên, email và mật khẩu.',
      'Sau khi đăng ký sẽ tự động đăng nhập vào hệ thống.',
      'Nếu đã có tài khoản, chọn Đăng nhập ở góc trên bên phải.',
      'Quên mật khẩu? Dùng chức năng "Gửi link đặt lại mật khẩu" ở trang đăng nhập.',
    ],
  },
  {
    icon: Camera,
    title: 'Chụp ảnh đề cương',
    color: 'bg-blue-100 text-blue-600',
    content: [
      'Chụp rõ nét toàn bộ nội dung đề cương, tối đa 5 ảnh mỗi lần.',
      'Hỗ trợ JPG, PNG và ảnh iPhone (HEIC — tự động chuyển đổi).',
      'Đảm bảo chữ đọc được, không bị mờ, không bị che khuất.',
      'Nhiều trang đề cương? Upload tất cả cùng lúc để AI đọc toàn bộ.',
    ],
  },
  {
    icon: Upload,
    title: 'Tạo bộ đề mới',
    color: 'bg-indigo-100 text-indigo-600',
    content: [
      'Vào trang "Tạo đề mới", điền tên đề cương, chọn Lớp và Môn học.',
      'Tải ảnh đề cương lên (kéo thả hoặc nhấp chọn ảnh).',
      'Nhấn "Tạo bộ đề ngay" — AI sẽ xử lý trong khoảng 30–60 giây.',
      'Hệ thống tự động nhận diện chữ viết và sinh 20 câu hỏi phù hợp.',
    ],
  },
  {
    icon: Brain,
    title: 'AI tạo đề theo từng môn',
    color: 'bg-emerald-100 text-emerald-600',
    content: [
      'Toán: câu đại số, hình học (có hình vẽ SVG) và chứng minh.',
      'Tiếng Anh: ngữ pháp, từ vựng, đọc hiểu — câu hỏi bằng tiếng Anh.',
      'Ngữ Văn / Tiếng Việt: đọc hiểu tác phẩm, ngữ pháp thực hành.',
      'Khoa Học Tự Nhiên: lý thuyết khái niệm và vận dụng thực tế.',
      'Các môn khác: câu nhận biết, thông hiểu và vận dụng.',
    ],
  },
  {
    icon: BookOpen,
    title: 'Luyện tập bộ đề',
    color: 'bg-amber-100 text-amber-600',
    content: [
      'Mở bộ đề, đọc từng câu hỏi và chọn đáp án.',
      'Nhấn "Xem đáp án" để hiện đáp án đúng và giải thích chi tiết.',
      'Câu trắc nghiệm, đúng/sai, tự luận và chứng minh đều có hướng dẫn giải.',
      'Câu hình học có hình vẽ minh họa kèm theo.',
    ],
  },
  {
    icon: Eye,
    title: 'Xem & quản lý bộ đề',
    color: 'bg-cyan-100 text-cyan-600',
    content: [
      'Trang "Bộ đề của bạn" liệt kê tất cả đề đã tạo.',
      'Lọc nhanh theo lớp hoặc theo môn học.',
      'Mặc định đề chỉ mình bạn xem được (riêng tư).',
      'Bật "Công khai" để chia sẻ bộ đề với mọi người.',
      'Nhấn icon thùng rác (hover vào đề) để xóa bộ đề không cần nữa.',
    ],
  },
]

const subjects = [
  { name: 'Toán', grades: '1–9', color: 'bg-blue-100 text-blue-700' },
  { name: 'Tiếng Việt', grades: '1–5', color: 'bg-rose-100 text-rose-700' },
  { name: 'Tiếng Anh', grades: '1–9', color: 'bg-green-100 text-green-700' },
  { name: 'Ngữ Văn', grades: '6–9', color: 'bg-purple-100 text-purple-700' },
  { name: 'Khoa Học Tự Nhiên', grades: '6–9', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Vật Lý', grades: '6–9', color: 'bg-sky-100 text-sky-700' },
  { name: 'Hóa Học', grades: '6–9', color: 'bg-orange-100 text-orange-700' },
  { name: 'Sinh Học', grades: '6–9', color: 'bg-lime-100 text-lime-700' },
  { name: 'Lịch Sử', grades: '6–9', color: 'bg-amber-100 text-amber-700' },
  { name: 'Địa Lý', grades: '6–9', color: 'bg-teal-100 text-teal-700' },
  { name: 'GDCD', grades: '6–9', color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Tự nhiên và Xã hội', grades: '1–5', color: 'bg-cyan-100 text-cyan-700' },
  { name: 'Đạo đức', grades: '1–5', color: 'bg-pink-100 text-pink-700' },
]

const tips = [
  { icon: CheckCircle, color: 'text-green-500', text: 'Ảnh chụp rõ, đủ sáng, chữ không bị nghiêng quá 30° sẽ cho kết quả tốt nhất.' },
  { icon: CheckCircle, color: 'text-green-500', text: 'Nếu đề cương nhiều trang, upload đủ tất cả để AI bao quát toàn bộ kiến thức.' },
  { icon: CheckCircle, color: 'text-green-500', text: 'Tên đề cương nên ghi rõ: "Đề cương HK1 Toán lớp 7" để dễ tìm lại sau.' },
  { icon: AlertCircle, color: 'text-amber-500', text: 'AI mất khoảng 30–60 giây để xử lý — vui lòng không tắt trang trong lúc chờ.' },
  { icon: AlertCircle, color: 'text-amber-500', text: 'Đề tạo ra mang tính tham khảo, nên kiểm tra lại đáp án với giáo viên khi cần.' },
]

export default function HuongDanPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hướng dẫn sử dụng</h1>
          <p className="text-gray-500">Từ đề cương đến bộ đề luyện tập chỉ trong vài bước</p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-10">
          {steps.map((step, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <div className={`p-2 rounded-lg ${step.color}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className="text-gray-400 font-normal text-sm">Bước {i + 1}</span>
                  <span>{step.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {step.content.map((line, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      {line}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Supported subjects */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Môn học & lớp được hỗ trợ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <div key={s.name} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.color}`}>
                  {s.name}
                  <span className="text-xs opacity-60">lớp {s.grades}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base">Mẹo để có bộ đề chất lượng tốt</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <tip.icon className={`w-4 h-4 shrink-0 mt-0.5 ${tip.color}`} />
                  {tip.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center">
          <Link href="/upload">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-10">
              <Upload className="w-5 h-5 mr-2" />
              Bắt đầu tạo đề ngay
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
