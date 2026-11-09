import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { exerciceRetenu, type LigneBilanRetenu, type LigneFondamentaux, type LigneResultatRetenu } from '@/lib/fiche/exerciceRetenu';
import { ratiosBilan } from '@/lib/fiche/ratiosBilan';
import { capitalisationFcfa } from '@/lib/fiche/capitalisation';
import { derniereIntermediaire, type Intermediaire, type LigneIntermediaire } from './intermediaires';

/** Un volet : soit ses données, soit « illisible » (la page continue). */
export type Volet<T> = { ok: true; data: T } | { ok: false };

export interface RatiosComptes {
  exercice: number | null;
  per: number | null;
  pb: number | null;
  /** fraction */
  roe: number | null;
  gearing: number | null;
}
export interface Actualite { titre: string; source: string; date: string; url: string | null }
export interface ActualitesCode { derniers: Actualite[]; total: number }

export interface LectureCode {
  comptes: Volet<RatiosComptes>;
  intermediaire: Volet<Intermediaire | null>;
  actualites: Volet<ActualitesCode>;
}

const groupe = <T extends { code: string }>(lignes: T[]): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const l of lignes) {
    const a = m.get(l.code);
    if (a) a.push(l); else m.set(l.code, [l]);
  }
  return m;
};

/** Une erreur PostgREST LÈVE : le volet concerné passe en « illisible », pas en « aucune donnée ». */
async function toutLire<T>(construire: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  return fetchAllRows<T>(async (from, to) => {
    const r = await construire(from, to);
    if (r.error) throw new Error(r.error.message);
    return r;
  });
}

async function essai<T>(f: () => Promise<T>): Promise<Volet<T>> {
  try { return { ok: true, data: await f() }; } catch { return { ok: false }; }
}

/**
 * Charge en LOT, pour toute la séance, les trois sources de la lecture
 * approfondie. À n'appeler que si l'accès Premium est accordé : rien de ce
 * qui suit ne doit atteindre le HTML d'un utilisateur gratuit.
 */
export async function chargerLecturesApprofondies(codes: string[], dateSeance: string, aujourdhui: string): Promise<Map<string, LectureCode>> {
  const sb = createClient();

  const comptesBruts = essai(async () => {
    const [inc, bil, fon, ins, cx] = await Promise.all([
      toutLire<LigneResultatRetenu & { code: string }>((a, b) =>
        sb.from('income_statements').select('code, periode, resultat_net, revenu_total').in('code', codes).eq('type_periode', 'annuel').order('code').order('periode').range(a, b)),
      toutLire<LigneBilanRetenu & { code: string }>((a, b) =>
        sb.from('balance_sheets').select('code, periode, total_capitaux_propres, dette_court_terme, dette_long_terme').in('code', codes).eq('type_periode', 'annuel').order('code').order('periode').range(a, b)),
      toutLire<LigneFondamentaux & { code: string }>((a, b) =>
        sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt').in('code', codes).order('code').order('year').range(a, b)),
      toutLire<{ code: string; shares: number | null }>((a, b) =>
        sb.from('brvm_instruments').select('code, shares').in('code', codes).order('code').range(a, b)),
      toutLire<{ code: string; cours_jour: number | null; valorisation: number | null }>((a, b) =>
        sb.from('brvm_actions_daily').select('code, cours_jour, valorisation').in('code', codes).eq('date_marche', dateSeance).order('code').range(a, b)),
    ]);
    return { inc: groupe(inc), bil: groupe(bil), fon: groupe(fon), ins: new Map(ins.map((r) => [r.code, r])), cx: new Map(cx.map((r) => [r.code, r])) };
  });

  const intermediairesBruts = essai(async () =>
    groupe(await toutLire<LigneIntermediaire>((a, b) =>
      sb.from('income_statements').select('code, periode, type_periode, revenu_total, resultat_net').in('code', codes).in('type_periode', ['trimestre', 'semestriel']).order('code').order('periode').order('type_periode').range(a, b))));

  const debut = new Date(`${aujourdhui}T00:00:00Z`);
  debut.setUTCDate(debut.getUTCDate() - 30);
  const depuis = debut.toISOString().slice(0, 10);
  const actusBrutes = essai(async () => {
    const lignes = await toutLire<{ id: string; titre: string; source: string; source_label: string | null; source_url: string | null; date_publication: string; ticker_codes: string[] | null }>((a, b) =>
      sb.from('brvm_news').select('id, titre, source, source_label, source_url, date_publication, ticker_codes')
        .overlaps('ticker_codes', codes).eq('hidden', false)
        .gte('date_publication', depuis).lte('date_publication', aujourdhui)
        .order('date_publication', { ascending: false }).order('id').range(a, b));
    const m = new Map<string, Actualite[]>();
    for (const n of lignes) {
      for (const c of n.ticker_codes ?? []) {
        if (!codes.includes(c)) continue;
        const a = m.get(c) ?? [];
        a.push({ titre: n.titre, source: n.source_label ?? n.source, date: n.date_publication, url: n.source_url });
        m.set(c, a);
      }
    }
    return m;
  });

  const [cb, ib, ab] = await Promise.all([comptesBruts, intermediairesBruts, actusBrutes]);
  const out = new Map<string, LectureCode>();
  for (const code of codes) {
    const comptes: Volet<RatiosComptes> = !cb.ok ? { ok: false } : (() => {
      const d = cb.data;
      const r = exerciceRetenu({ income: d.inc.get(code) ?? [], balance: d.bil.get(code) ?? [], fundamentals: d.fon.get(code) ?? [] });
      const cours = d.cx.get(code)?.cours_jour ?? null;
      const titres = d.ins.get(code)?.shares ?? null;
      const v = ratiosBilan({
        cours, titres, resultatNet: r.resultatNet, chiffreAffaires: r.chiffreAffaires,
        capitauxPropres: r.capitauxPropres, detteFinanciere: r.detteFinanciere,
        capitalisation: capitalisationFcfa({ valorisation: d.cx.get(code)?.valorisation ?? null, cours, titres }),
      });
      return { ok: true, data: { exercice: r.exercice, per: v.per.valeur, pb: v.pb, roe: v.roe, gearing: v.gearing } };
    })();
    const intermediaire: Volet<Intermediaire | null> = ib.ok ? { ok: true, data: derniereIntermediaire(ib.data.get(code) ?? []) } : { ok: false };
    const actualites: Volet<ActualitesCode> = ab.ok
      ? (() => { const t = ab.data.get(code) ?? []; return { ok: true as const, data: { derniers: t.slice(0, 3), total: t.length } }; })()
      : { ok: false };
    out.set(code, { comptes, intermediaire, actualites });
  }
  return out;
}
