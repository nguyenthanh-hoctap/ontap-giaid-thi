import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { Question } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SVG_RULES = `
QUY TẮC VẼ HÌNH SVG (bắt buộc tuân theo):
- viewBox="0 0 360 300" width="360" height="300"
- Vùng vẽ an toàn: x từ 30 đến 330, y từ 20 đến 280
- Màu nét: stroke="#1e293b" stroke-width="2" fill="none"
- Nhãn điểm: font-size="15" font-family="serif" font-style="italic" fill="#1e293b"
- Nhãn phải cách điểm 10-15px ra ngoài hình (không đè lên nét)
- Số đo độ dài/góc: font-size="11" fill="#6b7280"

NGUYÊN TẮC HÌNH HỌC CHÍNH XÁC (bắt buộc):
1. "Vuông tại X" = hai cạnh xuất phát từ X phải VUÔNG GÓC THẬT SỰ (tích vô hướng = 0)
   - Vuông tại A: AB thẳng đứng (x_A=x_B), AC nằm ngang (y_A=y_C)
   - Vuông tại B: BA thẳng đứng (x_B=x_A), BC nằm ngang (y_B=y_C)
   - Vuông tại C: CB thẳng đứng (x_C=x_B), CA nằm ngang (y_C=y_A)
2. Dấu góc vuông: ô vuông nhỏ 10px tại đỉnh vuông, dùng <polyline> 3 điểm dọc theo 2 cạnh vuông góc
3. Điểm D trên BC với BD=BA: tính t=BA/BC, D = B + t*(C-B)
4. Đường thẳng vuông góc với BC tại D: hướng pháp tuyến = (-dy, dx) chuẩn hóa từ (dx,dy)=C-B
5. Giao điểm đường thẳng với cạnh: dùng công thức giao 2 đoạn thẳng (tham số t)
6. TÍNH TỌA ĐỘ TRƯỚC rồi mới viết SVG — không đặt tọa độ ước lệ

TEMPLATE tam giác thường ABC:
<svg viewBox="0 0 360 300" width="360" height="300" xmlns="http://www.w3.org/2000/svg">
  <polygon points="180,30 50,270 310,270" fill="none" stroke="#1e293b" stroke-width="2"/>
  <text x="173" y="20" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="32" y="288" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="314" y="288" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
</svg>

TEMPLATE tam giác vuông tại A (AB thẳng đứng, AC nằm ngang):
<!-- A=(80,80), B=(80,260), C=(290,80) -->
<svg viewBox="0 0 360 300" width="360" height="300" xmlns="http://www.w3.org/2000/svg">
  <polygon points="80,80 80,260 290,80" fill="none" stroke="#1e293b" stroke-width="2"/>
  <!-- Dấu góc vuông tại A: bước 12px dọc AB (xuống) và dọc AC (sang phải) -->
  <polyline points="80,92 92,92 92,80" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <text x="62" y="80" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="62" y="275" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="294" y="80" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
</svg>

TEMPLATE tam giác vuông tại B (BA thẳng đứng, BC nằm ngang):
<!-- A=(70,50), B=(70,250), C=(280,250) -->
<svg viewBox="0 0 360 300" width="360" height="300" xmlns="http://www.w3.org/2000/svg">
  <polygon points="70,50 70,250 280,250" fill="none" stroke="#1e293b" stroke-width="2"/>
  <!-- Dấu góc vuông tại B -->
  <polyline points="70,235 85,235 85,250" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <text x="52" y="50" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="52" y="268" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="284" y="268" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
</svg>

VÍ DỤ: Tam giác ABC vuông tại A, D trên BC với BD=BA, DM⊥BC tại D cắt AC tại M cắt tia BA tại N:
<!-- A=(90,100), B=(90,270), C=(280,100) → AB=170(thẳng đứng), AC=190(nằm ngang) ✓ vuông tại A -->
<!-- BD=BA=170, BC=sqrt(190²+170²)≈254.8, t=170/254.8≈0.667 → D=B+t*(C-B)=(217,157) -->
<!-- Hướng BC=(190,-170), pháp tuyến=(170,190) chuẩn hóa. Đường DM: qua D theo pháp tuyến -->
<!-- Giao với AC (y=100): N=(90,15) trên tia BA, M=(166,100) trên AC -->
<svg viewBox="0 0 360 300" width="360" height="300" xmlns="http://www.w3.org/2000/svg">
  <polygon points="90,100 90,270 280,100" fill="none" stroke="#1e293b" stroke-width="2"/>
  <polyline points="90,112 102,112 102,100" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <line x1="90" y1="15" x2="217" y2="157" stroke="#3b82f6" stroke-width="1.8"/>
  <!-- Dấu góc vuông tại D theo hướng BC -->
  <polyline points="224,150 231,157 224,164" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <circle cx="90" cy="100" r="2.5" fill="#1e293b"/><circle cx="90" cy="270" r="2.5" fill="#1e293b"/>
  <circle cx="280" cy="100" r="2.5" fill="#1e293b"/><circle cx="217" cy="157" r="2.5" fill="#1e293b"/>
  <circle cx="166" cy="100" r="2.5" fill="#1e293b"/><circle cx="90" cy="15" r="2.5" fill="#1e293b"/>
  <text x="73" y="100" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">A</text>
  <text x="73" y="277" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">B</text>
  <text x="284" y="100" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">C</text>
  <text x="222" y="165" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">D</text>
  <text x="162" y="92" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">M</text>
  <text x="73" y="15" font-size="15" font-family="serif" font-style="italic" fill="#1e293b">N</text>
</svg>

Khi vẽ đường cao, trung tuyến, phân giác: tính toán tọa độ chính xác từ tọa độ đỉnh.
Khi có điểm trên cạnh (M trên BC): đặt tọa độ M đúng trên đoạn thẳng BC bằng tham số t.`

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

