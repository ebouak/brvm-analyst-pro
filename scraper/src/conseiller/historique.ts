import { createHash } from 'node:crypto';
import { getSupabase } from '../persistence/supabase.js';
import { reconstituerExDate } from './dividendes.js';
import type { ComptesAnnuels, Dividende, Donnees, FamilleComptable, Serie } from './types.js';

const TAILLE = 1000;

async function toutLire<T>(construire: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; ; a += TAILLE) {
    const { data, error } = await construire(a, a + TAILLE - 1);
    if (error) throw new Error(`lecture : ${error.message}`);
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < TAILLE) break;
  }
  return out;
}

/** Comptes de l'exercice N : publication réelle trouvée entre le 1er janvier et le 30 juin N+1, sinon 30 juin N+1. */
export function dispoComptes(pubs: { code: string; date_publication: string; libelle: string }[], code: string, exercice: number): string {
  const repli = `${exercice + 1}-06-30`;
  const motif = new RegExp(`(états? financiers|comptes|résultats?).*${exercice}`, 'i');
  const trouvee = pubs
    .filter((p) => p.code === code && p.date_publication > `${exercice}-12-31` && p.date_publication <= repli && motif.test(p.libelle))
    .map((p) => p.date_publication)
    .sort()[0];
  return trouvee ?? repli;
}

export interface Chargement { donnees: Donnees; empreinte: string }

/** Charge tout l'historique (paginé). Lecture seule. */
export async function chargerHistorique(): Promise<Chargement> {
  const sb = getSupabase();
  const cours = await toutLire<{ code: string; date_marche: string; cours_jour: number; volume: number | null; valeur_echangee: number | null; variation_pct: number | null }>((a, b) =>
    sb.from('brvm_actions_daily').select('code, date_marche, cours_jour, volume, valeur_echangee, variation_pct')
      .gt('cours_jour', 0).order('date_marche', { ascending: true }).order('code', { ascending: true }).range(a, b));
  const inst = await toutLire<{ code: string; famille_comptable: string | null }>((a, b) =>
    sb.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action').order('code').range(a, b));
  const inc = await toutLire<{ code: string; periode: string; resultat_net: number | null; actions_en_circulation: number | null }>((a, b) =>
    sb.from('income_statements').select('code, periode, resultat_net, actions_en_circulation').eq('type_periode', 'annuel').order('code').order('periode').range(a, b));
  const bal = await toutLire<{ code: string; periode: string; total_capitaux_propres: number | null }>((a, b) =>
    sb.from('balance_sheets').select('code, periode, total_capitaux_propres').eq('type_periode', 'annuel').order('code').order('periode').range(a, b));
  const divs = await toutLire<{ code: string; exercice: number | null; montant: number; ex_date: string | null }>((a, b) =>
    sb.from('dividends').select('code, exercice, montant, ex_date').gt('montant', 0).not('exercice', 'is', null).order('code').order('exercice').range(a, b));
  const pubs = await toutLire<{ code: string; date_publication: string; libelle: string }>((a, b) =>
    sb.from('publications').select('code, date_publication, libelle').order('date_publication').order('code').range(a, b));

  const series = new Map<string, Serie>();
  const calSet = new Set<string>();
  for (const r of cours) {
    calSet.add(r.date_marche);
    let s = series.get(r.code);
    if (!s) series.set(r.code, (s = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() }));
    if (s.pos.has(r.date_marche)) continue;
    s.pos.set(r.date_marche, s.dates.length);
    s.dates.push(r.date_marche);
    s.cours.push(Number(r.cours_jour));
    s.volumes.push(Number(r.volume ?? 0));
    s.valeurs.push(Number(r.valeur_echangee ?? 0));
    s.variations.push(r.variation_pct == null ? null : Number(r.variation_pct));
  }
  const familles = new Map<string, FamilleComptable>();
  for (const i of inst) familles.set(i.code, i.famille_comptable === 'banque' ? 'banque' : 'general');

  const cp = new Map(bal.map((b) => [`${b.code}|${b.periode.slice(0, 4)}`, b.total_capitaux_propres]));
  const comptes: ComptesAnnuels[] = inc.map((r) => {
    const exercice = Number(r.periode.slice(0, 4));
    const capitaux = cp.get(`${r.code}|${exercice}`);
    return {
      code: r.code,
      exercice,
      resultatNet: r.resultat_net == null ? null : Number(r.resultat_net),
      capitauxPropres: capitaux == null ? null : Number(capitaux),
      actions: r.actions_en_circulation == null ? null : Number(r.actions_en_circulation),
      disponibleLe: dispoComptes(pubs, r.code, exercice),
    };
  });
  const dividendes: Dividende[] = divs.map((r) => {
    const exercice = Number(r.exercice);
    const s = series.get(r.code);
    const exDate = r.ex_date ?? (s ? reconstituerExDate(s, Number(r.montant), `${exercice + 1}-04-01`) : null);
    return { code: r.code, exercice, montant: Number(r.montant), disponibleLe: `${exercice + 1}-07-31`, exDate };
  });

  const empreinte = createHash('sha256')
    .update(JSON.stringify({ n: cours.length, d0: cours[0]?.date_marche, d1: cours.at(-1)?.date_marche, comptes, dividendes }))
    .digest('hex');
  return { donnees: { calendrier: [...calSet].sort(), series, comptes, dividendes, familles }, empreinte };
}
