import { fmtFcfa, fmtDateCourte } from '@/lib/format';
import { formatPct, formatRatio } from '@/lib/financials/formatters';
import { ratiosBilan, type RatiosBilan } from './ratiosBilan';
import type { Affichable } from './affichage';

/**
 * COMPTES IFRS, second jeu publié par certaines sociétés (table `comptes_ifrs`,
 * migration 0199). Affichés À CÔTÉ des comptes SYSCOHADA, qui restent la base
 * des ratios principaux (`exerciceRetenu`). Les ratios IFRS passent par le même
 * `ratiosBilan`, sur les mêmes cours et capitalisation : seule la colonne de
 * comptes change. Fonction pure ; aucune donnée inventée (un poste NULL reste
 * « non disponible »).
 */

export interface PosteSika {
  poste: string;
  sika: number;
  ifrs: number;
  ecart: number;
  comparable: boolean;
}
export interface ComparaisonSika {
  source_url: string | null;
  consulte_le: string | null;
  referentiel_sika: string | null;
  postes: PosteSika[];
}

export interface LigneComptesIfrs {
  code: string;
  exercice: number;
  chiffre_affaires: number | null;
  resultat_net: number | null;
  resultat_net_part_groupe: number | null;
  capitaux_propres: number | null;
  capitaux_propres_part_groupe: number | null;
  total_actif: number | null;
  dette_financiere: number | null;
  source_url: string;
  source_titre: string | null;
  verifie_le: string;
  comparaison_sika: ComparaisonSika | null;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

function normaliserComparaison(v: unknown): ComparaisonSika | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.postes)) return null;
  const postes: PosteSika[] = [];
  for (const p of o.postes) {
    if (p == null || typeof p !== 'object') continue;
    const q = p as Record<string, unknown>;
    const poste = texte(q.poste); const sika = num(q.sika); const ifrs = num(q.ifrs); const ecart = num(q.ecart);
    if (poste == null || sika == null || ifrs == null || ecart == null || typeof q.comparable !== 'boolean') continue;
    postes.push({ poste, sika, ifrs, ecart, comparable: q.comparable });
  }
  if (postes.length === 0) return null;
  return { source_url: texte(o.source_url), consulte_le: texte(o.consulte_le), referentiel_sika: texte(o.referentiel_sika), postes };
}

/** Ligne brute (PostgREST) → ligne typée ; null si l'exercice ou la source manque. */
export function normaliserLigneIfrs(r: Record<string, unknown> | null | undefined): LigneComptesIfrs | null {
  if (!r) return null;
  const exercice = num(r.exercice);
  const code = texte(r.code); const source_url = texte(r.source_url); const verifie_le = texte(r.verifie_le);
  if (exercice == null || code == null || source_url == null || verifie_le == null) return null;
  return {
    code, exercice,
    chiffre_affaires: num(r.chiffre_affaires),
    resultat_net: num(r.resultat_net),
    resultat_net_part_groupe: num(r.resultat_net_part_groupe),
    capitaux_propres: num(r.capitaux_propres),
    capitaux_propres_part_groupe: num(r.capitaux_propres_part_groupe),
    total_actif: num(r.total_actif),
    dette_financiere: num(r.dette_financiere),
    source_url, source_titre: texte(r.source_titre), verifie_le,
    comparaison_sika: normaliserComparaison(r.comparaison_sika),
  };
}

export interface ComptesSyscohada {
  resultatNet: number | null;
  chiffreAffaires: number | null;
  capitauxPropres: number | null;
  detteFinanciere: number | null;
}

export interface LigneComparatif { libelle: string; syscohada: string; ifrs: string }

export interface ComparatifIfrs {
  exercice: number;
  ifrs: RatiosBilan;
  syscohada: RatiosBilan;
  /** BPA et ROE IFRS calculés sur la part du groupe (publiée). */
  surPartDuGroupe: boolean;
  lignes: LigneComparatif[];
  source: { url: string; titre: string | null; verifieLe: string };
  sika: string | null;
}

const montant = (n: number | null): string => (n == null ? 'non disponible' : `${fmtFcfa(n)} FCFA`);
const bpa = (a: Affichable): string => (a.valeur == null ? a.motif ?? 'non disponible' : `${formatRatio(a.valeur)} FCFA`);
const pct = (f: number | null): string => formatPct(f == null ? null : f * 100);

