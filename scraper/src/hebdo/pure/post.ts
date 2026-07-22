// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
/**
 * Compose les deux formats prêts à poster depuis un squelette DÉJÀ validé
 * (donc soumis aux mêmes garde-fous) : `long` pour LinkedIn/Facebook,
 * `court` pour WhatsApp/Telegram. PUR, testé.
 */
import type { Skeleton } from './narrative.js';
import type { HebdoMetrics } from './types.js';

export type PostFormat = 'long' | 'court';

const AVERTISSEMENT = '⚠️ Information à but pédagogique — ce n’est pas un conseil en investissement.';

function emoji(m: HebdoMetrics): string {
  return (m.variationHebdo ?? 0) >= 0 ? '📈' : '📉';
}

/** Première phrase d'un texte, pour condenser dans le format court. */
function premierePhrase(texte: string): string {
  const i = texte.search(/[.!?]/);
  return (i > 0 ? texte.slice(0, i + 1) : texte).trim();
}

export function buildPost(sk: Skeleton, m: HebdoMetrics, format: PostFormat): string {
  const tete = `${emoji(m)} ${m.code}`;

  if (format === 'court') {
    const lignes: string[] = [];
    const v = m.variationHebdo;
    lignes.push(`${tete} — ${v == null ? 'stable' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} %`} cette semaine`);
    if (m.ratioVolume != null) {
      lignes.push(`📊 ${m.ratioVolume.toFixed(1)}× plus de titres échangés que d’habitude`);
    }
    const sens = sk.sections.find((s) => s.titre === 'Ce que ça veut dire');
    if (sens) lignes.push(`🔍 ${premierePhrase(sens.texte)}`);
    const ctx = sk.sections.find((s) => s.titre === 'Le contexte');
    if (ctx) lignes.push(`📌 ${premierePhrase(ctx.texte)}`);
    const niv = sk.sections.find((s) => s.titre === 'Les niveaux à surveiller');
    if (niv) lignes.push(`🎯 ${premierePhrase(niv.texte)}`);
    lignes.push(AVERTISSEMENT);
    return lignes.join('\n');
  }

  // Format long : accroche + sections + avertissement.
  const accroche = `${tete} : ${sk.verdict.toLowerCase()}`;
  const corps = sk.sections.map((s) => `${s.titre}\n${s.texte}`).join('\n\n');
  return `${accroche}\n\n${corps}\n\n${AVERTISSEMENT}`;
}
