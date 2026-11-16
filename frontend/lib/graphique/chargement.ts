// Graphique avancé : lectures Supabase (navigateur, clé publique soumise à la RLS).
//
// PostgREST tronque toute réponse à 1000 lignes EN SILENCE : l'historique
// d'une valeur en compte près de 5000. Tout passe donc par `toutesLesLignes`,
// qui pagine ET lève à la première erreur — un historique partiel affiché
// comme complet serait pire qu'un message d'erreur.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LigneCours } from './donnees';
import type { Point } from './comparaison';
import { validerDessins, type Dessin } from './dessins';

const LOT = 1000;

async function toutesLesLignes<T>(
  construire: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tout: T[] = [];
  for (let debut = 0; ; debut += LOT) {
    const { data, error } = await construire(debut, debut + LOT - 1);
    if (error) throw new Error(error.message);
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < LOT) break;
  }
  return tout;
}

export const COLONNES_COURS = 'date_marche,cours_jour,ouverture,plus_haut,plus_bas,variation_pct,volume,valeur_echangee';

export function chargerCours(sb: SupabaseClient, code: string): Promise<LigneCours[]> {
  return toutesLesLignes<LigneCours>((a, b) =>
    sb.from('brvm_actions_daily').select(COLONNES_COURS).eq('code', code).order('date_marche', { ascending: true }).range(a, b),
  );
}

export interface Comparable {
  code: string;
  libelle: string;
  type: 'action' | 'indice';
}

export async function chargerComparables(sb: SupabaseClient): Promise<Comparable[]> {
  const { data, error } = await sb
    .from('brvm_instruments')
    .select('code,designation,type')
    .in('type', ['action', 'indice'])
    .eq('actif', true)
    .order('code');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { code: string; designation: string | null; type: 'action' | 'indice' }[]).map((r) => ({
    code: r.code,
    libelle: r.designation ?? r.code,
    type: r.type,
  }));
}

/** Série de clôtures d'une action ou valeurs d'un indice. */
export async function chargerSerie(sb: SupabaseClient, c: Pick<Comparable, 'code' | 'type'>): Promise<Point[]> {
  if (c.type === 'indice') {
    const rows = await toutesLesLignes<{ date_marche: string; valeur: number | string | null }>((a, b) =>
      sb.from('brvm_indices_daily').select('date_marche,valeur').eq('code', c.code).order('date_marche', { ascending: true }).range(a, b),
    );
    return rows.map((r) => ({ date: r.date_marche, valeur: Number(r.valeur) })).filter((p) => Number.isFinite(p.valeur) && p.valeur > 0);
  }
  const rows = await toutesLesLignes<{ date_marche: string; cours_jour: number | string | null }>((a, b) =>
    sb.from('brvm_actions_daily').select('date_marche,cours_jour').eq('code', c.code).order('date_marche', { ascending: true }).range(a, b),
  );
  return rows.map((r) => ({ date: r.date_marche, valeur: Number(r.cours_jour) })).filter((p) => Number.isFinite(p.valeur) && p.valeur > 0);
}

/** Dessins enregistrés du compte pour une valeur ; revalidés à la lecture. */
export async function chargerDessins(sb: SupabaseClient, userId: string, code: string): Promise<Dessin[]> {
  const { data, error } = await sb.from('graphique_dessins').select('dessins').eq('user_id', userId).eq('code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return validerDessins((data as { dessins?: unknown } | null)?.dessins ?? []);
}

export async function enregistrerDessins(sb: SupabaseClient, userId: string, code: string, dessins: Dessin[]): Promise<void> {
  const { error } = await sb
    .from('graphique_dessins')
    .upsert({ user_id: userId, code, dessins, updated_at: new Date().toISOString() }, { onConflict: 'user_id,code' });
  if (error) throw new Error(error.message);
}
