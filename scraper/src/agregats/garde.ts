/**
 * Garde de l'écriture depuis un rapport de reprise — PUR.
 *
 * Un rapport porteur d'avertissements n'est pas écrit : l'exploitant doit les
 * avoir vus. Une seule exception, explicite : la reprise BORNÉE dans le temps
 * (`--depuis`), dont l'avertissement décrit un périmètre choisi et approuvé,
 * pas un défaut de lecture. Elle ne passe qu'avec `--partielle-acceptee` ; tout
 * autre avertissement reste bloquant.
 */
export const PREFIXE_PARTIELLE = 'Reprise partielle : publications depuis le ';

export function avertissementsBloquants(avertissements: readonly string[] | undefined, opts: { partielleAcceptee: boolean }): string[] {
  return (avertissements ?? []).filter((a) => !(opts.partielleAcceptee && a.startsWith(PREFIXE_PARTIELLE)));
}
