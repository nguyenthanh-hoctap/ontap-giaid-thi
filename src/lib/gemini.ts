import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { jsonrepair } from 'jsonrepair'
import convert from 'heic-convert'
import sharp from 'sharp'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const MAX_BYTES = 4.5 * 1024 * 1024

async function compressToLimit(buf: Buffer): Promise<Buffer> {
  if (buf.length <= MAX_BYTES) return buf
  for (const quality of [80, 65, 50]) {
    const out = await sharp(buf).jpeg({ quality }).toBuffer()
    if (out.length <= MAX_BYTES) return out
  }
  return sharp(buf).resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer()
}

async function toJpegBuffer(buffer: Buffer, url: string, contentType: string): Promise<{ data: Buffer, mediaType: 'image/jpeg' }> {
  const isHeic = contentType.includes('heic') || contentType.includes('heif') ||
    /\.(heic|heif)(\?|$)/i.test(url)

  let jpegBuf: Buffer
  if (isHeic) {
    const converted = await convert({ buffer: buffer as unknown as ArrayBuffer, format: 'JPEG', quality: 0.9 })
    jpegBuf = Buffer.from(converted)
  } else {
    jpegBuf = buffer
  }

  const final = await compressToLimit(jpegBuf)
  return { data: final, mediaType: 'image/jpeg' }
}

export async function prepareImageParts(imageUrls: string[]) {
  return Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url)
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || ''
      const { data } = await toJpegBuffer(buffer, url, ct)
      return { inlineData: { data: data.toString('base64'), mimeType: 'image/jpeg' as const } }
    })
  )
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

interface FigureShape {
  type: 'rect'
  x1_pct: number; y1_pct: number; x2_pct: number; y2_pct: number
  fill: 'none' | 'white' | 'gray' | 'hatch'
  stroke: boolean
  label?: string | null
}
interface FigureLabel {
  text: string
  side: 'top' | 'bottom' | 'left' | 'right'
  pos_pct: number
  has_arrow: boolean
}
interface FigureJSON { shapes: FigureShape[]; labels: FigureLabel[] }

function fixFullHeightHatch(fig: FigureJSON): FigureJSON {
  // If a hatched shape is narrow (< 30% wide) and tall (> 40% height) and starts near the top,
  // it's almost certainly a full-height vertical strip — extend to y2=100
  const shapes = fig.shapes.map(s => {
    if (s.fill !== 'hatch') return s
    const w = s.x2_pct - s.x1_pct
    const h = s.y2_pct - s.y1_pct
    if (w < 30 && h > 40 && s.y1_pct <= 5 && s.y2_pct < 95) {
      return { ...s, y1_pct: 0, y2_pct: 100 }
    }
    return s
  })
  return { ...fig, shapes }
}

function fixSymmetricBorder(fig: FigureJSON): FigureJSON {
  // If shapes[0] is outer (0,0,100,100) and shapes[1] is an inner rect roughly centered,
  // enforce equal margins on all 4 sides (average the 4 margins)
  if (fig.shapes.length < 2) return fig
  const outer = fig.shapes[0]
  const inner = fig.shapes[1]
  if (outer.x1_pct !== 0 || outer.y1_pct !== 0 || outer.x2_pct !== 100 || outer.y2_pct !== 100) return fig
  if (inner.fill !== 'gray' && inner.fill !== 'none') return fig
  const mL = inner.x1_pct, mR = 100 - inner.x2_pct
  const mT = inner.y1_pct, mB = 100 - inner.y2_pct
  // Only symmetrize if all 4 margins are within 10% of each other (i.e. intended to be equal)
  const avg = (mL + mR + mT + mB) / 4
  if (Math.max(mL, mR, mT, mB) - Math.min(mL, mR, mT, mB) < 10) {
    const shapes = [...fig.shapes]
    shapes[1] = { ...inner, x1_pct: avg, y1_pct: avg, x2_pct: 100 - avg, y2_pct: 100 - avg }
    return { ...fig, shapes }
  }
  return fig
}

