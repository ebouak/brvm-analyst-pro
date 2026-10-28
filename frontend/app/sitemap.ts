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
    { url: `${SITE_URL}/secteurs`, changeFrequency: 'daily', priority: 0.8 },
    // Outils publics à contenu UNIQUE : personne d'autre sur la place ne les propose.
    // Ce sont eux qui peuvent capter des requêtes que les concurrents ne couvrent pas.
    { url: `${SITE_URL}/rendement-vrai`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/fiscalite`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/formations`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/formations/academy/lecon-0`, changeFrequency: 'monthly', priority: 0.7 },
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
    const [{ data: instruments }, { data: briefs }, { data: analyses }, { data: articles }] = await Promise.all([
      supabase.from('brvm_instruments').select('code').eq('type', 'action').eq('actif', true),
      supabase.from('brief_daily').select('date_marche').order('date_marche', { ascending: false }).limit(365),
      supabase.from('citable_pages').select('slug, updated_at').eq('published', true),
      // Articles publiés (RLS) ; table absente avant 0167 → data null, sans casser le sitemap.
      supabase.from('articles').select('slug, publie_le').order('publie_le', { ascending: false }).limit(1000),
    ]);

    const companyPages: MetadataRoute.Sitemap = (instruments ?? []).map((i) => ({
      url: `${SITE_URL}/societes/${i.code}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    // Chaque brief de séance = une page indexable datée (contenu figé → never).
    const briefPages: MetadataRoute.Sitemap = (briefs ?? []).map((b) => ({
      url: `${SITE_URL}/brief/${b.date_marche}`,
      lastModified: new Date(b.date_marche),
      changeFrequency: 'never' as const,
      priority: 0.7,
    }));

    // Pages citables (GEO) : contenu unique, mis a jour -> priorite haute.
    const analysePages: MetadataRoute.Sitemap = (analyses ?? []).map((a) => ({
      url: `${SITE_URL}/analyses/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    }));

    // Articles de presse : contenu daté et figé.
    const articlePages: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
      url: `${SITE_URL}/actualites/${a.slug}`,
      lastModified: a.publie_le ? new Date(a.publie_le) : undefined,
      changeFrequency: 'never' as const,
      priority: 0.75,
    }));

    return [...staticPages, ...companyPages, ...briefPages, ...analysePages, ...articlePages];
  } catch {
    // Base inaccessible au build : on publie au moins les pages statiques.
    return staticPages;
  }
}
