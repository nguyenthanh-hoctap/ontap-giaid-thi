import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'
import { Question } from '@/types'
import { prepareImageParts } from './gemini'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

const JSON_FORMAT = `CHỈ trả về JSON array thuần túy, KHÔNG markdown, bắt đầu bằng [ kết thúc bằng ].
Mỗi phần tử: {"order_number":1,"type":"multiple_choice","question_text":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correct_answer":"A","explanation":"giải thích chi tiết","difficulty":"easy","diagram":null}
- short_answer/proof: options là null, correct_answer là đáp án/các bước chứng minh đầy đủ
- true_false: options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- diagram: nếu câu có hình vẽ trong ảnh, trả về {"bbox":[ymin,xmin,ymax,xmax],"image_index":0} với tọa độ 0-1000. Nếu không có hình thì null.`

function parseGeminiResponse(text: string): Omit<Question, 'id' | 'exam_set_id'>[] {
  console.log('[callGemini] response length:', text.length)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) {
    console.log('[callGemini] No JSON array found. Full response:', text.slice(0, 1000))
    return []
  }
  try {
    const repaired = jsonrepair(text.slice(start, end + 1))
    return JSON.parse(repaired)
  } catch (e) {
    console.log('[callGemini] JSON parse failed:', e)
    console.log('[callGemini] Raw JSON slice (first 500):', text.slice(start, start + 500))
    return []
  }
}

const EXTRACT_RULES = (subject: string) => {
  if (subject === 'Toán') {
    return `- Câu trắc nghiệm 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- Câu tự luận/tính toán ngắn: type="short_answer", options=null
- Câu chứng minh hình học: type="proof", options=null
- Câu CÓ HÌNH VẼ trong ảnh: diagram={"bbox":[ymin,xmin,ymax,xmax],"image_index":số_thứ_tự_ảnh_0_based} tọa độ 0-1000`
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

function buildPrompt(subject: string, grade: number, content?: string) {
  return `Bạn là giáo viên ${subject} lớp ${grade}. ${content ? 'Dưới đây là nội dung đề thi được trích xuất từ ảnh.' : 'Nhìn vào các ảnh đề thi bên trên.'}

NHIỆM VỤ: Trích xuất TẤT CẢ câu hỏi có trong đề, ĐÚNG số lượng, ĐÚNG nội dung — KHÔNG thêm, KHÔNG bớt, KHÔNG thay đổi câu hỏi.
${content ? `\nNỘI DUNG ĐỀ THI:\n${content}\n` : ''}
QUY TẮC TRÍCH XUẤT:
${EXTRACT_RULES(subject)}
- difficulty: dựa vào mức độ câu hỏi — "easy" (nhận biết), "medium" (thông hiểu), "hard" (vận dụng)
- correct_answer: điền đáp án đúng dựa trên kiến thức ${subject} lớp ${grade}; nếu đề có ghi đáp án thì dùng đáp án đó; với câu short_answer/proof thì viết LỜI GIẢI CHI TIẾT từng bước
- explanation: giải thích CHI TIẾT từng bước tại sao đó là đáp án đúng, kèm công thức và tính toán cụ thể
- Giữ nguyên số thứ tự câu như trong đề cho order_number

${JSON_FORMAT}`
}

export async function extractExamQuestionsFromImages(
  imageUrls: string[],
  subject: string,
  grade: number,
): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { maxOutputTokens: 16000 } as never,
    safetySettings: SAFETY_SETTINGS,
  })
  const imageParts = await prepareImageParts(imageUrls)
  const result = await model.generateContent([
    ...imageParts,
    { text: buildPrompt(subject, grade) + `\n\nLƯU Ý QUAN TRỌNG:
- Xử lý TẤT CẢ ${imageUrls.length} ảnh, không bỏ sót câu nào
- Mỗi câu PHẢI có đầy đủ correct_answer và explanation
- Nếu câu có hình vẽ hình học trong ảnh: diagram={"bbox":[ymin,xmin,ymax,xmax],"image_index":0} tọa độ 0-1000, KHÔNG sinh SVG` },
  ])
  const raw = parseGeminiResponse(result.response.text())
  return raw
    .filter(q => q.question_text && q.correct_answer)
    .map((q, i) => ({ ...q, order_number: i + 1 }))
}

export async function extractExamQuestions(
  content: string,
  subject: string,
  grade: number,
): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', safetySettings: SAFETY_SETTINGS })
  const result = await model.generateContent(buildPrompt(subject, grade, content))
  const raw = parseGeminiResponse(result.response.text())
  return raw
    .filter(q => q.question_text && q.correct_answer)
    .map((q, i) => ({ ...q, order_number: i + 1 }))
}
