import type { SupabaseClient } from '@supabase/supabase-js';

export type NewsCategory = 'litiges' | 'insiders' | 'concentration_client';

export interface NewsSignal {
  titre: string;
  source: string;
  date: string;
  url: string | null;
}

export interface NewsRow {
  titre: string;
  resume: string | null;
  source_label: string | null;
  source: string;
  date_publication: string;
  source_url: string | null;
}

const KEYWORDS: Record<NewsCategory, string[]> = {
  litiges: ['litige', 'poursuite', 'judiciaire', 'tribunal', 'contentieux', 'sanction'],
  insiders: ['démission', 'dirigeant', 'actionnaire majoritaire', 'cession de titres', 'pdg'],
  concentration_client: ['client principal', 'dépendance', 'contrat majeur'],
};

/** Fonction pure : associe chaque ligne de veille à ses catégories de red flag par mot-clé. */
export function matchNewsSignals(rows: NewsRow[]): Record<NewsCategory, NewsSignal[]> {
  const result: Record<NewsCategory, NewsSignal[]> = { litiges: [], insiders: [], concentration_client: [] };
  for (const row of rows) {
    const text = `${row.titre} ${row.resume ?? ''}`.toLowerCase();
    for (const category of Object.keys(KEYWORDS) as NewsCategory[]) {
      if (KEYWORDS[category].some((kw) => text.includes(kw))) {
        result[category].push({
          titre: row.titre,
          source: row.source_label ?? row.source,
          date: row.date_publication,
          url: row.source_url,
        });
      }
    }
  }
  return result;
}

/** Interroge brvm_news pour un code donné (I/O), puis applique matchNewsSignals (pur). */
export async function findNewsSignals(
  sb: SupabaseClient,
  code: string,
): Promise<Record<NewsCategory, NewsSignal[]>> {
  const { data } = await sb
    .from('brvm_news')
    .select('titre, resume, source_label, source, date_publication, source_url')
    .or(`instrument_code.eq.${code},ticker_codes.cs.{${code}}`)
    .order('date_publication', { ascending: false })
    .limit(200);
  return matchNewsSignals((data ?? []) as NewsRow[]);
}
