/**
 * Récap du portefeuille en image — CALCUL PUR (aucune base, aucun réseau).
 * Spec : docs/superpowers/specs/2026-10-24-recap-portefeuille-design.md
 *
 * Valeur, capital investi, plus-value et secteurs sont repris TELS QUELS de
 * `derivePortfolio` : la récap montre les mêmes chiffres que /portefeuille,
 * jamais un second calcul qui finirait par diverger.
 *
 * Ce module n'ajoute que ce que la page n'a pas : la variation de la séance
 * (depuis la variation officielle de chaque titre), les meilleures et moins
 * bonnes lignes du jour, les détachements à venir. Une donnée absente reste
 * absente : une variation du jour inconnue vaut `null`, jamais 0.
 */
import type { PortfolioState } from '@/lib/portfolio/derive';

export interface EntreeRecap {
  etat: PortfolioState;
  /** Dernière séance connue, AAAA-MM-JJ. */
  seance: string;
  /** Variation officielle de la séance (%) des titres cotés ce jour-là. */
  variationJour: Record<string, number>;
  /** Détachements à venir sur les titres détenus. */
  dividendes: { code: string; exDate: string; montant: number | null }[];
  alertesDuJour: number;
}

export interface LigneJour {
  code: string;
  variation: number;
  /** Effet de la séance sur la ligne, en FCFA. */
  effet: number;
}

export interface Recap {
  vide: boolean;
  seance: string;
  seanceFr: string;
  lignes: number;
  valeur: number;
  investi: number;
  pnl: number;
  pnlPct: number | null;
  /** null quand aucun titre détenu n'a coté à cette séance. */
  varJour: { montant: number; pct: number } | null;
  meilleures: LigneJour[];
  moinsBonnes: LigneJour[];
  secteurs: { secteur: string; poids: number }[];
  dividendes: { code: string; exDateFr: string; montant: number | null }[];
  alertesDuJour: number;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateLongue(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number);
  return a && m && j ? `${j} ${MOIS[m - 1]} ${a}` : iso;
}

function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
}

const MAX_LIGNES = 3;
const MAX_SECTEURS = 4;

export function calculerRecap(e: EntreeRecap): Recap {
  const titres = e.etat.positions.filter((p) => !p.isLiquidites && p.quantite > 0);

  const duJour: LigneJour[] = [];
  for (const p of titres) {
    const v = e.variationJour[p.code];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= -100 || p.cours <= 0) continue;
    const veille = p.cours / (1 + v / 100);
    duJour.push({ code: p.code, variation: v, effet: p.quantite * (p.cours - veille) });
  }

  let varJour: Recap['varJour'] = null;
  if (duJour.length > 0) {
    const montant = duJour.reduce((s, l) => s + l.effet, 0);
    const valeurVeille = e.etat.currentValue - montant;
    varJour = { montant, pct: valeurVeille > 0 ? (montant / valeurVeille) * 100 : 0 };
  }

  const tries = [...duJour].sort((a, b) => b.variation - a.variation);
  const secteursTries = [...e.etat.sectors].sort((a, b) => b.poids - a.poids);
  const secteurs = secteursTries.slice(0, MAX_SECTEURS).map((s) => ({ secteur: s.secteur, poids: s.poids }));
  const reste = secteursTries.slice(MAX_SECTEURS).reduce((s, x) => s + x.poids, 0);
  if (reste > 0) secteurs.push({ secteur: 'Autres', poids: reste });

  return {
    vide: e.etat.positions.length === 0,
    seance: e.seance,
    seanceFr: dateLongue(e.seance),
    lignes: titres.length,
    valeur: e.etat.currentValue,
    investi: e.etat.investedCapital,
    pnl: e.etat.latentPnl,
    pnlPct: e.etat.latentPnlPct,
    varJour,
    meilleures: tries.filter((l) => l.variation > 0).slice(0, MAX_LIGNES),
    moinsBonnes: tries.filter((l) => l.variation < 0).reverse().slice(0, MAX_LIGNES),
    secteurs,
    dividendes: [...e.dividendes]
      .sort((a, b) => a.exDate.localeCompare(b.exDate))
      .slice(0, MAX_LIGNES)
      .map((d) => ({ code: d.code, exDateFr: dateCourte(d.exDate), montant: d.montant })),
    alertesDuJour: e.alertesDuJour,
  };
}
