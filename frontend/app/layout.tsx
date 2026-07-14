import type { Metadata, Viewport } from 'next';
import './globals.css';
import ConditionalShell from '@/components/ConditionalShell';
import NonEmbedChrome from '@/components/layout/NonEmbedChrome';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import OnboardingModal from '@/components/OnboardingModal';
import { BeginnerModeProvider } from '@/lib/beginner-mode';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import SplashScreen from '@/components/brand/SplashScreen';
import { CookieBanner } from '@/components/consent/CookieBanner';
import PostHogInit from '@/components/analytics/PostHogInit';
import { createClient } from '@/lib/supabase/server';

// URL canonique du site. Défaut = domaine cible westbourse.com ; surchargeable
// via NEXT_PUBLIC_SITE_URL (mettre l'URL RÉELLEMENT servie tant que le domaine
// n'est pas branché, sinon les canonical/OG pointent vers un domaine inactif).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // UX fix: template de titre pour que chaque page affiche "Page | WESTBOURSE".
  title: {
    default: 'WESTBOURSE — Cours BRVM, Notes A–F & Analyses Quantitatives',
    template: '%s | WESTBOURSE',
  },
  description:
    "Plateforme d'analyse BRVM : cours toutes les 15 min, notation A–F sur les actions, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit.",
  keywords: [
    'BRVM', 'bourse BRVM', 'cours BRVM', 'investir BRVM', 'BRVM en direct',
    'actions UEMOA', 'bourse UEMOA', 'investissement Afrique de l’Ouest',
    'cours bourse Côte d’Ivoire', 'SONATEL', 'ECOBANK BRVM',
    'SGI BRVM', 'SGI BRVM comparatif', 'analyse action BRVM', 'note A-F action BRVM',
    'simulateur bourse UEMOA', 'fondamentaux BRVM', 'diagnostic IA BRVM', 'brief BRVM quotidien',
    'comment investir BRVM débutant', 'WESTBOURSE',
  ],
  authors: [{ name: 'WESTBOURSE', url: SITE_URL }],
  creator: 'WESTBOURSE',
  publisher: 'WESTBOURSE',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Code de vérification Google Search Console : coller dans l'env
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (aucun placeholder dans le source).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WESTBOURSE',
  },
  // Équivalent standard de `apple-mobile-web-app-capable` (déprécié seul).
  other: { 'mobile-web-app-capable': 'yes' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    alternateLocale: ['fr_CI', 'fr_SN'],
    url: SITE_URL,
    siteName: 'WESTBOURSE',
    title: 'WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs',
    description:
      'Cours BRVM toutes les 15 min, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit — créez votre compte en 1 minute.',
    // og:image généré automatiquement par app/opengraph-image.tsx (1200×630).
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs',
    description:
      'Cours BRVM toutes les 15 min, note A–F sur les actions, simulateur et brief quotidien. Gratuit.',
    // twitter:image = fallback sur og:image (généré par opengraph-image.tsx).
  },
  alternates: {
    canonical: SITE_URL,
    types: { 'application/rss+xml': [{ url: `${SITE_URL}/api/rss`, title: 'WESTBOURSE — Actualités & briefs BRVM' }] },
  },
};

