/**
 * Classement du RENDEMENT DU DIVIDENDE des actions BRVM.
 *
 * Rendement = dividende NET de l'exercice de référence / dernier cours de clôture.
 *
 * ── Pourquoi cette page vise à être CITÉE (Perplexity, ChatGPT) ──
 * Les moteurs génératifs privilégient les données FRAÎCHES, SOURCÉES et
 * REPRODUCTIBLES. Cette page se régénère à chaque cours ; sa méthode est explicite.
 *
 * ── Deux corrections de rigueur (critique du 2026-07-16) ──
 *
 * 1. UN SEUL EXERCICE DE RÉFÉRENCE. On ne prend PAS « le dernier dividende non nul »
 *    de chaque titre : cela mélangeait des exercices hétérogènes (FILTISAC affichait
 *    87 % avec un dividende 2024 alors qu'elle n'a RIEN distribué en 2025). Le
 *    classement principal ne retient QUE l'exercice de référence — le plus récent
 *    exercice réellement distribué sur le marché (auto-détecté). Un titre qui n'a
 *    pas distribué cet exercice-là (montant 0 ou absent) est EXCLU : son rendement
 *    courant est nul, pas « celui d'il y a deux ans ».
 *
 * 2. MONTANTS NETS. Les dividendes publiés par les émetteurs BRVM (relevés sur les
 *    fiches sociétés) sont NETS de retenue à la source (IRVM). SONATEL 2025 : brut
 *    1 933, net 1 740 (= 1 933 × 0,9). On ne prétend donc PAS « rendement brut » :
 *    c'est un rendement NET, tel que publié. Reconstituer le brut exigerait le taux
 *    IRVM émetteur par émetteur — on ne l'invente pas.
 *
 * Fonction PURE, testée.
 */

export interface DividendRow {
  code: string;
  exercice: number | null;
  montant: number;
}

export interface CoursRow {
  code: string;
  cours_jour: number;
  designation: string | null;
}

export interface YieldRow {
  code: string;
  nom: string;
  /** Dividende NET par action de l'exercice de référence, en FCFA (tel que publié). */
  dividende: number;
  /** Exercice comptable du dividende — le même pour toutes les lignes. */
  exercice: number;
  /** Dernier cours de clôture, en FCFA. */
  cours: number;
  /** Rendement NET = dividende net / cours, en %. */
  rendementPct: number;
}

export interface YieldResult {
  /** Exercice de référence commun à tout le classement (le plus récent distribué). */
  exerciceRef: number;
  rows: YieldRow[];
}

/**
 * Exercice de RÉFÉRENCE = le plus récent exercice pour lequel AU MOINS UN émetteur
 * a réellement distribué (montant > 0). Auto-détecté : le classement suit
 * automatiquement le cycle courant quand les dividendes 2026 arriveront.
 */
function detecterExerciceRef(divs: DividendRow[]): number | null {
  let ref: number | null = null;
  for (const d of divs) {
    if (d.exercice != null && d.montant > 0 && (ref == null || d.exercice > ref)) {
      ref = d.exercice;
    }
  }
  return ref;
}

/**
 * Construit le classement du rendement NET pour l'exercice de référence.
 *
 * Un titre n'est retenu que s'il a, POUR CET EXERCICE, un dividende net > 0 ET un
 * cours > 0. Un titre qui n'a pas distribué l'exercice de référence (montant 0 ou
 * absent) est ÉCARTÉ — on ne remonte jamais à un exercice antérieur pour lui
 * fabriquer un rendement « courant » (le bug FILTISAC à 87 %).
 */
export function buildDividendYield(divs: DividendRow[], cours: CoursRow[]): YieldResult {
  const exerciceRef = detecterExerciceRef(divs);
  if (exerciceRef == null) return { exerciceRef: 0, rows: [] };

  const coursByCode = new Map<string, CoursRow>();
  for (const c of cours) {
    if (c.cours_jour > 0) coursByCode.set(c.code, c);
  }

  // Dividende de l'EXERCICE DE RÉFÉRENCE uniquement, par code.
  const divRef = new Map<string, number>();
  for (const d of divs) {
    if (d.exercice === exerciceRef && d.montant > 0) divRef.set(d.code, d.montant);
  }

  const rows: YieldRow[] = [];
  for (const [code, montant] of divRef) {
    const c = coursByCode.get(code);
    if (!c) continue;
    rows.push({
      code,
      nom: c.designation ?? code,
      dividende: montant,
      exercice: exerciceRef,
      cours: c.cours_jour,
      rendementPct: Math.round((montant / c.cours_jour) * 10000) / 100,
    });
  }

  rows.sort((a, b) => b.rendementPct - a.rendementPct);
  return { exerciceRef, rows };
}
