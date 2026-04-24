import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

export async function POST(req: NextRequest) {
  const { question_text, subject, grade, type } = await req.json()
  if (!question_text) return NextResponse.json({ error: 'Missing question_text' }, { status: 400 })

  const teacher = grade % 2 === 0 ? 'Thầy' : 'Cô'
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', safetySettings: SAFETY_SETTINGS })

  const prompt = `Bạn là ${teacher} dạy môn ${subject || ''} lớp ${grade || ''}. Hãy giải chi tiết bài sau cho học sinh.
${type === 'proof' ? 'Đây là bài chứng minh, trình bày đầy đủ các bước.' : ''}

BÀI TOÁN:
${question_text}

QUY TẮC TRÌNH BÀY (bắt buộc):
- Xưng "${teacher}", gọi học sinh là "em"
- Đánh số bước: "Bước 1:", "Bước 2:", ...
- KHÔNG dùng ký hiệu *, **, $, #, - để định dạng
- KHÔNG dùng markdown, chỉ dùng chữ thuần túy
- Xuống dòng giữa các bước
- Kết thúc bằng "Vậy, kết quả là: ..."
- Dùng tiếng Việt xuyên suốt`

  const result = await model.generateContent(prompt)
  const solution = result.response.text()
  return NextResponse.json({ solution })
}
