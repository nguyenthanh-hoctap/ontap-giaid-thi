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

const EXTRACT_RULES = (subject: string) => {
  if (subject === 'Toán') {
    return `- Câu trắc nghiệm 4 đáp án: type="multiple_choice"
- Câu đúng/sai: type="true_false", options=[{"key":"A","text":"Đúng"},{"key":"B","text":"Sai"}]
- Câu tự luận/tính toán ngắn: type="short_answer", options=null
- Câu chứng minh hình học: type="proof", options=null
- Câu có hình vẽ hoặc liên quan hình học: vẽ diagram SVG theo ${SVG_RULES}`
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
  Các câu tiếp theo trong cùng nhóm cũng ghi lại [PASSAGE]...[/PASSAGE] để học sinh không mất ngữ cảnh`
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
