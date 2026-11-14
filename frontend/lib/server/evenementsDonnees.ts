import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient } from '@/lib/supabase/public';
import { fenetreChargement, type DatedClose } from '@/lib/eventStudy';
import type { ReactionPublication } from '@/lib/reactionPublication';
import { chargerReactions } from './reactionsPublications';
import { cleReaction } from '@/lib/evenements/reaction';
import type { EvenementBrut } from '@/lib/evenements/regroupement';
import { souffleMarche, type Souffle } from '@/lib/evenements/seance';

const TRANCHE = 1000; // PostgREST tronque à 1000 lignes EN SILENCE

async function lireTout<T>(
  requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  nom: string,
  plafond = 5000,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < plafond; de += TRANCHE) {
    const { data, error } = await requete(de, de + TRANCHE - 1);
    if (error) throw new Error(`Lecture ${nom} impossible : ${error.message}`);
    const lot = data ?? [];
    out.push(...lot);
    if (lot.length < TRANCHE) break;
  }
  return out;
}

/**
 * Réactions à 5 séances de TOUTES les publications d'une page, en UN appel groupé,
 * mises en cache côté serveur une heure (clé = liste triée des couples code|date).
 * Client anonyme sans cookies : les tables lues sont publiques, et le cache est partagé
 * (jamais de donnée personnelle dedans). Une lecture qui échoue lève : pas de cache d'erreur.
 */
const reactionsEnCache = unstable_cache(
  async (cles: string[]): Promise<Record<string, ReactionPublication>> => {
    const demandes = cles.map((c) => {
      const [code, date] = c.split('|');
      return { code: code!, date: date! };
    });
    const map = await chargerReactions(createPublicClient(), demandes, 5);
    return Object.fromEntries(map);
  },
  ['evenements-reactions-v1'],
  { revalidate: 3600 },
);

export async function reactionsCachees(
  demandes: { code: string; date: string }[],
): Promise<Record<string, ReactionPublication> | null> {
  const cles = [...new Set(demandes.map((d) => cleReaction(d.code, d.date)))].sort();
  if (cles.length === 0) return {};
  try {
    return await reactionsEnCache(cles);
  } catch (e) {
    // Lecture impossible : la page l'annonce (« — ») au lieu d'afficher des zéros.
    console.error('[evenements] réactions indisponibles', e);
    return null;
  }
}

export interface FiltreEvenements {
  type?: string;
  code?: string;
  /** Restreint à ces codes (filtre « mes valeurs »). Tableau vide = aucun résultat. */
  codes?: string[];
  depuis?: string | null;
}

export async function lireEvenements(sb: SupabaseClient, f: FiltreEvenements): Promise<EvenementBrut[]> {
  if (f.codes && f.codes.length === 0) return [];
  return lireTout<EvenementBrut>((de, a) => {
    let q = sb
      .from('market_events')
      .select('id, event_date, title, event_type, instrument_code, source_url')
      .order('event_date', { ascending: false })
      .order('id', { ascending: true })
      .range(de, a);
    if (f.type) q = q.eq('event_type', f.type);
    if (f.code) q = q.eq('instrument_code', f.code.toUpperCase());
    if (f.codes) q = q.in('instrument_code', f.codes);
    if (f.depuis) q = q.gte('event_date', f.depuis);
    return q;
  }, 'market_events', 3000);
}

/** Sociétés actives cotées : le M de « N sociétés sur M ». Jamais un nombre écrit en dur. */
export async function societesActives(sb: SupabaseClient): Promise<{ code: string; designation: string | null }[]> {
  const { data, error } = await sb.from('brvm_instruments').select('code, designation').eq('type', 'action').eq('actif', true).order('code');
  if (error) throw new Error(`Lecture brvm_instruments impossible : ${error.message}`);
  return (data ?? []) as { code: string; designation: string | null }[];
}

export interface SeanceDuJour {
  date: string;
  indices: { code: string; libelle: string; valeur: number | null; variationPct: number | null }[];
  souffle: Souffle;
}

/** Dernière séance connue : indices, hausses et baisses. null si la base est vide. */
export async function seanceDuJour(sb: SupabaseClient): Promise<SeanceDuJour | null> {
  const { data: derniere } = await sb
    .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const date = (derniere?.date_marche as string | undefined) ?? null;
  if (!date) return null;
  const [actions, indices] = await Promise.all([
    lireTout<{ variation_pct: number | null }>(
      (de, a) => sb.from('brvm_actions_daily').select('variation_pct').eq('date_marche', date).order('code').range(de, a),
      'brvm_actions_daily',
    ),
    sb.from('brvm_indices_daily').select('code, libelle, valeur, variation_pct').eq('date_marche', date).in('code', ['BRVMC', 'BRVM30']),
  ]);
  return {
    date,
    indices: ((indices.data ?? []) as { code: string; libelle: string | null; valeur: number | null; variation_pct: number | null }[])
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((i) => ({ code: i.code, libelle: i.libelle ?? i.code, valeur: i.valeur, variationPct: i.variation_pct })),
    souffle: souffleMarche(actions.map((a) => a.variation_pct)),
  };
}

/** Clôtures du titre et de l'indice autour d'une date (J−40 j / J+30 j), paginées. */
export async function chargerSeriesEvenement(
  sb: SupabaseClient,
  code: string,
  date: string,
): Promise<{ titre: DatedClose[]; indice: DatedClose[] }> {
  const { debut, fin } = fenetreChargement(date);
  const [t, i] = await Promise.all([
    lireTout<{ date_marche: string; cours_jour: number | null }>(
      (de, a) => sb.from('brvm_actions_daily').select('date_marche, cours_jour').eq('code', code)
        .gte('date_marche', debut).lte('date_marche', fin).order('date_marche').range(de, a),
      'brvm_actions_daily',
    ),
    lireTout<{ date_marche: string; valeur: number | null }>(
      (de, a) => sb.from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC')
        .gte('date_marche', debut).lte('date_marche', fin).order('date_marche').range(de, a),
      'brvm_indices_daily',
    ),
  ]);
  return {
    titre: t.map((r) => ({ date: r.date_marche, close: r.cours_jour })),
    indice: i.map((r) => ({ date: r.date_marche, close: r.valeur })),
  };
}