// JSON-LD Schema.org (Organization + WebSite + FinancialService) pour les rich snippets.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'WESTBOURSE',
      alternateName: 'West Bourse',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
      description:
        "Plateforme SaaS d'analyse et d'aide à la décision pour les investisseurs sur la BRVM (Bourse Régionale des Valeurs Mobilières — UEMOA).",
      /**
       * `sameAs` — LA balise qui permet à Google de construire l'ENTITÉ « WESTBOURSE ».
       *
       * Sans elle, le moteur ne dispose d'aucune corroboration externe : il ignore
       * si la marque existe vraiment. « Westbourse » est de surcroît à une lettre de
       * « Westbourne » (lieu-dit britannique bien établi) — Google est donc enclin
       * à traiter la requête comme une faute de frappe. Des profils sociaux
       * officiels, déclarés ici, lèvent l'ambiguïté.
       *
       * On ne liste QUE des profils qui existent réellement : un `sameAs` pointant
       * vers une page 404 dégrade la confiance au lieu de la construire. Ajouter
       * chaque URL au fur et à mesure de la création des comptes.
       */
      sameAs: [
        // 'https://www.linkedin.com/company/westbourse',
        // 'https://x.com/westbourse',
        // 'https://www.facebook.com/westbourse',
        // 'https://www.youtube.com/@westbourse',
      ].filter(Boolean),
      areaServed: [
        { '@type': 'Country', name: "Côte d'Ivoire" },
        { '@type': 'Country', name: 'Sénégal' },
        { '@type': 'Country', name: 'Bénin' },
        { '@type': 'Country', name: 'Burkina Faso' },
        { '@type': 'Country', name: 'Mali' },
        { '@type': 'Country', name: 'Niger' },
        { '@type': 'Country', name: 'Togo' },
        { '@type': 'Country', name: 'Guinée-Bissau' },
      ],
      knowsAbout: ['BRVM', 'UEMOA', 'Bourse Régionale des Valeurs Mobilières', 'investissement', 'actions', 'obligations'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'WESTBOURSE',
      inLanguage: 'fr',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/societes?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FinancialService',
      '@id': `${SITE_URL}/#service`,
      name: 'WESTBOURSE — Analyse BRVM',
      url: SITE_URL,
      description:
        "Données de marché BRVM, notation quantitative A–F, fondamentaux d'entreprises, simulateur d'investissement et brief quotidien.",
      areaServed: ['Côte d’Ivoire', 'Sénégal', 'Burkina Faso', 'Mali', 'Bénin', 'Togo', 'Niger', 'Guinée-Bissau'],
      serviceType: "Plateforme d'analyse boursière",
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'XOF',
        description: 'Accès gratuit aux cours, notes et fondamentaux BRVM',
      },
      provider: { '@id': `${SITE_URL}/#organization` },
    },
    {
      // FAQ — doit refléter la FAQ VISIBLE de la landing (components/landing/LandingFaq).
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Est-ce vraiment gratuit ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Oui. Les cours, la note A–F et les fondamentaux sont accessibles gratuitement après création d'un compte — sans carte bancaire. L'abonnement Premium (Diagnostic IA) est optionnel.",
          },
        },
        {
          '@type': 'Question',
          name: 'Les données sont-elles fiables ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Les cours proviennent du portail public de la BRVM (actualisés ~15 min en séance) et les fondamentaux sont extraits des états financiers publiés par les sociétés. Aucune donnée n’est inventée.',
          },
        },
        {
          '@type': 'Question',
          name: 'Qu’est-ce que la note A–F ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Une note quantitative calculée à partir de critères objectifs (tendance, momentum, volume, fondamentaux). Elle synthétise l'analyse, mais ne constitue pas un conseil d'investissement.",
          },
        },
        {
          '@type': 'Question',
          name: 'Comment passer à Premium ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Depuis votre compte, via la page Tarifs. Le Premium débloque le Diagnostic IA (analyse détaillée par société), sans engagement.',
          },
        },
      ],
    },
  ],
};

export const viewport: Viewport = {
  themeColor: '#07080a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Session + profil. CRITIQUE : ce bloc ne doit JAMAIS jeter — une exception
  // ici fait tomber TOUTES les pages sur l'error boundary globale (« Une
  // erreur est survenue »). En cas d'indisponibilité Auth/DB, on retombe sur
  // l'état déconnecté (shell public) au lieu de casser le site.
  let hasUser = false;
  let isAdmin = false;
  let isPremium = false;
  let onboardingDone = true;
  let initialBeginner = false;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    hasUser = Boolean(user);
    isAdmin = user?.email === 'ebouak@gmail.com';
    isPremium = isAdmin;
    if (user) {
      // Une seule requête profiles (au lieu de deux variantes) — -1 round trip.
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, onboarding_done, mode_debutant')
        .eq('id', user.id)
        .maybeSingle();
      if (!isPremium) isPremium = profile?.is_premium ?? false;
      onboardingDone = profile?.onboarding_done ?? isAdmin; // superadmin = skip onboarding
      initialBeginner = profile?.mode_debutant ?? false;
    }
  } catch {
    // Auth/DB injoignable : rendu public par défaut, jamais d'écran d'erreur global.
  }

  return (
    <html lang="fr" className="dark">
      <head>
        {/* Anti-flash mode clair/sombre : pose data-theme AVANT le premier
            paint (script synchrone, pas de defer/async) — sinon flash du
            mauvais thème au chargement. Priorité : choix utilisateur
            persisté (localStorage) > préférence système > sombre (défaut). */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('westbourse-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
        {/* Polices chargées en <link> (découverte immédiate) plutôt qu'en @import
            CSS render-blocking. preconnect réchauffe les connexions → meilleur FCP. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=supreme@400,500,700,800&f[]=bespoke-serif@400,500,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body className="text-white antialiased font-sans">
        {/* JSON-LD Schema.org (rich snippets) */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Chrome applicatif : entièrement masqué sur /embed/* (widgets tiers :
            aucun cookie, aucun traceur). ConditionalShell reste hors du garde,
            car c'est lui qui rend les enfants. */}
        <NonEmbedChrome>
          <SplashScreen />
        </NonEmbedChrome>
        <ConsentProvider>
          <BeginnerModeProvider initial={initialBeginner}>
            <ConditionalShell isPremium={isPremium} isAdmin={isAdmin}>{children}</ConditionalShell>
            <NonEmbedChrome>
              <CommandPaletteProvider />
              <ServiceWorkerRegister />
              {hasUser && !onboardingDone && <OnboardingModal />}
              <CookieBanner />
              <PostHogInit />
            </NonEmbedChrome>
          </BeginnerModeProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
