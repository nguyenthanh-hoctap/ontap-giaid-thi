import Anthropic from '@anthropic-ai/sdk'
import convert from 'heic-convert'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function toJpegBuffer(buffer: Buffer, url: string, contentType: string): Promise<{ data: Buffer, mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const isHeic = contentType.includes('heic') || contentType.includes('heif') ||
    /\.(heic|heif)(\?|$)/i.test(url)

  if (isHeic) {
    const jpegBuffer = await convert({ buffer: buffer as unknown as ArrayBuffer, format: 'JPEG', quality: 0.85 })
    return { data: Buffer.from(jpegBuffer), mediaType: 'image/jpeg' }
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
  const mediaType = (validTypes.find(t => contentType.includes(t)) || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  return { data: buffer, mediaType }
}

export async function extractTextFromImages(imageUrls: string[]): Promise<string> {
  const imageContents = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url)
      const buffer = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || ''
      const { data, mediaType } = await toJpegBuffer(buffer, url, ct)
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: data.toString('base64') },
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
