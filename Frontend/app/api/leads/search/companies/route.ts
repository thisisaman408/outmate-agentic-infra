import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/lib/database/services'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Use hardcoded backend URL to avoid undefined issues
    const backendUrl = 'http://localhost:8000'

    console.log('=== DEBUG: Using hardcoded backend URL ===')
    console.log('backendUrl:', backendUrl)
    console.log('Proxying to backend:', `${backendUrl}/api/leads/search/companies`)
    console.log('Request body:', body)

    const response = await fetch(`${backendUrl}/api/leads/search/companies`, {
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

    // Store enriched company data in database
    if (responseData?.data?.companies && Array.isArray(responseData.data.companies)) {
      try {
        for (const company of responseData.data.companies) {
          await companyService.upsertCompany(company)
          console.log(`Stored company ${company.domain} in database`)
        }
      } catch (dbError) {
        console.error('Error storing company in database:', dbError)
        // Continue with response even if database storage fails
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData?.data || responseData,
      meta: responseData?.meta,
    })

  } catch (error) {
    console.error('API proxy error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
