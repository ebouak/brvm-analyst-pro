/** Paramètres d'URL des widgets embarquables. Fonctions pures (params.test.mjs). */

export type EmbedTheme = 'dark' | 'light';
export type EmbedLang = 'fr' | 'en';

/** Plafond de codes du ticker : sans borne, un tiers peut faire exploser la requête. */
export const MAX_CODES = 20;

export function parseTheme(raw: string | undefined): EmbedTheme {
  return raw?.toLowerCase() === 'light' ? 'light' : 'dark';
}

export function parseLang(raw: string | undefined): EmbedLang {
  return raw?.toLowerCase() === 'en' ? 'en' : 'fr';
}

/** `?codes=snts,etit` → ['SNTS','ETIT'] ; absent/vide → null (= toutes les actions). */
export function parseCodes(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const codes = [
    ...new Set(
      raw
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  return codes.length === 0 ? null : codes.slice(0, MAX_CODES);
}
