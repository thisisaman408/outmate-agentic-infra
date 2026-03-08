import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Technographics request received');
    
    const body = await request.json();
    const { domain } = body;
    
    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain is required' },
        { status: 400 }
      )
    }

    // Call backend Explorium API
    const backendUrl = `http://localhost:8000/api/explorium/technographics`
    
    const requestBody = {
      domain
    }

    console.log('Calling backend technographics API:', backendUrl, requestBody);

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
      console.error('Backend technographics API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json();
    console.log('Technographics response:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('Technographics error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
