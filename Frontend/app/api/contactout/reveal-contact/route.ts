import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { linkedin_url, include_phone = false } = body
    
    if (!linkedin_url) {
      return NextResponse.json(
        { success: false, error: { message: 'LinkedIn URL is required' } },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    console.log('Proxying to backend:', `${backendUrl}/api/contactout/reveal-contact`)

    const response = await fetch(`${backendUrl}/api/contactout/reveal-contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedin_url,
        include_phone
      }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Backend error:', responseData)
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Failed to reveal contact' } },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('ContactOut reveal contact proxy error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
