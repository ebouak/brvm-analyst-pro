/**
 * Séries de clôtures par période pour le graphique de la vue d'ensemble — pur.
 * Source : `brvm_actions_daily` (clôtures), jamais d'estimation. La vue 1J est
 * celle des instantanés de séance (`SeanceIntraday`), hors de ce module.
 */
export type Periode = '5J' | '1M' | 'YTD' | '3M' | '6M' | '1A' | '5A' | 'Max';
export const PERIODES: Periode[] = ['5J', '1M', 'YTD', '3M', '6M', '1A', '5A', 'Max'];

export interface Point { d: string; c: number }
export interface SeriePeriode { periode: Periode; points: Point[]; variationPct: number; debut: string; fin: string }

const MOIS: Partial<Record<Periode, number>> = { '1M': 1, '3M': 3, '6M': 6, '1A': 12, '5A': 60 };

/** Borne de début (incluse) d'une période calendaire ; null pour 5J (en séances) et Max. */
export function debutPeriode(p: Periode, fin: string): string | null {
  if (p === 'YTD') return `${fin.slice(0, 4)}-01-01`;
  const m = MOIS[p];
  if (m == null) return null;
  const d = new Date(fin + 'T00:00:00Z');
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - m);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d.toISOString().slice(0, 10);
}

/**
 * Réduit à `max` points au plus : premier et dernier conservés, et dans chaque
 * paquet le plus bas et le plus haut, pour qu'un pic ne disparaisse pas.
 */
export function sousEchantillonner(pts: Point[], max: number): Point[] {
  if (pts.length <= max || max < 4) return pts;
  const premier = pts[0]!, dernier = pts[pts.length - 1]!;
  const milieu = pts.slice(1, -1);
  const paquets = Math.floor((max - 2) / 2);
  const taille = milieu.length / paquets;
  const out: Point[] = [premier];
  for (let k = 0; k < paquets; k++) {
    const tranche = milieu.slice(Math.floor(k * taille), Math.floor((k + 1) * taille));
    if (tranche.length === 0) continue;
    let bas = tranche[0]!, haut = tranche[0]!;
    for (const p of tranche) { if (p.c < bas.c) bas = p; if (p.c > haut.c) haut = p; }
    if (bas === haut) out.push(bas);
    else out.push(...(bas.d < haut.d ? [bas, haut] : [haut, bas]));
  }
  out.push(dernier);
  return out;
}

export function seriesParPeriode(rows: { date_marche: string; cours_jour: number | null }[], max = 260): SeriePeriode[] {
  const pts: Point[] = rows
    .filter((r) => r.cours_jour != null && r.cours_jour > 0)
    .map((r) => ({ d: r.date_marche, c: Number(r.cours_jour) }))
    .sort((a, b) => a.d.localeCompare(b.d));
  if (pts.length < 2) return [];
  const fin = pts[pts.length - 1]!.d;

  const out: SeriePeriode[] = [];
  for (const periode of PERIODES) {
    let fenetre: Point[];
    if (periode === '5J') fenetre = pts.slice(-6);
    else if (periode === 'Max') fenetre = pts;
    else {
      const borne = debutPeriode(periode, fin)!;
      const i = pts.findIndex((p) => p.d >= borne);
      if (i < 0) continue;
      // La dernière clôture AVANT la borne sert de base : la variation de la période part d'elle.
      fenetre = pts.slice(Math.max(0, i - 1));
    }
    if (fenetre.length < 2) continue;
    const a = fenetre[0]!, b = fenetre[fenetre.length - 1]!;
    out.push({ periode, points: sousEchantillonner(fenetre, max), variationPct: ((b.c - a.c) / a.c) * 100, debut: a.d, fin: b.d });
  }
  return out;
}
