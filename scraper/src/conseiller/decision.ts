import type { LiquidityClass } from '../liquidity/compute.js';
import { FAMILLES_FACTEURS, type Action, type Decision, type FamilleFacteur } from './types.js';

/** Règle FIGÉE (spec §5). */
export const REGLE = { K: 3, seuilConcorde: 1 / 3, seuilOppose: 2 / 3, minFamilles: 2 } as const;

export function decider(
  scores: Record<FamilleFacteur, number | null>,
  classe: LiquidityClass | null,
): Pick<Decision, 'action' | 'concordantes' | 'disponibles' | 'raison'> {
  const vals = FAMILLES_FACTEURS.map((f) => scores[f]).filter((v): v is number => v != null);
  const disponibles = vals.length;
  if (classe == null || classe === 'C' || classe === 'D') return { action: 'conserver', concordantes: 0, disponibles, raison: 'liquidite' };
  if (disponibles < REGLE.minFamilles) return { action: 'conserver', concordantes: 0, disponibles, raison: 'abstention' };
  const pour = vals.filter((v) => v >= REGLE.seuilConcorde).length;
  const contre = vals.filter((v) => v <= -REGLE.seuilConcorde).length;
  const opposeAchat = vals.some((v) => v <= -REGLE.seuilOppose);
  const opposeVente = vals.some((v) => v >= REGLE.seuilOppose);
  let action: Action = 'conserver';
  if (pour >= REGLE.K && !opposeAchat) action = 'acheter';
  else if (contre >= REGLE.K && !opposeVente) action = 'vendre';
  return {
    action,
    concordantes: action === 'acheter' ? pour : action === 'vendre' ? contre : 0,
    disponibles,
    raison: action === 'conserver' ? 'pas_de_concordance' : 'concordance',
  };
}
