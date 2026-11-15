/**
 * Message à l'exploitant quand la file de relecture n'est pas vide — PUR.
 * Codes de valeurs et comptes seulement : aucune donnée personnelle.
 */
const SITE = 'https://www.westbourse.com';

export function messageFile(ouvertes: { code: string }[]): { subject: string; body: string } | null {
  if (ouvertes.length === 0) return null;
  const parCode = new Map<string, number>();
  for (const o of ouvertes) parCode.set(o.code, (parCode.get(o.code) ?? 0) + 1);
  const liste = [...parCode.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${c} (${n})`).join(', ');
  return {
    subject: `Agrégats bancaires — ${ouvertes.length} valeur(s) à relire`,
    body: `Rien de douteux n’est publié tant que ces valeurs ne sont pas tranchées : ${liste}.\n${SITE}/admin/agregats`,
  };
}
