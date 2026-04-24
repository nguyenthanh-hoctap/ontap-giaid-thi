import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Return this JSON: [{"order_number":1,"type":"multiple_choice","question_text":"2+2=?","options":[{"key":"A","text":"3"},{"key":"B","text":"4"},{"key":"C","text":"5"},{"key":"D","text":"6"}],"correct_answer":"B","explanation":"2+2=4","difficulty":"easy","diagram":null}]' }] }],
      generationConfig: { maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 0 } } as never,
    })
    const text = result.response.text()
    return NextResponse.json({ raw: text, length: text.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
