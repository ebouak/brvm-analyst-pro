import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { buildDividendYield, type YieldRow } from './dividendYield';

/**
 * Chargement d'une page citable : le calque éditable (table citable_pages) + le
 * tableau de données live si `kind='data'`.
 *
 * La lecture passe par la clé anon : la policy RLS ne renvoie que les pages
 * `published = true`. Une page en brouillon est donc invisible du public même si
 * on connaît son slug.
 */

export interface CitablePage {
  slug: string;
  kind: 'data' | 'editorial';
  data_source: string | null;
  title: string;
  question: string;
  short_answer: string;
  intro_md: string | null;
  commentary_md: string | null;
  methodology_md: string | null;
  sources: { label: string; url: string }[];
  faq: { q: string; a: string }[];
  hero_image_url: string | null;
  hero_image_alt: string | null;
  author: string;
  author_role: string | null;
  updated_at: string;
}

export interface DividendDataset {
  rows: YieldRow[];
  /** Date de la séance des cours utilisés (fraîcheur = signal de citation). */
  asOf: string | null;
  /** Exercice de référence commun au classement (ex. 2025). */
  exerciceRef: number;
}

/** La page + son jeu de données (null si la page n'est pas de type data). */
export interface LoadedCitable {
  page: CitablePage;
  dividend?: DividendDataset;
}

export async function loadCitablePage(slug: string): Promise<LoadedCitable | null> {
  const db = createPublicClient();

  const { data } = await db
    .from('citable_pages')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (!data) return null;
  const page = data as CitablePage;

  const result: LoadedCitable = { page };

  if (page.kind === 'data' && page.data_source === 'dividend_yield') {
    result.dividend = await loadDividendDataset();
  }

  return result;
}

/** Jeu de données « rendement du dividende » : dernière séance + dividendes confirmés. */
async function loadDividendDataset(): Promise<DividendDataset> {
  const db = createPublicClient();

  // Dernière séance de cours disponible.
  const { data: lastRow } = await db
    .from('brvm_actions_daily')
    .select('date_marche')
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  const asOf = (lastRow as { date_marche: string } | null)?.date_marche ?? null;
  if (!asOf) return { rows: [], asOf: null, exerciceRef: 0 };

  const [{ data: divs }, { data: cours }] = await Promise.all([
    db.from('dividends').select('code, exercice, montant'),
    db
      .from('brvm_actions_daily')
      .select('code, cours_jour, designation')
      .eq('date_marche', asOf)
      .not('cours_jour', 'is', null),
  ]);

  const { rows, exerciceRef } = buildDividendYield(
    (divs ?? []) as { code: string; exercice: number | null; montant: number }[],
    (cours ?? []) as { code: string; cours_jour: number; designation: string | null }[],
  );

  return { rows, asOf, exerciceRef };
}

/** Slugs publiés — pour le sitemap. */
export async function listPublishedCitableSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  const db = createPublicClient();
  const { data } = await db
    .from('citable_pages')
    .select('slug, updated_at')
    .eq('published', true);
  return (data ?? []) as { slug: string; updated_at: string }[];
}
