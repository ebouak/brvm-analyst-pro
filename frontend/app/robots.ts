import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/societes', '/simulateur', '/brief', '/methodologie', '/mentions-legales'],
        disallow: ['/api/', '/dashboard', '/portefeuille', '/parametres', '/admin', '/premium', '/print'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
