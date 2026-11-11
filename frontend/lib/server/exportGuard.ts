import { z } from 'zod';

/**
 * Corps accepté par /api/export/pdf et /api/export/docx.
 * `symbole` est vide pour un screener, sinon 3 à 6 majuscules : il finit dans
 * un en-tête HTTP, donc rien d'autre ne doit passer.
 */
export const exportBodySchema = z.object({
  texte: z.string().min(1).max(60_000),
  symbole: z.union([z.literal(''), z.string().regex(/^[A-Z]{3,6}$/)]).optional().default(''),
});

/** Nom de fichier sûr pour Content-Disposition : [A-Za-z0-9_-] seulement. */
export function nomFichierSur(symbole: string, date: string, ext: 'pdf' | 'docx'): string {
  const base = `BRVM_Analyse_${symbole || 'rapport'}_${date}`.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${base}.${ext}`;
}
