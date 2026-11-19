import { createPublicClient } from '@/lib/supabase/public';
import { choisirUne, type ArticleLanding } from './articlesUne';

const CORIS_AVANT_PREMIERE: ArticleLanding = {
  slug: 'coris-bank-ipo-2027',
  type: 'analyse',
  code: null,
  titre: 'Coris en bourse : 81 milliards peuvent-ils faire bouger la BRVM ?',
  chapo: 'Double IPO, origine du cash, précédent Bridge et matrice des comportements investisseurs : une étude illustrée de la liquidité régionale.',
  date_fait: '2026-11-19',
  publie_le: '2026-11-19T20:00:00+00:00',
  href: '/analyses/coris-bank-ipo-2027',
  imageSrc: '/analyses/coris-bank-ipo-2027/opengraph-image',
  featured: true,
  label: 'Avant-première',
};

/**
 * Articles publiés pour la landing. Clé anon : la RLS de 0167 ne laisse voir
 * que les publiés, un brouillon ne peut pas fuiter ici. Toute erreur rend une
 * liste vide — la section disparaît, la landing ne tombe jamais pour elle.
 */
export async function getArticlesLanding(): Promise<{ une: ArticleLanding | null; autres: ArticleLanding[] }> {
  try {
    const { data, error } = await createPublicClient()
      .from('articles')
      .select('slug, type, code, titre, chapo, date_fait, publie_le')
      .order('publie_le', { ascending: false })
      .limit(12);
    if (error) return choisirUne([CORIS_AVANT_PREMIERE], new Date());
    return choisirUne([CORIS_AVANT_PREMIERE, ...((data ?? []) as ArticleLanding[])], new Date());
  } catch {
    return choisirUne([CORIS_AVANT_PREMIERE], new Date());
  }
}
