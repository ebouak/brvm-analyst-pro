// Saisonnalité v2, lot 4 — F9, saison de la liquidité. PUR, testé.
// À partir de `saisonnalite_mensuelle` (valeur_echangee, seances_cotees, seances_marche).

export interface FaitLiquidite {
  annee: number;
  mois: number;
  valeurEchangee: number | null;
  seancesCotees: number;
  seancesMarche: number;
  complet: boolean;
}

export interface MoisLiquidite {
  mois: number;
  /**
   * Médiane, sur les années, de la valeur échangée du mois rapportée au mois
   * MÉDIAN de l'année (un mois ordinaire) : la moyenne serait tirée par quelques
   * mois de transactions de bloc.
   */
  ratio: number | null;
  /** Séances avec échange / séances du marché, cumulées sur les années. */
  partSeances: number | null;
  /** Années retenues. */
  annees: number;
}

/** Une année ne sert de référence que si 6 mois complets au moins y sont connus. */
const MOIS_MIN_ANNEE = 6;

function mediane(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function saisonLiquidite(faits: FaitLiquidite[]): MoisLiquidite[] {
  const complets = faits.filter((f) => f.complet);
  const parAnnee = new Map<number, FaitLiquidite[]>();
  for (const f of complets) {
    if (!parAnnee.has(f.annee)) parAnnee.set(f.annee, []);
    parAnnee.get(f.annee)!.push(f);
  }
  const ratios = Array.from({ length: 12 }, () => [] as number[]);
  const cotees = Array(12).fill(0) as number[];
  const marche = Array(12).fill(0) as number[];
  for (const lignes of parAnnee.values()) {
    if (lignes.length < MOIS_MIN_ANNEE) continue;
    const reference = mediane(lignes.map((l) => l.valeurEchangee ?? 0));
    for (const l of lignes) {
      cotees[l.mois - 1] = cotees[l.mois - 1]! + l.seancesCotees;
      marche[l.mois - 1] = marche[l.mois - 1]! + l.seancesMarche;
      if (reference > 0) ratios[l.mois - 1]!.push((l.valeurEchangee ?? 0) / reference);
    }
  }
  return ratios.map((r, i) => ({
    mois: i + 1,
    ratio: r.length ? mediane(r) : null,
    partSeances: marche[i]! > 0 ? cotees[i]! / marche[i]! : null,
    annees: r.length,
  }));
}
