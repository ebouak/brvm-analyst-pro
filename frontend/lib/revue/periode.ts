/**
 * Revue de résultats : choix de la PÉRIODE À PRÉSENTER en premier. PUR, testé.
 *
 * Règle : la Revue s'ouvre sur la DERNIÈRE période publiée (trimestre, semestre
 * ou exercice), comparée à la même période de l'année précédente ; l'exercice
 * annuel vient en second. Un intermédiaire ne compte que s'il est postérieur au
 * dernier exercice annuel (règle de `lib/financials/interim.ts`, réutilisée
 * telle quelle : `lectureIntermediaire`).
 *
 * Si la période précédente comparable manque, on le DIT et aucune évolution
 * n'est calculée. Jamais d'estimation, jamais d'annualisation.
 *
 * Les chiffres intermédiaires sont des CUMULS depuis le début de l'exercice : on
 * ne les compare qu'au même cumul de l'année précédente.
 */
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { libellePeriode, type LectureIntermediaire } from '@/lib/financials/interim';
import { constatCouverture, constatIntermediaire } from '@/lib/document/constats';

export interface ExerciceAnnuel {
  periode: string;
  revenu: number | null;
  resultatNet: number | null;
}

export interface PeriodePrincipale {
  type: 'intermediaire' | 'annuel';
  periode: string;
  /** « 9 premiers mois de 2026 », « exercice 2025 ». */
  libelle: string;
  libellePrecedent: string | null;
  revenu: number | null;
  resultatNet: number | null;
  revenuPrecedent: number | null;
  resultatNetPrecedent: number | null;
  /** Douze mois glissants (intermédiaire seulement), ou null. */
  glissant: LectureIntermediaire['glissant'];
  /** Une période précédente comparable existe en base. */
  comparable: boolean;
  /** Dit pourquoi aucune comparaison n'est faite. */
  motif: string | null;
}

const aucune = (v: number | null) => v == null;

/** Variation en % de `a` sur `b`, seulement si la base est strictement positive. */
export function variationPct(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0)) return null;
  return ((a - b) / b) * 100;
}

/** « le 1er semestre 2025 », « les 9 premiers mois de 2025 », « l'exercice 2024 ». */
export function avecArticle(libelle: string): string {
  if (/^\d+ premiers mois/.test(libelle)) return `les ${libelle}`;
  if (/^exercice/.test(libelle)) return `l’${libelle}`;
  return `le ${libelle}`;
}

/**
 * La période à présenter en premier. `annuels` : exercices annuels, le plus
 * récent d'abord (ordre de `getRevue`). `inter` : lecture intermédiaire déjà
 * filtrée par la règle de remplacement, ou null.
 */
export function periodePrincipale(annuels: ExerciceAnnuel[], inter: LectureIntermediaire | null): PeriodePrincipale | null {
  if (inter) {
    const comparable = inter.revenuPrecedent != null || inter.resultatNetPrecedent != null;
    return {
      type: 'intermediaire',
      periode: inter.periode,
      libelle: inter.libelle,
      libellePrecedent: inter.libellePrecedent,
      revenu: inter.revenu,
      resultatNet: inter.resultatNet,
      revenuPrecedent: inter.revenuPrecedent,
      resultatNetPrecedent: inter.resultatNetPrecedent,
      glissant: inter.glissant,
      comparable,
      motif: comparable
        ? null
        : `Les comptes de la même période de l’année précédente (${inter.libellePrecedent}) ne sont pas disponibles en base : aucune évolution n’est calculée.`,
    };
  }
  const courant = annuels.find((y) => y.revenu != null || y.resultatNet != null);
  if (!courant) return null;
  const precedent = annuels.find((y) => Number(y.periode) === Number(courant.periode) - 1) ?? null;
  const comparable = precedent != null && (precedent.revenu != null || precedent.resultatNet != null);
  return {
    type: 'annuel',
    periode: courant.periode,
    libelle: libellePeriode(courant.periode),
    libellePrecedent: precedent ? libellePeriode(precedent.periode) : null,
    revenu: courant.revenu,
    resultatNet: courant.resultatNet,
    revenuPrecedent: precedent?.revenu ?? null,
    resultatNetPrecedent: precedent?.resultatNet ?? null,
    glissant: null,
    comparable,
    motif: comparable
      ? null
      : `Les comptes de l’exercice ${Number(courant.periode) - 1} ne sont pas disponibles en base : aucune évolution n’est calculée.`,
  };
}

const sansArrondiNul = (n: number) => `${fmtFcfa(n)} FCFA`;

