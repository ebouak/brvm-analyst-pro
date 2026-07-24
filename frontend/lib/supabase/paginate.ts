/**
 * Pagination des requêtes PostgREST.
 *
 * PostgREST plafonne TOUTE réponse à 1000 lignes, `.limit()` plus élevé compris.
 * Une requête d'historique (plusieurs titres × plusieurs séances) dépasse
 * facilement ce seuil, et la troncature est SILENCIEUSE : le calcul qui suit
 * porte alors sur une fraction arbitraire des données, sans erreur ni avertissement.
 *
 * Ce défaut a été trouvé successivement dans le moteur de liquidité, le backtest,
 * le scanner, les outils premium et les corrélations — toujours le même oubli.
 * Passer par cette fonction rend l'oubli impossible.
 *
 * `construire(from, to)` doit renvoyer la requête bornée par `.range(from, to)`.
 */
export async function fetchAllRows<T>(
  construire: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const LOT = 1000;
  const tout: T[] = [];
  for (let debut = 0; ; debut += LOT) {
    const { data } = await construire(debut, debut + LOT - 1);
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < LOT) break;
  }
  return tout;
}
