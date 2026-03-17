import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    const sources = [
        request.headers.get("cf-connecting-ip"),
        request.headers.get("x-real-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        request.headers.get("true-client-ip"),
        request.headers.get("x-client-ip"),
    ]
    const ip = sources.find(ip => ip && ip !== "::1" && ip !== "127.0.0.1") || "unknown"
    return NextResponse.json({ ip })
}
