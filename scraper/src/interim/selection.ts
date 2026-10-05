/**
 * Comptes intermédiaires — choix des publications et mise en lignes. PUR,
 * testé (tests/interim.test.ts). Les I/O vivent dans runInterim.ts.
 */
import { codePeriode, periodeDuLibelle, typePeriode, type PeriodeInterim } from './periode.js';
import type { ChiffresPeriode } from './extraction.js';

export interface PubInterim {
  id: string;
  code: string;
  libelle: string;
  date_publication: string;
  source_url: string;
}

export interface PubPeriode extends PubInterim {
  periode: PeriodeInterim;
}

/** Une publication par (société, période) : le rapport d'activités d'abord, puis le plus récent. */
export function choisirPublications(rows: PubInterim[], anneeMin: number): PubPeriode[] {
  const parCle = new Map<string, PubPeriode>();
  const score = (p: PubPeriode) => (/activit/i.test(p.libelle) ? 1 : 0);
  for (const r of rows) {
    const periode = periodeDuLibelle(r.libelle);
    if (!periode || periode.annee < anneeMin || !r.source_url) continue;
    const cle = `${r.code}|${codePeriode(periode)}`;
    const cand: PubPeriode = { ...r, periode };
    const prev = parCle.get(cle);
    if (!prev || score(cand) > score(prev) || (score(cand) === score(prev) && cand.date_publication > prev.date_publication)) {
      parCle.set(cle, cand);
    }
  }
  // Plus ancienne d'abord : le rapport d'origine d'une période passe avant la
  // colonne comparative d'un rapport ultérieur.
  return [...parCle.values()].sort((a, b) => codePeriode(a.periode).localeCompare(codePeriode(b.periode)));
}

const entier = (v: number | null) => (v == null ? null : Math.round(v));

/** Lignes income / balance d'une colonne extraite (colonnes bigint : entiers). */
export function lignesInterim(code: string, periode: PeriodeInterim, c: ChiffresPeriode) {
  const base = { code, periode: codePeriode(periode), type_periode: typePeriode(periode.code) };
  const lsBilan =
    c.depots_clientele != null || c.credits_clientele != null
      ? { depots_clientele: entier(c.depots_clientele), credits_clientele: entier(c.credits_clientele) }
      : null;
  const income = {
    ...base,
    revenu_total: entier(c.revenu_total ?? c.pnb),
    resultat_exploitation: entier(c.resultat_exploitation),
    resultat_avant_impots: entier(c.resultat_avant_impots),
    resultat_net: entier(c.resultat_net),
    lignes_specifiques: c.pnb != null ? { pnb: entier(c.pnb) } : null,
  };
  const aBilan = c.total_actifs != null || c.total_capitaux_propres != null || lsBilan != null;
  const balance = aBilan
    ? {
        ...base,
        total_actifs: entier(c.total_actifs),
        total_capitaux_propres: entier(c.total_capitaux_propres),
        lignes_specifiques: lsBilan,
      }
    : null;
  return { income, balance };
}
