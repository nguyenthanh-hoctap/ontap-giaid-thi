import Anthropic from '@anthropic-ai/sdk'
import convert from 'heic-convert'
import sharp from 'sharp'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_BYTES = 4.5 * 1024 * 1024 // 4.5MB — dưới giới hạn 5MB của Claude

async function compressToLimit(buf: Buffer): Promise<Buffer> {
  if (buf.length <= MAX_BYTES) return buf
  // Thử giảm quality trước
  for (const quality of [80, 65, 50]) {
    const out = await sharp(buf).jpeg({ quality }).toBuffer()
    if (out.length <= MAX_BYTES) return out
  }
  // Nếu vẫn còn lớn thì resize xuống max 2000px
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

export async function extractTextFromImages(imageUrls: string[]): Promise<string> {
  const imageContents = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url)
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || ''
      const { data } = await toJpegBuffer(buffer, url, ct)
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: data.toString('base64') },
      }
    })
  )

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `Bạn là công cụ OCR chuyên nghiệp. Hãy đọc và trích xuất TOÀN BỘ nội dung văn bản từ các ảnh đề cương ôn thi này.

Yêu cầu:
- Giữ nguyên cấu trúc, tiêu đề, mục con
- Trích xuất đầy đủ các công thức, bài tập mẫu
- Không thêm nhận xét hay giải thích
- Chỉ trả về nội dung văn bản thuần túy`,
          },
        ],
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
