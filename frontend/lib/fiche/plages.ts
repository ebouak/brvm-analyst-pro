/** Plage de cours sur N jours calendaires, bornes incluses. Zéros et nuls écartés : un zéro en base est un trou de collecte. */
export interface Plage { bas: number; dateBas: string | null; haut: number; dateHaut: string | null; position: number | null }

/** Position du cours dans [bas, haut], bornée à [0, 1] ; null si la plage est plate ou le cours absent. */
export function positionDans(bas: number, haut: number, cours: number | null): number | null {
  if (cours == null || !(haut > bas)) return null;
  return Math.min(1, Math.max(0, (cours - bas) / (haut - bas)));
}

export function plageSurFenetre(
  rows: { date_marche: string; cours_jour: number | null }[],
  dateRef: string,
  jours: number,
  cours: number | null,
): Plage | null {
  const debut = new Date(dateRef + 'T00:00:00Z');
  debut.setUTCDate(debut.getUTCDate() - jours);
  const borne = debut.toISOString().slice(0, 10);
  const utiles = rows.filter((r) => r.date_marche >= borne && r.date_marche <= dateRef && r.cours_jour != null && r.cours_jour > 0);
  if (utiles.length === 0) return null;
  // Ordre d'entrée indifférent : tri par date croissante, et à cours égal on retient la date la PLUS RÉCENTE.
  utiles.sort((x, y) => x.date_marche.localeCompare(y.date_marche));
  let b = utiles[0]!, h = utiles[0]!;
  for (const r of utiles) {
    if (r.cours_jour! <= b.cours_jour!) b = r;
    if (r.cours_jour! >= h.cours_jour!) h = r;
  }
  const bas = b.cours_jour!, haut = h.cours_jour!;
  return { bas, dateBas: b.date_marche, haut, dateHaut: h.date_marche, position: positionDans(bas, haut, cours) };
}

/** Plage d'une séance (plus bas / plus haut publiés), sans dates. */
export function plageSeance(bas: number | null, haut: number | null, cours: number | null): Plage | null {
  if (bas == null || haut == null || bas <= 0 || haut <= 0) return null;
  return { bas, dateBas: null, haut, dateHaut: null, position: positionDans(bas, haut, cours) };
}

/** Nombre de séances lues pour la série de cours : identique sur la fiche et sur /financials. */
export const NB_SEANCES_SERIE = 600;

/** Plage 52 semaines (365 jours calendaires jusqu'à la dernière séance de la série) : source unique des deux pages. */
export function plage52Semaines(rows: { date_marche: string; cours_jour: number | null }[], cours: number | null): Plage | null {
  let dateRef: string | null = null;
  for (const r of rows) if (dateRef == null || r.date_marche > dateRef) dateRef = r.date_marche;
  return dateRef ? plageSurFenetre(rows, dateRef, 365, cours) : null;
}
