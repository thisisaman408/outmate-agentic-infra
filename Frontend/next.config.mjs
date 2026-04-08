/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Long-running agent endpoints (e.g. social-listening/run) can take 60-120s
  // for the full Tavily → BrightData → Apollo → Hunter → LLM pipeline.
  // Default Next.js dev proxy timeout (~30s) was killing these with
  // ECONNRESET / "socket hang up".  Bumped to 10 minutes.
  experimental: {
    proxyTimeout: 600_000,
  },
  async headers() {
    const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA || process.env.GITHUB_SHA || 'unknown'
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Outmate-Build', value: buildSha }],
      },
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
