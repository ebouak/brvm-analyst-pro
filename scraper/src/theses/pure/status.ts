// Copie de frontend/lib/theses/status.ts — toute correction doit être
// reportée des deux côtés (pas de module partagé entre les deux paquets TS,
// même contrainte déjà rencontrée pour scraper/src/hebdo/pure/).
//
// Évalue si une thèse d'investissement tient toujours, en confrontant la
// conviction de l'utilisateur aux données réelles actuelles (cours + signal
// quantitatif). Fonction pure, testable. N'invente rien : compare seulement.

export type Stance = 'achat' | 'conserver' | 'vente';
export type ThesisStatus = 'intacte' | 'a-revoir' | 'objectif-atteint';

export interface ThesisCheckInput {
  stance: Stance;
  coursReference: number | null;
  objectif: number | null;
  coursActuel: number | null;
  signalActuel: 'BUY' | 'SELL' | 'HOLD' | null;
}

export interface ThesisCheckResult {
  status: ThesisStatus;
  perfPct: number | null; // évolution du cours depuis la rédaction
  raisons: string[];
}

const SIGNAL_STANCE: Record<string, Stance> = { BUY: 'achat', SELL: 'vente', HOLD: 'conserver' };

export function checkThesis(i: ThesisCheckInput): ThesisCheckResult {
  const raisons: string[] = [];
  const perfPct = i.coursReference && i.coursActuel ? (i.coursActuel / i.coursReference - 1) * 100 : null;

  // Objectif atteint (pour une thèse d'achat : cours ≥ objectif).
  if (i.objectif != null && i.coursActuel != null) {
    if (i.stance === 'achat' && i.coursActuel >= i.objectif) {
      raisons.push(`Objectif de ${i.objectif.toLocaleString('fr-FR')} FCFA atteint ou dépassé.`);
      return { status: 'objectif-atteint', perfPct, raisons };
    }
    if (i.stance === 'vente' && i.coursActuel <= i.objectif) {
      raisons.push(`Objectif de baisse (${i.objectif.toLocaleString('fr-FR')} FCFA) atteint.`);
      return { status: 'objectif-atteint', perfPct, raisons };
    }
  }

  // Le signal quantitatif contredit-il la conviction ?
  if (i.signalActuel) {
    const sigStance = SIGNAL_STANCE[i.signalActuel];
    const contradiction =
      (i.stance === 'achat' && i.signalActuel === 'SELL') ||
      (i.stance === 'vente' && i.signalActuel === 'BUY');
    if (contradiction) {
      raisons.push(`Le signal quantitatif (${sigStance}) contredit votre thèse (${i.stance}).`);
    }
  }

  // Décrochage marqué contre une thèse d'achat (ou rebond contre une thèse de vente).
  if (perfPct != null) {
    if (i.stance === 'achat' && perfPct <= -20) raisons.push(`Le cours a reculé de ${perfPct.toFixed(0)}% depuis votre thèse.`);
    if (i.stance === 'vente' && perfPct >= 20) raisons.push(`Le cours a progressé de +${perfPct.toFixed(0)}% malgré votre thèse de vente.`);
  }

  return { status: raisons.length > 0 ? 'a-revoir' : 'intacte', perfPct, raisons };
}
