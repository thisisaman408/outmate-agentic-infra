/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Next.js 16 uses Turbopack by default — acknowledge it
  turbopack: {},
  async headers() {
    return [
      {
        // HTML pages should always be revalidated so new deployments take effect
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  async rewrites() {
    // In development we may want to proxy requests to a local backend. In
    // production the frontend uses NEXT_PUBLIC_API_URL when making fetch calls,
    // so rewrites are not strictly necessary. Keep this conditional logic to
    // avoid leaking localhost addresses into the build output.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

}

export default nextConfig
