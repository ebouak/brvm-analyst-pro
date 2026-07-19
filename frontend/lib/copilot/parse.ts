/**
 * Copilote ⌘K — parseur d'intentions en langage naturel. Fonction PURE, testée.
 *
 * Première passe déterministe avant tout appel LLM : société + page cible,
 * filtres PER / rendement. Retourne null si la requête ne matche rien —
 * la route /api/copilot bascule alors sur le choix d'outil par LLM.
 */

export interface InstrumentRef {
  code: string;
  designation: string | null;
}

export type CopilotIntent =
  | { type: 'navigate'; href: string; label: string }
  | { type: 'filtre_per'; op: 'lt' | 'gt'; seuil: number }
  | { type: 'filtre_rendement'; op: 'lt' | 'gt'; seuil: number };

/** Minuscules + accents retirés — même normalisation pour requête et libellés. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Pages d'une société, par mot-clé (ordre = priorité de détection). */
const SOCIETE_PAGES: { re: RegExp; href: (code: string) => string; label: string }[] = [
  { re: /fondament|bilan|compte de result|etats? financ|chiffre d'affaires|resultat net/, href: (c) => `/financials/${c}`, label: 'Fondamentaux' },
  { re: /diagnostic/, href: (c) => `/premium/diagnostic/${c}`, label: 'Diagnostic IA' },
  { re: /dividende/, href: (c) => `/actions/${c}#dividendes`, label: 'Dividendes' },
  { re: /signa(l|ux)|rsi|macd|technique/, href: (c) => `/actions/${c}`, label: 'Analyse technique' },
];

/** Opérateur d'un filtre numérique : « < », « inférieur à », « moins de », « sous »… */
function parseOp(text: string): 'lt' | 'gt' | null {
  if (/(<|inferieur|moins de|sous|en dessous|max)/.test(text)) return 'lt';
  if (/(>|superieur|plus de|au dessus|au-dessus|min|d'au moins)/.test(text)) return 'gt';
  return null;
}

function parseNumericFilter(nq: string, keyword: RegExp): { op: 'lt' | 'gt'; seuil: number } | null {
  const m = nq.match(keyword);
  if (!m) return null;
  // La partie après le mot-clé porte l'opérateur et le seuil.
  const after = nq.slice((m.index ?? 0) + m[0].length);
  const num = after.match(/(\d+(?:[.,]\d+)?)/);
  if (!num?.[1]) return null;
  const op = parseOp(after.slice(0, num.index ?? after.length)) ?? parseOp(nq.slice(0, m.index ?? 0));
  if (!op) return null;
  return { op, seuil: parseFloat(num[1].replace(',', '.')) };
}

/** Cherche une société citée dans la requête (code exact en mot, ou nom inclus). */
export function findSociete(nq: string, instruments: InstrumentRef[]): InstrumentRef | null {
  // 1. Code en mot entier (SNTS, PALC…) — insensible à la casse via normalize.
  for (const i of instruments) {
    if (new RegExp(`\\b${normalize(i.code)}\\b`).test(nq)) return i;
  }
  // 2. Désignation : au moins un mot significatif (≥ 4 lettres) présent dans la requête.
  let best: { inst: InstrumentRef; len: number } | null = null;
  for (const i of instruments) {
    if (!i.designation) continue;
    const words = normalize(i.designation).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    for (const w of words) {
      if (nq.includes(w) && (!best || w.length > best.len)) best = { inst: i, len: w.length };
    }
  }
  return best?.inst ?? null;
}

export function parseCopilotQuery(query: string, instruments: InstrumentRef[]): CopilotIntent | null {
  const nq = normalize(query);

  // ── Filtres numériques (avant la détection société : « per » n'est pas un code) ──
  const per = parseNumericFilter(nq, /\bper\b/);
  if (per) return { type: 'filtre_per', ...per };
  const rdt = parseNumericFilter(nq, /rendement/);
  if (rdt) return { type: 'filtre_rendement', ...rdt };

  // ── Société + page cible ──
  const soc = findSociete(nq, instruments);
  if (soc) {
    for (const p of SOCIETE_PAGES) {
      if (p.re.test(nq)) {
        return { type: 'navigate', href: p.href(soc.code), label: `${p.label} — ${soc.designation ?? soc.code}` };
      }
    }
    return { type: 'navigate', href: `/actions/${soc.code}`, label: `Fiche ${soc.designation ?? soc.code}` };
  }

  return null;
}
