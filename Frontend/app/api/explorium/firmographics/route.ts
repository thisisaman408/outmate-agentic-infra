import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain, business_id, name } = body || {}

    if (!domain && !business_id && !name) {
      return NextResponse.json(
        { success: false, error: { message: 'Provide domain or business_id or name' } },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = `${backendUrl}/api/explorium/firmographics`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, business_id, name }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Firmographics failed' } },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
