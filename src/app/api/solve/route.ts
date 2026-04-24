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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings: SAFETY_SETTINGS })

  const prompt = `Bạn là ${teacher} dạy môn ${subject || ''} lớp ${grade || ''}. Giải ngắn gọn bài sau cho học sinh.
${type === 'proof' ? 'Đây là bài chứng minh.' : ''}

BÀI TOÁN:
${question_text}

QUY TẮC:
- Xưng "${teacher}", gọi học sinh là "em"
- Giải NGẮN GỌN, súc tích — chỉ ghi các bước chính, không giải thích dài dòng
- Đánh số bước nếu có nhiều hơn 2 bước
- KHÔNG dùng ký hiệu *, **, $, #, - để định dạng, KHÔNG markdown
- Kết thúc bằng "Vậy: ..."
- Tiếng Việt`

  const result = await model.generateContent(prompt)
  const solution = result.response.text()
  return NextResponse.json({ solution })
}
