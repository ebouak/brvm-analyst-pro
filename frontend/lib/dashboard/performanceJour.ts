import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';

/**
 * Performance du jour du portefeuille face au BRVM Composite — PUR (spec §4.5).
 *
 * Règle de cohérence temporelle : toutes les positions et l'indice doivent
 * porter sur la MÊME séance. Sinon, pas de comparaison (« non comparable »)
 * plutôt qu'un mélange de deux séances. Variation pondérée par la valeur de
 * la VEILLE (cours / (1 + variation)), comme un indice.
 */
export interface LignePerf {
  code: string;
  quantite: number;
  cours: number | null;
  variationPct: number | null;
  dateMarche: string | null;
}

export interface ResultatPerfJour {
  portefeuillePct: number | null;
  variationFcfa: number | null;
  indicePct: number | null;
  dateMarche: string | null;
  comparable: boolean;
  raison: string | null;
}

interface LigneComplete extends LignePerf {
  cours: number;
  variationPct: number;
  dateMarche: string;
}

// Une ligne est exploitable seulement si cours > 0, variation finie > -100 % (sinon 1 + v/100 <= 0) et séance connue.
function estComplete(l: LignePerf): l is LigneComplete {
  return (
    l.cours != null && Number.isFinite(l.cours) && l.cours > 0 &&
    l.variationPct != null && Number.isFinite(l.variationPct) && l.variationPct > -100 &&
    l.dateMarche != null
  );
}

export function performanceJour(
  lignes: LignePerf[],
  indice: { variationPct: number | null; dateMarche: string | null } | null,
): ResultatPerfJour {
  const vide = (raison: string): ResultatPerfJour => ({
    portefeuillePct: null, variationFcfa: null, indicePct: null, dateMarche: null, comparable: false, raison,
  });

  // A: la ligne de liquidités n'a pas de cours de marché ; B: quantité finie et > 0.
  const actives = lignes.filter(
    (l) => l.code !== LIQUIDITES_CODE && Number.isFinite(l.quantite) && l.quantite > 0,
  );
  if (actives.length === 0) return vide('aucune position');

  // C: une donnée de marché manquante ou inexploitable annule le calcul, on nomme le code.
  const manquante = actives.find((l) => !estComplete(l));
  if (manquante) return vide(`cours du jour absent pour ${manquante.code}`);
  const completes = actives.filter(estComplete);

  const dates = new Set(completes.map((l) => l.dateMarche));
  if (dates.size > 1) return vide('positions cotées à des séances différentes');

  const date = completes[0]!.dateMarche;
  let veille = 0;
  let jour = 0;
  for (const l of completes) {
    veille += l.quantite * (l.cours / (1 + l.variationPct / 100));
    jour += l.quantite * l.cours;
  }
  // D: pas de variation en FCFA sans son pourcentage ; veille nulle ou non finie = non calculable.
  if (!Number.isFinite(veille) || !Number.isFinite(jour) || veille <= 0) {
    return vide('valeur de la veille non calculable');
  }
  const portefeuillePct = (jour / veille - 1) * 100;

  // E: comparable seulement si l'indice a une variation finie ET la même séance.
  if (indice == null || indice.variationPct == null || !Number.isFinite(indice.variationPct) || indice.dateMarche == null) {
    return { portefeuillePct, variationFcfa: jour - veille, indicePct: null, dateMarche: date, comparable: false, raison: 'indice indisponible' };
  }
  const comparable = indice.dateMarche === date;

  return {
    portefeuillePct,
    variationFcfa: jour - veille,
    indicePct: comparable ? indice.variationPct : null,
    dateMarche: date,
    comparable,
    raison: comparable ? null : "l'indice ne porte pas sur la même séance",
  };
}
