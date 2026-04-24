import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ version: 'v3-debug-2025-04-24', anthropic: false })
}
