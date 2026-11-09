/**
 * Profil d'une société cotée (table societes_profils, migration 0201).
 *
 * Règle « officiel d'abord » : les dirigeants et l'actionnariat ont été retenus
 * seulement sur source officielle (BRVM, émetteur, BCEAO, État). Ce module ne
 * fait que valider et ordonner : une ligne mal formée disparaît, rien n'est deviné.
 */

export interface Dirigeant { nom: string; fonction: string; depuis: string | null; source: string }
export interface Actionnaire { nom: string; pct: number }
export interface ProfilSociete {
  presentation: string | null;
  metiers: string[];
  determinants: string[];
  dirigeants: Dirigeant[];
  actionnariat: { lignes: Actionnaire[]; date: string; source: string } | null;
  siteWeb: string | null;
  verifieLe: string;
}

const TIERS_DE_DONNEES = /richbourse|madisinvest|sikafinance|waramina|zonebourse/i;

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const textes = (v: unknown): string[] => (Array.isArray(v) ? v.map(texte).filter((s): s is string => !!s) : []);

/** Rang d'affichage : présidence, direction générale, adjoints, puis le reste. */
function rang(fonction: string): number {
  const f = fonction.toLowerCase();
  if (/pr[ée]sident/.test(f) && !/vice/.test(f)) return 0;
  if (/adjoint/.test(f)) return 2;
  if (/directeur g[ée]n[ée]ral|directrice g[ée]n[ée]rale/.test(f)) return 1;
  return 3;
}

export function libelleSource(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h.endsWith('brvm.org') ? 'BRVM' : h;
  } catch {
    return 'source';
  }
}

interface LigneBrute {
  presentation?: unknown; metiers?: unknown; determinants?: unknown;
  dirigeants?: unknown; actionnariat?: unknown; site_web?: unknown; verifie_le?: unknown;
}

export function normaliserProfil(row: LigneBrute | null | undefined): ProfilSociete | null {
  if (!row) return null;

  const dirigeants: Dirigeant[] = (Array.isArray(row.dirigeants) ? row.dirigeants : [])
    .map((d: unknown): Dirigeant | null => {
      const o = (d ?? {}) as Record<string, unknown>;
      const nom = texte(o.nom), fonction = texte(o.fonction), source = texte(o.source);
      return nom && fonction && source ? { nom, fonction, depuis: texte(o.depuis), source } : null;
    })
    .filter((d): d is Dirigeant => d !== null)
    .sort((a, b) => rang(a.fonction) - rang(b.fonction));

  let actionnariat: ProfilSociete['actionnariat'] = null;
  const a = (row.actionnariat ?? null) as Record<string, unknown> | null;
  const date = a ? texte(a.date) : null;
  const source = a ? texte(a.source) : null;
  if (a && Array.isArray(a.lignes) && date && source) {
    const lignes = (a.lignes as Array<Record<string, unknown>>)
      .map((l) => ({ nom: texte(l.nom), pct: Number(l.pct) }))
      .filter((l): l is Actionnaire => !!l.nom && Number.isFinite(l.pct) && l.pct > 0)
      .sort((x, y) => y.pct - x.pct);
    const total = lignes.reduce((s, l) => s + l.pct, 0);
    // Une répartition qui dépasse 100 % trahit une source fautive : on ne l'affiche pas.
    if (lignes.length && total <= 100.5) actionnariat = { lignes, date, source };
  }

  const site = texte(row.site_web);
  return {
    presentation: texte(row.presentation),
    metiers: textes(row.metiers),
    determinants: textes(row.determinants),
    dirigeants,
    actionnariat,
    siteWeb: site && /^https?:\/\//.test(site) && !TIERS_DE_DONNEES.test(site) ? site : null,
    verifieLe: texte(row.verifie_le) ?? '',
  };
}
