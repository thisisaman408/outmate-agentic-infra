import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    console.log('Request URL:', request.url)
    
    const resolvedParams = await params
    console.log('Resolved params:', resolvedParams)
    
    const domain = resolvedParams.domain
    console.log('Extracted domain:', domain)
    
    if (!domain) {
      console.error('No domain provided in params')
      return NextResponse.json(
        { success: false, error: { message: 'No domain provided' } },
        { status: 400 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    const url = `${backendUrl}/api/contactout/decision-makers/${encodeURIComponent(domain)}?page=${page}`
    console.log('Proxying to backend:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const responseData = await response.json()
    console.log('Backend response:', responseData)

    if (!response.ok) {
      console.error('Backend error:', responseData)
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Failed to fetch decision makers' } },
        { status: response.status }
      )
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('ContactOut decision makers proxy error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
