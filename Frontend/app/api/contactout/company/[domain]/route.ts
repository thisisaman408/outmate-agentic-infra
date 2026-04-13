import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: any }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params)
    const domain = resolvedParams?.domain

    if (!domain) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing domain parameter' } },
        { status: 400 }
      )
    }
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://dev.outmate.ai'

    console.log('Proxying to backend:', `${backendUrl}/api/v1/contactout/company/${encodeURIComponent(domain)}`)

    const authHeader = request.headers.get('Authorization')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${backendUrl}/api/v1/contactout/company/${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers,
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Backend error:', responseData)
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Failed to fetch company data' } },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('ContactOut company proxy error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
