/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 6에서 각 대시보드 앱을 zone으로 붙일 자리.
  //   async rewrites() {
  //     return [{ source: '/online/:path*', destination: `${process.env.ZONE_ONLINE}/online/:path*` }];
  //   },
};

module.exports = nextConfig;
