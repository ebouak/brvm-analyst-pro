/**
 * Algorithme pur de détection des drawdowns et des épisodes de crise BRVM.
 * Aucune donnée future (look-ahead) : le sommet de référence à t est le plus
 * haut observé sur [0..t].
 *
 * Ce module est également copié vers `frontend/lib/stress/drawdowns.ts`
 * (parité vérifiée par `scraper/tests/stressCopie.test.ts`).
 */
import type {
  ConfigDetection,
  EpisodeCrise,
  NiveauCrise,
  PhaseTrajectoire,
  PointDrawdown,
  PointIndice,
  PointTrajectoireBase100,
} from './types.js';

const MS_JOUR = 86_400_000;

function arrondi(x: number, dec = 4): number {
  const f = 10 ** dec;
  return Math.round(x * f) / f;
}

function diffJours(d1: string, d2: string): number {
  return Math.max(0, Math.round((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / MS_JOUR));
}

function ajouterJours(iso: string, jours: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + jours * MS_JOUR).toISOString().slice(0, 10);
}

/** Classe un drawdown (en % négatif) selon les 6 niveaux du cahier des charges. */
export function classifierDrawdown(ddPct: number): NiveauCrise {
  if (ddPct <= -40) return 'crise_extreme';
  if (ddPct <= -30) return 'crise_majeure';
  if (ddPct <= -20) return 'marche_baissier';
  if (ddPct <= -15) return 'correction_severe';
  if (ddPct <= -10) return 'correction_significative';
  return 'correction_moderee';
}

/**
 * Calcule la série quotidienne des drawdowns :
 *   DD(t) = (Indice(t) / SommetHistorique(<= t) - 1) * 100
 */
export function calculerDrawdowns(serie: readonly PointIndice[]): PointDrawdown[] {
  const triee = [...serie]
    .filter((p) => Number.isFinite(p.valeur) && p.valeur > 0)
    .sort((a, b) => a.date_marche.localeCompare(b.date_marche));

  const out: PointDrawdown[] = [];
  let sommet = -Infinity;
  let dateSommet = '';

  for (const p of triee) {
    if (p.valeur > sommet) {
      sommet = p.valeur;
      dateSommet = p.date_marche;
    }
    const dd = sommet > 0 ? ((p.valeur / sommet) - 1) * 100 : 0;
    out.push({
      date_marche: p.date_marche,
      valeur: p.valeur,
      sommet_precedent: sommet,
      date_sommet_precedent: dateSommet,
      drawdown_pct: arrondi(dd, 4),
    });
  }
  return out;
}

function rendementPostCreux(
  serie: readonly PointDrawdown[],
  idxCreux: number,
  joursCalendaires: number,
): number | null {
  const creux = serie[idxCreux];
  if (!creux || creux.valeur <= 0) return null;
  const cible = ajouterJours(creux.date_marche, joursCalendaires);
  const limite = ajouterJours(cible, 15);
  for (let i = idxCreux + 1; i < serie.length; i++) {
    const pt = serie[i]!;
    if (pt.date_marche >= cible) {
      if (pt.date_marche > limite) return null;
      return arrondi(((pt.valeur / creux.valeur) - 1) * 100, 4);
    }
  }
  return null;
}

function sousEchantillonnerTrajectoire(
  points: readonly PointTrajectoireBase100[],
  maxPoints: number,
  indicesCles: ReadonlySet<number>,
): PointTrajectoireBase100[] {
  if (points.length <= maxPoints) return [...points];
  const pas = (points.length - 1) / (maxPoints - 1);
  const retenus = new Set<number>(indicesCles);
  retenus.add(0);
  retenus.add(points.length - 1);
  for (let k = 0; k < maxPoints; k++) {
    retenus.add(Math.round(k * pas));
  }
  return [...retenus]
    .filter((i) => i >= 0 && i < points.length)
    .sort((a, b) => a - b)
    .map((i) => points[i]!);
}

