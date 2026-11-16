import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { versLigne, type LigneNervosite } from './affichage';

const TABLE = 'brvm_nervosite_daily';
const COLONNES = 'date_marche, valeur, rapide, lente, rang, regime, n_titres';
const PAGE = 1000;

/** Séances montrées par la petite courbe du tableau de bord (≈ un an). */
export const SEANCES_COURBE_COURTE = 250;

export interface ResumeNervosite {
  /** Dernière séance publiée (avec ou sans valeur). */
  derniere: LigneNervosite;
  /** Première séance dotée d'une valeur : début de l'historique du rang. */
  debut: string | null;
  /** Dernières séances avec valeur, ordre chronologique (petite courbe). */
  courbe: LigneNervosite[];
}

/**
 * Série complète, ordre chronologique. Paginée : PostgREST tronque à 1000
 * lignes EN SILENCE, et la série en compte plusieurs milliers.
 * `null` = lecture en erreur (table absente tant que 0248 n'est pas
 * appliquée, réseau) — journalisée, jamais remplacée par des zéros.
 */
export async function chargerSerieNervosite(sb: SupabaseClient): Promise<LigneNervosite[] | null> {
  const out: LigneNervosite[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from(TABLE)
      .select(COLONNES)
      .order('date_marche', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('[nervosite] série illisible :', error.message);
      return null;
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows.map(versLigne));
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Résumé pour le tableau de bord : dernière séance + un an de courbe.
 * `null` = rien à montrer (erreur de lecture ou table vide) : le bloc le dit.
 */
export async function chargerResumeNervosite(sb: SupabaseClient): Promise<ResumeNervosite | null> {
  const [recents, premier] = await Promise.all([
    sb.from(TABLE).select(COLONNES).order('date_marche', { ascending: false }).limit(SEANCES_COURBE_COURTE),
    sb.from(TABLE).select('date_marche').not('valeur', 'is', null).order('date_marche', { ascending: true }).limit(1),
  ]);
  if (recents.error) {
    console.error('[nervosite] résumé illisible :', recents.error.message);
    return null;
  }
  const lignes = ((recents.data ?? []) as Record<string, unknown>[]).map(versLigne).reverse();
  const derniere = lignes.at(-1);
  if (!derniere) return null;
  const debut = premier.error ? null : ((premier.data?.[0]?.date_marche as string | undefined)?.slice(0, 10) ?? null);
  return { derniere, debut, courbe: lignes.filter((l) => l.valeur !== null) };
}
