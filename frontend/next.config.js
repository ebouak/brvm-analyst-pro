const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dossier de build surchargeable, pour faire coexister un serveur de DEV et
  // un serveur de PROD sur la même copie du dépôt. Sans ça les deux se
  // disputent `.next` et le dev plante sur un `EINVAL readlink` en lisant les
  // manifestes de production. Vercel n'a pas la variable et garde `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Retire l'en-tête de fingerprinting `X-Powered-By: Next.js`.
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer', 'docx'],
    // Permet l'upload de PDF/images via Server Action (défaut 1 Mo trop bas).
    serverActions: { bodySizeLimit: '10mb' },
    // Active instrumentation.ts (init Sentry serveur/edge) sous Next 14.
    instrumentationHook: true,
    // NB : `staleTimes` retiré — suspecté de casser la navigation par <Link>
    // depuis la page d'entrée /dashboard (test e2e). À réévaluer plus tard.
  },
  // ESLint disponible via `npm run lint` mais NON bloquant au build : le code
  // existant n'a jamais été linté → on évite de casser les déploiements Vercel.
  // À durcir progressivement (corriger puis passer à false).
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Squelette premium fusionné avec la vraie page backtest (audit 2026-06-12)
      { source: '/premium/backtesting', destination: '/backtest', permanent: true },
      // /rendement-reel fusionné dans /rendement-vrai (vue « cours seul · réel »).
      // 308 edge — les query params entrants (code, annees) sont conservés et
      // fusionnés avec mode=reel. Consolide le SEO des deux anciennes URL.
      { source: '/rendement-reel', destination: '/rendement-vrai?mode=reel', permanent: true },
    ];
  },
  // En-têtes de sécurité HTTP sur toutes les routes. (Étaient définis dans un
  // next.config.mjs ignoré — Next ne lit que ce next.config.js → ils n'étaient
  // jamais servis. Consolidés ici.)
  async headers() {
    // CSP en mode BLOQUANT. Allowlist vérifiée contre les origines réellement
    // chargées par le navigateur : polices (Google Fonts + Fontshare), Turnstile,
    // Supabase, Sentry, replays formations (YouTube/Vimeo). 'unsafe-inline'/
    // 'unsafe-eval' requis par Next + lightweight-charts. (DeepSeek/Resend sont
    // appelés côté serveur → hors CSP navigateur.)
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      // 'self' (pas 'none') pour autoriser l'embarquement same-origin : la page
      // /formations/academy charge /academy/index.html dans un iframe. Protection
      // anti-clickjacking tiers préservée (cohérent avec X-Frame-Options SAMEORIGIN).
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cdn.plot.ly https://eu-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
      "img-src 'self' data: blob: https:",
      // Vidéos des modules formation : MP4 hébergés sur Supabase Storage (ou blob local).
      "media-src 'self' blob: data: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.de.sentry.io https://challenges.cloudflare.com https://api.fontshare.com https://eu.i.posthog.com https://eu-assets.i.posthog.com",
      "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "worker-src 'self' blob:",
    ].join('; ');

    // CSP des pages embarquables (/embed/*) : politique identique, mais
    // `frame-ancestors *` — c'est tout l'objet des widgets (médias partenaires).
    const cspEmbed = csp.replace("frame-ancestors 'self'", 'frame-ancestors *');

    return [
      {
        // Tout SAUF /embed : anti-clickjacking tiers intact.
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // anti-clickjacking tiers, autorise iframe same-origin
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
          // Isolation du contexte de navigation (anti XS-Leaks / cross-window).
          // 'allow-popups' préserve les flux OAuth/popup éventuels.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // NB : pas de CSP Trusted-Types en report-only. Next.js 14 n'est pas
          // conforme Trusted-Types (son bundler crée des TrustedScriptURL hors
          // policy) → l'en-tête report-only ne bloquait rien (0 protection
          // active) et ne faisait que polluer la console. La vraie CSP bloquante
          // ci-dessus (`Content-Security-Policy`) reste la protection effective.
        ],
      },
      {
        // Widgets embarquables par des sites tiers.
        // AUCUN X-Frame-Options ici : l'en-tête legacy PRIME sur la CSP dans
        // tous les navigateurs — le laisser annulerait silencieusement
        // l'ouverture. Pas de COOP non plus (isolerait l'iframe du parent).
        // Pages en lecture seule, sans session ni formulaire : rien à détourner.
        source: '/embed/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: cspEmbed },
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
