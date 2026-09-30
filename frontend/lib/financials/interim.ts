/**
 * Comptes intermédiaires (T1, S1, T3) — lecture. PUR, testé
 * (tests/interim-lecture.test.ts).
 *
 * Écrits par le scraper (scraper/src/interim/) dans income_statements avec
 * `periode` = 'AAAA-T1' | 'AAAA-S1' | 'AAAA-T3' et `type_periode` =
 * 'semestriel' | 'trimestre'. Chiffres en CUMUL DEPUIS LE DÉBUT DE L'EXERCICE.
 *
 * RÈGLE DE REMPLACEMENT (demande du 2026-09-30) : un intermédiaire ne sert que
 * tant que l'exercice annuel de la même année n'est pas publié. Dès que
 * l'annuel N arrive, les intermédiaires de N sortent de l'analyse — ils restent
 * en base comme historique.
 *
 * 12 MOIS GLISSANTS (choix du 2026-09-30) : annuel N−1 − cumul N−1 + cumul N,
 * calculé SEULEMENT si les trois termes existent. Jamais d'annualisation
 * (« semestre × 2 ») : fausse pour toute activité saisonnière.
 *
 * ⚠️ Codes de période dupliqués depuis scraper/src/interim/periode.ts (deux
 * paquets TS distincts). Toute correction se reporte des deux côtés.
 */

export type CodeInterim = 'T1' | 'S1' | 'T3';

export const MOIS: Record<CodeInterim, number> = { T1: 3, S1: 6, T3: 9 };

/** Valeurs de `type_periode` des lignes intermédiaires. */
export const TYPES_INTERIM = ['semestriel', 'trimestre'] as const;

export function lireCodePeriode(periode: string): { annee: number; code: CodeInterim } | null {
  const m = /^(20\d{2})-(T1|S1|T3)$/.exec(periode);
  return m ? { annee: Number(m[1]), code: m[2] as CodeInterim } : null;
}

const LIBELLE: Record<CodeInterim, (a: number) => string> = {
  T1: (a) => `1er trimestre ${a}`,
  S1: (a) => `1er semestre ${a}`,
  T3: (a) => `9 premiers mois de ${a}`,
};
const FIN: Record<CodeInterim, string> = { T1: 'fin mars', S1: 'fin juin', T3: 'fin septembre' };

/** '2026-S1' → '1er semestre 2026' ; un annuel '2025' → 'exercice 2025'. */
export function libellePeriode(periode: string): string {
  const p = lireCodePeriode(periode);
  return p ? LIBELLE[p.code](p.annee) : `exercice ${periode}`;
}

export interface LigneComptes {
  periode: string;
  revenu_total: number | null;
  resultat_net: number | null;
}

export interface LectureIntermediaire {
  periode: string;
  libelle: string;
  mois: number;
  revenu: number | null;
  resultatNet: number | null;
  /** Même période, année précédente (comparatif). */
  periodePrecedente: string;
  libellePrecedent: string;
  revenuPrecedent: number | null;
  resultatNetPrecedent: number | null;
  /** Douze mois glissants à la fin de la période ; null si un terme manque. */
  glissant: { libelle: string; revenu: number | null; resultatNet: number | null } | null;
}

const annuelsDe = (lignes: LigneComptes[]) =>
  lignes.filter((l) => /^20\d{2}$/.test(l.periode) && (l.revenu_total != null || l.resultat_net != null));

/**
 * La période intermédiaire à prendre en compte, ou null.
 * Retenue seulement si son année est POSTÉRIEURE au dernier exercice annuel
 * publié ; la plus avancée de l'année l'emporte (T3 > S1 > T1).
 */
export function lectureIntermediaire(lignes: LigneComptes[]): LectureIntermediaire | null {
  const annuels = annuelsDe(lignes);
  const dernierAnnuel = annuels.reduce((m, l) => Math.max(m, Number(l.periode)), 0);

  const interims = lignes
    .map((l) => ({ l, p: lireCodePeriode(l.periode) }))
    .filter((x): x is { l: LigneComptes; p: { annee: number; code: CodeInterim } } => x.p !== null)
    .filter((x) => x.l.revenu_total != null || x.l.resultat_net != null);

  const retenu = interims
    .filter((x) => x.p.annee > dernierAnnuel)
    .sort((a, b) => b.p.annee - a.p.annee || MOIS[b.p.code] - MOIS[a.p.code])[0];
  if (!retenu) return null;

  const { annee, code } = retenu.p;
  const periodePrecedente = `${annee - 1}-${code}`;
  const prec = interims.find((x) => x.l.periode === periodePrecedente)?.l ?? null;
  const annuelPrec = annuels.find((l) => l.periode === String(annee - 1)) ?? null;

  const glisse = (n: number | null, nm1: number | null | undefined, an: number | null | undefined) =>
    n != null && nm1 != null && an != null ? an - nm1 + n : null;
  const revenuG = glisse(retenu.l.revenu_total, prec?.revenu_total, annuelPrec?.revenu_total);
  const rnG = glisse(retenu.l.resultat_net, prec?.resultat_net, annuelPrec?.resultat_net);

  return {
    periode: retenu.l.periode,
    libelle: LIBELLE[code](annee),
    mois: MOIS[code],
    revenu: retenu.l.revenu_total,
    resultatNet: retenu.l.resultat_net,
    periodePrecedente,
    libellePrecedent: LIBELLE[code](annee - 1),
    revenuPrecedent: prec?.revenu_total ?? null,
    resultatNetPrecedent: prec?.resultat_net ?? null,
    glissant:
      revenuG != null || rnG != null
        ? { libelle: `douze mois glissants à ${FIN[code]} ${annee}`, revenu: revenuG, resultatNet: rnG }
        : null,
  };
}
