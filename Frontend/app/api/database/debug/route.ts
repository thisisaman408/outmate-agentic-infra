// Debug route to check database schema
import { NextRequest, NextResponse } from 'next/server'
import { getDatabasePool } from '@/lib/database'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 })
  }

  try {
    const pool = getDatabasePool()
    
    // Check prospects table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prospects' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)
    
    const columns = columnsResult.rows.map(row => ({
      name: row.column_name,
      type: row.data_type
    }))
    
    return NextResponse.json({
      success: true,
      table: 'prospects',
      columns: columns
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
