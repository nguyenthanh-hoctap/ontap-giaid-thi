import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { Question } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SVG_RULES = `
QUY TẮC VẼ HÌNH SVG (bắt buộc tuân theo):
- viewBox="0 0 300 260" width="300" height="260"
- Vùng vẽ an toàn: x từ 30 đến 270, y từ 30 đến 230
- Màu nét: stroke="#1e293b" stroke-width="2" fill="none"
- Nhãn điểm: font-size="15" font-family="serif" font-style="italic" fill="#1e293b"
- Nhãn phải cách điểm 10-15px ra ngoài hình (không đè lên nét)
- Số đo độ dài/góc: font-size="12" fill="#6b7280"

TEMPLATE tam giác thường ABC (copy và điều chỉnh tọa độ cho phù hợp đề):
<svg viewBox="0 0 300 260" width="300" height="260" xmlns="http://www.w3.org/2000/svg">
  <polygon points="150,40 40,220 260,220" fill="none" stroke="#1e293b" stroke-width="2"/>
  <text x="143" y="28" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="22" y="235" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="264" y="235" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
</svg>

TEMPLATE tam giác vuông tại B:
<svg viewBox="0 0 300 260" width="300" height="260" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,220 60,50 260,220" fill="none" stroke="#1e293b" stroke-width="2"/>
  <rect x="60" y="205" width="15" height="15" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <text x="35" y="50" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="35" y="240" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="265" y="240" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
</svg>

Khi vẽ đường cao, trung tuyến, phân giác: tính toán tọa độ chính xác từ tọa độ đỉnh.
Khi có điểm trên cạnh (M trên BC): đặt tọa độ M đúng trên đoạn thẳng BC.`

const JSON_FORMAT = `CHỈ trả về JSON array thuần túy, KHÔNG markdown, bắt đầu bằng [ kết thúc bằng ].
Mỗi phần tử: {"order_number":1,"type":"multiple_choice","question_text":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_answer":"A","explanation":"giải thích chi tiết","difficulty":"easy","diagram":null}
- short_answer/proof: options là null, correct_answer là đáp án/các bước chứng minh đầy đủ
- true_false: options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- diagram: SVG string nếu câu liên quan hình học (tuân theo QUY TẮC VẼ HÌNH SVG bên trên), null nếu không`

async function callClaude(prompt: string): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  const repaired = jsonrepair(text.slice(start, end + 1))
  return JSON.parse(repaired)
}

export async function generateExamQuestions(
  content: string,
  subject: string,
  grade: number,
  count = 20
): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const half = Math.ceil(count / 2)

  // Lần 1: câu hỏi cho các chủ đề KHÔNG phải hình học/chứng minh
  const batch1Promise = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi cho các chủ đề ĐẠI SỐ, XÁC SUẤT, THỐNG KÊ (KHÔNG tạo câu về hình học hay chứng minh hình học).

ĐỀ CƯƠNG:
${content}

Loại câu: mix multiple_choice, true_false, short_answer. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  // Lần 2: câu hỏi HÌNH HỌC trắc nghiệm/ngắn
  const batch2Promise = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${count - half - 2} câu hỏi multiple_choice và short_answer về HÌNH HỌC.

ĐỀ CƯƠNG:
${content}

${SVG_RULES}

- Mỗi câu hình học PHẢI có diagram SVG chính xác theo quy tắc trên
${JSON_FORMAT}`)

  // Lần 3: CHỨNG MINH tam giác (riêng để đảm bảo có)
  const batch3Promise = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ĐÚNG 2 câu chứng minh tam giác, type PHẢI là "proof".

ĐỀ CƯƠNG:
${content}

${SVG_RULES}

Mỗi câu proof:
- question_text: nêu đầy đủ bài toán (cho biết gì, cần chứng minh gì)
- correct_answer: các bước chứng minh chi tiết
- explanation: hướng dẫn giải từng bước
- diagram: SVG vẽ hình tam giác chính xác theo quy tắc trên
- options: null
- difficulty: "hard"

${JSON_FORMAT}`)

  const [batch1, batch2, batch3] = await Promise.all([batch1Promise, batch2Promise, batch3Promise])

  // Gộp lại, đánh lại order_number
  const all = [...batch1, ...batch2, ...batch3]
    .filter(q => q.question_text && q.correct_answer)
    .map((q, i) => ({ ...q, order_number: i + 1 }))

  return all
}
