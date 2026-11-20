import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Ajouts du 2026-11-18 (quota CPU Vercel) : chemins rendus à chaque
        // visite et sans valeur de référencement. `/apercu` est déjà en noindex,
        // `/embed/` se lit dans l'iframe d'un site tiers, `/rapports/` et
        // `/auth/` exigent une session, et `/login?…` / `/signup?…` sont les
        // redirections du mur (une variante par lien fermé suivi par le robot).
        // `/login` et `/signup` eux-mêmes restent indexables.
        disallow: [
          '/api/', '/dashboard', '/portefeuille', '/parametres', '/account', '/admin', '/premium', '/print',
          '/apercu', '/embed/', '/rapports/', '/auth/', '/login?', '/signup?',
          // Liens de suivi (redirections comptées) : un robot n'a rien à y voir.
          '/chaine', '/telegram',
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  };
}
