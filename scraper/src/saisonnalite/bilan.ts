/**
 * Bilan public figé (saisonnalité v2, lot 4, F11) — PUR.
 * Le profil d'un mois ne dépend que des MÊMES mois des années ANTÉRIEURES :
 * il peut s'écrire n'importe quel jour du mois sans rien savoir du mois en
 * cours. La première écriture fait foi (ignoreDuplicates côté runner), et la
 * règle qui jugera le réalisé est figée dans la ligne avec sa version
 * (conseil fable-advisor, 2026-11-11) : définie après coup, elle serait
 * ajustée aux résultats.
 */
import type { FaitMensuel } from './mensuel.js';
import { quantile, verdictCellule, type Verdict } from './pure/saison.js';
import { SAUT_MAX } from './etat.js';

export const REGLE_TENUE = 'v1 : signe du réalisé = signe de la médiane du profil ; verdict « hasard » non compté';
const FENETRE = 10;
const N_MIN = 5;

export interface Profil { mediane: number; q25: number; q75: number; verdict: Verdict; n: number; regle: string }

export function profilDuMois(faits: FaitMensuel[], annee: number, mois: number): Profil | null {
  const cellule = faits
    .filter((f) => f.mois === mois && f.annee < annee && f.annee >= annee - FENETRE && f.complet && !f.exclu && f.rdt_total != null)
    .map((f) => ({ year: f.annee, ret: f.rdt_total! }));
  if (cellule.length < N_MIN) return null;
  const xs = cellule.map((c) => c.ret).sort((a, b) => a - b);
  return { mediane: quantile(xs, 0.5), q25: quantile(xs, 0.25), q75: quantile(xs, 0.75), verdict: verdictCellule(cellule), n: cellule.length, regle: REGLE_TENUE };
}

/** Règle v1. `null` = non compté (hasard, ou signe nul). */
export function tenue(profilMediane: number, verdict: Verdict | string, realise: number): boolean | null {
  if (verdict === 'hasard' || profilMediane === 0 || realise === 0) return null;
  return Math.sign(profilMediane) === Math.sign(realise);
}

/**
 * Rendement réalisé d'un mois TERMINÉ (une séance du mois suivant est chargée :
 * c'est ce que signifie `complet`). Mois exclu ou incomplet : null. Saut au-delà
 * de 50 % : refusé et nommé.
 */
export function realiseDuMois(faits: FaitMensuel[], annee: number, mois: number): { realise: number | null; refus?: string } {
  const f = faits.find((x) => x.annee === annee && x.mois === mois);
  if (!f || !f.complet || f.exclu || f.rdt_total == null) return { realise: null };
  if (Math.abs(f.rdt_total) > SAUT_MAX) return { realise: null, refus: `${f.code} ${annee}-${mois} : ${(f.rdt_total * 100).toFixed(1)} %, au-delà de 50 %` };
  return { realise: f.rdt_total };
}
