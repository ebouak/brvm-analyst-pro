/**
 * Saison des résultats (lot 5) : qui a publié quoi pour une période donnée.
 * PUR : aucune lecture ; les entrées sont des événements déjà regroupés et la liste des sociétés actives.
 */
import { libellePeriode } from './periode';
import type { EvenementRegroupe } from './regroupement';

/** Fin de période (AAAAMM), pour ordonner les périodes dans le temps. */
function cleChrono(periode: string): number {
  const m = periode.match(/^(T|S|9M|A)(\d?)-(\d{4})$/);
  if (!m) return 0;
  const annee = Number(m[3]);
  let mois = 12;
  if (m[1] === 'T') mois = Number(m[2]) * 3;
  else if (m[1] === 'S') mois = Number(m[2]) * 6;
  else if (m[1] === '9M') mois = 9;
  return annee * 100 + mois;
}

const estResultat = (e: EvenementRegroupe) => (e.type === 'resultats' || e.type === 'resultat') && !!e.periode && !!e.code;

const jours = (ref: string, n: number) => new Date(Date.parse(`${ref}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** Périodes présentes dans les publications de résultats, de la plus récente à la plus ancienne. */
export function periodesDisponibles(evts: EvenementRegroupe[]): string[] {
  return [...new Set(evts.filter(estResultat).map((e) => e.periode as string))].sort((a, b) => cleChrono(b) - cleChrono(a));
}

/**
 * Période « en cours » : celle qui a reçu le plus de publications de résultats
 * dans les `fenetreJours` derniers jours ; à égalité, la plus récente. Null s'il n'y en a aucune.
 */
export function periodeDeSaison(evts: EvenementRegroupe[], refDate: string, fenetreJours = 120): string | null {
  const debut = jours(refDate, fenetreJours);
  const compte = new Map<string, number>();
  for (const e of evts) {
    if (!estResultat(e) || e.date < debut || e.date > refDate) continue;
    compte.set(e.periode as string, (compte.get(e.periode as string) ?? 0) + 1);
  }
  let meilleure: string | null = null;
  for (const [p, n] of compte) {
    if (meilleure == null) { meilleure = p; continue; }
    const nm = compte.get(meilleure)!;
    if (n > nm || (n === nm && cleChrono(p) > cleChrono(meilleure))) meilleure = p;
  }
  return meilleure;
}

export interface PubSaison { code: string; date: string; id: string; titre: string }

export interface BilanSaison {
  periode: string;
  /** Une ligne par société ACTIVE ayant publié (première publication de la période). */
  publies: PubSaison[];
  /** Codes des sociétés actives sans publication recensée pour la période. */
  nonPublies: string[];
  nPublies: number;
  nActifs: number;
}

export function bilanSaison(actifs: string[], evts: EvenementRegroupe[], periode: string): BilanSaison {
  const actifSet = new Set(actifs);
  const parCode = new Map<string, PubSaison>();
  for (const e of evts) {
    if (!estResultat(e) || e.periode !== periode || !actifSet.has(e.code as string)) continue;
    const code = e.code as string;
    const deja = parCode.get(code);
    if (!deja || e.date < deja.date) parCode.set(code, { code, date: e.date, id: e.id, titre: e.titre });
  }
  const publies = [...parCode.values()].sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code));
  const nonPublies = [...actifSet].filter((c) => !parCode.has(c)).sort();
  return { periode, publies, nonPublies, nPublies: publies.length, nActifs: actifSet.size };
}

/** « leurs résultats du 3e trimestre 2026 », « leurs résultats de l'exercice 2025 », « leurs résultats des 9 mois 2026 ». */
export function objetPublication(periode: string): string {
  const lib = libellePeriode(periode);
  if (!lib) return 'leurs résultats';
  if (lib.startsWith('exercice')) return `leurs résultats de l’${lib}`;
  if (lib.startsWith('9 mois')) return `leurs résultats des ${lib}`;
  return `leurs résultats du ${lib}`;
}

/** « 31 sociétés sur 47 ont publié leurs résultats du 3e trimestre 2026 », accords compris. */
export function titreSaison(b: Pick<BilanSaison, 'periode' | 'nPublies' | 'nActifs'>): string {
  const n = b.nPublies;
  const sujet = `${n} ${n > 1 ? 'sociétés' : 'société'} sur ${b.nActifs}`;
  const objet = n > 1 ? objetPublication(b.periode) : objetPublication(b.periode).replace(/^leurs /, 'ses ');
  return `${sujet} ${n > 1 ? 'ont' : 'a'} publié ${objet}`;
}

export function variationPct(actuel: number | null | undefined, precedent: number | null | undefined): number | null {
  if (actuel == null || precedent == null || !Number.isFinite(actuel) || !Number.isFinite(precedent)) return null;
  // Base nulle ou négative : un pourcentage de variation serait trompeur.
  if (precedent <= 0) return null;
  return ((actuel - precedent) / precedent) * 100;
}

export interface LigneComptes { periode: string; revenu_total: number | null; resultat_net: number | null }

/**
 * Variations annuelles extraites en base pour « A-AAAA » : exercice AAAA comparé à AAAA−1.
 * Toute autre période (trimestre, semestre, 9 mois) : non extraite, car la base ne porte que des exercices annuels.
 */
export function variationsComptes(
  periode: string,
  lignes: LigneComptes[],
): { chiffreAffaires: number | null; resultatNet: number | null; extrait: boolean } {
  const m = periode.match(/^A-(\d{4})$/);
  if (!m) return { chiffreAffaires: null, resultatNet: null, extrait: false };
  const n = lignes.find((l) => l.periode === m[1]);
  const p = lignes.find((l) => l.periode === String(Number(m[1]) - 1));
  if (!n || !p) return { chiffreAffaires: null, resultatNet: null, extrait: false };
  return {
    chiffreAffaires: variationPct(n.revenu_total, p.revenu_total),
    resultatNet: variationPct(n.resultat_net, p.resultat_net),
    extrait: true,
  };
}
