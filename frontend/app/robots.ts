import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://westbourse.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/portefeuille', '/parametres', '/account', '/admin', '/premium', '/print'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