/** Phrase de couverture : l'évolution sur la même période, ou à défaut les montants. */
export function constatPeriode(p: PeriodePrincipale): string | null {
  if (p.type === 'annuel') {
    return constatCouverture({
      exercice: p.periode,
      resultatNet: p.resultatNet,
      resultatNetPrecedent: p.comparable ? p.resultatNetPrecedent : null,
    });
  }
  const phrase = p.comparable
    ? constatIntermediaire({
        libelle: p.libelle,
        periodePrecedente: p.periode.replace(/^\d{4}/, String(Number(p.periode.slice(0, 4)) - 1)),
        revenu: p.revenu,
        revenuPrecedent: p.revenuPrecedent,
        resultatNet: p.resultatNet,
        resultatNetPrecedent: p.resultatNetPrecedent,
      })
    : null;
  if (phrase) return phrase;
  const membres = [
    p.revenu != null ? `chiffre d’affaires de ${sansArrondiNul(p.revenu)}` : null,
    p.resultatNet != null ? (p.resultatNet < 0 ? `perte nette de ${sansArrondiNul(-p.resultatNet)}` : `résultat net de ${sansArrondiNul(p.resultatNet)}`) : null,
  ].filter(Boolean);
  if (membres.length === 0) return null;
  return `Sur ${avecArticle(p.libelle)} : ${membres.join(', ')}.`.replace('Sur le 1er', 'Au 1er');
}

export interface ChiffreGeantPeriode {
  /** Valeur déjà formatée (« +13,8 »), sans l'unité. */
  valeur: string | null;
  unite: string;
  legende: string | null;
  /** Titre-constat du panneau. */
  titre: string;
}

const signe = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

/**
 * Le chiffre géant de la page « dernière période » : l'évolution du résultat net
 * sur la même période ; à défaut celle du chiffre d'affaires ; à défaut le
 * montant du résultat net. Une donnée absente donne `valeur: null`.
 */
export function chiffreGeantPeriode(p: PeriodePrincipale): ChiffreGeantPeriode {
  const comp = p.libellePrecedent ? `par rapport à ${avecArticle(p.libellePrecedent)}` : '';
  const vRn = p.comparable ? variationPct(p.resultatNet, p.resultatNetPrecedent) : null;
  if (vRn != null) {
    return {
      valeur: `${signe(vRn)}${fmtNumber(Math.abs(vRn), 1)}`,
      unite: '%',
      legende: `Évolution du résultat net sur ${avecArticle(p.libelle)}, ${comp}.`,
      titre: `Résultat net ${vRn >= 0 ? 'en hausse' : 'en baisse'} de ${fmtNumber(Math.abs(vRn), 1)} % sur ${avecArticle(p.libelle)}`,
    };
  }
  const vCa = p.comparable ? variationPct(p.revenu, p.revenuPrecedent) : null;
  if (vCa != null) {
    return {
      valeur: `${signe(vCa)}${fmtNumber(Math.abs(vCa), 1)}`,
      unite: '%',
      legende: `Évolution du chiffre d’affaires sur ${avecArticle(p.libelle)}, ${comp}. Le résultat net n’est pas comparable (base nulle, négative ou absente).`,
      titre: `Chiffre d’affaires ${vCa >= 0 ? 'en hausse' : 'en baisse'} de ${fmtNumber(Math.abs(vCa), 1)} % sur ${avecArticle(p.libelle)}`,
    };
  }
  if (p.resultatNet != null) {
    const m = fmtFcfa(p.resultatNet).match(/^(.*?)\s(Md|M)$/);
    return {
      valeur: m ? m[1]! : fmtFcfa(p.resultatNet),
      unite: m ? `${m[2]} FCFA` : 'FCFA',
      legende: p.motif ?? 'Aucune comparaison disponible.',
      titre: p.resultatNet < 0 ? `Perte nette sur ${avecArticle(p.libelle)}` : `Résultat net sur ${avecArticle(p.libelle)}`,
    };
  }
  return { valeur: null, unite: '', legende: p.motif, titre: `Comptes de ${avecArticle(p.libelle)}` };
}

export interface LigneComparaison {
  libelle: string;
  courant: number | null;
  precedent: number | null;
  /** Variation en % ; null quand la base n'est pas strictement positive. */
  evolution: number | null;
}

/** Lignes du tableau « période contre même période de l'année précédente ». Une ligne sans aucune valeur est retirée. */
export function lignesComparaison(p: PeriodePrincipale): LigneComparaison[] {
  const l = (libelle: string, courant: number | null, precedent: number | null): LigneComparaison => ({
    libelle, courant, precedent, evolution: p.comparable ? variationPct(courant, precedent) : null,
  });
  return [
    l('Chiffre d’affaires', p.revenu, p.revenuPrecedent),
    l('Résultat net', p.resultatNet, p.resultatNetPrecedent),
  ].filter((x) => !(aucune(x.courant) && aucune(x.precedent)));
}
