/**
 * Contrôles de qualité et rapport de couverture historique (purs, sans I/O).
 */
import {
  DATES_CREATION_INDICES,
  type AnomalieQualite,
  type CouvertureAnnuelle,
  type PointIndice,
  type RapportCouverture,
} from './types.js';

const SEUIL_VAR_INDICE_PCT = 12;
const SEUIL_TROU_JOURS_OUVRES = 5;

function parseIsoUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function isIsoDateValid(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const t = parseIsoUtc(iso);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === iso;
}

/** Compte le nombre de jours ouvrés (lun-ven) strictement dans ]d1, d2]. */
export function compterJoursOuvresEntre(d1: string, d2: string, inclusDebut = false): number {
  const start = parseIsoUtc(d1);
  const end = parseIsoUtc(d2);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  let count = 0;
  const step = 86_400_000;
  for (let t = inclusDebut ? start : start + step; t <= end; t += step) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Valide et nettoie une série chronologique d'indice :
 * - écarte dates invalides, valeurs <= 0 ou non finies ;
 * - rejette toute cotation antérieure à la date officielle de création ;
 * - déduplique les dates (conserve la dernière occurrence à qualité >=) ;
 * - signale variations > ±12 % et trous > 5 jours ouvrés.
 */
export function validerSerieIndice(
  indiceCode: string,
  points: readonly PointIndice[],
): { seriePropre: PointIndice[]; anomalies: AnomalieQualite[] } {
  const anomalies: AnomalieQualite[] = [];
  const dateCreation = DATES_CREATION_INDICES[indiceCode] ?? null;
  const parDate = new Map<string, PointIndice>();

  for (const p of points) {
    const date = String(p.date_marche ?? '').slice(0, 10);
    if (!isIsoDateValid(date)) {
      anomalies.push({ type: 'valeur_invalide', date_marche: String(p.date_marche ?? ''), detail: 'Date invalide ignorée' });
      continue;
    }
    const val = Number(p.valeur);
    if (!Number.isFinite(val) || val <= 0) {
      anomalies.push({ type: 'valeur_invalide', date_marche: date, detail: `Valeur non positive ou invalide (${p.valeur})` });
      continue;
    }
    if (dateCreation && date < dateCreation) {
      anomalies.push({
        type: 'date_pre_creation',
        date_marche: date,
        detail: `Cotation antérieure à la création officielle de ${indiceCode} (${dateCreation}) rejetée`,
      });
      continue;
    }
    if (parDate.has(date)) {
      anomalies.push({ type: 'doublon_date', date_marche: date, detail: `Doublon de séance pour ${indiceCode}` });
    }
    parDate.set(date, { ...p, date_marche: date, valeur: val });
  }

  const seriePropre = [...parDate.values()].sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  for (let i = 1; i < seriePropre.length; i++) {
    const prev = seriePropre[i - 1]!;
    const curr = seriePropre[i]!;
    const varPct = ((curr.valeur / prev.valeur) - 1) * 100;
    if (Math.abs(varPct) > SEUIL_VAR_INDICE_PCT) {
      anomalies.push({
        type: 'variation_excessive',
        date_marche: curr.date_marche,
        detail: `Variation de ${varPct.toFixed(2)} % entre ${prev.date_marche} et ${curr.date_marche}`,
      });
    }
    const ouvrManquants = compterJoursOuvresEntre(prev.date_marche, curr.date_marche, false) - 1;
    if (ouvrManquants > SEUIL_TROU_JOURS_OUVRES) {
      anomalies.push({
        type: 'trou_cotation',
        date_marche: curr.date_marche,
        detail: `${ouvrManquants} jours ouvrés manquants entre ${prev.date_marche} et ${curr.date_marche}`,
      });
    }
  }

  return { seriePropre, anomalies };
}

/**
 * Calcule le rapport de couverture historique d'une série propre d'indice.
 */
export function calculerRapportCouverture(
  indiceCode: string,
  seriePropre: readonly PointIndice[],
): RapportCouverture {
  if (seriePropre.length === 0) {
    return {
      indice_code: indiceCode,
      debut_date: null,
      fin_date: null,
      nb_seances_disponibles: 0,
      nb_jours_ouvres_theoriques: 0,
      nb_seances_manquantes: 0,
      couverture_pct: 0,
      annees_exploitables: [],
      trous_majeurs: [],
    };
  }

  const triee = [...seriePropre].sort((a, b) => a.date_marche.localeCompare(b.date_marche));
  const debut = triee[0]!.date_marche;
  const fin = triee[triee.length - 1]!.date_marche;
  const nbOuvres = compterJoursOuvresEntre(debut, fin, true);
  const nbDispo = triee.length;
  const nbManquants = Math.max(0, nbOuvres - nbDispo);
  const couverturePct = nbOuvres > 0 ? Math.min(100, Math.round((10000 * nbDispo) / nbOuvres) / 100) : 0;

  const parAnnee = new Map<string, { min: string; max: string; count: number }>();
  for (const p of triee) {
    const an = p.date_marche.slice(0, 4);
    const cur = parAnnee.get(an);
    if (!cur) {
      parAnnee.set(an, { min: p.date_marche, max: p.date_marche, count: 1 });
    } else {
      cur.count++;
      if (p.date_marche < cur.min) cur.min = p.date_marche;
      if (p.date_marche > cur.max) cur.max = p.date_marche;
    }
  }

  const annees_exploitables: CouvertureAnnuelle[] = [...parAnnee.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([annee, info]) => {
      const debAn = annee === debut.slice(0, 4) ? debut : `${annee}-01-01`;
      const finAn = annee === fin.slice(0, 4) ? fin : `${annee}-12-31`;
      const theoriques = Math.max(info.count, compterJoursOuvresEntre(debAn, finAn, true));
      return {
        annee,
        seances: info.count,
        jours_ouvres_theoriques: theoriques,
        couverture_pct: theoriques > 0 ? Math.min(100, Math.round((10000 * info.count) / theoriques) / 100) : 0,
      };
    });

  const trous_majeurs: RapportCouverture['trous_majeurs'] = [];
  for (let i = 1; i < triee.length; i++) {
    const d1 = triee[i - 1]!.date_marche;
    const d2 = triee[i]!.date_marche;
    const manquants = compterJoursOuvresEntre(d1, d2, false) - 1;
    if (manquants > SEUIL_TROU_JOURS_OUVRES) {
      trous_majeurs.push({ debut: d1, fin: d2, jours_ouvres_manquants: manquants });
    }
  }

  return {
    indice_code: indiceCode,
    debut_date: debut,
    fin_date: fin,
    nb_seances_disponibles: nbDispo,
    nb_jours_ouvres_theoriques: nbOuvres,
    nb_seances_manquantes: nbManquants,
    couverture_pct: couverturePct,
    annees_exploitables,
    trous_majeurs,
  };
}
