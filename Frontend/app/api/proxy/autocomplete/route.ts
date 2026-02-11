import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { field, query, limit } = body;

        const authToken = process.env.CRUSTDATA_AUTH_TOKEN || "8ec44093901b0453d538605c317bd60b"; // Fallback for dev

        if (!query) {
            return NextResponse.json({ options: [] });
        }

        const response = await fetch('https://api.crustdata.com/screener/companydb/autocomplete', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                field: field || 'hq_location',
                query: query,
                limit: limit || 10
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("CrustData API Error:", response.status, errorText);
            return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: response.status });
        }

        const data = await response.json();
        // The API structure for response isn't explicitly detailed in the markdown provided in the "Example Request" section, 
        // but typically autocomplete returns an array of strings or objects. 
        // However, looking at the user's "Quick Example", it doesn't show the response format.
        // I will assume it returns { values: [...] } or { suggestions: [...] } or just an array.
        // Let's assume standard behavior and default to passing data through, or refining if we knew.
        // Reviewing the doc: "Get possible values for any field..."
        // Let's assume the response is the direct JSON from CrustData.

        return NextResponse.json(data);

    } catch (error) {
        console.error("Autocomplete Proxy Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
