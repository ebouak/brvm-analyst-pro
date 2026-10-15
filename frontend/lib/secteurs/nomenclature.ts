/**
 * Nomenclature sectorielle BRVM en vigueur depuis le 2 janvier 2026 (Bulletin
 * officiel de la cote) : sept secteurs, chacun doté de son indice. Les libellés
 * sont ceux de `brvm_instruments.secteur`, que le tableau de bord compare à
 * l'identique.
 *
 * Le profil proposait l'ancienne liste (Finance, Agro-industrie, Distribution,
 * Industrie, Transport) : un favori « Finance » ne correspondait à aucun secteur
 * en base et le bloc « Vos secteurs » restait vide, sans le dire. Les anciens
 * choix sont convertis à la lecture plutôt que réécrits en base : aucune
 * migration, et l'enregistrement suivant du profil les fixe.
 */
export const SECTEURS_2026 = [
  'Services financiers',
  'Télécommunications',
  'Consommation de base',
  'Consommation discrétionnaire',
  'Industriels',
  'Énergie',
  'Services publics',
] as const;

/** Ancien libellé → secteur 2026. Distribution : CFAO et assimilés (le pétrolier relève de l'Énergie). */
const ANCIENS: Record<string, string> = {
  Finance: 'Services financiers',
  'Agro-industrie': 'Consommation de base',
  Distribution: 'Consommation discrétionnaire',
  Industrie: 'Industriels',
  Transport: 'Industriels',
  Energie: 'Énergie',
};

/** Favoris convertis à la nomenclature 2026, sans doublon ni libellé inconnu. */
export function secteursCourants(favoris: readonly string[] | null | undefined): string[] {
  const valides = new Set<string>(SECTEURS_2026);
  const out: string[] = [];
  for (const brut of favoris ?? []) {
    const s = ANCIENS[brut] ?? brut;
    if (valides.has(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
