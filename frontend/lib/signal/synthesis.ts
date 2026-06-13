/**
 * Synthèse : réconcilie lecture technique, contexte de position et timing
 * dividende en un verdict **nuancé** (jamais un BUY/SELL sec) + raisons +
 * mises en garde.
 *
 * Fonction pure et testable.
 */

import type { SignalLabel, TechnicalReading } from './technical';
import type { PositionContext } from './position';
import type { DividendTiming } from './dividendTiming';

export interface SynthesisInput {
  signal: SignalLabel;
  confiance: number | null;
  incomplet: boolean;
  technical: TechnicalReading;
  position: PositionContext;
  dividend: DividendTiming;
}

export interface Synthesis {
  verdict: string;
  rationale: string[];
  cautions: string[];
}

const LABEL: Record<SignalLabel, string> = {
  BUY: 'plutôt acheteur',
  SELL: 'plutôt vendeur',
  HOLD: 'neutre',
};

export function synthesize(s: SynthesisInput): Synthesis {
  if (s.incomplet) {
    return {
      verdict: 'Pas de signal fiable : historique ou données insuffisants. Observer avant d’agir.',
      rationale: ['Le calcul a été neutralisé (HOLD) faute de données suffisantes.'],
      cautions: [],
    };
  }

  const rationale: string[] = [];
  const cautions: string[] = [];

  // 1) Lecture technique en tête.
  rationale.push(`${s.technical.headline} — ${LABEL[s.signal]}.`);
  for (const p of s.technical.points) rationale.push(p);

  // 2) Contexte position.
  rationale.push(s.position.reading);

  // 3) Dividende en parallèle.
  if (s.dividend.status !== 'none') rationale.push(s.dividend.verdict);

  // Mises en garde.
  if (s.technical.tension) cautions.push(s.technical.tension);
  if (s.dividend.status === 'recent') {
    cautions.push('La baisse récente est en partie un détachement de dividende (mécanique), à ne pas confondre avec un signal vendeur.');
  }
  if (s.confiance != null && s.confiance < 0.4) {
    cautions.push('Confiance faible : signal à confirmer par d’autres éléments.');
  }

  // Verdict : priorité au contexte position quand l'utilisateur détient.
  let verdict: string;
  if (s.position.held) {
    verdict = s.position.reading;
  } else if (s.dividend.status === 'upcoming') {
    verdict =
      s.signal === 'SELL'
        ? `Signal ${LABEL[s.signal]}, mais un détachement de dividende approche : peser le coupon contre la baisse mécanique attendue.`
        : `${s.technical.headline} et un détachement de dividende approche : un achat avant capte le coupon.`;
  } else if (s.technical.tension) {
    verdict = `${s.technical.headline} : ${s.technical.tension}`;
  } else {
    verdict =
      s.signal === 'BUY'
        ? `${s.technical.headline} — point d’entrée potentiel pour qui ne détient pas la valeur.`
        : s.signal === 'SELL'
          ? `${s.technical.headline} — prudence ; à l’écart tant que la pression vendeuse domine.`
          : `${s.technical.headline} — pas d’action évidente, surveiller.`;
  }

  return { verdict, rationale, cautions };
}
