import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/societes`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/actualites`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/brief`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/simulateur`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/comparateur-sgi`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/formations`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/simulateur-budget`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/debutant`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/methodologie`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/developers`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/cgu`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const supabase = createPublicClient();
    const { data: instruments } = await supabase
      .from('brvm_instruments')
      .select('code')
      .eq('type', 'action')
      .eq('actif', true);

    const companyPages: MetadataRoute.Sitemap = (instruments ?? []).map((i) => ({
      url: `${SITE_URL}/societes/${i.code}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    return [...staticPages, ...companyPages];
  } catch {
    // Base inaccessible au build : on publie au moins les pages statiques.
    return staticPages;
  }
}
