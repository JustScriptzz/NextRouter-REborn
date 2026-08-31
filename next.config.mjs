/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['undici'],
  async rewrites() {
    // On Vercel, proxy API calls to the Render backend so the frontend
    // stays on Vercel while all /api logic runs on Render.
    if (process.env.VERCEL && process.env.RENDER_API_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.RENDER_API_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
