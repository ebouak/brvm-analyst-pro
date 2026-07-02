import type { RealtimeActionRow } from './mergeActions';
import type { TickItem } from '@/components/landing/taste/types';

/**
 * Dérive un TickItem d'affichage depuis une ligne de cours brute. PUR : utilisé
 * côté serveur (rendu initial) ET côté client (mise à jour temps réel), pour
 * que l'affichage reste cohérent entre le SSR et les patchs Realtime.
 */
const nf = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function toTick(row: RealtimeActionRow): TickItem {
  const pct = row.variation_pct ?? 0;
  return {
    sym: row.code,
    val: row.cours_jour != null ? nf(row.cours_jour) : '—',
    dir: pct >= 0 ? 'up' : 'down',
    pct: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
  };
}
