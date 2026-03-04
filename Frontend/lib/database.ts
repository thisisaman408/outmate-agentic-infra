// Database connection utilities
import { Pool } from 'pg'
import Redis, { RedisOptions } from 'ioredis'

// NOTE: the code in this file **must only run on the server** (Next.js Node
// environment).  We guard later against accidental client‑side execution
// so that e.g. React components imported into the browser don't attempt to
// open TCP sockets.

// Database configuration from environment variables
// (Supabase uses a normal PostgreSQL URL with TLS requirements.)
const databaseUrl = process.env.DATABASE_URL || ''

// helper to parse a postgres URL into connection parameters.  When the
// environment variable is missing we simply return an empty object; callers
// should handle the lack of configuration gracefully.
const parseDatabaseUrl = (url: string) => {
  if (!url) return {}
  try {
    const urlObj = new URL(url)
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1), // Remove leading slash
      user: urlObj.username,
      password: decodeURIComponent(urlObj.password),
      ssl: { rejectUnauthorized: false } // Supabase requires TLS
    }
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error)
    return {}
  }
}

const dbConfig = {
  ...parseDatabaseUrl(databaseUrl),
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // how long to wait when connecting a new client
}

// Redis configuration from environment variables.  We keep the simple host/
// port form for Next.js, but we also support a full REDIS_URL which is the
// recommended way to configure managed Redis providers.
const redisUrl = process.env.REDIS_URL || ''
const redisOpts: RedisOptions = redisUrl
  ? { url: redisUrl } as any
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    }

// add robust retry strategy and debug event handlers
const baseRedisOptions: RedisOptions = {
  ...redisOpts,
  // Connection and retry tuning to make server-side reconnects more resilient
  connectTimeout: 5000,
  maxRetriesPerRequest: 5,
  enableReadyCheck: true,
  // stop after 10 attempts
  retryStrategy(times) {
    if (times > 10) return null
    // linear backoff capped at 2s
    return Math.min(times * 50, 2000)
  },
  reconnectOnError(err) {
    // allow reconnection for common transient errors
    try {
      const msg = String(err && (err as Error).message || '')
      if (/ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT|READONLY|CONNECTION_BROKEN/i.test(msg)) {
        console.warn('Redis transient error, will attempt reconnect:', msg)
        return true
      }
    } catch (_) {
      // fallthrough to allow reconnect
    }
    return true
  },
}

// PostgreSQL connection pool
let pool: Pool | null = null

export const getDatabasePool = (): Pool => {
  if (typeof window !== 'undefined') {
    throw new Error('Database pool should only be created on the server side')
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured; cannot create pool')
  }

  if (!pool) {
    pool = new Pool(dbConfig)

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })

    // Handle connection errors
    pool.on('connect', async (client) => {
      console.log('New database client connected')
      try {
        await client.query(`SET statement_timeout = 60000`)
      } catch (timeoutError) {
        console.error('Failed to set statement_timeout:', timeoutError)
      }
    })

    console.log('Database pool created with config:', dbConfig)
  }
  return pool
}

// Redis connection
let redisClient: Redis | null = null

export const getRedisClient = (): Redis => {
  if (typeof window !== 'undefined') {
    // this function should not be invoked on the browser
    throw new Error('Redis client must only be accessed on the server side')
  }

  if (!redisClient) {
    if (!redisUrl && !process.env.REDIS_HOST) {
      throw new Error('Redis configuration missing (set REDIS_URL or REDIS_HOST)')
    }

    redisClient = new Redis(baseRedisOptions)

    redisClient.on('connect', () => {
      console.log('Redis client connected')
    })
    redisClient.on('ready', () => {
      console.log('Redis client ready')
    })
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err)
    })
    redisClient.on('close', () => {
      console.warn('Redis client disconnected')
    })
    redisClient.on('reconnecting', (delay) => {
      console.log(`Redis client reconnecting in ${delay}ms`)
    })
  }
  return redisClient
}

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  if (typeof window !== 'undefined') return false
  if (!databaseUrl) {
    console.error('DATABASE_URL not set; cannot test connection')
    return false
  }
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
  if (typeof window !== 'undefined') return false
  try {
    const redis = getRedisClient()
    const resp = await redis.ping()
    console.log('Redis connection successful', resp)
    return true
  } catch (error) {
    console.error('Redis connection failed:', error)
    return false
  }
}

// Initialize connections (only server side)
export const initializeConnections = async (): Promise<{ db: boolean; redis: boolean }> => {
  if (typeof window !== 'undefined') {
    return { db: false, redis: false }
  }
  const dbConnected = await testDatabaseConnection()
  const redisConnected = await testRedisConnection()
  
  return { db: dbConnected, redis: redisConnected }
}

// Close connections (clean up when running in long-lived process)
export const closeConnections = async (): Promise<void> => {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database pool closed')
  }
  
  if (redisClient) {
    try {
      await redisClient.quit()
    } catch (e) {
      console.warn('Failed to quit Redis client', e)
    }
    redisClient = null
    console.log('Redis client closed')
  }
}
