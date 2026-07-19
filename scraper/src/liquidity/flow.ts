/**
 * Flux acheteur/vendeur d'une séance — tick rule sur les snapshots intraday
 * (cours + volume CUMULÉ toutes les ~15 min). PURE, testée.
 * Volume passé pendant une hausse de cours = pression acheteuse ; pendant une
 * baisse = vendeuse ; cours inchangé = neutre. Indicateur DIRECTIONNEL, jamais
 * intégré au score de liquidité (spec §3).
 */

export interface FlowSnapshot {
  captured_at: string;
  close: number | null;
  volume: number | null; // cumul de séance au moment de la capture
}

export interface SessionFlow {
  volume_achat: number;
  volume_vente: number;
  volume_neutre: number;
  /** (achat − vente) / (achat + vente) × 100 ; null si aucun volume classé directionnel. */
  flux_net_pct: number | null;
}

export function computeSessionFlow(snapshots: FlowSnapshot[]): SessionFlow | null {
  const pts = snapshots
    .filter((s) => s.close != null && s.volume != null)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  if (pts.length < 2) return null;

  let achat = 0;
  let vente = 0;
  let neutre = 0;
  let lastClose = pts[0]!.close!;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i]!;
    // Cumul de séance : un recul (correction source) donne un delta négatif → 0.
    const delta = Math.max(0, cur.volume! - pts[i - 1]!.volume!);
    if (delta > 0) {
      if (cur.close! > lastClose) achat += delta;
      else if (cur.close! < lastClose) vente += delta;
      else neutre += delta;
    }
    lastClose = cur.close!;
  }

  const directionnel = achat + vente;
  return {
    volume_achat: achat,
    volume_vente: vente,
    volume_neutre: neutre,
    flux_net_pct: directionnel > 0 ? Math.round(((achat - vente) / directionnel) * 10_000) / 100 : null,
  };
}
