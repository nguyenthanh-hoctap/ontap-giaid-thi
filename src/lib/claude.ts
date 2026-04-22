import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { Question } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const JSON_FORMAT = `CHỈ trả về JSON array thuần túy, KHÔNG markdown, bắt đầu bằng [ kết thúc bằng ].
Mỗi phần tử: {"order_number":1,"type":"multiple_choice","question_text":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_answer":"A","explanation":"giải thích chi tiết","difficulty":"easy","diagram":null}
- short_answer/proof: options là null, correct_answer là đáp án/các bước chứng minh đầy đủ
- true_false: options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- diagram: SVG string nếu câu liên quan hình học (viewBox="0 0 300 200", width="300", height="200", có nhãn điểm A/B/C, stroke="#1e293b"), null nếu không`

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

- Mỗi câu hình học PHẢI có diagram SVG
${JSON_FORMAT}`)

  // Lần 3: CHỨNG MINH tam giác (riêng để đảm bảo có)
  const batch3Promise = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ĐÚNG 2 câu chứng minh tam giác, type PHẢI là "proof".

ĐỀ CƯƠNG:
${content}

Mỗi câu proof:
- question_text: nêu đầy đủ bài toán (cho biết gì, cần chứng minh gì)
- correct_answer: các bước chứng minh chi tiết
- explanation: hướng dẫn giải từng bước
- diagram: SVG vẽ hình tam giác có nhãn điểm
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
