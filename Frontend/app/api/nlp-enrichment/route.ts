export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

// ============ Config ============
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-4.5-sonnet'
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || '' // optional
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// Optional pgvector memory (requires DATABASE_URL + pgvector extension)
let pool: any = null
async function getPool() {
  if (pool) return pool
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null
  try {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await ensureVectorTable()
    return pool
  } catch {
    return null
  }
}

async function ensureVectorTable() {
  try {
    const p = await getPool()
    if (!p) return
    // Enable pgvector and create table if not exists (dimension guessed 1536, adjust if using a different embedding model)
    await p.query(`CREATE EXTENSION IF NOT EXISTS vector`)
    await p.query(`
      CREATE TABLE IF NOT EXISTS nlp_queries (
        id BIGSERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        embedding VECTOR(1536),
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)
  } catch {}
}

// ============ Prompt Builder (LangChain-style modular) ============
function buildSystemPrompt() {
  return (
    `You are "Outmate AI", an autonomous B2B enrichment agent.\n` +
    `Goal: Parse user natural language into a compact JSON plan for querying app features (companies/prospects).\n` +
    `Return ONLY a strict JSON with keys: { target: 'companies'|'prospects', filters: object, sample_size: number }.\n` +
    `- Infer simple filters: industry, region/country, titles (for prospects), and optional keywords/signals.\n` +
    `- Default: target='companies', sample_size=10 if ambiguous. Do not fabricate values.\n`
  )
}

function buildUserPrompt(query: string) {
  return `Query: ${query}`
}

// ============ OpenRouter Calls ============
async function callOpenRouterChat(system: string, user: string) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
      temperature: 0.2,
    })
  })
  if (!resp.ok) throw new Error(`OpenRouter chat error ${resp.status}`)
  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content || ''
  return content
}

async function callOpenRouterEmbedding(text: string) {
  if (!OPENROUTER_API_KEY || !OPENROUTER_EMBEDDING_MODEL) return null
  const resp = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({ model: OPENROUTER_EMBEDDING_MODEL, input: text })
  })
  if (!resp.ok) return null
  const data = await resp.json()
  const vec = data?.data?.[0]?.embedding
  return Array.isArray(vec) ? vec : null
}

// ============ Vector Memory (optional) ============
async function saveQueryMemory(query: string) {
  try {
    const embedding = await callOpenRouterEmbedding(query)
    const p = await getPool()
    if (!p || !embedding) return
    const dim = embedding.length
    // If table was created with 1536 but the embedding size differs, this insert will fail; we ignore in catch.
    const placeholders = embedding.map((_, i) => `$${i + 2}`).join(',')
    const sql = `INSERT INTO nlp_queries (query, embedding) VALUES ($1, ARRAY[${placeholders}]::vector)`
    await p.query(sql, [query, ...embedding])
  } catch { /* ignore memory failures */ }
}

async function recallSimilarQueries(query: string, topK = 3) {
  try {
    const embedding = await callOpenRouterEmbedding(query)
    const p = await getPool()
    if (!p || !embedding) return []
    const vecLit = embedding.map((v: number) => v.toFixed(6)).join(',')
    const sql = `
      SELECT query, 1 - (embedding <=> ARRAY[${vecLit}]::vector) AS score
      FROM nlp_queries
      ORDER BY embedding <=> ARRAY[${vecLit}]::vector ASC
      LIMIT ${topK}
    `
    const r = await p.query(sql)
    return r.rows || []
  } catch { return [] }
}

// ============ LangGraph-style Orchestrator ============
// States: PLAN -> ROUTE -> FETCH_SAMPLE -> SYNTHESIZE -> DONE

type Target = 'companies' | 'prospects'
interface Plan { target: Target; filters: Record<string, any>; sample_size: number }

async function plan(query: string): Promise<Plan> {
  const system = buildSystemPrompt()
  const user = buildUserPrompt(query)
  const raw = await callOpenRouterChat(system, user)
  try {
    const j = JSON.parse(raw)
    const target: Target = j.target === 'prospects' ? 'prospects' : 'companies'
    const sample_size = Number(j.sample_size) || 10
    const filters = (j.filters && typeof j.filters === 'object') ? j.filters : {}
    return { target, filters, sample_size }
  } catch {
    return { target: 'companies', filters: {}, sample_size: 10 }
  }
}

async function routeToFeature(plan: Plan) {
  return plan.target // trivial router, could be augmented via memory in future
}

async function fetchSample(target: Target, filters: Record<string, any>, limit: number) {
  if (target === 'prospects') {
    const r = await fetch(`${BACKEND_BASE}/api/v1/prospects/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, options: { limit } })
    })
    const data = await r.json().catch(() => ({}))
    return { raw: data, items: data?.data?.prospects || data?.prospects || [] }
  } else {
    const r = await fetch(`${BACKEND_BASE}/api/v1/leads/search/companies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, options: { limit } })
    })
    const data = await r.json().catch(() => ({}))
    return { raw: data, items: data?.data?.companies || data?.companies || [] }
  }
}

function synthesize(query: string, target: Target, items: any[]) {
  const out: any[] = []
  if (target === 'prospects') {
    for (const p of items) {
      out.push({
        company_name: p.company_name || null,
        website: p.company_domain ? `https://${p.company_domain}` : null,
        industry: p.industry || null,
        firmographics: { revenue: null, employees: null },
        detected_signal: { type: null, details: null },
        contacts: [
          {
            name: [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
            title: p.title || null,
            email: p.email || p.work_email || p.personal_email || null,
            linkedin: p.linkedin_url || null
          }
        ]
      })
    }
  } else {
    for (const c of items) {
      out.push({
        company_name: c.name || null,
        website: c.domain ? `https://${c.domain}` : (c.website || null),
        industry: c.industry || null,
        firmographics: {
          revenue: c.revenue_exact || c.revenue_range || null,
          employees: c.employee_count_exact || c.employee_count_range || null,
        },
        detected_signal: { type: null, details: null },
        contacts: []
      })
    }
  }
  const noun = target === 'prospects' ? 'people' : 'companies'
  const agent_insights = `\n**Summary**\n- Query: ${query}\n- Returned: ${out.length} ${noun} (sample)\n- Next: Confirm to pull more or refine the request.`
  return { data: out, agent_insights }
}

// ============ API Handler ============
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const query: string = body?.query || ''
    const mode: 'sample'|'full' = (body?.mode === 'full') ? 'full' : 'sample'
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    // Save memory opportunistically (no-op if not configured)
    saveQueryMemory(query).catch(() => {})

    // PLAN
    const p = await plan(query)

    // ROUTE
    const target = await routeToFeature(p)

    // FETCH_SAMPLE (lazy eval)
    const limit = mode === 'full' ? 100 : Math.min(10, p.sample_size || 10)
    const sample = await fetchSample(target, p.filters, limit)

    // SYNTHESIZE
    const synth = synthesize(query, target, sample.items)

    // OUTPUT schema
    const response = {
      request_id: `req_${Date.now()}`,
      query_summary: query,
      data: synth.data,
      agent_insights: synth.agent_insights
    }

    return NextResponse.json(response)
  } catch (e: any) {
    console.error('NLP enrichment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
