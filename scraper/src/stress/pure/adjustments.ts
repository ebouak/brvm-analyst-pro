/**
 * Ajustement rétroactif des cours historiques lors des opérations sur titres
 * (fractionnements / regroupements), SANS modifier les données brutes en base.
 *
 * Règle anti-double-ajustement :
 *   Dans brvm_actions_daily, certains fractionnements anciens (ex: BOABF 2017,
 *   SNTS 2026) sont déjà ajustés dans la série, tandis que d'autres (ex: PALC
 *   2017, ONTBF 2018) ne le sont pas. On vérifie donc empiriquement le saut de
 *   cours autour de `date_effet` avant d'appliquer `1 / ratio` aux séances
 *   antérieures.
 */

export interface CoursBrutAction {
  date_marche: string;
  cours_jour: number | null;
  variation_pct?: number | null;
  volume?: number | null;
  valeur_echangee?: number | null;
}

export interface SplitConnu {
  date_effet: string;
  ratio: number; // ex: 10 pour 10 nouvelles pour 1 ancienne
  source?: string;
}

export interface CoursAjusteAction {
  date_marche: string;
  cours_brut: number;
  cours_ajuste: number;
  variation_pct: number | null;
  volume_brut: number | null;
  volume_ajuste: number | null;
  valeur_echangee: number | null;
}

export interface AjustementApplique {
  date_effet: string;
  ratio: number;
  ratio_observe: number;
  applique: boolean;
  raison: string;
}

/**
 * Extrait le ratio d'un libellé de fractionnement tel que stocké dans
 * `societes_profils.identite.fractionnements[].parite`.
 * Ex: "10 actions nouvelles pour 1 action ancienne" -> 10
 */
export function parserPariteFractionnement(parite: string | null | undefined): number | null {
  if (!parite) return null;
  const s = parite.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const m1 = s.match(/(\d+(?:[.,]\d+)?)\s*actions?\s*nouvelles?\s*pour\s*(\d+(?:[.,]\d+)?)/);
  if (m1) {
    const nouv = Number(m1[1]!.replace(',', '.'));
    const anc = Number(m1[2]!.replace(',', '.'));
    if (nouv > 0 && anc > 0) return nouv / anc;
  }
  const m2 = s.match(/(\d+(?:[.,]\d+)?)\s*(?:pour|\/|:)\s*(\d+(?:[.,]\d+)?)/);
  if (m2) {
    const nouv = Number(m2[1]!.replace(',', '.'));
    const anc = Number(m2[2]!.replace(',', '.'));
    if (nouv > 0 && anc > 0) return nouv / anc;
  }
  return null;
}

