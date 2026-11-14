/**
 * Données de la page d'accueil (PR 1 de la refonte « vitrine »), dérivées de
 * `getLandingBisData` : AUCUNE requête nouvelle, aucun chiffre en dur. Fonctions
 * PURES (testées) : elles transforment la séance lue en base en données
 * sérialisables pour les sections, composants client compris.
 *
 * Une donnée absente reste `null` : la section affiche « non disponible » ou se retire.
 */
import { fmtNumber, fmtFcfa } from '@/lib/format';

export interface LigneCours { code: string; cours_jour: number | null; variation_pct: number | null }
export interface PointIndice { d: string; v: number }

/** « +7,18 % », « −6,97 % », « 0,00 % » : moins typographique, espace insécable, zéro sans signe. */
export function pctTexte(v: number, d = 2): string {
  const r = Number(v.toFixed(d));
  const signe = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${signe}${fmtNumber(Math.abs(r), d)} %`;
}

/** « 11 novembre 2026 » (date ISO lue en UTC). */
export function dateLongue(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** « relevé le 11/11 à 17:04 UTC », ou null sans horodatage. */
export function releve(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `relevé le ${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)} à ${p(t.getUTCHours())}:${p(t.getUTCMinutes())} UTC`;
}

// ── Scène de l'indice ────────────────────────────────────────────────────

export interface SceneIndice {
  valeur: number;
  variation: number | null;
  /** Séances chronologiques, avec leur VRAIE date (la maquette n'avait que « il y a N séances »). */
  serie: { date: string; valeur: number }[];
  bas: number;
  haut: number;
}

/** Les `n` dernières séances de l'indice, bornes comprises ; null sans au moins deux points. */
export function sceneIndice(valeur: number | null, variation: number | null, serie: PointIndice[], n = 60): SceneIndice | null {
  const pts = serie.filter((p) => Number.isFinite(p.v) && p.v > 0).slice(-n).map((p) => ({ date: p.d, valeur: p.v }));
  if (valeur == null || pts.length < 2) return null;
  const vals = pts.map((p) => p.valeur);
  return { valeur, variation, serie: pts, bas: Math.min(...vals), haut: Math.max(...vals) };
}

/** Tracé SVG (viewBox 0 0 L H) d'une série ; marge verticale de 8 en haut et en bas. */
export function traceSerie(valeurs: number[], L = 560, H = 184, marge = 8): string {
  if (valeurs.length < 2) return '';
  const bas = Math.min(...valeurs), haut = Math.max(...valeurs);
  const e = haut - bas || 1;
  return valeurs
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i * L) / (valeurs.length - 1)).toFixed(1)} ${(marge + ((haut - v) / e) * (H - 2 * marge)).toFixed(1)}`)
    .join(' ');
}

// ── Mosaïque des valeurs ─────────────────────────────────────────────────

export type TonCase = 'hausse-pleine' | 'hausse' | 'stable' | 'baisse' | 'baisse-pleine';
export interface CaseValeur { code: string; cours: number | null; variation: number; ton: TonCase; pct: string; lecture: string }

/**
 * Une case par action cotée de la séance, de la plus forte hausse à la plus forte
 * baisse. ±1 % et plus : case pleine (texte presque noir) ; en dessous : teintée ;
 * 0 : stable. Une variation absente est rangée comme stable et le dit.
 */
export function casesMosaique(lignes: LigneCours[]): CaseValeur[] {
  return lignes
    .filter((l) => l.code)
    .map((l) => {
      const v = l.variation_pct ?? 0;
      const r = Number(v.toFixed(2));
      const ton: TonCase = r >= 1 ? 'hausse-pleine' : r > 0 ? 'hausse' : r <= -1 ? 'baisse-pleine' : r < 0 ? 'baisse' : 'stable';
      const pct = l.variation_pct == null ? 'non disponible' : pctTexte(v);
      const cours = l.cours_jour != null && l.cours_jour > 0 ? l.cours_jour : null;
      return {
        code: l.code, cours, variation: r, ton, pct,
        lecture: `${l.code} · ${cours != null ? `${fmtNumber(cours, 0)} FCFA` : 'cours non disponible'} · ${pct}`,
      };
    })
    .sort((a, b) => b.variation - a.variation || a.code.localeCompare(b.code));
}

// ── Bandeau de mots et film ──────────────────────────────────────────────

export interface ChiffresSeance {
  indice: number | null; variation: number | null;
  hausses: number; stables: number; baisses: number;
  capitaux: number | null; titres: number | null; transactions: number | null;
  meilleure: { code: string; variation: number } | null;
  pire: { code: string; variation: number } | null;
  nbValeurs: number;
}

const pluriel = (n: number, mot: string) => `${fmtNumber(n, 0)} ${mot}${n > 1 ? 's' : ''}`;

/** Deux lignes de mots composées avec les chiffres de la séance ; un chiffre absent retire son mot. */
export function motsBandeau(c: ChiffresSeance): [string[], string[]] {
  const l1 = [
    c.indice != null ? fmtNumber(c.indice, 2) : null,
    c.variation != null ? `${c.variation > 0 ? '▲' : c.variation < 0 ? '▼' : ''} ${pctTexte(c.variation)}`.trim() : null,
    pluriel(c.hausses, 'hausse'),
    'la séance',
    pluriel(c.baisses, 'baisse'),
    c.capitaux != null ? `${fmtFcfa(c.capitaux)} FCFA` : null,
  ].filter((m): m is string => !!m);
  const l2 = [
    c.meilleure ? `${c.meilleure.code} ${pctTexte(c.meilleure.variation)}` : null,
    pluriel(c.nbValeurs, 'valeur'),
    'au chiffre près',
    c.pire ? `${c.pire.code} ${pctTexte(c.pire.variation)}` : null,
    c.titres != null ? pluriel(c.titres, 'titre') : null,
    c.transactions != null ? pluriel(c.transactions, 'transaction') : null,
  ].filter((m): m is string => !!m);
  return [l1, l2];
}

/** Les deux plus fortes hausses et les deux plus fortes baisses (film, scène 3). */
export function plusFortesVariations(cases: CaseValeur[], n = 2): { code: string; variation: number; pct: string }[] {
  const h = cases.filter((c) => c.variation > 0).slice(0, n);
  const b = cases.filter((c) => c.variation < 0).slice(-n);
  return [...h, ...b].map((c) => ({ code: c.code, variation: c.variation, pct: c.pct }));
}
