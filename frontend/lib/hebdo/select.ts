/**
 * Sélection des valeurs « en vogue » de la semaine — PURE, testée.
 * Score de notabilité sur 4 axes : ampleur du mouvement, volume anormal,
 * cassure de canal, extrémité de RSI. Garantit au moins une BAISSE quand il en
 * existe une : l'hebdo ne doit pas être un bulletin uniquement haussier.
 */
import { detect, rsi } from '../indicators';
import { computeLevels } from './levels';
import type { HebdoCandidate, HebdoPick } from './types';

const MIN_CLOSES = 32;
const MAX_PICKS = 5;
const MIN_PICKS = 3;
const VOLUME_ANORMAL = 2;

interface Scored extends HebdoPick {
  variation: number;
}

function scoreOne(c: HebdoCandidate): Scored | null {
  if (!Array.isArray(c.closes) || c.closes.length < MIN_CLOSES) return null;
  const variation = c.variationHebdo ?? 0;
  const ratio = c.avgVolume20 && c.avgVolume20 > 0 && c.volume != null ? c.volume / c.avgVolume20 : null;
  const lv = computeLevels(c.closes);
  const d = detect(c.closes);
  const r = rsi(c.closes, 14);

  const raisons: string[] = [];
  let score = Math.abs(variation); // axe 1 : ampleur

  if (ratio != null && ratio >= VOLUME_ANORMAL) {
    score += 10;
    raisons.push(`volume ${ratio.toFixed(1)}× la moyenne`);
  }
  if (lv?.cassureHaut || d.breakoutUp) { score += 8; raisons.push('cassure de résistance'); }
  if (lv?.cassureBas || d.breakoutDown) { score += 8; raisons.push('rupture de support'); }
  if (d.overbought) { score += 3; raisons.push('RSI en zone de surachat'); }
  if (d.oversold) { score += 3; raisons.push('RSI en zone de survente'); }
  if (d.goldenCross) { score += 4; raisons.push('croisement haussier MA20/MA50'); }
  if (d.deathCross) { score += 4; raisons.push('croisement baissier MA20/MA50'); }
  if (raisons.length === 0 && r != null) raisons.push(`RSI à ${r.toFixed(0)}`);

  return {
    code: c.code,
    sens: variation >= 0 ? 'hausse' : 'baisse',
    raison: `${variation >= 0 ? 'Hausse' : 'Baisse'} de ${Math.abs(variation).toFixed(2)} % · ${raisons.join(' · ')}`,
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
