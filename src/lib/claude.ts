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

const SUBCHOICE_RULE = `- Câu có nhiều phần con (a, b, c, d, ...): tách thành NHIỀU phần tử JSON, mỗi phần con = 1 câu trắc nghiệm riêng
  + Phần con ĐẦU TIÊN: question_text = "[STEM]\n{toàn bộ đề bài gốc}\n[/STEM]\n\n{câu hỏi phần a}"
  + Các phần con TIẾP THEO: question_text chỉ ghi nội dung câu hỏi phần đó thôi (không lặp lại đề gốc)
  + Mỗi phần con là 1 câu trắc nghiệm 4 đáp án độc lập`

const EXTRACT_RULES = (subject: string) => {
  const diagramRule = `- Câu CÓ HÌNH VẼ trong ảnh: diagram={"bbox":[ymin,xmin,ymax,xmax],"image_index":số_thứ_tự_ảnh_0_based} tọa độ 0-1000`
  const mcRule = `- ƯU TIÊN chuyển câu tự luận/tính toán thành trắc nghiệm 4 đáp án (tạo 3 đáp án sai hợp lý): type="multiple_choice"
- Chỉ dùng short_answer nếu câu YÊU CẦU TRÌNH BÀY lời giải (chứng minh, giải phương trình nhiều bước)`
  if (subject === 'Toán') {
    return `${mcRule}
${SUBCHOICE_RULE}
- Câu trắc nghiệm sẵn 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- Câu chứng minh hình học bắt buộc trình bày: type="proof", options=null
${diagramRule}`
  }
  if (subject === 'Tiếng Anh') {
    return `- BỎ QUA hoàn toàn phần LISTENING / NGHE (Section Listening, Part Listening, câu nghe audio...) vì không có file âm thanh
- Chỉ trích xuất: Reading, Grammar, Vocabulary, Writing, Speaking/câu văn viết
- Câu trắc nghiệm: type="multiple_choice"
- Câu đúng/sai (True/False): type="true_false", options=[{"key":"A","text":"True"},{"key":"B","text":"False"}]
- Câu điền từ/tự luận ngắn: type="short_answer", options=null
- Giữ nguyên tiếng Anh cho question_text và options, explanation viết tiếng Việt
${SUBCHOICE_RULE}
- QUAN TRỌNG — Đoạn văn / đoạn hội thoại đọc hiểu (reading passage, dialogue):
  Đưa TOÀN BỘ đoạn văn vào đầu question_text của câu hỏi ĐẦU TIÊN trong nhóm, định dạng:
  "[PASSAGE]\n{toàn bộ đoạn văn}\n[/PASSAGE]\n\n{câu hỏi}"
  Các câu tiếp theo trong cùng nhóm KHÔNG lặp lại [PASSAGE], chỉ ghi nội dung câu hỏi bình thường`
  }
  return `${mcRule}
${SUBCHOICE_RULE}
- Câu trắc nghiệm sẵn 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]`
}

function buildPrompt(subject: string, grade: number, content?: string) {
  return `Bạn là giáo viên ${subject} lớp ${grade}. ${content ? 'Dưới đây là nội dung đề thi được trích xuất từ ảnh.' : 'Nhìn vào các ảnh đề thi bên trên.'}

NHIỆM VỤ: Trích xuất TẤT CẢ câu hỏi có trong đề, ĐÚNG số lượng, ĐÚNG nội dung — KHÔNG thêm, KHÔNG bớt, KHÔNG thay đổi câu hỏi.
${content ? `\nNỘI DUNG ĐỀ THI:\n${content}\n` : ''}
QUY TẮC TRÍCH XUẤT:
${EXTRACT_RULES(subject)}
- difficulty: dựa vào mức độ câu hỏi — "easy" (nhận biết), "medium" (thông hiểu), "hard" (vận dụng)
- correct_answer: KHÔNG được để trống — điền đáp án đúng theo kiến thức ${subject} lớp ${grade}; đề có ghi thì dùng đáp án đó; short_answer/proof thì viết lời giải từng bước
- explanation: KHÔNG được để trống — giải thích tại sao đáp án đúng, kèm công thức/tính toán; BẮT BUỘC cho MỌI câu kể cả câu cuối
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
    safetySettings: SAFETY_SETTINGS,
  })
  const imageParts = await prepareImageParts(imageUrls)
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [...imageParts, { text: buildPrompt(subject, grade) + `\n\nBẮT BUỘC: Đếm và liệt kê TẤT CẢ câu hỏi có trong ${imageUrls.length} ảnh — KHÔNG được bỏ sót bất kỳ câu nào. Mỗi câu PHẢI có correct_answer và explanation. Nếu câu có hình vẽ: diagram={"bbox":[ymin,xmin,ymax,xmax],"image_index":số_ảnh} tọa độ 0-1000, KHÔNG sinh SVG.` }] }],
    generationConfig: { maxOutputTokens: 16000 },
  })
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
