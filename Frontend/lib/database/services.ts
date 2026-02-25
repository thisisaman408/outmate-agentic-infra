// Database services for storing enriched company and prospect data
import { getDatabasePool, getRedisClient } from '../database'
import { initializeDatabase } from './schema'

// Company database service
export class CompanyService {
  private pool = getDatabasePool()
  private redis = getRedisClient()
  private companyColumns: Set<string> | null = null
  private hasRawJson: boolean = false

  // Initialize database schema
  async initialize(): Promise<boolean> {
    return await initializeDatabase(this.pool)
  }

  private async ensureCompanyColumns(): Promise<void> {
    if (this.companyColumns) return
    const sql = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies'
    `
    const res = await this.pool.query(sql)
    const cols = new Set<string>()
    let hasRaw = false
    for (const row of res.rows) {
      const col = String(row.column_name)
      cols.add(col)
      if (col === 'raw' && (row.data_type === 'json' || row.data_type === 'jsonb')) {
        hasRaw = true
      }
    }
    this.companyColumns = cols
    this.hasRawJson = hasRaw
  }

  // Store or update company data (schema-aware)
  async upsertCompany(companyData: any): Promise<any> {
    try {
      await this.ensureCompanyColumns()
      if (!this.companyColumns) throw new Error('companies table metadata not available')
      if (!this.companyColumns.has('domain')) throw new Error("companies table missing required 'domain' column")

      // Build column/value lists by intersecting payload with existing columns
      const payload: Record<string, any> = { ...companyData }

      // Normalize arrays/objects to JSON strings for safety where types are unknown
      const normalize = (v: any) => {
        if (v === undefined) return null
        if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v)
        return v
      }

      const insertCols: string[] = []
      const values: any[] = []

      // Always include domain
      insertCols.push('domain')
      values.push(payload.domain || null)

      // Add other known columns from payload
      for (const key of Object.keys(payload)) {
        if (key === 'domain') continue
        if (key === 'id') continue
        if (this.companyColumns.has(key)) {
          insertCols.push(key)
          values.push(normalize(payload[key]))
        }
      }

      // Optionally include raw json snapshot
      if (this.hasRawJson && !insertCols.includes('raw')) {
        insertCols.push('raw')
        values.push(JSON.stringify(companyData))
      }

      // Build parameter placeholders
      const placeholders = insertCols.map((_, i) => `${i + 1}`)

      // Build update set list excluding the conflict key 'domain'
      const updateSet = insertCols
        .filter(c => c !== 'domain')
        .map(c => `${c} = EXCLUDED.${c}`)
        .join(', ')

      const query = `
        INSERT INTO companies (${insertCols.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT (domain) DO UPDATE SET ${updateSet}
        RETURNING *
      `

      const result = await this.pool.query(query, values)

      // Cache in Redis for quick access (if Redis is available)
      try {
        await this.redis.setex(`company:${companyData.domain}`, 3600, JSON.stringify(result.rows[0]))
      } catch (redisError) {
        console.warn('Redis caching failed, continuing without cache:', redisError)
      }

      console.log(`Company ${companyData.domain} stored/updated in database (schema-aware)`) 
      return result.rows[0]
    } catch (error) {
      console.error('Error upserting company:', error)
      throw error
    }
  }

  // Get company by domain
  async getCompanyByDomain(domain: string): Promise<any> {
    try {
      // Check Redis cache first
      const cached = await this.redis.get(`company:${domain}`)
      if (cached) {
        return JSON.parse(cached)
      }

      // Query database
      const query = 'SELECT * FROM companies WHERE domain = $1'
      const result = await this.pool.query(query, [domain])
      
      if (result.rows.length > 0) {
        // Cache in Redis
        await this.redis.setex(`company:${domain}`, 3600, JSON.stringify(result.rows[0]))
        return result.rows[0]
      }
      
      return null
    } catch (error) {
      console.error('Error getting company:', error)
      throw error
    }
  }

  // Record enrichment history
  async recordEnrichmentHistory(
    entityType: 'company' | 'prospect',
    entityId: number,
    enrichmentType: string,
    provider: string,
    creditsUsed: number,
    fieldsEnriched: string[],
    success: boolean,
    errorMessage?: string,
    enrichmentData?: any
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO enrichment_history (
          entity_type, entity_id, enrichment_type, provider, credits_used,
          fields_enriched, success, error_message, enrichment_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `

      const values = [
        entityType,
        entityId,
        enrichmentType,
        provider,
        creditsUsed,
        JSON.stringify(fieldsEnriched),
        success,
        errorMessage || null,
        enrichmentData ? JSON.stringify(enrichmentData) : null
      ]

      await this.pool.query(query, values)
    } catch (error) {
      console.error('Error recording enrichment history:', error)
    }
  }
}

// Prospect database service
export class ProspectService {
  private pool = getDatabasePool()
  private redis = getRedisClient()

