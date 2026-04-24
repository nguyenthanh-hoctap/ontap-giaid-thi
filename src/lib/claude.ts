import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { Question } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const JSON_FORMAT = `CHỈ trả về JSON array thuần túy, KHÔNG markdown, bắt đầu bằng [ kết thúc bằng ].
Mỗi phần tử: {"order_number":1,"type":"multiple_choice","question_text":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_answer":"A","explanation":"giải thích chi tiết","difficulty":"easy","diagram":null}
- short_answer/proof: options là null, correct_answer là đáp án/các bước chứng minh đầy đủ
- true_false: options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- diagram: luôn để null`

async function callClaude(prompt: string): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  console.log('[callClaude] stop_reason:', message.stop_reason, '| response length:', text.length)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) {
    console.log('[callClaude] No JSON array found. Full response:', text.slice(0, 1000))
    return []
  }
  try {
    const repaired = jsonrepair(text.slice(start, end + 1))
    return JSON.parse(repaired)
  } catch (e) {
    console.log('[callClaude] JSON parse failed:', e)
    console.log('[callClaude] Raw JSON slice (first 500):', text.slice(start, start + 500))
    return []
  }
}

const EXTRACT_RULES = (subject: string) => {
  if (subject === 'Toán') {
    return `- Câu trắc nghiệm 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- Câu tự luận/tính toán ngắn: type="short_answer", options=null
- Câu chứng minh hình học: type="proof", options=null`
  }
  if (subject === 'Tiếng Anh') {
    return `- BỎ QUA hoàn toàn phần LISTENING / NGHE (Section Listening, Part Listening, câu nghe audio...) vì không có file âm thanh
- Chỉ trích xuất: Reading, Grammar, Vocabulary, Writing, Speaking/câu văn viết
- Câu trắc nghiệm: type="multiple_choice"
- Câu đúng/sai (True/False): type="true_false", options=[{"key":"A","text":"True"},{"key":"B","text":"False"}]
- Câu điền từ/tự luận ngắn: type="short_answer", options=null
- Giữ nguyên tiếng Anh cho question_text và options, explanation viết tiếng Việt
- QUAN TRỌNG — Đoạn văn / đoạn hội thoại đọc hiểu (reading passage, dialogue):
  Đưa TOÀN BỘ đoạn văn vào đầu question_text của câu hỏi ĐẦU TIÊN trong nhóm, định dạng:
  "[PASSAGE]\n{toàn bộ đoạn văn}\n[/PASSAGE]\n\n{câu hỏi}"
  Các câu tiếp theo trong cùng nhóm KHÔNG lặp lại [PASSAGE], chỉ ghi nội dung câu hỏi bình thường`
  }
  return `- Câu trắc nghiệm 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- Câu tự luận/ngắn: type="short_answer", options=null`
}

export async function extractExamQuestions(
  content: string,
  subject: string,
  grade: number,
): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const prompt = `Bạn là giáo viên ${subject} lớp ${grade}. Dưới đây là nội dung đề thi được trích xuất từ ảnh.

NHIỆM VỤ: Trích xuất TẤT CẢ câu hỏi có trong đề, ĐÚNG số lượng, ĐÚNG nội dung — KHÔNG thêm, KHÔNG bớt, KHÔNG thay đổi câu hỏi.

NỘI DUNG ĐỀ THI:
${content}

QUY TẮC TRÍCH XUẤT:
${EXTRACT_RULES(subject)}
- difficulty: dựa vào mức độ câu hỏi — "easy" (nhận biết), "medium" (thông hiểu), "hard" (vận dụng)
- correct_answer: điền đáp án đúng dựa trên kiến thức ${subject} lớp ${grade}; nếu đề có ghi đáp án thì dùng đáp án đó
- explanation: giải thích ngắn gọn tại sao đó là đáp án đúng
- Giữ nguyên số thứ tự câu như trong đề cho order_number

${JSON_FORMAT}`

  const raw = await callClaude(prompt)
  return raw
    .filter(q => q.question_text && q.correct_answer)
    .map((q, i) => ({ ...q, order_number: i + 1 }))
}
