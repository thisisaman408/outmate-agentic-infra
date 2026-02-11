import { NextResponse } from 'next/server'

const ALL_COMPANY_FIELDS = [
  'headcount',
  'founders.profiles',
  'cxos',
  'decision_makers',
  'funding_and_investment',
  'web_traffic',
  'glassdoor',
  'g2',
  'linkedin_followers',
  'job_openings',
  'seo',
  'news_articles',
  'producthunt',
  'gartner',
  'competitors',
  'taxonomy',
  'all_office_addresses',
].join(',')

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const domain = url.searchParams.get('domain')

    if (!domain) {
      return NextResponse.json({ error: 'Missing domain' }, { status: 400 })
    }

    const authToken = process.env.CRUSTDATA_AUTH_TOKEN || '8ec44093901b0453d538605c317bd60b'

    const crustUrl = new URL('https://api.crustdata.com/screener/company')
    crustUrl.searchParams.set('company_domain', domain)
    crustUrl.searchParams.set('exact_match', 'true')
    crustUrl.searchParams.set('fields', ALL_COMPANY_FIELDS)

    const response = await fetch(crustUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Token ${authToken}`,
      },
      cache: 'no-store',
    })

    const text = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Crustdata API error',
          status: response.status,
          statusText: response.statusText,
          details: text,
        },
        { status: response.status },
      )
    }

    const data = text ? JSON.parse(text) : null
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Crustdata company proxy error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