/**
 * Comparatif SYSCOHADA | IFRS pour l'exercice retenu. null sans ligne IFRS, ou
 * quand la ligne IFRS porte un autre exercice (deux exercices ne se comparent pas).
 */
export function comptesIfrs(p: {
  ligne: LigneComptesIfrs | null;
  exercice: number | null;
  syscohada: ComptesSyscohada;
  cours: number | null;
  titres: number | null;
  capitalisation: number | null;
}): ComparatifIfrs | null {
  const l = p.ligne;
  if (!l || p.exercice == null || l.exercice !== p.exercice) return null;

  const surPartDuGroupe = l.resultat_net_part_groupe != null && l.capitaux_propres_part_groupe != null;
  const rnIfrs = surPartDuGroupe ? l.resultat_net_part_groupe : l.resultat_net;
  const cpIfrs = surPartDuGroupe ? l.capitaux_propres_part_groupe : l.capitaux_propres;

  const ifrs = ratiosBilan({
    cours: p.cours, titres: p.titres, capitalisation: p.capitalisation,
    resultatNet: rnIfrs, chiffreAffaires: l.chiffre_affaires,
    capitauxPropres: cpIfrs, detteFinanciere: l.dette_financiere,
  });
  const syscohada = ratiosBilan({
    cours: p.cours, titres: p.titres, capitalisation: p.capitalisation,
    resultatNet: p.syscohada.resultatNet, chiffreAffaires: p.syscohada.chiffreAffaires,
    capitauxPropres: p.syscohada.capitauxPropres, detteFinanciere: p.syscohada.detteFinanciere,
  });

  const lignes: LigneComparatif[] = [
    { libelle: 'Résultat net', syscohada: montant(p.syscohada.resultatNet), ifrs: montant(rnIfrs) },
    { libelle: 'Capitaux propres', syscohada: montant(p.syscohada.capitauxPropres), ifrs: montant(cpIfrs) },
    { libelle: 'BPA', syscohada: bpa(syscohada.bpa), ifrs: bpa(ifrs.bpa) },
    { libelle: 'P / valeur comptable', syscohada: formatRatio(syscohada.pb), ifrs: formatRatio(ifrs.pb) },
    { libelle: 'ROE', syscohada: pct(syscohada.roe), ifrs: pct(ifrs.roe) },
    { libelle: 'Dette / fonds propres', syscohada: formatRatio(syscohada.gearing), ifrs: formatRatio(ifrs.gearing) },
  ];

  return {
    exercice: l.exercice, ifrs, syscohada, surPartDuGroupe, lignes,
    source: { url: l.source_url, titre: l.source_titre, verifieLe: l.verifie_le },
    sika: ligneSika(l.comparaison_sika),
  };
}

const LIBELLE_POSTE: Record<string, string> = {
  chiffre_affaires: "chiffre d'affaires",
  resultat_net: 'résultat net',
  capitaux_propres: 'capitaux propres',
};

/** Sika publie en millions : un écart inférieur au demi-million est un arrondi. */
const ARRONDI_SIKA = 500_000;

/** Phrase de comparaison avec Sika Finance, dérivée des seuls postes stockés. */
export function ligneSika(c: ComparaisonSika | null): string | null {
  if (!c || c.postes.length === 0) return null;
  const ref = c.referentiel_sika ?? 'non précisé';
  const parties = c.postes.map((q) => {
    const nom = LIBELLE_POSTE[q.poste] ?? q.poste;
    const base = `${nom} ${fmtFcfa(q.sika)} FCFA`;
    if (!q.comparable) return `${base}, non comparable (référentiel ${ref})`;
    if (Math.abs(q.ecart) <= ARRONDI_SIKA) return `${base}, concordant à l'arrondi près`;
    return `${base}, écart de ${fmtFcfa(q.ecart)} FCFA avec l'IFRS`;
  });
  const quand = c.consulte_le ? `, consulté le ${fmtDateCourte(c.consulte_le)}` : '';
  return `Sika Finance (référentiel ${ref}${quand}) : ${parties.join(' ; ')}.`;
}
