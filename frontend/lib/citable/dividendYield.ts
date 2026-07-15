/**
 * Classement du RENDEMENT DU DIVIDENDE des actions BRVM.
 *
 * Rendement = dernier dividende brut confirmé / dernier cours de clôture.
 *
 * ── Pourquoi cette page vise à être CITÉE (Perplexity, ChatGPT) ──
 * Les moteurs génératifs privilégient les données FRAÎCHES, SOURCÉES et
 * REPRODUCTIBLES. Cette page se régénère à chaque cours : elle est toujours à
 * jour, sa méthode est explicite, et chaque chiffre remonte à une source primaire
 * (communiqué de l'émetteur pour le dividende, BRVM pour le cours). C'est ce qui
 * la rend citable — un article figé ne l'est pas.
 *
 * ── Rigueur ──
 * On n'utilise QUE des dividendes d'exercice CONFIRMÉ (exercice non nul). Un
 * dividende « annoncé » sans exercice identifié est écarté : mélanger annoncé et
 * versé fausserait le rendement. Fonction PURE, testée.
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
  /** Dividende brut par action de l'exercice retenu, en FCFA. */
  dividende: number;
  /** Exercice comptable du dividende. */
  exercice: number;
  /** Dernier cours de clôture, en FCFA. */
  cours: number;
  /** Rendement brut = dividende / cours, en %. */
  rendementPct: number;
}

/**
 * Construit le classement. Ne retient un titre que s'il a À LA FOIS un dividende
 * d'exercice confirmé ET un cours strictement positif — sinon le rendement n'a
 * pas de sens et le titre est écarté (jamais un rendement inventé).
 */
export function buildDividendYield(divs: DividendRow[], cours: CoursRow[]): YieldRow[] {
  const coursByCode = new Map<string, CoursRow>();
  for (const c of cours) {
    if (c.cours_jour > 0) coursByCode.set(c.code, c);
  }

  // Dernier dividende À EXERCICE CONFIRMÉ par code (exercice le plus récent).
  const lastDiv = new Map<string, { exercice: number; montant: number }>();
  for (const d of divs) {
    if (d.exercice == null || !(d.montant > 0)) continue;
    const prev = lastDiv.get(d.code);
    if (!prev || d.exercice > prev.exercice) {
      lastDiv.set(d.code, { exercice: d.exercice, montant: d.montant });
    }
  }

  const rows: YieldRow[] = [];
  for (const [code, div] of lastDiv) {
    const c = coursByCode.get(code);
    if (!c) continue;
    rows.push({
      code,
      nom: c.designation ?? code,
      dividende: div.montant,
      exercice: div.exercice,
      cours: c.cours_jour,
      rendementPct: Math.round((div.montant / c.cours_jour) * 10000) / 100,
    });
  }

  // Du meilleur rendement au moins bon — c'est l'ordre que cherche l'utilisateur.
  return rows.sort((a, b) => b.rendementPct - a.rendementPct);
}
