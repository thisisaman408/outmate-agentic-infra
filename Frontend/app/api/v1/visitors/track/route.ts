import { NextRequest, NextResponse } from "next/server"

/**
 * Tracking pixel proxy — intercepts /api/v1/visitors/track before the
 * Next.js rewrite fires.
 *
 * Why this exists:
 *   Next.js rewrites proxy to the backend but do NOT forward the real client IP.
 *   Every visitor would appear as 127.0.0.1. This route explicitly extracts the
 *   real IP from proxy headers and injects it before forwarding.
 *
 * CORS:
 *   The pixel is embedded on third-party customer sites. Every response here
 *   must return Access-Control-Allow-Origin so cross-origin POSTs succeed.
 */

const BACKEND_URL =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://dev.outmate.ai"

function extractRealIp(request: NextRequest): string {
    const candidates = [
        request.headers.get("cf-connecting-ip"),                       // Cloudflare
        request.headers.get("x-real-ip"),                              // nginx / load balancer
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(), // standard proxy chain
        request.headers.get("true-client-ip"),                         // Akamai / CF Enterprise
        request.headers.get("x-client-ip"),
    ]
    return candidates.find(ip => ip && ip !== "::1" && ip !== "127.0.0.1") || "unknown"
}

function corsHeaders(origin: string | null) {
    return {
        // Echo the origin so we can return Allow-Credentials: true. Wildcard
        // is illegal alongside credentials per the CORS spec, and sendBeacon
        // always sends credentialed requests cross-origin.
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Pixel-Key",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }
}

// Handle CORS preflight — browsers send this before cross-origin POSTs
export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get("origin")
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
    const origin = request.headers.get("origin")
    const ip = extractRealIp(request)

    try {
        const body = await request.text()

        const res = await fetch(`${BACKEND_URL}/api/v1/visitors/track`, {
            method: "POST",
            headers: {
                "Content-Type": request.headers.get("content-type") || "application/json",
                "X-Forwarded-For": ip,
                "X-Real-IP": ip,
                "User-Agent": request.headers.get("user-agent") || "",
                "X-Pixel-Key": request.headers.get("x-pixel-key") || "",
                "Referer": request.headers.get("referer") || "",
            },
            body,
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, {
            status: res.status,
            headers: corsHeaders(origin),
        })
    } catch {
        // Always return 200 to the pixel — silently drop on backend errors
        // to avoid JS errors on customer sites
        return NextResponse.json(
            { status: "ok" },
            { status: 200, headers: corsHeaders(origin) }
        )
    }
}