function construireLibelle(
  niveau: NiveauCrise,
  dateSommet: string,
  dateFin: string,
  statut: 'en_cours' | 'termine',
): string {
  const anDeb = dateSommet.slice(0, 4);
  const anFin = dateFin.slice(0, 4);
  const prefix =
    niveau === 'crise_extreme' || niveau === 'crise_majeure'
      ? 'Crise'
      : niveau === 'marche_baissier'
        ? 'Marché baissier'
        : 'Correction';
  const periode = anDeb === anFin ? anDeb : `${anDeb}–${anFin}`;
  return statut === 'en_cours' ? `${prefix} ${periode} (en cours)` : `${prefix} ${periode}`;
}

/**
 * Détecte tous les épisodes de correction/crise franchissant `seuilDeclenchementPct`.
 *
 * Règles clés :
 * - Un épisode débute au sommet immédiatement antérieur au franchissement du seuil.
 * - `date_debut_correction` est la première séance suivant le sommet où le cours passe strictement sous le sommet.
 * - Un épisode ne se clôt (`statut = 'termine'`) que lorsque le drawdown revient
 *   >= `seuilRecuperationPct` pendant `joursConfirmationReprise` séances consécutives.
 * - Les rebonds intermédiaires pendant la phase de baisse (avant le point bas définitif)
 *   sont comptabilisés dès qu'un rebond depuis un plus bas local atteint `seuilRebondIntermediairePct`.
 */
