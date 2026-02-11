import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

// Cache valid schools data
let schoolsData: string[] | null = null

async function loadData() {
    try {
        if (!schoolsData) {
            const filePath = path.join(process.cwd(), 'input_data', 'schools.json')
            const fileContents = await fs.readFile(filePath, 'utf8')
            schoolsData = JSON.parse(fileContents)
        }
    } catch (error) {
        console.error("Error loading schools data:", error)
    }
}

export async function POST(request: Request) {
    try {
        const { query, limit = 50 } = await request.json()

        if (!query || typeof query !== 'string' || query.length < 2) {
            return NextResponse.json([])
        }

        await loadData()

        if (!schoolsData) {
            return NextResponse.json([])
        }

        const searchLower = query.toLowerCase()
        // Simple filter
        const results = schoolsData
            .filter(school => school.toLowerCase().includes(searchLower))
            .slice(0, limit)

        return NextResponse.json(results)
    } catch (error) {
        console.error("School search error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