async function generateForMath(content: string, grade: number, count: number) {
  const half = Math.ceil(count / 2)

  const batch1Promise = callClaude(`Bạn là giáo viên Toán lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi cho các chủ đề ĐẠI SỐ, XÁC SUẤT, THỐNG KÊ (KHÔNG tạo câu về hình học hay chứng minh hình học).

ĐỀ CƯƠNG:
${content}

Loại câu: mix multiple_choice, true_false, short_answer. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  const batch2Promise = callClaude(`Bạn là giáo viên Toán lớp ${grade}. Từ đề cương sau, tạo ${count - half - 2} câu hỏi multiple_choice và short_answer về HÌNH HỌC.

ĐỀ CƯƠNG:
${content}

${SVG_RULES}

- Mỗi câu hình học PHẢI có diagram SVG chính xác theo quy tắc trên
${JSON_FORMAT}`)

  const batch3Promise = callClaude(`Bạn là giáo viên Toán lớp ${grade}. Từ đề cương sau, tạo ĐÚNG 2 câu chứng minh tam giác, type PHẢI là "proof".

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

  const [b1, b2, b3] = await Promise.all([batch1Promise, batch2Promise, batch3Promise])
  return [...b1, ...b2, ...b3]
}

async function generateForEnglish(content: string, grade: number, count: number) {
  const half = Math.ceil(count / 2)
  const b1 = callClaude(`Bạn là giáo viên Tiếng Anh lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi về NGỮ PHÁP và TỪ VỰNG (grammar, vocabulary, sentence structure).

ĐỀ CƯƠNG:
${content}

Loại câu: multiple_choice. Viết câu hỏi và đáp án bằng tiếng Anh, explanation bằng tiếng Việt. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  const b2 = callClaude(`Bạn là giáo viên Tiếng Anh lớp ${grade}. Từ đề cương sau, tạo ${count - half} câu hỏi về KỸ NĂNG ĐỌC HIỂU và VẬN DỤNG (reading comprehension, fill-in-the-blank, error correction).

ĐỀ CƯƠNG:
${content}

Loại câu: mix multiple_choice, true_false, short_answer. Câu hỏi và đáp án bằng tiếng Anh, explanation bằng tiếng Việt. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  return [...(await b1), ...(await Promise.resolve(b2))]
}

async function generateForVietnamese(content: string, subject: string, grade: number, count: number) {
  const half = Math.ceil(count / 2)
  const b1 = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi về ĐỌC HIỂU VĂN BẢN và NỘI DUNG TÁC PHẨM (nhân vật, chủ đề, ý nghĩa, nghệ thuật).

ĐỀ CƯƠNG:
${content}

Loại câu: multiple_choice. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  const b2 = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${count - half} câu hỏi về TIẾNG VIỆT THỰC HÀNH (từ loại, câu, biện pháp tu từ, chính tả, ngữ pháp).

ĐỀ CƯƠNG:
${content}

Loại câu: mix multiple_choice, true_false, short_answer. Độ khó: 40% easy, 40% medium, 20% hard.
${JSON_FORMAT}`)

  const [r1, r2] = await Promise.all([b1, b2])
  return [...r1, ...r2]
}

async function generateForNaturalScience(content: string, grade: number, count: number) {
  const half = Math.ceil(count / 2)
  const b1 = callClaude(`Bạn là giáo viên Khoa Học Tự Nhiên lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi LÝ THUYẾT về các khái niệm, định nghĩa, quy luật sinh học/vật lý/hóa học trong đề cương.

ĐỀ CƯƠNG:
${content}

Loại câu: multiple_choice. Độ khó: 40% easy, 40% medium, 20% hard. Câu hỏi phải bám sát NỘI DUNG ĐỀ CƯƠNG, không bịa thêm kiến thức ngoài.
${JSON_FORMAT}`)

  const b2 = callClaude(`Bạn là giáo viên Khoa Học Tự Nhiên lớp ${grade}. Từ đề cương sau, tạo ${count - half} câu hỏi VẬN DỤNG và THỰC HÀNH (giải thích hiện tượng, thí nghiệm, ứng dụng thực tế).

ĐỀ CƯƠNG:
${content}

Loại câu: mix multiple_choice, true_false, short_answer. Độ khó: 40% easy, 40% medium, 20% hard. Câu hỏi phải bám sát NỘI DUNG ĐỀ CƯƠNG.
${JSON_FORMAT}`)

  const [r1, r2] = await Promise.all([b1, b2])
  return [...r1, ...r2]
}

async function generateForGeneral(content: string, subject: string, grade: number, count: number) {
  const half = Math.ceil(count / 2)
  const b1 = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${half} câu hỏi NHẬN BIẾT và THÔNG HIỂU bám sát nội dung đề cương.

ĐỀ CƯƠNG:
${content}

Loại câu: multiple_choice. Độ khó: 40% easy, 40% medium, 20% hard. Chỉ ra câu hỏi đúng với môn ${subject}.
${JSON_FORMAT}`)

  const b2 = callClaude(`Bạn là giáo viên ${subject} lớp ${grade}. Từ đề cương sau, tạo ${count - half} câu hỏi VẬN DỤNG bám sát nội dung đề cương.

ĐỀ CƯƠNG:
${content}

Loại câu: mix true_false, short_answer. Độ khó: 40% easy, 40% medium, 20% hard. Chỉ ra câu hỏi đúng với môn ${subject}.
${JSON_FORMAT}`)

  const [r1, r2] = await Promise.all([b1, b2])
  return [...r1, ...r2]
}

export async function generateExamQuestions(
  content: string,
  subject: string,
  grade: number,
  count = 20
): Promise<Omit<Question, 'id' | 'exam_set_id'>[]> {
  let raw: Omit<Question, 'id' | 'exam_set_id'>[]

  if (subject === 'Toán') {
    raw = await generateForMath(content, grade, count)
  } else if (subject === 'Tiếng Anh') {
    raw = await generateForEnglish(content, grade, count)
  } else if (subject === 'Ngữ Văn' || subject === 'Tiếng Việt') {
    raw = await generateForVietnamese(content, subject, grade, count)
  } else if (subject === 'Khoa Học Tự Nhiên') {
    raw = await generateForNaturalScience(content, grade, count)
  } else {
    raw = await generateForGeneral(content, subject, grade, count)
  }

  return raw
    .filter(q => q.question_text && q.correct_answer)
    .map((q, i) => ({ ...q, order_number: i + 1 }))
}