function figureJsonToSvg(fig: FigureJSON): string {
  fig = fixFullHeightHatch(fig)
  fig = fixSymmetricBorder(fig)
  const DW = 300, DH = 240, OX = 30, OY = 30
  const px = (p: number) => OX + (p / 100) * DW
  const py = (p: number) => OY + (p / 100) * DH
  const pw = (p: number) => (p / 100) * DW
  const ph = (p: number) => (p / 100) * DH
  const parts: string[] = [
    `<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">`,
    `<rect width="8" height="8" fill="#e5e7eb"/>`,
    `<path d="M-1,1 l2,-2 M0,8 l8,-8 M6,10 l2,-2" stroke="#64748b" stroke-width="1.2"/>`,
    `</pattern></defs>`,
  ]
  for (const s of fig.shapes) {
    const x = px(s.x1_pct), y = py(s.y1_pct), w = pw(s.x2_pct - s.x1_pct), h = ph(s.y2_pct - s.y1_pct)
    const f = s.fill === 'hatch' ? 'url(#hatch)' : s.fill === 'gray' ? '#e5e7eb' : s.fill === 'white' ? '#ffffff' : 'none'
    const sk = s.stroke ? 'stroke="#1e293b" stroke-width="2"' : 'stroke="none"'
    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${f}" ${sk}/>`)
    if (s.label) {
      const cx = (px(s.x1_pct) + px(s.x2_pct)) / 2, cy = (py(s.y1_pct) + py(s.y2_pct)) / 2
      parts.push(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="13" font-family="sans-serif" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`)
    }
  }
  for (const lbl of fig.labels) {
    let x = 0, y = 0, anchor = 'middle'
    const PAD = 18
    if (lbl.side === 'top')    { x = px(lbl.pos_pct); y = OY - 8; anchor = 'middle' }
    if (lbl.side === 'bottom') { x = px(lbl.pos_pct); y = OY + DH + PAD; anchor = 'middle' }
    if (lbl.side === 'left')   { x = OX - 8; y = py(lbl.pos_pct); anchor = 'end' }
    if (lbl.side === 'right')  { x = OX + DW + 8; y = py(lbl.pos_pct); anchor = 'start' }
    parts.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="14" font-family="sans-serif" fill="#1e293b" text-anchor="${anchor}" dominant-baseline="middle">${lbl.text}</text>`)
  }
  return `<svg viewBox="0 0 360 300" width="360" height="300" xmlns="http://www.w3.org/2000/svg">\n${parts.join('\n')}\n</svg>`
}

export async function generateSvgFromCrop(
  imageUrl: string,
  bbox: [number, number, number, number],
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || ''
    const { data: jpegBuf } = await toJpegBuffer(buffer, imageUrl, ct)
    const meta = await sharp(jpegBuf).metadata()
    const W = meta.width!, H = meta.height!
    const [ymin, xmin, ymax, xmax] = bbox
    const left = Math.max(0, Math.round(xmin / 1000 * W) - 15)
    const top = Math.max(0, Math.round(ymin / 1000 * H) - 15)
    const width = Math.min(W - left, Math.round((xmax - xmin) / 1000 * W) + 30)
    const height = Math.min(H - top, Math.round((ymax - ymin) / 1000 * H) + 30)
    const cropped = await sharp(jpegBuf).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer()

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', safetySettings: SAFETY_SETTINGS })
    const result = await model.generateContent([
      { inlineData: { data: cropped.toString('base64'), mimeType: 'image/jpeg' } },
      { text: `Phân tích hình vẽ hình học này và trả về JSON mô tả cấu trúc.

JSON format (CHỈ trả JSON thuần, không markdown):
{
  "shapes": [
    {
      "type": "rect",
      "x1_pct": <% từ trái 0-100>,
      "y1_pct": <% từ trên 0-100>,
      "x2_pct": <% từ trái>,
      "y2_pct": <% từ trên>,
      "fill": "none" | "white" | "gray" | "hatch",
      "stroke": true | false,
      "label": "<text bên trong nếu có, null nếu không>"
    }
  ],
  "labels": [
    {
      "text": "<nhãn chính xác>",
      "side": "top" | "bottom" | "left" | "right",
      "pos_pct": <vị trí dọc theo cạnh 0-100>,
      "has_arrow": true | false
    }
  ]
}

QUY TẮC QUAN TRỌNG:
- Shape đầu tiên LUÔN là hình chữ nhật ngoài cùng: x1=0,y1=0,x2=100,y2=100 (fill theo thực tế)
- Tọa độ % tính từ góc trên-trái của hình ngoài cùng
- CHỈ thêm shape nếu nó THỰC SỰ tồn tại trong hình — KHÔNG thêm shape trắng để "clear" vùng
- fill="gray" chỉ dùng khi hình gốc có vùng TÔ MÀU XÁM rõ ràng
- fill="hatch" chỉ dùng khi hình gốc có vùng GẠCH CHÉO rõ ràng
- fill="none" cho các hình chỉ có đường viền, không tô màu
- Vùng gạch chéo chạm cạnh trên VÀ dưới → y1_pct=0, y2_pct=100 (FULL chiều cao)
- Vùng gạch chéo chạm cạnh trái VÀ phải → x1_pct=0, x2_pct=100 (FULL chiều rộng)
- NẾU có 2 vùng gạch chéo tách biệt: một nằm ngang trên, một nằm dọc → vùng dọc PHẢI có y1=0 và y2=100 (span toàn bộ chiều cao, từ trên xuống dưới hình ngoài)
- Đo tỉ lệ kỹ: nếu vùng chiếm ~1/3 chiều ngang thì x2-x1≈33
- Mũi tên đo khoảng cách (như x(m) giữa 2 đường thẳng): đưa vào "labels" với has_arrow=true, KHÔNG tạo shape riêng` }
    ])

    const text = result.response.text().trim()
    const start = text.indexOf('{'), end = text.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const fig: FigureJSON = JSON.parse(jsonrepair(text.slice(start, end + 1)))
    return figureJsonToSvg(fig)
  } catch { return null }
}

