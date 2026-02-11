import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

// Cache the data in memory to avoid reading disk on every request
// In a serverless environment (like Vercel), this cache might be reset frequently, 
// but it helps for persistent containers or local dev.
let regionsData: Record<string, any> | null = null
let countriesData: any[] | null = null

async function loadData() {
    try {
        if (!regionsData) {
            const regionsPath = path.join(process.cwd(), 'input_data', 'region.json')
            const fileContents = await fs.readFile(regionsPath, 'utf8')
            regionsData = JSON.parse(fileContents)
        }
        if (!countriesData) {
            const countriesPath = path.join(process.cwd(), 'input_data', 'HQ_Country.json')
            const fileContents = await fs.readFile(countriesPath, 'utf8')
            countriesData = JSON.parse(fileContents)
        }
    } catch (error) {
        console.error("Error loading location data:", error)
    }
}

export async function POST(request: Request) {
    try {
        const { query, limit = 50 } = await request.json()

        if (!query || typeof query !== 'string' || query.length < 2) {
            return NextResponse.json([])
        }

        await loadData()

        const searchLower = query.toLowerCase()
        const results: { label: string; value: string; type: 'country' | 'region' }[] = []
        const seenValues = new Set<string>()

        // 1. Search Countries (High priority)
        if (countriesData) {
            const matchedCountries = countriesData.filter((c: any) =>
                c.name.toLowerCase().includes(searchLower)
            ).slice(0, limit)

            matchedCountries.forEach((c: any) => {
                if (!seenValues.has(c.name)) {
                    results.push({
                        label: c.name,
                        value: c.name, // FIXED: Use country name instead of ISO code for CrustData API
                        type: 'country'
                    })
                    seenValues.add(c.name)
                }
            })
        }

        // 2. Search Regions (Stop if limit reached)
        if (regionsData && results.length < limit) {
            const regionKeys = Object.keys(regionsData)
            // Basic includes search; for 4MB file, array iteration is acceptable but could be optimized
            // if performance becomes an issue (e.g., pre-computed index).
            for (const regionName of regionKeys) {
                if (regionName.toLowerCase().includes(searchLower)) {
                    if (!seenValues.has(regionName)) {
                        results.push({
                            label: regionName,
                            value: regionName, // FIXED: Use region name instead of ID for CrustData API
                            type: 'region'
                        })
                        seenValues.add(regionName)
                    }
                    if (results.length >= limit) break
                }
            }
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error("Location search error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
