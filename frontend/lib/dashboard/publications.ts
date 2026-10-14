/**
 * Bloc « Publications » (spec §4.2) — documents déposés par les émetteurs.
 * PUR et testé. Sources officielles uniquement : la presse reste dans `actus`.
 */
export interface PublicationSource {
  code: string;
  date_publication: string;
  libelle: string;
  type_publication: string | null;
  source_url: string | null;
}

export interface PublicationBloc {
  code: string;
  date: string;
  libelle: string;
  typeLibelle: string;
  url: string | null;
  mienne: boolean;
}

const TYPES: Record<string, string> = {
  etats_financiers: 'États financiers',
  bilan: 'États financiers',
  rapport: 'Rapport',
  ag: 'Assemblée générale',
  notation: 'Notation',
  autre: 'Communiqué',
};

export function libelleType(type: string | null): string {
  return (type && TYPES[type]) || 'Communiqué';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Seuls les liens http(s) sont rendus : un `javascript:` en base ne doit jamais devenir cliquable. */
function urlSure(u: string | null): string | null {
  return u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

export function preparerPublications(
  rows: PublicationSource[],
  codesDetenus: ReadonlySet<string>,
  limite = 8,
): PublicationBloc[] {
  const vus = new Set<string>();
  const out: PublicationBloc[] = [];
  const recentsD = [...rows].sort((x, y) => String(y.date_publication).localeCompare(String(x.date_publication)));
  for (const r of recentsD) {
    const libelle = r.libelle?.trim() ?? '';
    if (!ISO.test(r.date_publication) || !libelle) continue;
    const code = r.code.trim().toUpperCase();
    const url = urlSure(r.source_url);
    const cle = url ?? `${code}|${r.date_publication}|${libelle}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ code, date: r.date_publication, libelle, typeLibelle: libelleType(r.type_publication), url, mienne: codesDetenus.has(code) });
  }
  return out
    .sort((x, y) => Number(y.mienne) - Number(x.mienne) || y.date.localeCompare(x.date) || x.code.localeCompare(y.code))
    .slice(0, limite);
}
