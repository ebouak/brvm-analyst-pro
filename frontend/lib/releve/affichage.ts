/**
 * Relevé mensuel — lecture du document figé et mise en forme. PUR, testé.
 *
 * Aucun chiffre n'est produit ici : tout vient de `report_json`, calculé à la
 * génération. Ce module décide seulement quoi dire d'une valeur absente et
 * comment répartir les lignes sur des feuilles A4 de hauteur fixe.
 */
import type { ReleveJson } from './types';

/** Lignes par feuille. Les feuilles ont une hauteur fixe (A4) : l'excédent est reporté, jamais rogné. */
export const LIGNES_PAR_FEUILLE = { positions: 13, dividendes: 12, publications: 9, rendezVous: 13 } as const;

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-10 » → « octobre 2026 ». */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split('-');
  const nom = MOIS[Number(m) - 1];
  return nom ? `${nom} ${a}` : mois;
}

/**
 * Document v2 reconnu, ou null. Tout autre contenu (ancien format sans
 * `version`, JSON tronqué, version future) n'est pas rendu : la page dit
 * « format non reconnu » plutôt que d'afficher des champs manquants.
 */
export function lireReleve(json: unknown): ReleveJson | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Partial<ReleveJson>;
  if (j.version !== 2) return null;
  if (j.type !== 'reel' && j.type !== 'simule') return null;
  if (typeof j.mois !== 'string' || !/^\d{4}-\d{2}$/.test(j.mois)) return null;
  if (!Array.isArray(j.lignes) || !Array.isArray(j.exclues) || !Array.isArray(j.rendez_vous)) return null;
  if (!j.resume || typeof j.resume !== 'object') return null;
  if (!j.publications || !Array.isArray(j.publications.liste)) return null;
  if (!j.concentration || typeof j.concentration !== 'object') return null;
  return j as ReleveJson;
}

/** Découpe en tranches de `taille` ; renvoie toujours au moins UNE tranche (vide) pour garder la feuille et son message d'état vide. */
export function decouper<T>(liste: T[], taille: number): T[][] {
  if (taille < 1) throw new Error('taille de tranche invalide');
  if (liste.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille));
  return out;
}

/** Nombre total de feuilles du document, pour le pied « n / total » et le contrôle du worker. */
export function nombreDeFeuilles(r: ReleveJson): number {
  const l = LIGNES_PAR_FEUILLE;
  const lignesDividendes = r.dividendes ? r.dividendes.detaches.length + r.dividendes.encaisses.length : 0;
  return (
    1 + // synthèse
    // Les lignes exclues des totaux figurent dans le même tableau, après les lignes valorisées.
    decouper(new Array(r.lignes.length + r.exclues.length), l.positions).length +
    (r.dividendes ? decouper(new Array(lignesDividendes), l.dividendes).length : 0) +
    decouper(r.publications.liste, l.publications).length +
    decouper(r.rendez_vous, l.rendezVous).length
  );
}

/** Entier groupé à la française : « 1 234 567 ». */
export function fcfa(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v).toLocaleString('fr-FR').replace(/ /g, ' ');
}

/** Pourcentage signé : « +4,12 % », « −0,50 % », « 0,00 % ». */
export function pourcentSigne(v: number | null | undefined, decimales = 2): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const arrondi = Math.round(Math.abs(v) * 10 ** decimales) / 10 ** decimales;
  const signe = arrondi === 0 ? '' : v > 0 ? '+' : '−';
  return `${signe}${arrondi.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
}

/** Pourcentage sans signe : « 62,40 % ». */
export function pourcent(v: number | null | undefined, decimales = 1): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
}

/** Nombre signé (points de contribution) : « +1,2 pt ». */
export function pointsSignes(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const arrondi = Math.round(Math.abs(v) * 100) / 100;
  const signe = arrondi === 0 ? '' : v > 0 ? '+' : '−';
  return `${signe}${arrondi.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;
}

export const LIBELLE_BASE: Record<'net' | 'brut' | 'inconnu', string> = {
  net: 'net',
  brut: 'brut',
  inconnu: 'base non précisée',
};

/** Ton d'une variation pour la coloration, jamais un verdict. */
export function tonVariation(v: number | null | undefined): 'hausse' | 'baisse' | null {
  if (v == null || !Number.isFinite(v) || Math.round(Math.abs(v) * 100) === 0) return null;
  return v > 0 ? 'hausse' : 'baisse';
}
