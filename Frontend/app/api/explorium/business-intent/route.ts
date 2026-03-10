import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Business intent request received');
    
    const body = await request.json();
    const { domain, min_score } = body;
    
    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain is required' },
        { status: 400 }
      )
    }

    // Call backend Explorium API
    const backendUrl = `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/v1/explorium/business-intent`
    
    const requestBody = {
      domain,
      min_score: min_score || 60
    }

    console.log('Calling backend business intent API:', backendUrl, requestBody);

    const authHeader = request.headers.get('authorization') || ''
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend business intent API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json();
    console.log('Business intent response:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('Business intent error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
