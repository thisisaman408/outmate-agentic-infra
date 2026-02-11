// Database connection utilities
import { Pool } from 'pg'
import Redis from 'ioredis'

// Database configuration from environment variables
// Parse DATABASE_URL for Supabase PostgreSQL
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:Mayank%401232617@db.sikcffedycienprvobow.supabase.co:5432/postgres'

// Parse DATABASE_URL to extract connection details
const parseDatabaseUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1), // Remove leading slash
      user: urlObj.username,
      password: decodeURIComponent(urlObj.password),
      ssl: { rejectUnauthorized: false } // Required for Supabase
    }
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error)
    // Fallback to default values
    return {
      host: 'db.sikcffedycienprvobow.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Mayank@1232617',
      ssl: { rejectUnauthorized: false }
    }
  }
}

const dbConfig = {
  ...parseDatabaseUrl(databaseUrl),
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // how long to wait when connecting a new client
}

// Redis configuration from environment variables
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
}

// PostgreSQL connection pool
let pool: Pool | null = null

export const getDatabasePool = (): Pool => {
  if (!pool) {
    pool = new Pool(dbConfig)
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
    
    // Handle connection errors
    pool.on('connect', (client) => {
      console.log('New database client connected')
    })
    
    console.log('Database pool created with config:', dbConfig)
  }
  return pool
}

// Redis connection
let redisClient: Redis | null = null

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig)
    
    redisClient.on('connect', () => {
      console.log('Redis client connected')
    })
    
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err)
    })
    
    redisClient.on('close', () => {
      console.log('Redis client disconnected')
    })
  }
  return redisClient
}

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const pool = getDatabasePool()
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    console.log('Database connection successful')
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const redis = getRedisClient()
    await redis.ping()
    console.log('Redis connection successful')
    return true
  } catch (error) {
    console.error('Redis connection failed:', error)
    return false
  }
}

// Initialize connections
export const initializeConnections = async (): Promise<{ db: boolean; redis: boolean }> => {
  const dbConnected = await testDatabaseConnection()
  const redisConnected = await testRedisConnection()
  
  return { db: dbConnected, redis: redisConnected }
}

// Close connections
export const closeConnections = async (): Promise<void> => {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database pool closed')
  }
  
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis client closed')
  }
}
