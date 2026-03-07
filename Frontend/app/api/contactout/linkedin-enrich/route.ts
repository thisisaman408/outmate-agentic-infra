import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('LinkedIn enrich request received');
    
    const body = await request.json();
    const { linkedin_url, include_experience, include_education, include_skills } = body;
    
    if (!linkedin_url) {
      return NextResponse.json(
        { success: false, error: 'LinkedIn URL is required' },
        { status: 400 }
      )
    }

    // Call backend ContactOut API
    const backendUrl = `http://localhost:8000/api/contactout/linkedin-enrich`
    
    const requestBody = {
      linkedin_url,
      include_experience: include_experience || false,
      include_education: include_education || false,
      include_skills: include_skills || false
    }

    console.log('Calling backend LinkedIn enrich API:', backendUrl, requestBody);

    const authHeader = request.headers.get('Authorization')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend LinkedIn enrich API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json();
    console.log('LinkedIn enrich response:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('LinkedIn enrich error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