  // Store or update prospect data
  async upsertProspect(prospectData: any): Promise<any> {
    try {
      const query = `
        INSERT INTO prospects (
          first_name, last_name, email, phone, title, seniority, department,
          company_domain, company_name, linkedin_url, linkedin_profile_id,
          personal_email, work_email, mobile_phone, direct_phone, location,
          country, state, city, timezone, skills, experience, education,
          certifications, interests, social_profiles, last_active, response_rate,
          email_status, phone_status, linkedin_status, data_quality_score,
          provider_source, enriched, last_enriched_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34, $35
        )
        ON CONFLICT (email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          title = EXCLUDED.title,
          seniority = EXCLUDED.seniority,
          department = EXCLUDED.department,
          company_domain = EXCLUDED.company_domain,
          company_name = EXCLUDED.company_name,
          linkedin_url = EXCLUDED.linkedin_url,
          linkedin_profile_id = EXCLUDED.linkedin_profile_id,
          personal_email = EXCLUDED.personal_email,
          work_email = EXCLUDED.work_email,
          mobile_phone = EXCLUDED.mobile_phone,
          direct_phone = EXCLUDED.direct_phone,
          location = EXCLUDED.location,
          country = EXCLUDED.country,
          state = EXCLUDED.state,
          city = EXCLUDED.city,
          timezone = EXCLUDED.timezone,
          skills = EXCLUDED.skills,
          experience = EXCLUDED.experience,
          education = EXCLUDED.education,
          certifications = EXCLUDED.certifications,
          interests = EXCLUDED.interests,
          social_profiles = EXCLUDED.social_profiles,
          last_active = EXCLUDED.last_active,
          response_rate = EXCLUDED.response_rate,
          email_status = EXCLUDED.email_status,
          phone_status = EXCLUDED.phone_status,
          linkedin_status = EXCLUDED.linkedin_status,
          data_quality_score = EXCLUDED.data_quality_score,
          provider_source = EXCLUDED.provider_source,
          enriched = EXCLUDED.enriched,
          last_enriched_at = EXCLUDED.last_enriched_at
        RETURNING *
      `

      const values = [
        prospectData.first_name,
        prospectData.last_name,
        prospectData.email,
        prospectData.phone,
        prospectData.title,
        prospectData.seniority,
        prospectData.department,
        prospectData.company_domain,
        prospectData.company_name,
        prospectData.linkedin_url,
        prospectData.linkedin_profile_id,
        prospectData.personal_email,
        prospectData.work_email,
        prospectData.mobile_phone,
        prospectData.direct_phone,
        prospectData.location,
        prospectData.country,
        prospectData.state,
        prospectData.city,
        prospectData.timezone,
        JSON.stringify(prospectData.skills || []),
        JSON.stringify(prospectData.experience || []),
        JSON.stringify(prospectData.education || []),
        JSON.stringify(prospectData.certifications || []),
        JSON.stringify(prospectData.interests || []),
        JSON.stringify(prospectData.social_profiles || []),
        prospectData.last_active,
        prospectData.response_rate,
        prospectData.email_status,
        prospectData.phone_status,
        prospectData.linkedin_status,
        prospectData.data_quality_score,
        prospectData.provider_source,
        prospectData.enriched || true,
        new Date()
      ]

      const result = await this.pool.query(query, values)
      
      // Cache in Redis for quick access
      if (prospectData.email) {
        await this.redis.setex(`prospect:${prospectData.email}`, 3600, JSON.stringify(result.rows[0]))
      }
      
      console.log(`Prospect ${prospectData.email} stored/updated in database`)
      return result.rows[0]
    } catch (error) {
      console.error('Error upserting prospect:', error)
      throw error
    }
  }

  // Get prospect by email
  async getProspectByEmail(email: string): Promise<any> {
    try {
      // Check Redis cache first
      const cached = await this.redis.get(`prospect:${email}`)
      if (cached) {
        return JSON.parse(cached)
      }

      // Query database
      const query = 'SELECT * FROM prospects WHERE email = $1'
      const result = await this.pool.query(query, [email])
      
      if (result.rows.length > 0) {
        // Cache in Redis
        await this.redis.setex(`prospect:${email}`, 3600, JSON.stringify(result.rows[0]))
        return result.rows[0]
      }
      
      return null
    } catch (error) {
      console.error('Error getting prospect:', error)
      throw error
    }
  }
}

// Export service instances
export const companyService = new CompanyService()
export const prospectService = new ProspectService()
