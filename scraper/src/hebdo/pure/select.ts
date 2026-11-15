// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Sélection des valeurs « en vogue » de la semaine — PURE, testée.
 * Score de notabilité sur 4 axes : ampleur du mouvement, volume anormal,
 * cassure de canal, extrémité de RSI. Garantit au moins une BAISSE quand il en
 * existe une : l'hebdo ne doit pas être un bulletin uniquement haussier.
 */
import { detect, rsi } from './indicators.js';
import { computeLevels, pasDeCotation, MARGE_SORTIE_PCT } from './levels.js';
import { fmtPct, fmtRatio } from './format.js';
import type { HebdoCandidate, HebdoPick } from './types.js';

const MIN_CLOSES = 32;
const MAX_PICKS = 5;
const MIN_PICKS = 3;
const VOLUME_ANORMAL = 2;

interface Scored extends HebdoPick {
  variation: number;
}

/** Score et raison d'une valeur, même hors sélection (aperçu, relecture). */
export function scoreCandidat(c: HebdoCandidate): HebdoPick | null {
  const s = scoreOne(c);
  return s ? { code: s.code, sens: s.sens, raison: s.raison, score: s.score } : null;
}

function scoreOne(c: HebdoCandidate): Scored | null {
  if (!Array.isArray(c.closes) || c.closes.length < MIN_CLOSES) return null;
  const variation = c.variationHebdo ?? 0;
  const ratio = c.avgVolume20 && c.avgVolume20 > 0 && c.volume != null ? c.volume / c.avgVolume20 : null;
  // Sortie de canal jugée avec la marge et le pas : une clôture à un pas du
  // plafond n'est pas une « cassure » (SLBC, 13/11/2026 : 5 FCFA, 0,01 %).
  const lv = computeLevels(c.closes, { pas: pasDeCotation(c.closes), margePct: MARGE_SORTIE_PCT });
  const d = detect(c.closes);
  const r = rsi(c.closes, 14);

  const raisons: string[] = [];
  let score = Math.abs(variation); // axe 1 : ampleur

  if (ratio != null && ratio >= VOLUME_ANORMAL) {
    score += 10;
    raisons.push(`volume ${fmtRatio(ratio)} fois la moyenne`);
  }
  if (lv?.cassureHaut) { score += 8; raisons.push('sortie du canal par le haut'); }
  if (lv?.cassureBas) { score += 8; raisons.push('sortie du canal par le bas'); }
  if (d.overbought) { score += 3; raisons.push('RSI en zone de surachat'); }
  if (d.oversold) { score += 3; raisons.push('RSI en zone de survente'); }
  if (d.goldenCross) { score += 4; raisons.push('croisement haussier MA20/MA50'); }
  if (d.deathCross) { score += 4; raisons.push('croisement baissier MA20/MA50'); }
  if (raisons.length === 0 && r != null) raisons.push(`RSI à ${r.toFixed(0)}`);

  return {
    code: c.code,
    sens: variation >= 0 ? 'hausse' : 'baisse',
    raison: [`${variation >= 0 ? 'Hausse' : 'Baisse'} de ${fmtPct(Math.abs(variation))}`, ...raisons].join(' · '),
    score: Math.round(score * 100) / 100,
    variation,
  };
}

export function selectHebdo(candidats: HebdoCandidate[]): HebdoPick[] {
  const scored = candidats.map(scoreOne).filter((s): s is Scored => s !== null);
  if (scored.length === 0) return [];
  scored.sort((a, b) => b.score - a.score);

  const retenus = scored.slice(0, MAX_PICKS);
  // Honnêteté : si aucune baisse dans le haut du classement mais qu'il en existe
  // une, on remplace la dernière hausse par la baisse la mieux classée.
  const baisses = scored.filter((s) => s.sens === 'baisse');
  if (baisses.length > 0 && !retenus.some((s) => s.sens === 'baisse')) {
    retenus[retenus.length - 1] = baisses[0]!;
  }
  const final = retenus.slice(0, Math.max(MIN_PICKS, Math.min(MAX_PICKS, retenus.length)));
  return final.map(({ code, sens, raison, score }) => ({ code, sens, raison, score }));
}
