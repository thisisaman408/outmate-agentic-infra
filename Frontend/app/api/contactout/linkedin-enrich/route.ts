import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Profile enrich request received');
    
    const body = await request.json();
    const { linkedin_url, include_experience, include_education, include_skills } = body;
    
    if (!linkedin_url) {
      return NextResponse.json(
        { success: false, error: 'Profile URL is required' },
        { status: 400 }
      )
    }

    // Call backend ContactOut API
    const backendUrl = `${process.env.BACKEND_URL || 'https://dev.outmate.ai'}/api/v1/contactout/linkedin-enrich`
    
    const requestBody = {
      linkedin_url,
      include_experience: include_experience || false,
      include_education: include_education || false,
      include_skills: include_skills || false
    }

    console.log('Calling backend profile enrich API:', backendUrl, requestBody);

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
      console.error('Backend profile enrich API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json();
    console.log('Profile enrich response:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('Profile enrich error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
