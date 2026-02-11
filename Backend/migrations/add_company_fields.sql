-- Database Migration: Add new columns to companies table
-- Execute this in Supabase SQL Editor

-- Add additional firmographic fields
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS market_segments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS acquisition_status VARCHAR(50);

-- Add headcount growth metrics
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS employee_growth_6m INTEGER,
ADD COLUMN IF NOT EXISTS employee_growth_12m INTEGER,
ADD COLUMN IF NOT EXISTS employee_growth_6m_percent INTEGER,
ADD COLUMN IF NOT EXISTS employee_growth_12m_percent INTEGER;

-- Add department headcount
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS department_headcount JSONB DEFAULT '{}'::jsonb;

-- Add social metrics
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS follower_count INTEGER,
ADD COLUMN IF NOT EXISTS follower_growth_6m INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN companies.categories IS 'Company categories (e.g., B2B, SaaS, Enterprise)';
COMMENT ON COLUMN companies.market_segments IS 'Target market segments';
COMMENT ON COLUMN companies.acquisition_status IS 'Acquisition status (acquired, null for not acquired)';
COMMENT ON COLUMN companies.employee_growth_6m IS '6-month employee growth (absolute)';
COMMENT ON COLUMN companies.employee_growth_12m IS '12-month employee growth (absolute)';
COMMENT ON COLUMN companies.department_headcount IS 'Department-wise headcount as JSON object';
COMMENT ON COLUMN companies.follower_count IS 'LinkedIn follower count';
COMMENT ON COLUMN companies.follower_growth_6m IS '6-month LinkedIn follower growth';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN (
    'categories', 
    'market_segments', 
    'acquisition_status',
    'employee_growth_6m',
    'employee_growth_12m',
    'department_headcount',
    'follower_count',
    'follower_growth_6m'
  )
ORDER BY column_name;
