// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Compose les deux formats prêts à poster depuis un squelette DÉJÀ validé
 * (donc soumis aux mêmes garde-fous) : `long` pour LinkedIn/Facebook,
 * `court` pour WhatsApp/Telegram. PUR, testé.
 */
import { fmtPct, fmtRatio } from './format.js';
import { TITRES, type Skeleton } from './narrative.js';
import type { HebdoMetrics } from './types.js';

export type PostFormat = 'long' | 'court';

const AVERTISSEMENT = 'Information à but pédagogique — ce n’est pas un conseil en investissement.';

function emoji(m: HebdoMetrics): string {
  return (m.variationHebdo ?? 0) >= 0 ? '▲' : '▼';
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

/** Longueur maximale du format court (un message WhatsApp lisible d'un coup d'œil). */
const COURT_MAX = 700;

/** Découpe en phrases (les nombres s'écrivent à la virgule : aucun point interne). */
function phrases(texte: string): string[] {
  return (texte.match(/[^.!?]+[.!?]/g) ?? [texte]).map((x) => x.trim()).filter(Boolean);
}

export function buildPost(sk: Skeleton, m: HebdoMetrics, format: PostFormat): string {
  const tete = `${emoji(m)} ${m.code}`;

  if (format === 'court') {
    const lignes: string[] = [];
    const v = m.variationHebdo;
    lignes.push(`${tete} — ${v == null ? 'stable' : `${v >= 0 ? '+' : '−'}${fmtPct(Math.abs(v))}`} cette semaine`);
    if (m.ratioVolume != null) {
      lignes.push(`· ${fmtRatio(m.ratioVolume)} fois le volume moyen lors de la dernière séance`);
    }
    const texteDe = (titre: string) => sk.sections.find((s) => s.titre === titre)?.texte ?? null;
    const semaine = texteDe(TITRES.semaine);
    const marche = semaine ? phrases(semaine).find((x) => x.startsWith('Sur la même période')) : undefined;
    if (marche) lignes.push(`· ${marche}`);
    const valo = texteDe(TITRES.valorisation);
    if (valo) lignes.push(`· ${phrases(valo)[0]}`);
    const liq = texteDe(TITRES.liquidite);
    if (liq) lignes.push(`· ${phrases(liq)[0]}`);
    const tech = texteDe(TITRES.technique);
    const canal = tech ? phrases(tech).find((x) => x.startsWith('Le cours')) : undefined;
    if (canal) lignes.push(`· ${canal}`);
    // Format court : on retire les lignes de détail, de la dernière vers la
    // première, jusqu'à tenir dans un message.
    while (lignes.length > 1 && [...lignes, AVERTISSEMENT].join('\n').length > COURT_MAX) lignes.pop();
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
