// Database schema for enriched companies and prospects

// Companies table schema
export const CREATE_COMPANIES_TABLE = `
  CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    logo_url VARCHAR(500),
    description TEXT,
    industry VARCHAR(255),
    sub_industry VARCHAR(255),
    linkedin_industry_category VARCHAR(255),
    company_type VARCHAR(255),
    founded_year INTEGER,
    employee_count_exact INTEGER,
    employee_count_range VARCHAR(100),
    revenue_exact BIGINT,
    revenue_range VARCHAR(100),
    funding_stage VARCHAR(255),
    funding_total BIGINT,
    last_funding_date DATE,
    has_recent_funding BOOLEAN DEFAULT FALSE,
    headquarters_country VARCHAR(255),
    headquarters_state VARCHAR(255),
    headquarters_city VARCHAR(255),
    street VARCHAR(500),
    zip_code VARCHAR(50),
    locations JSONB,
    headquarters_address VARCHAR(500),
    location_display VARCHAR(500),
    phone VARCHAR(500),
    email VARCHAR(500),
    personal_email VARCHAR(500),
    work_email VARCHAR(500),
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    facebook_url VARCHAR(500),
    instagram_url VARCHAR(500),
    follower_count INTEGER,
    technologies JSONB,
    is_tech_heavy BOOLEAN DEFAULT FALSE,
    employee_growth_6m INTEGER,
    employee_growth_12m INTEGER,
    employee_growth_6m_percent DECIMAL(5,2),
    employee_growth_12m_percent DECIMAL(5,2),
    growth_category VARCHAR(255),
    job_openings_count INTEGER,
    web_traffic INTEGER,
    seo_score INTEGER,
    decision_makers_count INTEGER,
    locations_distribution_count INTEGER DEFAULT 0,
    acquisition_status VARCHAR(255),
    data_quality_score INTEGER,
    provider_source VARCHAR(255),
    enriched BOOLEAN DEFAULT FALSE,
    ticker VARCHAR(50),
    stock_symbol VARCHAR(50),
    naics VARCHAR(50),
    naics_description VARCHAR(255),
    sic_code VARCHAR(50),
    sic_code_description VARCHAR(255),
    last_enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

// Prospects table schema
export const CREATE_PROSPECTS_TABLE = `
  CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    job_title VARCHAR(255),
    seniority_level VARCHAR(255),
    department VARCHAR(255),
    job_function VARCHAR(255),
    country VARCHAR(255),
    state VARCHAR(255),
    city VARCHAR(255),
    location_data JSONB,
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    provider_source VARCHAR(255),
    external_id VARCHAR(255),
    raw_data JSONB,
    enriched BOOLEAN DEFAULT FALSE,
    data_quality_score INTEGER,
    email_verified BOOLEAN,
    last_enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

// Enrichment history table
export const CREATE_ENRICHMENT_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS enrichment_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'company' or 'prospect'
    entity_id INTEGER NOT NULL,
    enrichment_type VARCHAR(100) NOT NULL, -- 'basic', 'detailed', 'technographics', etc.
    provider VARCHAR(100) NOT NULL, -- 'explorium', 'contactout', etc.
    credits_used INTEGER DEFAULT 0,
    fields_enriched JSONB,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    enrichment_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

// Indexes for better performance
export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);',
  'CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);',
  'CREATE INDEX IF NOT EXISTS idx_companies_employee_count ON companies(employee_count_exact);',
  'CREATE INDEX IF NOT EXISTS idx_companies_revenue ON companies(revenue_exact);',
  'CREATE INDEX IF NOT EXISTS idx_companies_funding_stage ON companies(funding_stage);',
  'CREATE INDEX IF NOT EXISTS idx_companies_enriched ON companies(enriched);',
  'CREATE INDEX IF NOT EXISTS idx_companies_last_enriched ON companies(last_enriched_at);',
  
  'CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);',
  'CREATE INDEX IF NOT EXISTS idx_prospects_company_id ON prospects(company_id);',
  'CREATE INDEX IF NOT EXISTS idx_prospects_title ON prospects(job_title);',
  'CREATE INDEX IF NOT EXISTS idx_prospects_seniority ON prospects(seniority_level);',
  'CREATE INDEX IF NOT EXISTS idx_prospects_enriched ON prospects(enriched);',
  'CREATE INDEX IF NOT EXISTS idx_prospects_last_enriched ON prospects(last_enriched_at);',
  
  'CREATE INDEX IF NOT EXISTS idx_enrichment_history_entity ON enrichment_history(entity_type, entity_id);',
  'CREATE INDEX IF NOT EXISTS idx_enrichment_history_provider ON enrichment_history(provider);',
  'CREATE INDEX IF NOT EXISTS idx_enrichment_history_created ON enrichment_history(created_at);'
]

