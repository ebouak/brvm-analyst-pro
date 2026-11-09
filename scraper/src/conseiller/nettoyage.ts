import type { Dividende, Serie } from './types.js';

/** Spec §11.2 : bornes du saut (étendues avant mesure : cas BOAN), fenêtre de retour et tolérance de retour. */
const SAUT_BAS = 0.8;
const SAUT_HAUT = 1.25;
const RETOUR_MAX = 5;
const RETOUR_MIN_RATIO = 0.9;
const RETOUR_MAX_RATIO = 1.1;

/** Spec §11.3 : limite de cotation en une séance, et tolérance sur le montant d'un dividende. */
const RUPTURE_BAS = 0.8;
const RUPTURE_HAUT = 1.25;
const TOLERANCE_DIVIDENDE = 0.2;

function reconstruire(s: Serie, garde: boolean[]): Serie {
  const out: Serie = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() };
  for (let i = 0; i < s.dates.length; i++) {
    if (!garde[i]) continue;
    const k = out.dates.length;
    out.pos.set(s.dates[i]!, k);
    out.dates.push(s.dates[i]!);
    out.cours.push(s.cours[i]!);
    out.volumes.push(s.volumes[i]!);
    out.valeurs.push(s.valeurs[i]!);
    out.variations.push(k === 0 ? null : (s.cours[i]! / out.cours[k - 1]! - 1) * 100);
  }
  return out;
}

/**
 * Erreurs de saisie (spec §11.2) : un saut hors de [×0,8 ; ×1,25] qui revient,
 * dans les 5 séances suivantes, à ±10 % du cours d'avant le saut. Les séances
 * du saut jusqu'au retour (exclu) sont retirées de la série.
 */
export function nettoyerAllersRetours(s: Serie): { serie: Serie; retirees: string[] } {
  const garde = s.dates.map(() => true);
  for (let i = 1; i < s.cours.length; i++) {
    const r = s.cours[i]! / s.cours[i - 1]!;
    if (!(r < SAUT_BAS || r > SAUT_HAUT)) continue;
    for (let j = i + 1; j <= Math.min(s.cours.length - 1, i + RETOUR_MAX); j++) {
      const retour = s.cours[j]! / s.cours[i - 1]!;
      if (retour >= RETOUR_MIN_RATIO && retour <= RETOUR_MAX_RATIO) {
        for (let k = i; k < j; k++) garde[k] = false;
        break;
      }
    }
  }
  const retirees = s.dates.filter((_, i) => !garde[i]);
  return retirees.length === 0 ? { serie: s, retirees } : { serie: reconstruire(s, garde), retirees };
}

/**
 * Ruptures non expliquées (spec §11.3) : variation d'une séance hors de
 * [×0,8 ; ×1,25], sauf si un dividende détaché ce jour-là en explique la baisse
 * (à ±20 % du montant). Rien n'est ajusté ni deviné.
 */
export function detecterRuptures(s: Serie, dividendesDuCode: Dividende[]): Set<string> {
  const out = new Set<string>();
  for (let i = 1; i < s.cours.length; i++) {
    const r = s.cours[i]! / s.cours[i - 1]!;
    if (r >= RUPTURE_BAS && r <= RUPTURE_HAUT) continue;
    const baisse = s.cours[i - 1]! - s.cours[i]!;
    const expliquee = dividendesDuCode.some(
      (d) => d.exDate === s.dates[i] && d.montant > 0 && Math.abs(baisse - d.montant) <= TOLERANCE_DIVIDENDE * d.montant,
    );
    if (!expliquee) out.add(s.dates[i]!);
  }
  return out;
}
