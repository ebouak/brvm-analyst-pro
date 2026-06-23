const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'docx'],
    // Permet l'upload de PDF/images via Server Action (défaut 1 Mo trop bas).
    serverActions: { bodySizeLimit: '10mb' },
    // Active instrumentation.ts (init Sentry serveur/edge) sous Next 14.
    instrumentationHook: true,
  },
  // ESLint disponible via `npm run lint` mais NON bloquant au build : le code
  // existant n'a jamais été linté → on évite de casser les déploiements Vercel.
  // À durcir progressivement (corriger puis passer à false).
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Squelette premium fusionné avec la vraie page backtest (audit 2026-06-12)
      { source: '/premium/backtesting', destination: '/backtest', permanent: true },
    ];
  },
  // En-têtes de sécurité HTTP sur toutes les routes. (Étaient définis dans un
  // next.config.mjs ignoré — Next ne lit que ce next.config.js → ils n'étaient
  // jamais servis. Consolidés ici.)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' }, // anti-clickjacking
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

// Wrap Sentry : capture runtime (erreurs client/serveur/edge) toujours active.
// L'upload des source maps ne s'exécute que si SENTRY_ORG/PROJECT/AUTH_TOKEN sont
// définis (en CI/Vercel) — sinon ignoré, le build reste vert.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
