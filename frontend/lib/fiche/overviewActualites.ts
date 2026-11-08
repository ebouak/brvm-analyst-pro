/**
 * Actualités de la vue d'ensemble — logique pure. Seules celles de LA valeur :
 * publications officielles (`publications` du code) et presse (`brvm_news` dont
 * `ticker_codes` contient le code, filtrée et non masquée par la requête).
 * Rien n'est daté dans le futur ; un même titre repris par deux sites n'est
 * gardé qu'une fois.
 */
import { titrePublication } from './affichage';
import { dateEnLettres } from './overview';

export interface ActuItem {
  id: string;
  titre: string;
  href: string | null;
  source: string;
  date: string;
  /** ISO, pour le tri. */
  dateIso: string;
  nature: 'officielle' | 'presse';
}

export interface GroupesActualites { tout: ActuItem[]; officielles: ActuItem[]; presse: ActuItem[] }

export interface PubEntree { id: string; libelle: string | null; date_publication: string; type_publication?: string | null; source_url: string | null }
export interface NewsEntree { id: string; titre: string; date_publication: string; source_label: string | null; source: string | null; source_url: string | null }

export function lienSur(u: string | null | undefined): string | null {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

/** Les flux Google News suffixent le titre par « - Nom du site » : il devient la source. */
function separerSource(n: NewsEntree): { titre: string; source: string } {
  const agregateur = !n.source_label || /^google news/i.test(n.source_label);
  const i = n.titre.lastIndexOf(' - ');
  if (agregateur && i > 0) return { titre: n.titre.slice(0, i).trim(), source: n.titre.slice(i + 3).trim() };
  return { titre: n.titre.trim(), source: n.source_label ?? 'Presse' };
}

const cle = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const parDate = (a: ActuItem, b: ActuItem) =>
  b.dateIso.localeCompare(a.dateIso) || (a.nature === b.nature ? 0 : a.nature === 'officielle' ? -1 : 1);

export function regrouperActualites(pubs: PubEntree[], news: NewsEntree[], aujourdhui: string): GroupesActualites {
  const officielles: ActuItem[] = pubs
    .filter((p) => p.date_publication.slice(0, 10) <= aujourdhui && (p.libelle ?? '').trim() !== '')
    .map((p) => ({
      id: `pub-${p.id}`,
      titre: titrePublication(p.libelle!),
      href: lienSur(p.source_url),
      source: 'BRVM',
      date: dateEnLettres(p.date_publication) ?? p.date_publication,
      dateIso: p.date_publication.slice(0, 10),
      nature: 'officielle' as const,
    }))
    .sort(parDate);

  const vus = new Set<string>();
  const presse: ActuItem[] = [];
  for (const n of [...news].sort((a, b) => b.date_publication.localeCompare(a.date_publication))) {
    if (n.date_publication.slice(0, 10) > aujourdhui) continue;
    const { titre, source } = separerSource(n);
    if (!titre) continue;
    const k = cle(titre);
    if (vus.has(k)) continue;
    vus.add(k);
    presse.push({
      id: `news-${n.id}`,
      titre,
      href: lienSur(n.source_url),
      source,
      date: dateEnLettres(n.date_publication) ?? n.date_publication,
      dateIso: n.date_publication.slice(0, 10),
      nature: 'presse',
    });
  }
  presse.sort(parDate);

  return { tout: [...officielles, ...presse].sort(parDate), officielles, presse };
}
