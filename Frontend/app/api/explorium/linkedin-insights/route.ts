import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain, include_posts = true, posts_limit = 10 } = body
    
    if (!domain) {
      return NextResponse.json(
        { success: false, error: { message: 'Domain is required' } },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    console.log('Proxying to backend:', `${backendUrl}/api/explorium/linkedin-insights`)

    const authHeader = request.headers.get('authorization') || ''
    const response = await fetch(`${backendUrl}/api/explorium/linkedin-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify({
        domain,
        include_posts,
        posts_limit
      }),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Backend error:', responseData)
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Failed to fetch LinkedIn insights' } },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Explorium LinkedIn insights proxy error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