export async function cropAndUploadDiagram(
  imageUrl: string,
  bbox: [number, number, number, number],
  supabase: { storage: { from: (b: string) => { upload: (p: string, d: Buffer) => Promise<{error: unknown}>; getPublicUrl: (p: string) => {data: {publicUrl: string}} } } }
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    const buffer = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || ''
    const { data: jpegBuf } = await toJpegBuffer(buffer, imageUrl, ct)
    const meta = await sharp(jpegBuf).metadata()
    const W = meta.width!, H = meta.height!
    const [ymin, xmin, ymax, xmax] = bbox
    const left = Math.max(0, Math.round(xmin / 1000 * W) - 10)
    const top = Math.max(0, Math.round(ymin / 1000 * H) - 10)
    const width = Math.min(W - left, Math.round((xmax - xmin) / 1000 * W) + 20)
    const height = Math.min(H - top, Math.round((ymax - ymin) / 1000 * H) + 20)
    const cropped = await sharp(jpegBuf).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer()
    const fileName = `diagrams/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    const { error } = await supabase.storage.from('syllabuses').upload(fileName, cropped)
    if (error) return null
    const { data } = supabase.storage.from('syllabuses').getPublicUrl(fileName)
    return data.publicUrl
  } catch { return null }
}

export async function extractTextFromImages(imageUrls: string[]): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', safetySettings: SAFETY_SETTINGS })
  const imageParts = await prepareImageParts(imageUrls)

  const result = await model.generateContent([
    ...imageParts,
    {
      text: `Bạn là công cụ OCR chuyên nghiệp. Hãy đọc và trích xuất TOÀN BỘ nội dung văn bản từ các ảnh đề cương ôn thi này.

Yêu cầu:
- Giữ nguyên cấu trúc, tiêu đề, mục con
- Trích xuất đầy đủ các công thức, bài tập mẫu
- Không thêm nhận xét hay giải thích
- Chỉ trả về nội dung văn bản thuần túy`,
    },
  ])

  return result.response.text()
}
