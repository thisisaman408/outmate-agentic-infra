import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "https://dev.outmate.ai"

function extractRealIp(request: NextRequest): string {
    const sources = [
        request.headers.get("cf-connecting-ip"),
        request.headers.get("x-real-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        request.headers.get("true-client-ip"),
        request.headers.get("x-client-ip"),
    ]
    return sources.find(ip => ip && ip !== "::1" && ip !== "127.0.0.1") || ""
}

export async function POST(request: NextRequest) {
    const ip = extractRealIp(request)

    // Read optional IP override from body (local dev fallback)
    let bodyIp = ""
    try {
        const body = await request.json()
        bodyIp = body?.ip || ""
    } catch { }

    const auth = request.headers.get("authorization") || ""

    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/visitors/test-hit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth,
                // Pass the best available IP so the backend can use it
                "X-Forwarded-For": ip || bodyIp || "127.0.0.1",
                "X-Real-IP": ip || bodyIp || "127.0.0.1",
                "User-Agent": request.headers.get("user-agent") || "",
            },
            body: bodyIp ? JSON.stringify({ ip: bodyIp }) : "{}",
        })
        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    } catch (e) {
        return NextResponse.json({ error: "Cannot reach backend" }, { status: 503 })
    }
}
