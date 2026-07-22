// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
/**
 * Compose les deux formats prêts à poster depuis un squelette DÉJÀ validé
 * (donc soumis aux mêmes garde-fous) : `long` pour LinkedIn/Facebook,
 * `court` pour WhatsApp/Telegram. PUR, testé.
 */
import { fmtPct, fmtRatio } from './format.js';
import type { Skeleton } from './narrative.js';
import type { HebdoMetrics } from './types.js';

export type PostFormat = 'long' | 'court';

const AVERTISSEMENT = '⚠️ Information à but pédagogique — ce n’est pas un conseil en investissement.';

function emoji(m: HebdoMetrics): string {
  return (m.variationHebdo ?? 0) >= 0 ? '📈' : '📉';
}

/**
 * Accroche du format long : on met en avant ce qui rend la semaine remarquable
 * pour ce titre — l'ampleur du mouvement, ou l'afflux de volume s'il est
 * frappant. Rien d'inventé : les deux chiffres viennent des métriques.
 */
function accrocheLongue(m: HebdoMetrics, tete: string): string {
  const v = m.variationHebdo;
  if (v != null && Math.abs(v) >= 5) {
    const mot = v >= 0 ? 'bondit de' : 'décroche de';
    return `${tete} ${mot} ${fmtPct(Math.abs(v))} cette semaine`;
  }
  if (m.ratioVolume != null && m.ratioVolume >= 3) {
    return `${tete} : ${fmtRatio(m.ratioVolume)} fois son volume habituel cette semaine`;
  }
  if (v != null) {
    const mot = v >= 0 ? 'gagne' : 'cède';
    return `${tete} ${mot} ${fmtPct(Math.abs(v))} cette semaine`;
  }
  return `${tete} : la semaine en bref`;
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
    lignes.push(`${tete} — ${v == null ? 'stable' : `${v >= 0 ? '+' : '−'}${fmtPct(Math.abs(v))}`} cette semaine`);
    if (m.ratioVolume != null) {
      lignes.push(`📊 ${fmtRatio(m.ratioVolume)}× plus de titres échangés que d’habitude`);
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
  // L'accroche reprend le fait le plus saillant de la semaine (mouvement,
  // volume) plutôt qu'un verdict générique : c'est la première ligne que voit
  // un lecteur de fil d'actualité, elle doit lui donner une raison de lire.
  const accroche = accrocheLongue(m, tete);
  const corps = sk.sections.map((s) => `${s.titre}\n${s.texte}`).join('\n\n');
  return `${accroche}\n\n${corps}\n\n${AVERTISSEMENT}`;
}
