import { NextRequest, NextResponse } from 'next/server'
import { companyService } from '@/lib/database/services'

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const demo = url.searchParams.get('demo') === 'true'
    const body = await request.json()
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'

    console.log('=== DEBUG: backend URL ===')
    console.log('backendUrl:', backendUrl)
    console.log('Proxying to backend:', `${backendUrl}/api/v1/leads/search/companies`)
    console.log('Request body:', body)

    const response = await fetch(`${backendUrl}/api/v1/leads/search/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Backend error:', responseData)
      if (demo) {
        // Fallback demo data if backend fails and demo=true
        const demoCompanies = [
          { id: '1', name: 'Acme Corp', domain: 'acme.com', industry: 'Software', employee_count_exact: 500, revenue_exact: 120000000, company_type: 'Private', headquarters_country: 'USA', headquarters_state: 'CA', headquarters_city: 'San Francisco', linkedin_url: 'https://www.linkedin.com/company/acme', technologies: ['React', 'Node.js'], logo_url: 'https://logo.clearbit.com/acme.com' },
          { id: '2', name: 'Globex Inc', domain: 'globex.com', industry: 'Manufacturing', employee_count_exact: 2000, revenue_exact: 450000000, company_type: 'Public', headquarters_country: 'USA', headquarters_state: 'NY', headquarters_city: 'New York', linkedin_url: 'https://www.linkedin.com/company/globex', technologies: ['SAP', 'AWS'], logo_url: 'https://logo.clearbit.com/globex.com' },
          { id: '3', name: 'Initech', domain: 'initech.com', industry: 'IT Services', employee_count_exact: 800, revenue_exact: 90000000, company_type: 'Private', headquarters_country: 'USA', headquarters_state: 'TX', headquarters_city: 'Austin', linkedin_url: 'https://www.linkedin.com/company/initech', technologies: ['Kubernetes', 'Python'], logo_url: 'https://logo.clearbit.com/initech.com' }
        ]
        return NextResponse.json({ success: true, data: { companies: demoCompanies, total_count: demoCompanies.length } })
      }
      return NextResponse.json(
        { success: false, error: responseData?.error || { message: 'Search failed' } },
        { status: response.status }
      )
    }

    console.log('Backend response companies:', responseData?.data?.companies?.length || 0)

    // Optionally store enriched company data in database.  This is only
    // enabled in development or when the feature flag is explicitly set.
    const allowDbWrites =
      process.env.NODE_ENV === 'development' ||
      process.env.ENABLE_FRONTEND_DB === 'true'

    if (allowDbWrites && responseData?.data?.companies && Array.isArray(responseData.data.companies)) {
      try {
        for (const company of responseData.data.companies) {
          await companyService.upsertCompany(company)
          console.log(`Stored company ${company.domain} in database`)
        }
      } catch (dbError) {
        console.error('Error storing company in database:', dbError)
        // Continue with response even if database storage fails
      }
    } else if (!allowDbWrites) {
      console.debug('Database write skipped (not in development or feature flag off)')
    }

    return NextResponse.json({
      success: true,
      data: responseData?.data || responseData,
      meta: responseData?.meta,
    })

  } catch (error) {
    console.error('API proxy error:', error)
    // If demo=true, still return demo records to show something
    try {
      const url = new URL(request.url)
      const demo = url.searchParams.get('demo') === 'true'
      if (demo) {
        const demoCompanies = [
          { id: '1', name: 'Acme Corp', domain: 'acme.com', industry: 'Software', employee_count_exact: 500, revenue_exact: 120000000, company_type: 'Private', headquarters_country: 'USA', headquarters_state: 'CA', headquarters_city: 'San Francisco', linkedin_url: 'https://www.linkedin.com/company/acme', technologies: ['React', 'Node.js'], logo_url: 'https://logo.clearbit.com/acme.com' },
          { id: '2', name: 'Globex Inc', domain: 'globex.com', industry: 'Manufacturing', employee_count_exact: 2000, revenue_exact: 450000000, company_type: 'Public', headquarters_country: 'USA', headquarters_state: 'NY', headquarters_city: 'New York', linkedin_url: 'https://www.linkedin.com/company/globex', technologies: ['SAP', 'AWS'], logo_url: 'https://logo.clearbit.com/globex.com' }
        ]
        return NextResponse.json({ success: true, data: { companies: demoCompanies, total_count: demoCompanies.length } })
      }
    } catch {}
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