export function ajusterSerieActions(
  code: string,
  rows: readonly CoursBrutAction[],
  splitsConnus: readonly SplitConnu[],
): {
  serieAjustee: CoursAjusteAction[];
  ajustementsAppliques: AjustementApplique[];
  anomalies: string[];
} {
  const propre = [...rows]
    .filter((r) => r.cours_jour != null && Number(r.cours_jour) > 0 && /^\d{4}-\d{2}-\d{2}/.test(r.date_marche))
    .map((r) => ({
      date_marche: r.date_marche.slice(0, 10),
      cours_brut: Number(r.cours_jour),
      variation_pct: r.variation_pct != null ? Number(r.variation_pct) : null,
      volume_brut: r.volume != null && Number(r.volume) >= 0 ? Number(r.volume) : null,
      valeur_echangee: r.valeur_echangee != null && Number(r.valeur_echangee) >= 0 ? Number(r.valeur_echangee) : null,
    }))
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  // Dédupliquer par date (dernière occurrence)
  const parDate = new Map<string, (typeof propre)[number]>();
  for (const r of propre) parDate.set(r.date_marche, r);
  const serie = [...parDate.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  if (serie.length === 0) {
    return { serieAjustee: [], ajustementsAppliques: [], anomalies: [] };
  }

  const facteurs = new Array<number>(serie.length).fill(1);
  const ajustementsAppliques: AjustementApplique[] = [];
  const datesSplitsAppliques = new Set<string>();

  // Traiter les splits du plus récent au plus ancien
  const splits = [...splitsConnus]
    .filter((s) => Number.isFinite(s.ratio) && s.ratio > 1.05 && /^\d{4}-\d{2}-\d{2}$/.test(s.date_effet))
    .sort((a, b) => b.date_effet.localeCompare(a.date_effet));

  for (const sp of splits) {
    // Trouver l'indice de la première séance >= date_effet
    const idxPost = serie.findIndex((p) => p.date_marche >= sp.date_effet);
    if (idxPost <= 0) {
      ajustementsAppliques.push({
        date_effet: sp.date_effet,
        ratio: sp.ratio,
        ratio_observe: 1,
        applique: false,
        raison: 'Split antérieur ou sans séance précédente en base',
      });
      continue;
    }

    // Chercher le saut le plus proche dans [idxPost - 2 .. min(idxPost + 4, len - 1)]
    let bestIdx = idxPost;
    let bestDiff = Infinity;
    const cibleObs = 1 / sp.ratio;
    const startSearch = Math.max(1, idxPost - 2);
    const endSearch = Math.min(serie.length - 1, idxPost + 4);
    for (let k = startSearch; k <= endSearch; k++) {
      const prev = serie[k - 1]!.cours_brut;
      const cur = serie[k]!.cours_brut;
      if (prev > 0) {
        const rObs = cur / prev;
        const d = Math.abs(rObs - cibleObs);
        if (d < bestDiff) {
          bestDiff = d;
          bestIdx = k;
        }
      }
    }

    const coursAvant = serie[bestIdx - 1]!.cours_brut;
    const coursApres = serie[bestIdx]!.cours_brut;
    const rObs = coursAvant > 0 ? coursApres / coursAvant : 1;

    // Tolérance ±25 % autour de 1/ratio (ex: pour ratio=2, 0.5 dans [0.375, 0.625])
    if (rObs >= cibleObs * 0.75 && rObs <= cibleObs * 1.25) {
      for (let i = 0; i < bestIdx; i++) {
        facteurs[i] = facteurs[i]! / sp.ratio;
      }
      datesSplitsAppliques.add(serie[bestIdx]!.date_marche);
      ajustementsAppliques.push({
        date_effet: sp.date_effet,
        ratio: sp.ratio,
        ratio_observe: Math.round(rObs * 10000) / 10000,
        applique: true,
        raison: `Ajustement 1/${sp.ratio} appliqué avant ${serie[bestIdx]!.date_marche} (saut observé ${(rObs * 100 - 100).toFixed(1)} %)`,
      });
    } else {
      ajustementsAppliques.push({
        date_effet: sp.date_effet,
        ratio: sp.ratio,
        ratio_observe: Math.round(rObs * 10000) / 10000,
        applique: false,
        raison: `Série déjà continue autour du ${sp.date_effet} (ratio observé ${rObs.toFixed(3)}) — non réajusté`,
      });
    }
  }

  const anomalies: string[] = [];
  const serieAjustee: CoursAjusteAction[] = serie.map((r, i) => {
    const f = facteurs[i]!;
    const cours_ajuste = Math.round(r.cours_brut * f * 10000) / 10000;
    const volume_ajuste = r.volume_brut != null && f > 0 ? Math.round(r.volume_brut / f) : null;
    return {
      date_marche: r.date_marche,
      cours_brut: r.cours_brut,
      cours_ajuste,
      variation_pct: r.variation_pct,
      volume_brut: r.volume_brut,
      volume_ajuste,
      valeur_echangee: r.valeur_echangee,
    };
  });

  // Recalculer variation_pct propre sur les sauts ajustés et repérer les sauts non expliqués (> 15 %)
  for (let i = 1; i < serieAjustee.length; i++) {
    const prev = serieAjustee[i - 1]!;
    const cur = serieAjustee[i]!;
    if (prev.cours_ajuste > 0) {
      const vCalc = ((cur.cours_ajuste / prev.cours_ajuste) - 1) * 100;
      if (datesSplitsAppliques.has(cur.date_marche)) {
        cur.variation_pct = Math.round(vCalc * 10000) / 10000;
      } else if (Math.abs(vCalc) > 15) {
        anomalies.push(`${code} : variation journalière atypique de ${vCalc.toFixed(1)} % le ${cur.date_marche}`);
      }
      if (cur.variation_pct == null) {
        cur.variation_pct = Math.round(vCalc * 10000) / 10000;
      }
    }
  }

  return { serieAjustee, ajustementsAppliques, anomalies };
}
