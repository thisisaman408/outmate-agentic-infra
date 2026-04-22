import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
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
  // Turbopack resolves CSS @import from the git root (monorepo parent),
  // not from Frontend/.  Point it at our node_modules so
  // `@import "tailwindcss"` in globals.css resolves correctly.
  turbopack: {
    root: __dirname,
    resolveAlias: {
      tailwindcss: path.resolve(__dirname, 'node_modules/tailwindcss'),
      'tw-animate-css': path.resolve(__dirname, 'node_modules/tw-animate-css'),
    },
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
    const apiUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
