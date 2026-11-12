/** Code de période de `periodeDuTitre` en français : « T3-2026 » → « 3e trimestre 2026 », « A-2025 » → « exercice 2025 ». */
export function libellePeriode(periode: string | null): string | null {
  const m = periode?.match(/^(T|S)(\d)-(\d{4})$/);
  if (m) return `${m[2] === '1' ? '1er' : `${m[2]}e`} ${m[1] === 'T' ? 'trimestre' : 'semestre'} ${m[3]}`;
  const n = periode?.match(/^(9M|A)-(\d{4})$/);
  if (n) return n[1] === 'A' ? `exercice ${n[2]}` : `9 mois ${n[2]}`;
  return null;
}
