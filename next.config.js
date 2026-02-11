/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const baseSecurityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]

    const hstsHeader =
      process.env.NODE_ENV === 'production'
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ]
        : []

    return [
      {
        source: '/api/:path*',
        headers: [
          ...baseSecurityHeaders,
          ...hstsHeader,
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/:path*',
        headers: [...baseSecurityHeaders, ...hstsHeader],
      },
    ]
  },
}

module.exports = nextConfig
