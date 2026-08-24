/**
 * Variation sectorielle du jour, pondérée par la capitalisation.
 *
 * Pourquoi ce module existe : `brvm_instruments.secteur` est vide en base
 * (330 lignes nulles sur 331 actives). La classification fiable vit dans
 * `lib/brvmSectors.json` (GICS par ticker), déjà utilisée par la cartographie.
 * On agrège donc ce fichier avec les variations réelles de la dernière séance.
 *
 * Fonction pure : aucune I/O, aucune valeur de repli inventée. Un secteur sans
 * aucune valeur exploitable est absent du résultat plutôt que rendu à 0 %.
 */

export interface SectorInput {
  code: string;
  variation_pct: number | null;
  cours_jour: number | null;
  /** Nombre de titres (brvm_instruments.shares) — sert de pondération. */
  shares: number | null;
}

export interface SectorVariation {
  secteur: string;
  /** Variation pondérée par la capitalisation, en %. */
  variation_pct: number;
  /** Nombre de valeurs réellement prises en compte. */
  nb: number;
}

/**
 * @param rows        lignes de séance (déjà chargées pour les movers — aucune requête en plus)
 * @param sectorByCode classification ticker -> secteur (brvmSectors.json)
 */
export function computeSectorVariations(
  rows: SectorInput[],
  sectorByCode: Record<string, string>,
): SectorVariation[] {
  const acc = new Map<string, { poids: number; somme: number; nb: number }>();

  for (const r of rows) {
    const secteur = sectorByCode[r.code];
    if (!secteur || r.variation_pct == null || !Number.isFinite(r.variation_pct)) continue;

    // Capitalisation comme poids. Si elle manque, la valeur compte pour 1 :
    // mieux vaut une pondération dégradée qu'exclure un titre de son secteur.
    const cap =
      r.cours_jour != null && r.shares != null && r.cours_jour > 0 && r.shares > 0
        ? r.cours_jour * r.shares
        : 1;

    const cur = acc.get(secteur) ?? { poids: 0, somme: 0, nb: 0 };
    cur.poids += cap;
    cur.somme += r.variation_pct * cap;
    cur.nb += 1;
    acc.set(secteur, cur);
  }

  return [...acc.entries()]
    .map(([secteur, v]) => ({ secteur, variation_pct: v.somme / v.poids, nb: v.nb }))
    .sort((a, b) => b.variation_pct - a.variation_pct);
}
