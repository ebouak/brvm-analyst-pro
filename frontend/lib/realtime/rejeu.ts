/**
 * Rejeu d'une séance à partir des relevés réels (brvm_intraday_snapshots,
 * un relevé par valeur à chaque passage de la collecte, toutes les 15 min).
 *
 * Logique PURE, testée. Règles d'honnêteté :
 *  - une image = un relevé réellement collecté, jamais un point interpolé ;
 *  - une valeur absente d'un relevé garde son dernier cours connu (elle n'a
 *    pas été traitée entre-temps), et avant son premier relevé elle vaut la
 *    clôture de la veille, variation nulle ;
 *  - les relevés identiques au précédent (passages après la clôture) sont
 *    fusionnés : ils n'apportent aucune information.
 */
import type { FlashDirection } from './mergeActions';

export interface Releve {
  code: string;
  captured_at: string;
  close: number | string | null;
  volume?: number | string | null;
}

export interface ImageSeance {
  /** Instant du relevé (ISO). */
  t: string;
  cours: Record<string, number>;
  volumes: Record<string, number>;
}

const nombre = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function construireRejeu(releves: readonly Releve[]): ImageSeance[] {
  const parInstant = new Map<string, Releve[]>();
  for (const r of releves) {
    const lot = parInstant.get(r.captured_at);
    if (lot) lot.push(r);
    else parInstant.set(r.captured_at, [r]);
  }
  const instants = [...parInstant.keys()].sort((a, b) => Date.parse(a) - Date.parse(b));

  const images: ImageSeance[] = [];
  let cours: Record<string, number> = {};
  let volumes: Record<string, number> = {};
  for (const t of instants) {
    const c = { ...cours };
    const v = { ...volumes };
    for (const r of parInstant.get(t)!) {
      const prix = nombre(r.close);
      if (prix != null && prix > 0) c[r.code] = prix;
      const vol = nombre(r.volume);
      if (vol != null && vol >= 0) v[r.code] = vol;
    }
    const identique =
      images.length > 0 &&
      Object.keys(c).length === Object.keys(cours).length &&
      Object.keys(c).every((k) => c[k] === cours[k] && v[k] === volumes[k]);
    if (!identique) images.push({ t, cours: c, volumes: v });
    cours = c;
    volumes = v;
  }
  return images;
}

interface LigneCours {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume?: number | null;
}

/**
 * Les lignes telles qu'elles étaient à l'instant de `image`. Les champs
 * serveur (désignation, secteur…) sont conservés ; seuls cours, variation et
 * volume changent. `veilles` : clôture de la séance précédente, par code.
 */
export function lignesAuMoment<T extends LigneCours>(
  base: readonly T[],
  image: ImageSeance,
  veilles: Readonly<Record<string, number | null | undefined>>,
): T[] {
  return base.map((ligne) => {
    const veille = veilles[ligne.code] ?? null;
    const releve = image.cours[ligne.code];
    const cours = releve ?? veille;
    const variation = cours != null && veille != null && veille > 0 ? (cours / veille - 1) * 100 : null;
    const volume = image.volumes[ligne.code] ?? (releve == null ? 0 : ligne.volume ?? null);
    // Les relevés ne portent ni capitaux ni transactions : à cet instant, ils
    // sont inconnus. Les chiffres de fin de journée seraient faux à 10 h.
    const inconnus = {
      ...('valeur_echangee' in ligne ? { valeur_echangee: null } : {}),
      ...('nb_transactions' in ligne ? { nb_transactions: null } : {}),
    };
    return { ...ligne, cours_jour: cours, variation_pct: variation, volume, ...inconnus };
  });
}

/** Sens du changement de cours entre deux images (flash vert ou rouge). */
export function directionsEntre(avant: ImageSeance | null, apres: ImageSeance): Record<string, FlashDirection> {
  const dirs: Record<string, FlashDirection> = {};
  if (!avant) return dirs;
  for (const [code, c] of Object.entries(apres.cours)) {
    const p = avant.cours[code];
    if (p != null && c !== p) dirs[code] = c > p ? 'up' : 'down';
  }
  return dirs;
}

/**
 * Clôture de la veille déduite du cours et de la variation PUBLIÉE, quand la
 * base ne la donne pas directement (carte de chaleur). Calcul sur des
 * chiffres publiés, arrondi compris : à n'utiliser qu'à défaut de
 * `cours_precedent`.
 */
export function veilleDepuisVariation(cours: number | null, variation: number | null): number | null {
  if (cours == null || variation == null || variation <= -100) return null;
  return cours / (1 + variation / 100);
}

/**
 * Clôture de la veille de chaque ligne : `cours_precedent` de la base quand
 * il est connu, sinon déduite de la variation publiée.
 */
export function veillesDe(
  base: readonly { code: string; cours_jour: number | null; variation_pct: number | null; cours_precedent?: number | null }[],
): Record<string, number | null> {
  const veilles: Record<string, number | null> = {};
  for (const l of base) {
    const cp = l.cours_precedent;
    veilles[l.code] = cp != null && cp > 0 ? cp : veilleDepuisVariation(l.cours_jour, l.variation_pct);
  }
  return veilles;
}
