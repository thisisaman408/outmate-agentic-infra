import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Social media presence request received');
    
    const body = await request.json();
    const { domain, include_posts, posts_limit } = body;
    
    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain is required' },
        { status: 400 }
      )
    }

    // Call backend Explorium API
    const backendUrl = `${process.env.BACKEND_URL || 'https://dev.outmate.ai'}/api/v1/explorium/social-media-presence`
    
    const requestBody = {
      domain,
      include_posts: include_posts || false,
      posts_limit: posts_limit || 10
    }

    console.log('Calling backend social media presence API:', backendUrl, requestBody);

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
      console.error('Backend social media presence API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Backend API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json();
    console.log('Social media presence response:', data);

    return NextResponse.json(data);

  } catch (error) {
    console.error('Social media presence error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
