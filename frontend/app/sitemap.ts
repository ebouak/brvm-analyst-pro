import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/societes`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/simulateur`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/brief`, changeFrequency: 'daily', priority: 0.7 },
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