export function detecterEpisodes(
  serieIndice: readonly PointIndice[],
  indiceCode: string,
  config: ConfigDetection = { seuilDeclenchementPct: -10 },
): EpisodeCrise[] {
  const ddSerie = calculerDrawdowns(serieIndice);
  if (ddSerie.length < 2) return [];

  const seuilDecl = config.seuilDeclenchementPct;
  const seuilRecup = config.seuilRecuperationPct ?? 0;
  const jConfirm = Math.max(1, config.joursConfirmationReprise ?? 5);
  const seuilRebondInter = Math.max(0.5, config.seuilRebondIntermediairePct ?? 3);
  const maxPoints = Math.max(30, config.maxPointsTrajectoire ?? 180);

  const episodes: EpisodeCrise[] = [];
  let i = 0;

  while (i < ddSerie.length) {
    const pt = ddSerie[i]!;
    if (pt.drawdown_pct > seuilDecl) {
      i++;
      continue;
    }

    // Trouver l'index exact du sommet de référence précédent
    let idxSommet = i;
    for (let k = i; k >= 0; k--) {
      if (ddSerie[k]!.date_marche === pt.date_sommet_precedent) {
        idxSommet = k;
        break;
      }
    }
    const sommet = ddSerie[idxSommet]!;

    // Première séance strictement sous le sommet
    let idxDebutCorr = i;
    for (let k = idxSommet + 1; k <= i; k++) {
      if (ddSerie[k]!.valeur < sommet.valeur) {
        idxDebutCorr = k;
        break;
      }
    }

    // Suivi jusqu'à récupération confirmée ou fin de série
    let idxCreux = idxSommet;
    let valCreux = sommet.valeur;
    let consecRecup = 0;
    let idxRecup: number | null = null;
    let j = idxSommet + 1;

    while (j < ddSerie.length) {
      const cur = ddSerie[j]!;
      if (cur.valeur < valCreux) {
        valCreux = cur.valeur;
        idxCreux = j;
      }
      const ddRelatifSommet = ((cur.valeur / sommet.valeur) - 1) * 100;
      if (ddRelatifSommet >= seuilRecup) {
        consecRecup++;
        if (consecRecup >= jConfirm) {
          idxRecup = j - jConfirm + 1;
          break;
        }
      } else {
        consecRecup = 0;
      }
      j++;
    }

    const idxFin = idxRecup ?? ddSerie.length - 1;
    const creux = ddSerie[idxCreux]!;
    const perteMaxPct = arrondi(((creux.valeur / sommet.valeur) - 1) * 100, 4);

    // Comptage des rebonds intermédiaires significatifs pendant la phase [sommet -> creux]
    let nbRebondsInter = 0;
    let maxRebondInter: number | null = null;
    let localMin = sommet.valeur;
    let inRebound = false;
    let reboundPeak = sommet.valeur;

    for (let k = idxSommet + 1; k <= idxCreux; k++) {
      const v = ddSerie[k]!.valeur;
      if (v < localMin) {
        if (inRebound) {
          const amp = ((reboundPeak / localMin) - 1) * 100;
          if (amp >= seuilRebondInter) {
            nbRebondsInter++;
            maxRebondInter = maxRebondInter == null ? amp : Math.max(maxRebondInter, amp);
          }
          inRebound = false;
        }
        localMin = v;
        reboundPeak = v;
      } else if (localMin > 0) {
        const amp = ((v / localMin) - 1) * 100;
        if (amp >= seuilRebondInter) {
          inRebound = true;
          if (v > reboundPeak) reboundPeak = v;
        }
      }
    }

    const statut: 'en_cours' | 'termine' = idxRecup !== null ? 'termine' : 'en_cours';
    const recup = idxRecup !== null ? ddSerie[idxRecup]! : null;
    const niveau = classifierDrawdown(perteMaxPct);

    // Construction trajectoire base 100 au sommet
    const rawTraj: PointTrajectoireBase100[] = [];
    for (let k = idxSommet; k <= idxFin; k++) {
      const p = ddSerie[k]!;
      const dd = arrondi(((p.valeur / sommet.valeur) - 1) * 100, 4);
      let phase: PhaseTrajectoire = 'baisse';
      if (k === idxCreux) phase = 'creux';
      else if (k > idxCreux && idxRecup !== null && k >= idxRecup) phase = 'recupere';
      else if (k > idxCreux) phase = 'reprise';
      rawTraj.push({
        jour_seance: k - idxSommet,
        date: p.date_marche,
        base100: arrondi((p.valeur / sommet.valeur) * 100, 3),
        drawdown_pct: dd,
        phase,
      });
    }

    const cles = new Set<number>([
      0,
      idxDebutCorr - idxSommet,
      idxCreux - idxSommet,
      ...(idxRecup !== null ? [idxRecup - idxSommet] : []),
      rawTraj.length - 1,
    ]);
    const trajectoire = sousEchantillonnerTrajectoire(rawTraj, maxPoints, cles);

    episodes.push({
      indice_code: indiceCode,
      seuil_pct: seuilDecl,
      niveau,
      libelle: construireLibelle(niveau, sommet.date_marche, recup?.date_marche ?? ddSerie[idxFin]!.date_marche, statut),
      date_sommet: sommet.date_marche,
      valeur_sommet: sommet.valeur,
      date_debut_correction: ddSerie[idxDebutCorr]!.date_marche,
      date_creux: creux.date_marche,
      valeur_creux: creux.valeur,
      perte_max_pct: perteMaxPct,
      nb_seances_baisse: idxCreux - idxSommet,
      duree_calendaire_baisse: diffJours(sommet.date_marche, creux.date_marche),
      nb_rebonds_intermediaires: nbRebondsInter,
      amplitude_max_rebond_pct: maxRebondInter != null ? arrondi(maxRebondInter, 4) : null,
      date_recuperation: recup ? recup.date_marche : null,
      nb_seances_rebond: idxRecup !== null ? idxRecup - idxCreux : null,
      duree_totale_recuperation_jours: recup ? diffJours(sommet.date_marche, recup.date_marche) : null,
      perf_cumulee_recuperation_pct: recup && creux.valeur > 0 ? arrondi(((recup.valeur / creux.valeur) - 1) * 100, 4) : null,
      statut,
      rebond_1m_pct: rendementPostCreux(ddSerie, idxCreux, 30),
      rebond_3m_pct: rendementPostCreux(ddSerie, idxCreux, 91),
      rebond_6m_pct: rendementPostCreux(ddSerie, idxCreux, 182),
      rebond_12m_pct: rendementPostCreux(ddSerie, idxCreux, 365),
      rebond_24m_pct: rendementPostCreux(ddSerie, idxCreux, 730),
      trajectoire_base100: trajectoire,
    });

    // Repartir après la récupération confirmée (ou fin de série)
    i = idxRecup !== null ? idxRecup + jConfirm : ddSerie.length;
  }

  return episodes;
}
