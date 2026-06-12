/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'docx'],
  },
  async redirects() {
    return [
      // Squelette premium fusionné avec la vraie page backtest (audit 2026-06-12)
      { source: '/premium/backtesting', destination: '/backtest', permanent: true },
    ];
  },
};

module.exports = nextConfig;
