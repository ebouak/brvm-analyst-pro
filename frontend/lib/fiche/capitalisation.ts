/**
 * Capitalisation boursière en FCFA, règle unique : la `valorisation` de la
 * séance quand elle est présente (et positive), sinon cours × nombre de titres.
 * Fiche, /financials et /revue la lisent ici, pour ne pas diverger.
 */
export function capitalisationFcfa(p: { valorisation: number | null | undefined; cours: number | null | undefined; titres: number | null | undefined }): number | null {
  if (p.valorisation != null && Number.isFinite(p.valorisation) && p.valorisation > 0) return p.valorisation;
  if (p.cours != null && p.titres != null && p.cours > 0 && p.titres > 0) return p.cours * p.titres;
  return null;
}
