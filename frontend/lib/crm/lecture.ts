/**
 * Lecture paginée du CRM qui ÉCHOUE BRUYAMMENT. fetchAllRows (partagé) avale
 * l'erreur et rend une liste vide : ici, une table illisible ferait croire à
 * « aucune opposition » ou « aucun paiement ». Mieux vaut une page en erreur.
 */
export async function lireTout<T>(
  construire: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  quoi: string,
): Promise<T[]> {
  const LOT = 1000;
  const tout: T[] = [];
  for (let debut = 0; ; debut += LOT) {
    const { data, error } = await construire(debut, debut + LOT - 1);
    if (error) throw new Error(`CRM : lecture « ${quoi} » impossible (${error.message})`);
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < LOT) break;
  }
  return tout;
}
