/**
 * Valorisation calculée — module pur.
 *
 * Le modèle calculait lui-même la valorisation dans le texte du rapport, et
 * s'y trompait (SGBC, 2026-10-07 : rendement cité à 6,7 % puis 6,5 %, stop
 * « proche » d'une borne distante de 8 000 FCFA). Ces calculs sont désormais
 * faits ICI, une fois : le graphique « fourchette de valorisation » et le
 * prompt lisent les mêmes nombres, et le modèle les commente sans les refaire.
 *
 * Hypothèses identiques à celles qu'imposait le prompt : coût des fonds propres
 * k entre 12 et 14 %, croissance g entre 3 et 4 %, valeur centrale à 13 % / 3,5 %.
 * Une méthode dont une entrée manque est ABSENTE, jamais estimée.
 */

import type { IncomeStatement, BalanceSheet } from '@/lib/financials/types';
import type { LigneComparaison } from './medianes';

export const K = { bas: 0.12, central: 0.13, haut: 0.14 } as const;
export const G = { bas: 0.03, central: 0.035, haut: 0.04 } as const;

export interface MethodeValorisation {
  id: 'pb_justifie' | 'gordon' | 'per_median' | 'pb_median';
  libelle: string;
  /** Valeur par action, en FCFA. */
  centrale: number;
  /** Fourchette selon k et g ; égale à la centrale pour un multiple. */
  bas: number;
  haut: number;
  /** La formule, avec ses entrées, pour le texte et la légende. */
  detail: string;
}

export interface Valorisation {
  cours: number | null;
  /** Valeur comptable par action. */
  bvps: number | null;
  /** Bénéfice par action (résultat net / actions). */
  bpa: number | null;
  /** Résultat net / capitaux propres de fin d'exercice. */
  roe: number | null;
  dpa: number | null;
  methodes: MethodeValorisation[];
}

const nf = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const pc = (v: number) => `${nf(v * 100, 1)} %`;

function medianeDe(lignes: LigneComparaison[] | undefined, libelle: string): number | null {
  const l = lignes?.find((x) => x.libelle === libelle);
  return l?.mediane != null && l.mediane > 0 ? l.mediane : null;
}

/** Applique f aux quatre coins (k, g) et renvoie min, centrale, max. */
function fourchette(f: (k: number, g: number) => number | null): { bas: number; centrale: number; haut: number } | null {
  const centrale = f(K.central, G.central);
  const coins = [f(K.bas, G.bas), f(K.bas, G.haut), f(K.haut, G.bas), f(K.haut, G.haut)];
  if (centrale == null || coins.some((v) => v == null || !Number.isFinite(v) || v <= 0)) return null;
  const vals = coins as number[];
  return { bas: Math.min(...vals), centrale, haut: Math.max(...vals) };
}

export function valoriser(e: {
  famille: 'banque' | 'assurance' | 'general' | null | undefined;
  cours: number | null;
  actions: number | null;
  inc: IncomeStatement | null;
  bal: BalanceSheet | null;
  medianes?: LigneComparaison[];
}): Valorisation {
  const actions = e.actions != null && e.actions > 0 ? e.actions : null;
  const cp = e.bal?.total_capitaux_propres ?? null;
  const rn = e.inc?.resultat_net ?? null;
  const bvps = actions && cp != null && cp > 0 ? cp / actions : null;
  const bpa = e.inc?.benefice_par_action ?? (actions && rn != null ? rn / actions : null);
  const roe = rn != null && cp != null && cp > 0 ? rn / cp : null;
  const dpa = e.inc?.dividende_par_action != null && e.inc.dividende_par_action > 0 ? e.inc.dividende_par_action : null;
  const methodes: MethodeValorisation[] = [];

  // Valeur justifiée par le P/B — banques et assurances : leur valeur se lit sur
  // les fonds propres, et la formule suppose ROE > g.
  if ((e.famille === 'banque' || e.famille === 'assurance') && bvps && roe != null && roe > G.haut) {
    const f = fourchette((k, g) => ((roe - g) / (k - g)) * bvps);
    if (f) {
      methodes.push({
        id: 'pb_justifie', libelle: 'Valeur justifiée par le P/B', ...f,
        detail: `P/B = (ROE − g) / (k − g), ROE ${pc(roe)}, valeur comptable ${nf(bvps)} FCFA par action`,
      });
    }
  }

  if (dpa) {
    const f = fourchette((k, g) => (dpa * (1 + g)) / (k - g));
    if (f) {
      methodes.push({
        id: 'gordon', libelle: 'Actualisation des dividendes', ...f,
        detail: `V = DPA × (1 + g) / (k − g), DPA ${nf(dpa)} FCFA`,
      });
    }
  }

  const per = medianeDe(e.medianes, 'PER');
  if (per && bpa != null && bpa > 0) {
    const v = per * bpa;
    methodes.push({ id: 'per_median', libelle: 'PER médian des pairs', centrale: v, bas: v, haut: v,
      detail: `${nf(per, 1)} × BPA ${nf(bpa)} FCFA` });
  }

  const pb = medianeDe(e.medianes, 'Cours / valeur comptable');
  if (pb && bvps) {
    const v = pb * bvps;
    methodes.push({ id: 'pb_median', libelle: 'P/B médian des pairs', centrale: v, bas: v, haut: v,
      detail: `${nf(pb, 1)} × valeur comptable ${nf(bvps)} FCFA` });
  }

  return { cours: e.cours, bvps, bpa, roe, dpa, methodes };
}

/** Bloc pour le prompt : chaque méthode avec sa formule, sa fourchette et l'écart au cours. */
export function blocValorisation(v: Valorisation): string {
  if (v.methodes.length === 0) return 'Aucune méthode calculable avec les données disponibles.';
  const lignes = v.methodes.map((m) => {
    const ecart = v.cours ? ` ; écart de la valeur centrale au cours : ${m.centrale >= v.cours ? '+' : ''}${nf(((m.centrale - v.cours) / v.cours) * 100, 1)} %` : '';
    const plage = m.bas === m.haut ? '' : ` (fourchette ${nf(m.bas)} – ${nf(m.haut)} FCFA)`;
    return `- ${m.libelle} : ${nf(m.centrale)} FCFA${plage} — ${m.detail}${ecart}`;
  });
  return [
    `Hypothèses : k entre ${pc(K.bas)} et ${pc(K.haut)} (central ${pc(K.central)}), g entre ${pc(G.bas)} et ${pc(G.haut)} (central ${pc(G.central)}).`,
    ...lignes,
  ].join('\n');
}
