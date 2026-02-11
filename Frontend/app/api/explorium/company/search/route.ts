import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    console.log('Proxying to backend:', `${backendUrl}/api/explorium/company/search`)
    console.log('Request body:', body)

    const response = await fetch(`${backendUrl}/api/explorium/company/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Backend error:', responseData)
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Search failed' } },
        { status: response.status }
      )
    }

    console.log('Backend response companies:', responseData?.data?.companies?.length || 0)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Proxy route error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    )
  }
}
