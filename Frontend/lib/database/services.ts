// Database services for storing enriched company and prospect data
import { getDatabasePool, getRedisClient } from '../database'
import { initializeDatabase } from './schema'

// Company database service
export class CompanyService {
  private pool = getDatabasePool()
  private redis = getRedisClient()

  // Initialize database schema
  async initialize(): Promise<boolean> {
    return await initializeDatabase(this.pool)
  }

  // Store or update company data
  async upsertCompany(companyData: any): Promise<any> {
    try {
      const query = `
        INSERT INTO companies (
          domain, name, website, logo_url, description, industry, sub_industry,
          linkedin_industry_category, company_type, founded_year, employee_count_exact,
          employee_count_range, revenue_exact, revenue_range, funding_stage,
          funding_total, last_funding_date, has_recent_funding, headquarters_country,
          headquarters_state, headquarters_city, street, zip_code, locations,
          headquarters_address, location_display, phone, email, personal_email,
          work_email, linkedin_url, twitter_url, facebook_url, instagram_url,
          follower_count, technologies, is_tech_heavy, employee_growth_6m,
          employee_growth_12m, employee_growth_6m_percent, employee_growth_12m_percent,
          growth_category, job_openings_count, web_traffic, seo_score,
          decision_makers_count, locations_distribution_count, acquisition_status,
          data_quality_score, provider_source, enriched, ticker, stock_symbol,
          naics, naics_description, sic_code, sic_code_description, last_enriched_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
          $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58
        )
        ON CONFLICT (domain) DO UPDATE SET
          name = EXCLUDED.name,
          website = EXCLUDED.website,
          logo_url = EXCLUDED.logo_url,
          description = EXCLUDED.description,
          industry = EXCLUDED.industry,
          sub_industry = EXCLUDED.sub_industry,
          linkedin_industry_category = EXCLUDED.linkedin_industry_category,
          company_type = EXCLUDED.company_type,
          founded_year = EXCLUDED.founded_year,
          employee_count_exact = EXCLUDED.employee_count_exact,
          employee_count_range = EXCLUDED.employee_count_range,
          revenue_exact = EXCLUDED.revenue_exact,
          revenue_range = EXCLUDED.revenue_range,
          funding_stage = EXCLUDED.funding_stage,
          funding_total = EXCLUDED.funding_total,
          last_funding_date = EXCLUDED.last_funding_date,
          has_recent_funding = EXCLUDED.has_recent_funding,
          headquarters_country = EXCLUDED.headquarters_country,
          headquarters_state = EXCLUDED.headquarters_state,
          headquarters_city = EXCLUDED.headquarters_city,
          street = EXCLUDED.street,
          zip_code = EXCLUDED.zip_code,
          locations = EXCLUDED.locations,
          headquarters_address = EXCLUDED.headquarters_address,
          location_display = EXCLUDED.location_display,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          personal_email = EXCLUDED.personal_email,
          work_email = EXCLUDED.work_email,
          linkedin_url = EXCLUDED.linkedin_url,
          twitter_url = EXCLUDED.twitter_url,
          facebook_url = EXCLUDED.facebook_url,
          instagram_url = EXCLUDED.instagram_url,
          follower_count = EXCLUDED.follower_count,
          technologies = EXCLUDED.technologies,
          is_tech_heavy = EXCLUDED.is_tech_heavy,
          employee_growth_6m = EXCLUDED.employee_growth_6m,
          employee_growth_12m = EXCLUDED.employee_growth_12m,
          employee_growth_6m_percent = EXCLUDED.employee_growth_6m_percent,
          employee_growth_12m_percent = EXCLUDED.employee_growth_12m_percent,
          growth_category = EXCLUDED.growth_category,
          job_openings_count = EXCLUDED.job_openings_count,
          web_traffic = EXCLUDED.web_traffic,
          seo_score = EXCLUDED.seo_score,
          decision_makers_count = EXCLUDED.decision_makers_count,
          locations_distribution_count = EXCLUDED.locations_distribution_count,
          acquisition_status = EXCLUDED.acquisition_status,
          data_quality_score = EXCLUDED.data_quality_score,
          provider_source = EXCLUDED.provider_source,
          enriched = EXCLUDED.enriched,
          ticker = EXCLUDED.ticker,
          stock_symbol = EXCLUDED.stock_symbol,
          naics = EXCLUDED.naics,
          naics_description = EXCLUDED.naics_description,
          sic_code = EXCLUDED.sic_code,
          sic_code_description = EXCLUDED.sic_code_description,
          last_enriched_at = EXCLUDED.last_enriched_at
        RETURNING *
      `

      const values = [
        companyData.domain,
        companyData.name,
        companyData.website,
        companyData.logo_url,
        companyData.description,
        companyData.industry,
        companyData.sub_industry,
        companyData.linkedin_industry_category,
        companyData.company_type,
        companyData.founded_year,
        companyData.employee_count_exact,
        companyData.employee_count_range,
        companyData.revenue_exact,
        companyData.revenue_range,
        companyData.funding_stage,
        companyData.funding_total,
        companyData.last_funding_date,
        companyData.has_recent_funding,
        companyData.headquarters_country,
        companyData.headquarters_state,
        companyData.headquarters_city,
        companyData.street,
        companyData.zip_code,
        JSON.stringify(companyData.locations || []),
        companyData.headquarters_address,
        companyData.location_display,
        companyData.phone,
        companyData.email,
        companyData.personal_email,
        companyData.work_email,
        companyData.linkedin_url,
        companyData.twitter_url,
        companyData.facebook_url,
        companyData.instagram_url,
        companyData.follower_count,
        JSON.stringify(companyData.technologies || []),
        companyData.is_tech_heavy,
        companyData.employee_growth_6m,
        companyData.employee_growth_12m,
        companyData.employee_growth_6m_percent,
        companyData.employee_growth_12m_percent,
        companyData.growth_category,
        companyData.job_openings_count,
        companyData.web_traffic,
        companyData.seo_score,
        companyData.decision_makers_count,
        companyData.locations_distribution_count,
        companyData.acquisition_status,
        companyData.data_quality_score,
        companyData.provider_source,
        companyData.enriched || true,
        companyData.ticker,
        companyData.stock_symbol,
        companyData.naics,
        companyData.naics_description,
        companyData.sic_code,
        companyData.sic_code_description,
        new Date()
      ]

      const result = await this.pool.query(query, values)
      
      // Cache in Redis for quick access (if Redis is available)
      try {
        await this.redis.setex(`company:${companyData.domain}`, 3600, JSON.stringify(result.rows[0]))
      } catch (redisError) {
        console.warn('Redis caching failed, continuing without cache:', redisError)
      }
      
      console.log(`Company ${companyData.domain} stored/updated in database`)
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
