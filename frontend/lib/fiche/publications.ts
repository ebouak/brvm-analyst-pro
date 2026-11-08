export interface Pub {
  id: string;
  date_publication: string;
  libelle: string;
  type_publication: string | null;
  source_url: string | null;
}

const TYPES_CONNUS = ['etats_financiers', 'ag', 'rapport', 'bilan', 'notation', 'avis', 'autre'];
const estConnu = (t: string | null) => t != null && TYPES_CONNUS.includes(t);

const parDateDesc = (a: Pub, b: Pub) => b.date_publication.localeCompare(a.date_publication);

export interface DocumentsCles { etats: Pub | null; rapport: Pub | null; ag: Pub | null }

export function documentsCles(pubs: Pub[]): DocumentsCles {
  const tri = [...pubs].sort(parDateDesc);
  const premier = (t: string) => tri.find((x) => x.type_publication === t) ?? null;
  return { etats: premier('etats_financiers'), rapport: premier('rapport'), ag: premier('ag') };
}

export interface Compteurs { total: number; parType: Record<string, number>; sansType: number }

/** `sansType` = total − somme des types connus : un document dont le type est absent ou inconnu reste atteignable. */
export function compteursParType(pubs: Pub[]): Compteurs {
  const parType: Record<string, number> = {};
  for (const t of TYPES_CONNUS) parType[t] = pubs.filter((x) => x.type_publication === t).length;
  const somme = Object.values(parType).reduce((a, n) => a + n, 0);
  return { total: pubs.length, parType, sansType: pubs.length - somme };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrerPublications(pubs: Pub[], filtre: string, recherche: string): Pub[] {
  const q = norm(recherche.trim());
  return pubs.filter((x) => {
    if (filtre === 'sans_type' ? estConnu(x.type_publication) : filtre !== 'all' && x.type_publication !== filtre) return false;
    return q === '' || norm(x.libelle).includes(q);
  });
}

export function grouperParAnnee(pubs: Pub[]): { annee: string; items: Pub[] }[] {
  const tri = [...pubs].sort(parDateDesc);
  const groupes: { annee: string; items: Pub[] }[] = [];
  for (const x of tri) {
    const annee = x.date_publication.slice(0, 4);
    const g = groupes[groupes.length - 1];
    if (g && g.annee === annee) g.items.push(x);
    else groupes.push({ annee, items: [x] });
  }
  return groupes;
}
