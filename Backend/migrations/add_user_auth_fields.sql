-- Database migration for authentication support
-- Run this script against the database (e.g., via Supabase SQL editor)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);

COMMENT ON COLUMN users.hashed_password IS 'Bcrypt digest of the user password for authentication';
