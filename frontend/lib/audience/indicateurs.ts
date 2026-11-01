import 'server-only';

/**
 * Chargement de l'audience — SERVEUR. Chaque bloc est indépendant (allSettled) :
 * une requête qui échoue rend « indisponible » pour CE bloc, jamais un zéro
 * fabriqué ni une page blanche. Les requêtes elles-mêmes vivent dans requetes.ts.
 */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { codeErreur, requeteHogQL } from './posthogQuery';
import * as q from './requetes';
import * as L from './lignes';
import { repartirFormation } from './formationCrm';
import type { Bornes, Fenetre } from './periodes';
import type { Audience, Bloc, FormationCrm, JourSerie } from './types';

async function bloc<T>(sql: () => string, lire: (rows: unknown[][]) => T): Promise<Bloc<T>> {
  try {
    return { ok: true, data: lire((await requeteHogQL(sql())).results) };
  } catch (e) {
    console.error('[audience] bloc indisponible :', codeErreur(e));
    return { ok: false, erreur: codeErreur(e) };
  }
}

/** Comptes avec un signal `formation_vue` dans la fenêtre, répartis par pays du profil. */
export async function chargerFormationCrm(f: Fenetre): Promise<Bloc<FormationCrm>> {
  try {
    const sb = getServiceClient();
    const jour = (d: Date) => d.toISOString().slice(0, 10);
    const ids: string[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from('crm_signaux').select('user_id').eq('type', 'formation_vue')
        .gte('jour', jour(f.debut)).lt('jour', jour(f.fin)).order('id').range(de, de + 999);
      if (error) throw new Error('crm_signaux');
      ids.push(...(data ?? []).map((r) => r.user_id as string));
      if ((data ?? []).length < 1000) break;
    }
    const uniques = [...new Set(ids)];
    const pays = new Map<string, string | null>();
    for (let i = 0; i < uniques.length; i += 200) {
      const { data, error } = await sb.from('profiles').select('id, pays_code').in('id', uniques.slice(i, i + 200));
      if (error) throw new Error('profiles');
      for (const p of data ?? []) pays.set(p.id as string, (p.pays_code as string | null) ?? null);
    }
    return { ok: true, data: repartirFormation(uniques, pays) };
  } catch (e) {
    console.error('[audience] CRM indisponible :', e instanceof Error ? e.message : 'inconnue');
    return { ok: false, erreur: 'crm' };
  }
}

export async function chargerAudience(b: Bornes): Promise<Audience> {
  const [overview, overviewPrecedent, continents, continentsPrecedent, pays, villes, sessions, pages, clics, appareils, tendance, entonnoir, formationCrm] = await Promise.all([
    bloc(() => q.sqlOverview(b), (r) => L.lireOverview(r[0])),
    bloc(() => q.sqlOverview(b.precedent), (r) => L.lireOverview(r[0])),
    bloc(() => q.sqlContinents(b), L.lireContinents),
    bloc(() => q.sqlContinents(b.precedent), L.lireContinents),
    bloc(() => q.sqlPaysAfrique(b), L.lirePays),
    bloc(() => q.sqlVillesAfrique(b), L.lireVilles),
    bloc(() => q.sqlSessions(b), (r) => L.lireSessions(r[0])),
    bloc(() => q.sqlPages(b), L.lirePages),
    bloc(() => q.sqlClics(b), L.lireClics),
    bloc(() => q.sqlAppareils(b), L.lireAppareils),
    bloc(() => q.sqlTendance(b.fin), L.lireTendance),
    bloc(() => q.sqlEntonnoir(b), (r) => L.lireEntonnoir(r[0])),
    chargerFormationCrm(b),
  ]);
  return { debut: b.debut.toISOString(), fin: b.fin.toISOString(), overview, overviewPrecedent, continents, continentsPrecedent, pays, villes, sessions, pages, clics, appareils, tendance, entonnoir, formationCrm };
}

export const audienceComplete = (a: Audience): boolean =>
  [a.overview, a.overviewPrecedent, a.continents, a.continentsPrecedent, a.pays, a.villes, a.sessions, a.pages, a.clics, a.appareils, a.tendance, a.entonnoir, a.formationCrm].every((x) => x.ok);

/** Cache mémoire par instance (10 min), alimenté SEULEMENT par des chargements complets : une panne n'est jamais figée. */
const MEMO = new Map<string, { a: Audience; t: number }>();
const TTL_MS = 10 * 60_000;
export async function chargerAudienceCache(cle: string, b: Bornes): Promise<Audience> {
  const hit = MEMO.get(cle);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.a;
  const a = await chargerAudience(b);
  if (audienceComplete(a)) MEMO.set(cle, { a, t: Date.now() });
  return a;
}

/** Check quotidien : 8 jours de série en UNE requête (la veille + les 7 jours précédents). Lève si PostHog échoue. */
export async function chargerSerieJours(fin: Date, jours = 8): Promise<JourSerie[]> {
  const debut = new Date(fin.getTime() - jours * 86_400_000);
  return L.lireSerieJour((await requeteHogQL(q.sqlSerieJournaliere({ debut, fin }))).results);
}
