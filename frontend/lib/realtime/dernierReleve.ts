/**
 * Ce qui a bougé entre les DEUX DERNIERS relevés de la séance — PUR, testé.
 *
 * Pourquoi (2026-11-23, verdict Fable) : un éclair de 650 ms tous les quarts
 * d'heure ne se voit pas. Ce qu'a apporté le dernier relevé doit RESTER à
 * l'écran jusqu'au suivant, calculé depuis les relevés en base
 * (brvm_intraday_snapshots) et jamais depuis ce que l'onglet a vu : un onglet
 * ouvert à 12:20 n'a pas de « avant » en mémoire.
 *
 * Contrairement au rejeu (`construireRejeu`), les relevés identiques ne sont
 * PAS fusionnés : un relevé sans mouvement se dit « aucun cours n'a bougé ».
 * `titres` : titres échangés entre les deux relevés (écart des volumes
 * cumulés), null si l'écart n'est pas lisible.
 */
import type { Releve } from './rejeu';

export interface MouvementReleve {
  code: string;
  avant: number;
  apres: number;
  variationPct: number;
  titres: number | null;
}

export interface ComparaisonReleves {
  /** Instant du dernier relevé (ISO). */
  instant: string;
  /** Instant du relevé précédent (ISO). */
  instantPrecedent: string;
  /** Cours qui ont changé, du plus fort mouvement au plus faible. */
  mouvements: MouvementReleve[];
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function comparerDerniersReleves(releves: readonly Releve[]): ComparaisonReleves | null {
  const parInstant = new Map<string, Map<string, Releve>>();
  for (const r of releves) {
    let lot = parInstant.get(r.captured_at);
    if (!lot) parInstant.set(r.captured_at, (lot = new Map()));
    lot.set(r.code, r);
  }
  const instants = [...parInstant.keys()].sort((a, b) => Date.parse(b) - Date.parse(a));
  if (instants.length < 2) return null;
  const [instant, instantPrecedent] = instants as [string, string];
  const dernier = parInstant.get(instant)!;
  const precedent = parInstant.get(instantPrecedent)!;

  const mouvements: MouvementReleve[] = [];
  for (const [code, r] of dernier) {
    const p = precedent.get(code);
    const apres = nombre(r.close);
    const avant = p ? nombre(p.close) : null;
    if (apres == null || avant == null || apres <= 0 || avant <= 0 || apres === avant) continue;
    const vA = nombre(r.volume);
    const vP = p ? nombre(p.volume) : null;
    const titres = vA != null && vP != null && vA - vP > 0 ? vA - vP : null;
    mouvements.push({ code, avant, apres, variationPct: ((apres - avant) / avant) * 100, titres });
  }
  mouvements.sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct) || a.code.localeCompare(b.code));
  return { instant, instantPrecedent, mouvements };
}
