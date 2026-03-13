/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
