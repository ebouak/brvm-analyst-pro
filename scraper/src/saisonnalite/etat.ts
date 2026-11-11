/**
 * État du mois en cours par valeur (saisonnalité v2, lot 4, F10 et F12) — PUR.
 * Même logique que la confrontation de la page (F1), plus une bande large
 * (10-90 %) réservée à l'alerte : la bande 25-75 % est franchie la moitié du
 * temps par construction (conseil fable-advisor, 2026-11-11).
 */
import type { Serie } from '../conseiller/types.js';
import type { FaitMensuel } from './mensuel.js';
import { bandeHistorique, etatMois, trajectoireMois, verdictCellule, type EtatMois, type PointTrajectoire, type Verdict } from './pure/saison.js';

/** Au-delà, le mois trahit une opération sur titres ou une erreur : aucun état écrit. */
export const SAUT_MAX = 0.5;
const FENETRE_TRAJ = 15;
const FENETRE_VERDICT = 10;

export interface LigneEtat {
  code: string;
  date_seance: string;
  annee: number;
  mois: number;
  rang: number;
  rdt_en_cours: number;
  q10: number | null;
  q25: number | null;
  mediane: number | null;
  q75: number | null;
  q90: number | null;
  n: number;
  etat: EtatMois;
  etat_large: EtatMois;
  verdict: Verdict;
}

export function calculerEtat(e: { code: string; serie: Serie; faits: FaitMensuel[]; asOf: string }): { ligne: LigneEtat | null; refus?: string } {
  const annee = Number(e.asOf.slice(0, 4));
  const mois = Number(e.asOf.slice(5, 7));
  const closes = e.serie.dates.map((d, i) => ({ date: d, close: e.serie.cours[i]! })).filter((c) => c.date <= e.asOf);
  const faitDe = (y: number) => e.faits.find((f) => f.annee === y && f.mois === mois);
  const coupons = (f: FaitMensuel | undefined) => {
    const d = f?.evenements.find((x) => x.type === 'detachement');
    return f && d && f.dividende ? [{ date: d.date, montant: f.dividende }] : [];
  };

  const enCours = trajectoireMois(closes, annee, mois, coupons(faitDe(annee))) ?? [];
  const dernier = enCours[enCours.length - 1];
  if (!dernier) return { ligne: null };
  if (Math.abs(dernier.cumul) > SAUT_MAX) {
    return { ligne: null, refus: `${e.code} : ${(dernier.cumul * 100).toFixed(1)} % depuis le début du mois, au-delà de ${SAUT_MAX * 100} % (opération sur titres probable)` };
  }

  const passees: PointTrajectoire[][] = [];
  for (let y = annee - FENETRE_TRAJ; y < annee; y++) {
    const f = faitDe(y);
    if (!f || f.exclu || !f.complet) continue;
    const t = trajectoireMois(closes, y, mois, coupons(f));
    if (t && t.length) passees.push(t);
  }
  const bande = bandeHistorique(passees);
  const entree = { rdtEnCours: dernier.cumul, rangSeance: dernier.rang, bande };
  const etat = etatMois(entree);
  const etatLarge = etatMois(entree, 'q10', 'q90');
  const ref = bande.find((b) => b.rang === dernier.rang) ?? bande[bande.length - 1];
  const montrer = etat !== 'trop_tot' && etat !== 'historique_insuffisant' && ref;

  const cellule = e.faits
    .filter((f) => f.mois === mois && f.annee < annee && f.annee >= annee - FENETRE_VERDICT && f.complet && !f.exclu && f.rdt_total != null)
    .map((f) => ({ year: f.annee, ret: f.rdt_total! }));

  return {
    ligne: {
      code: e.code,
      date_seance: e.asOf,
      annee,
      mois,
      rang: dernier.rang,
      rdt_en_cours: dernier.cumul,
      q10: montrer ? ref.q10 : null,
      q25: montrer ? ref.q25 : null,
      mediane: montrer ? ref.mediane : null,
      q75: montrer ? ref.q75 : null,
      q90: montrer ? ref.q90 : null,
      n: ref?.n ?? 0,
      etat,
      etat_large: etatLarge,
      verdict: verdictCellule(cellule),
    },
  };
}