// Function to update updated_at timestamp
export const CREATE_UPDATE_TIMESTAMP_FUNCTION = `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';
`

// Triggers for updated_at
export const CREATE_TRIGGERS = [
  'DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;',
  'CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
  
  'DROP TRIGGER IF EXISTS update_prospects_updated_at ON prospects;',
  'CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();'
]

// Initialize database schema
export const initializeDatabase = async (pool: any) => {
  try {
    console.log('Starting database schema initialization...')
    
    // Check if tables already exist first
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `)
    const existingTables = tablesResult.rows.map(row => row.table_name)
    console.log('Existing tables:', existingTables)
    
    // Create companies table
    if (!existingTables.includes('companies')) {
      try {
        await pool.query(CREATE_COMPANIES_TABLE)
        console.log('Companies table created successfully')
      } catch (error) {
        console.error('Error creating companies table:', error)
        throw error
      }
    } else {
      console.log('Companies table already exists, skipping creation')
    }
    
    // Create prospects table
    if (!existingTables.includes('prospects')) {
      try {
        await pool.query(CREATE_PROSPECTS_TABLE)
        console.log('Prospects table created successfully')
      } catch (error) {
        console.error('Error creating prospects table:', error)
        throw error
      }
    } else {
      console.log('Prospects table already exists, skipping creation')
    }
    
    // Create enrichment history table
    if (!existingTables.includes('enrichment_history')) {
      try {
        await pool.query(CREATE_ENRICHMENT_HISTORY_TABLE)
        console.log('Enrichment history table created successfully')
      } catch (error) {
        console.error('Error creating enrichment history table:', error)
        throw error
      }
    } else {
      console.log('Enrichment history table already exists, skipping creation')
    }
    
    // Create indexes (only if tables exist)
    if (existingTables.includes('companies')) {
      for (const indexQuery of CREATE_INDEXES.filter(q => q.includes('companies'))) {
        try {
          await pool.query(indexQuery)
          console.log('Company index created successfully')
        } catch (error) {
          console.error('Error creating company index:', error)
          // Continue even if index creation fails
        }
      }
    }
    
    if (existingTables.includes('prospects')) {
      for (const indexQuery of CREATE_INDEXES.filter(q => q.includes('prospects'))) {
        try {
          await pool.query(indexQuery)
          console.log('Prospect index created successfully')
        } catch (error) {
          console.error('Error creating prospect index:', error)
          // Continue even if index creation fails
        }
      }
    }
    
    // Create function and triggers (only if tables exist)
    if (existingTables.includes('companies') || existingTables.includes('prospects')) {
      try {
        await pool.query(CREATE_UPDATE_TIMESTAMP_FUNCTION)
        console.log('Update timestamp function created successfully')
      } catch (error) {
        console.error('Error creating update function:', error)
        // Continue even if function creation fails
      }
      
      for (const triggerQuery of CREATE_TRIGGERS) {
        try {
          await pool.query(triggerQuery)
          console.log('Trigger created successfully')
        } catch (error) {
          console.error('Error creating trigger:', error)
          // Continue even if trigger creation fails
        }
      }
    }
    
    console.log('Database schema initialized successfully')
    return true
  } catch (error) {
    console.error('Failed to initialize database schema:', error)
    return false
  }
}
