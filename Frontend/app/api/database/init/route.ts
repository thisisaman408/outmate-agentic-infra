// API route to initialize database connections and schema
import { NextRequest, NextResponse } from 'next/server'
import { initializeConnections, testDatabaseConnection, testRedisConnection } from '@/lib/database'
import { companyService } from '@/lib/database/services'

export async function GET() {
  try {
    console.log('Initializing database connections...')
    
    // Test connections
    const dbConnected = await testDatabaseConnection()
    const redisConnected = await testRedisConnection()
    
    if (!dbConnected) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: 'Please check your database configuration in .env file'
        },
        { status: 500 }
      )
    }
    
    if (!redisConnected) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Redis connection failed',
          details: 'Please check your Redis configuration in .env file'
        },
        { status: 500 }
      )
    }
    
    // Initialize database schema
    const schemaInitialized = await companyService.initialize()
    
    if (!schemaInitialized) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database schema initialization failed'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      connections: {
        database: dbConnected,
        redis: redisConnected
      },
      schema: schemaInitialized
    })
    
  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    if (action === 'test-connections') {
      const dbConnected = await testDatabaseConnection()
      const redisConnected = await testRedisConnection()
      
      return NextResponse.json({
        success: true,
        connections: {
          database: dbConnected,
          redis: redisConnected
        }
      })
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
