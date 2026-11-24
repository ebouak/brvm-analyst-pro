/**
 * Simulateurs techniques des leçons du niveau 3 — fonctions PURES et testées
 * (simTechnique.test.ts). Les indicateurs viennent de lib/indicators (jamais
 * recodés) ; les clôtures sont RÉELLES, lues par /api/academy/serie.
 *
 * Chaque lecture DÉCRIT ce qui s'est passé. Aucune ne prévoit, aucune ne
 * recommande : « au-dessus des moyennes » n'est pas « à acheter ».
 */
import { emaSeries, macdSeries, rsiSeries, smaSeries } from '@/lib/indicators';
import { SaisieInvalide, fmtPct, type Lecture } from './simulateurs';

export interface PointSerie {
  date: string;
  cours: number;
  /** Bougie de la séance, quand la base la publie (null sinon) ; lue par le simulateur `bougies`. */
  ouverture?: number | null;
  haut?: number | null;
  bas?: number | null;
  volume?: number | null;
}

const nb = (n: number, dec = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dec }).format(n);
const fmtFcfa = (n: number) => `${nb(Math.round(n))} FCFA`;
const CONCLUSION = 'C’est ce qui s’est passé, pas ce qui va se passer.';

/** Clôtures valides, de la plus ancienne à la plus récente. */
export function nettoyerSerie(points: PointSerie[]): PointSerie[] {
  return points.filter((p) => Number.isFinite(p.cours) && p.cours > 0).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Variation selon l'horizon ────────────────────────────────────────────────

export interface HorizonVariation {
  libelle: string;
  seances: number;
}

/** Horizons de la leçon « Lire un graphique » (≈ 21 séances par mois). */
export const HORIZONS_DEFAUT: HorizonVariation[] = [
  { libelle: 'Un mois', seances: 21 },
  { libelle: 'Trois mois', seances: 63 },
  { libelle: 'Six mois', seances: 126 },
  { libelle: 'Un an', seances: 250 },
];

export interface LigneVariation {
  libelle: string;
  seances: number;
  depuis: string | null;
  variationPct: number | null;
}

export interface ResultatVariation extends Lecture {
  lignes: LigneVariation[];
  derniere: PointSerie;
}

export function lectureVariation(serie: PointSerie[], horizons: HorizonVariation[] = HORIZONS_DEFAUT): ResultatVariation {
  const s = nettoyerSerie(serie);
  if (s.length < 2) throw new SaisieInvalide('Historique insuffisant pour mesurer une variation.');
  const derniere = s[s.length - 1]!;
  const lignes: LigneVariation[] = horizons.map((h) => {
    const i = s.length - 1 - h.seances;
    if (i < 0) return { libelle: h.libelle, seances: h.seances, depuis: null, variationPct: null };
    return { libelle: h.libelle, seances: h.seances, depuis: s[i]!.date, variationPct: (derniere.cours / s[i]!.cours - 1) * 100 };
  });
  const connues = lignes.filter((l) => l.variationPct != null);
  const hausses = connues.filter((l) => l.variationPct! > 0).map((l) => l.libelle.toLowerCase());
  const baisses = connues.filter((l) => l.variationPct! < 0).map((l) => l.libelle.toLowerCase());
  let lecture: string;
  if (connues.length === 0) lecture = 'Historique trop court pour ces horizons : aucune variation n’est calculée.';
  else if (hausses.length > 0 && baisses.length > 0) {
    lecture = `Hausse sur ${hausses.join(', ')}, baisse sur ${baisses.join(', ')} : les deux descriptions sont exactes, elles ne portent pas sur le même horizon. Choisissez d’abord celui de votre projet.`;
  } else {
    lecture = `${hausses.length > 0 ? 'Hausse' : baisses.length > 0 ? 'Baisse' : 'Stabilité'} sur tous les horizons mesurés : ici, les échelles de temps racontent la même histoire. ${CONCLUSION}`;
  }
  const alertes = lignes.some((l) => l.variationPct == null) ? ['Certains horizons dépassent l’historique disponible : ils restent vides plutôt que calculés sur moins de séances.'] : [];
  return { lignes, derniere, lecture, alertes };
}

// ── Moyennes mobiles ────────────────────────────────────────────────────────

export interface PointMoyennes { date: string; cours: number; courte: number | null; longue: number | null }

export type PositionMoyennes = 'au-dessus des deux' | 'sous les deux' | 'entre les deux';
export type PenteMoyenne = 'monte' | 'plate' | 'baisse';
/** Simple (SMA) : poids égal à chaque séance. Exponentielle (EMA) : poids décroissant, k = 2 ÷ (N + 1). */
export type MethodeMoyenne = 'simple' | 'exponentielle';

/** Dernier croisement des DEUX moyennes entre elles (et non du cours avec l'une d'elles). */
export interface CroisementMoyennes {
  sens: 'haussier' | 'baissier';
  /** Séances écoulées depuis la séance du croisement (0 = dernière séance). */
  seances: number;
  date: string;
}

export interface ResultatMoyennes extends Lecture {
  points: PointMoyennes[];
  methode: MethodeMoyenne;
  position: PositionMoyennes;
  pente: PenteMoyenne;
  pentePct: number;
  derniere: PointMoyennes;
  /** Écart du dernier cours à chaque moyenne, en % : (cours − moyenne) ÷ moyenne. */
  ecartCourtePct: number;
  ecartLonguePct: number;
  /** Séances entre la dernière fois où le cours a croisé la moyenne longue et aujourd'hui (null si jamais). */
  seancesDepuisCroisement: number | null;
  /** Dernier passage de la moyenne courte au-dessus (haussier) ou en dessous (baissier) de la longue. */
  croisementMoyennes: CroisementMoyennes | null;
}

const dateCourte = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Dernier croisement de la moyenne courte et de la longue. On retient le
 * dernier SIGNE non nul de l'écart : deux moyennes égales sur quelques séances
 * ne fabriquent pas de croisement, il faut qu'elles changent de côté.
 */
export function dernierCroisementMoyennes(points: PointMoyennes[]): CroisementMoyennes | null {
  let signePrecedent = 0;
  let trouve: CroisementMoyennes | null = null;
  points.forEach((p, i) => {
    if (p.courte == null || p.longue == null) return;
    const s = Math.sign(p.courte - p.longue);
    if (s === 0) return;
    if (signePrecedent !== 0 && s !== signePrecedent) {
      trouve = { sens: s > 0 ? 'haussier' : 'baissier', seances: points.length - 1 - i, date: p.date };
    }
    signePrecedent = s;
  });
  return trouve;
}

/** Une moyenne longue qui varie de moins de ±1 % en 10 séances est dite « plate » (convention de ce simulateur). */
export const SEUIL_PENTE_PCT = 1;

export function lectureMoyennes(serie: PointSerie[], courte: number, longue: number, methode: MethodeMoyenne = 'simple'): ResultatMoyennes {
  if (!(Number.isInteger(courte) && Number.isInteger(longue) && courte >= 2 && longue > courte && longue <= 200)) {
    throw new SaisieInvalide('La moyenne courte doit compter moins de séances que la longue (2 à 200).');
  }
  const s = nettoyerSerie(serie);
  if (s.length < longue + 10) throw new SaisieInvalide(`Historique insuffisant : il faut au moins ${longue + 10} séances cotées.`);
  const closes = s.map((p) => p.cours);
  const calcul = methode === 'exponentielle' ? emaSeries : smaSeries;
  const c = calcul(closes, courte);
  const l = calcul(closes, longue);
  const points = s.map((p, i) => ({ date: p.date, cours: p.cours, courte: c[i] ?? null, longue: l[i] ?? null }));
  const derniere = points[points.length - 1]!;
  const mc = derniere.courte!;
  const ml = derniere.longue!;
  const position: PositionMoyennes = derniere.cours > mc && derniere.cours > ml ? 'au-dessus des deux' : derniere.cours < mc && derniere.cours < ml ? 'sous les deux' : 'entre les deux';
  const avant = points[points.length - 11]!.longue!;
  const pentePct = (ml / avant - 1) * 100;
  const pente: PenteMoyenne = pentePct > SEUIL_PENTE_PCT ? 'monte' : pentePct < -SEUIL_PENTE_PCT ? 'baisse' : 'plate';
  let seancesDepuisCroisement: number | null = null;
  const signe = (p: PointMoyennes) => Math.sign(p.cours - (p.longue as number));
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i - 1]!.longue == null) break;
    if (signe(points[i]!) !== signe(points[i - 1]!)) { seancesDepuisCroisement = points.length - 1 - i; break; }
  }
  const LECT: Record<PositionMoyennes, string> = {
    // La position ne décrit que le mouvement récent ; la tendance de fond, c'est
    // la PENTE de la moyenne longue (phrase suivante). Les mêler faisait dire
    // « la tendance de fond va vers le bas » puis « la moyenne longue monte ».
    'au-dessus des deux': 'le mouvement récent est orienté à la hausse',
    'sous les deux': 'le mouvement récent est orienté à la baisse',
    'entre les deux': 'court terme et fond divergent : souvent une phase d’hésitation',
  };
  const PENTE: Record<PenteMoyenne, string> = {
    monte: 'monte : la tendance de fond reste haussière',
    baisse: 'baisse : la tendance de fond est orientée à la baisse',
    plate: 'est plate : un marché sans direction, où les croisements perdent leur sens',
  };
  const ecartCourtePct = (derniere.cours / mc - 1) * 100;
  const ecartLonguePct = (derniere.cours / ml - 1) * 100;
  const croisementMoyennes = dernierCroisementMoyennes(points);
  const genre = methode === 'exponentielle' ? 'moyennes exponentielles' : 'moyennes';
  let lecture =
    `Le cours (${fmtFcfa(derniere.cours)}) est ${position} ${genre} (${courte} séances : ${fmtFcfa(mc)}, écart ${fmtPct(ecartCourtePct)} ; ` +
    `${longue} séances : ${fmtFcfa(ml)}, écart ${fmtPct(ecartLonguePct)}) : ${LECT[position]}. ` +
    `La moyenne longue ${PENTE[pente]} (${fmtPct(pentePct)} en 10 séances).`;
  if (position === 'sous les deux' && pente === 'monte') lecture += ' La baisse récente n’a pas encore retourné la tendance de fond.';
  if (position === 'au-dessus des deux' && pente === 'baisse') lecture += ' La hausse récente n’a pas encore retourné la tendance de fond.';
  if (seancesDepuisCroisement != null) {
    lecture += seancesDepuisCroisement === 0
      ? ' Le cours a croisé sa moyenne longue à la dernière séance.'
      : ` Le cours a croisé sa moyenne longue il y a ${nb(seancesDepuisCroisement)} séance${seancesDepuisCroisement > 1 ? 's' : ''}.`;
  }
  if (croisementMoyennes) {
    const { sens, seances, date } = croisementMoyennes;
    lecture += ` La moyenne ${courte} séances est passée ${sens === 'haussier' ? 'au-dessus' : 'en dessous'} de la moyenne ${longue} séances ` +
      `(croisement ${sens}) le ${dateCourte(date)}, ${seances === 0 ? 'à la dernière séance' : `il y a ${nb(seances)} séance${seances > 1 ? 's' : ''}`}.`;
  }
  lecture += ` ${CONCLUSION}`;
  const alertes: string[] = [];
  if (courte < 5) alertes.push('Une moyenne sur moins de 5 séances suit presque chaque mouvement : elle lisse très peu.');
  return { points, methode, position, pente, pentePct, derniere, ecartCourtePct, ecartLonguePct, seancesDepuisCroisement, croisementMoyennes, lecture, alertes };
}

// ── Atelier : la moyenne qui glisse (clôtures saisies) ──────────────────────

export interface LigneGlissante {
  seance: number;
  cloture: number;
  /** Les N clôtures retenues ; null tant qu'il n'y en a pas N. */
  fenetre: number[] | null;
  sma: number | null;
  ema: number | null;
  /** (clôture − moyenne simple) ÷ moyenne simple, en %. */
  ecartSmaPct: number | null;
}

export interface ResultatGlissante extends Lecture {
  lignes: LigneGlissante[];
  periode: number;
  /** Poids de la dernière clôture dans la moyenne exponentielle : 2 ÷ (N + 1). */
  k: number;
}

/**
 * Calcul pas à pas, séance par séance. La moyenne simple est la somme de la
 * fenêtre divisée par N (somme recalculée, pas glissée : aucune dérive
 * d'arrondi). L'exponentielle part de la première moyenne simple, comme
 * emaSeries — c'est la convention de lib/indicators, celle du MACD.
 */
export function moyenneGlissante(clotures: number[], periode: number): ResultatGlissante {
  if (!(Number.isInteger(periode) && periode >= 2 && periode < clotures.length)) {
    throw new SaisieInvalide('La période doit compter au moins 2 séances, et moins que le nombre de clôtures saisies.');
  }
  if (clotures.some((c) => !(Number.isFinite(c) && c > 0))) throw new SaisieInvalide('Chaque clôture doit être un cours positif.');
  const ema = emaSeries(clotures, periode);
  const lignes: LigneGlissante[] = clotures.map((cloture, i) => {
    if (i < periode - 1) return { seance: i + 1, cloture, fenetre: null, sma: null, ema: null, ecartSmaPct: null };
    const fenetre = clotures.slice(i - periode + 1, i + 1);
    const sma = fenetre.reduce((t, x) => t + x, 0) / periode;
    return { seance: i + 1, cloture, fenetre, sma, ema: ema[i] ?? null, ecartSmaPct: (cloture / sma - 1) * 100 };
  });
  const k = 2 / (periode + 1);
  const d = lignes[lignes.length - 1]!;
  const p = lignes[lignes.length - 2]!;
  const sansMoyenne = periode - 1 === 1 ? 'la première séance n’en a pas' : `les ${periode - 1} premières séances n’en ont pas`;
  let lecture =
    `La moyenne simple sur ${periode} séances a besoin de ${periode} clôtures : ${sansMoyenne}. ` +
    `À la séance ${d.seance}, le cours (${nb(d.cloture, 2)}) est ${d.cloture > d.sma! ? 'au-dessus de' : d.cloture < d.sma! ? 'en dessous de' : 'égal à'} sa moyenne simple ` +
    `(${nb(d.sma!, 2)}, écart ${fmtPct(d.ecartSmaPct!)}). La moyenne exponentielle (${nb(d.ema!, 2)}) donne à la dernière clôture un poids de ${nb(k * 100, 1)} % ` +
    `contre ${nb(100 / periode, 1)} % dans la simple : elle ${Math.abs(d.cloture - d.ema!) < Math.abs(d.cloture - d.sma!) ? 'en est plus proche' : 'n’en est pas plus proche ici'}.`;
  if (p.sma != null && d.cloture < p.cloture && d.sma! > p.sma) {
    lecture += ' Le cours vient de baisser, mais la moyenne simple monte encore : c’est le retard, elle est faite de cours passés.';
  } else if (p.sma != null && d.cloture > p.cloture && d.sma! < p.sma) {
    lecture += ' Le cours vient de monter, mais la moyenne simple baisse encore : c’est le retard, elle est faite de cours passés.';
  }
  const alertes = periode === 2 ? ['Une moyenne sur 2 séances lisse très peu : elle suit presque chaque mouvement.'] : [];
  return { lignes, periode, k, lecture, alertes };
}

// ── RSI ─────────────────────────────────────────────────────────────────────

export type ZoneRsi = 'surachat' | 'survente' | 'neutre';

export interface ResultatRsi extends Lecture {
  points: { date: string; rsi: number | null }[];
  dernier: number;
  zone: ZoneRsi;
  /** Séances passées dans chaque zone sur la fenêtre affichée. */
  repartition: Record<ZoneRsi, number>;
  /** Séances sans échange parmi les `periode` dernières ; null quand les volumes ne sont pas connus. */
  seancesSansEchange: number | null;
  /**
   * Cours inchangé depuis au moins `periode` séances. Avec le lissage de Wilder,
   * hausse et baisse moyennes s'amenuisent alors du même facteur : le RSI garde
   * indéfiniment sa dernière valeur (constaté sur SEMC et SICC en novembre 2026).
   */
  fige: boolean;
}

export function lectureRsi(serie: PointSerie[], periode: number, haut: number, bas: number): ResultatRsi {
  if (!(Number.isInteger(periode) && periode >= 2 && periode <= 50)) throw new SaisieInvalide('La période du RSI doit être comprise entre 2 et 50 séances.');
  if (!(haut > bas && haut <= 95 && bas >= 5)) throw new SaisieInvalide('Le seuil haut doit dépasser le seuil bas (entre 5 et 95).');
  const s = nettoyerSerie(serie);
  if (s.length < periode + 2) throw new SaisieInvalide(`Historique insuffisant : il faut au moins ${periode + 2} séances cotées.`);
  const r = rsiSeries(s.map((p) => p.cours), periode);
  const points = s.map((p, i) => ({ date: p.date, rsi: r[i] ?? null }));
  const dernier = r[r.length - 1]!;
  const zoneDe = (v: number): ZoneRsi => (v >= haut ? 'surachat' : v <= bas ? 'survente' : 'neutre');
  const zone = zoneDe(dernier);
  const repartition: Record<ZoneRsi, number> = { surachat: 0, survente: 0, neutre: 0 };
  for (const v of r) if (v != null) repartition[zoneDe(v)]++;
  const LECT: Record<ZoneRsi, string> = {
    surachat: 'les hausses récentes ont nettement dominé les baisses. « Surachat » ne veut pas dire « trop cher » : le cours a monté vite, rien de plus',
    survente: 'les baisses récentes ont nettement dominé les hausses. « Survente » ne veut pas dire « bon marché » : le cours a baissé vite, rien de plus',
    neutre: 'pas d’excès marqué, ni à la hausse ni à la baisse',
  };
  const total = repartition.surachat + repartition.survente + repartition.neutre;
  const lecture =
    `RSI ${periode} séances : ${nb(dernier, 1)}, zone ${zone} (seuils ${haut} / ${bas}) : ${LECT[zone]}. ` +
    `Sur ${nb(total)} séances mesurées, ${nb(repartition.surachat)} en surachat et ${nb(repartition.survente)} en survente. ` +
    'Une zone extrême décrit l’intensité d’un mouvement récent, pas sa fin.';
  const alertes: string[] = [];
  // BRVM (leçon 4 enrichie, 2026-11-24) : avant de lire un RSI, vérifier qu'il
  // repose sur de vrais échanges.
  const fenetre = s.slice(-periode);
  const volumesConnus = fenetre.every((p) => typeof p.volume === 'number');
  const seancesSansEchange = volumesConnus ? fenetre.filter((p) => !((p.volume as number) > 0)).length : null;
  let k = s.length - 1;
  while (k > 0 && s[k]!.cours === s[k - 1]!.cours) k--;
  const immobiles = s.length - 1 - k;
  const fige = immobiles >= periode;
  if (fige) {
    alertes.push(`Cours inchangé depuis ${nb(immobiles)} séances (depuis le ${dateCourte(s[k]!.date)}) : le RSI reste figé à sa dernière valeur et ne décrit plus aucun mouvement. Vérifiez les échanges avant de le lire.`);
  } else if (seancesSansEchange) {
    alertes.push(`${seancesSansEchange} des ${periode} dernières séances sans échange : le RSI s’y appuie en partie sur des cours immobiles.`);
  }
  if (periode < 7) alertes.push('Sur une période très courte, le RSI passe d’une zone extrême à l’autre au gré de quelques séances : il devient du bruit.');
  if (haut - bas < 30) alertes.push('Des seuils aussi rapprochés classent presque toutes les séances en excès : la zone perd son sens.');
  return { points, dernier, zone, repartition, seancesSansEchange, fige, lecture, alertes };
}

// ── Atelier : le RSI pas à pas (clôtures saisies) ───────────────────────────

export interface LigneRsi {
  seance: number;
  cloture: number;
  /** Variation depuis la clôture précédente (null pour la première séance). */
  variation: number | null;
  hausse: number | null;
  baisse: number | null;
  /** Moyennes lissées : null tant que `periode` variations ne sont pas réunies. */
  moyHausse: number | null;
  moyBaisse: number | null;
  /** Force relative ; null quand aucune baisse (division impossible, RSI = 100). */
  rs: number | null;
  rsi: number | null;
}

export interface ResultatRsiPasAPas extends Lecture {
  lignes: LigneRsi[];
  periode: number;
}

/**
 * Le RSI séance par séance, avec le calcul de WESTBOURSE (rsiSeries, lissage de
 * Wilder) : première moyenne simple des `periode` premières variations, puis
 * moyenne du jour = (moyenne de la veille × (periode − 1) + séance) ÷ periode.
 * Un test vérifie l'égalité avec rsiSeries sur des séries quelconques.
 */
export function rsiPasAPas(clotures: number[], periode: number): ResultatRsiPasAPas {
  if (!(Number.isInteger(periode) && periode >= 2 && periode < clotures.length)) {
    throw new SaisieInvalide(`Un RSI sur ${periode} séances demande au moins ${periode + 1} clôtures (période de 2 à 14).`);
  }
  if (clotures.some((c) => !(Number.isFinite(c) && c > 0))) throw new SaisieInvalide('Chaque clôture doit être un cours positif.');
  let mh = 0;
  let mb = 0;
  const lignes: LigneRsi[] = clotures.map((cloture, i) => {
    if (i === 0) return { seance: 1, cloture, variation: null, hausse: null, baisse: null, moyHausse: null, moyBaisse: null, rs: null, rsi: null };
    const variation = cloture - clotures[i - 1]!;
    const hausse = variation > 0 ? variation : 0;
    const baisse = variation < 0 ? -variation : 0;
    if (i < periode) {
      mh += hausse;
      mb += baisse;
      return { seance: i + 1, cloture, variation, hausse, baisse, moyHausse: null, moyBaisse: null, rs: null, rsi: null };
    }
    if (i === periode) {
      mh = (mh + hausse) / periode;
      mb = (mb + baisse) / periode;
    } else {
      mh = (mh * (periode - 1) + hausse) / periode;
      mb = (mb * (periode - 1) + baisse) / periode;
    }
    const rs = mb === 0 ? null : mh / mb;
    const rsi = mb === 0 ? (mh === 0 ? 50 : 100) : 100 - 100 / (1 + mh / mb);
    return { seance: i + 1, cloture, variation, hausse, baisse, moyHausse: mh, moyBaisse: mb, rs, rsi };
  });
  const d = lignes[lignes.length - 1]!;
  const zone = d.rsi! >= 70 ? 'surachat' : d.rsi! <= 30 ? 'survente' : 'zone neutre';
  let lecture =
    `Un RSI sur ${periode} séances demande ${periode} variations, donc ${periode + 1} clôtures : il apparaît à la séance ${periode + 1}. ` +
    `À la séance ${d.seance}, hausse moyenne ${nb(d.moyHausse!, 2)}, baisse moyenne ${nb(d.moyBaisse!, 2)}` +
    `${d.rs == null ? '' : `, force relative ${nb(d.rs, 2)}`} : RSI ${nb(d.rsi!, 1)} (${zone}).`;
  if (lignes.length > periode + 1) {
    lecture += ` Après la séance ${periode + 1}, chaque nouvelle séance ne pèse que 1/${periode} : moyenne du jour = (moyenne de la veille × ${periode - 1} + séance) ÷ ${periode}. C’est le lissage de Wilder, celui de WESTBOURSE.`;
  }
  if (d.moyBaisse === 0) lecture += ' Aucune baisse sur la période : le RSI vaut 100, quelle que soit l’ampleur des hausses.';
  const alertes: string[] = [];
  if (periode < 7) alertes.push('Sur une période très courte, le RSI passe d’un extrême à l’autre au gré de quelques séances.');
  return { lignes, periode, lecture, alertes };
}

// ── MACD ────────────────────────────────────────────────────────────────────

export type LectureHistogramme = 'positif_croissant' | 'positif_decroissant' | 'negatif_decroissant' | 'negatif_croissant';

export const LECTURE_HISTOGRAMME: Record<LectureHistogramme, string> = {
  positif_croissant: 'positif et croissant : la tendance haussière s’accélère',
  positif_decroissant: 'positif et décroissant : la hausse ralentit',
  negatif_decroissant: 'négatif et décroissant : la tendance baissière s’accélère',
  negatif_croissant: 'négatif et croissant : la baisse ralentit',
};

export interface ResultatMacd extends Lecture {
  points: { date: string; macd: number | null; signal: number | null; hist: number | null }[];
  etat: LectureHistogramme;
  dernier: { macd: number; signal: number; hist: number };
  seancesDepuisCroisement: number | null;
}

export function lectureMacd(serie: PointSerie[], rapide = 12, lente = 26, signal = 9): ResultatMacd {
  if (!(Number.isInteger(rapide) && Number.isInteger(lente) && Number.isInteger(signal) && rapide >= 2 && lente > rapide && lente <= 100 && signal >= 2 && signal <= 50)) {
    throw new SaisieInvalide('Paramètres impossibles : la moyenne rapide doit compter moins de séances que la lente.');
  }
  const s = nettoyerSerie(serie);
  if (s.length < lente + signal + 2) throw new SaisieInvalide(`Historique insuffisant : il faut au moins ${lente + signal + 2} séances cotées.`);
  const m = macdSeries(s.map((p) => p.cours), rapide, lente, signal);
  const points = s.map((p, i) => ({ date: p.date, ...m[i]! }));
  const d = m[m.length - 1]!;
  const p = m[m.length - 2]!;
  if (d.hist == null || p.hist == null || d.macd == null || d.signal == null) throw new SaisieInvalide('Historique insuffisant pour lire l’histogramme.');
  const etat: LectureHistogramme = d.hist >= 0 ? (d.hist >= p.hist ? 'positif_croissant' : 'positif_decroissant') : (d.hist <= p.hist ? 'negatif_decroissant' : 'negatif_croissant');
  let seancesDepuisCroisement: number | null = null;
  for (let i = m.length - 1; i > 0; i--) {
    const a = m[i]!.hist;
    const b = m[i - 1]!.hist;
    if (a == null || b == null) break;
    if (Math.sign(a) !== Math.sign(b)) { seancesDepuisCroisement = m.length - 1 - i; break; }
  }
  let lecture = `Histogramme ${LECTURE_HISTOGRAMME[etat]}. Ligne MACD ${d.macd >= 0 ? 'positive' : 'négative'} : la moyenne courte est ${d.macd >= 0 ? 'au-dessus' : 'en dessous'} de la longue.`;
  if (seancesDepuisCroisement != null) {
    lecture += ` Les lignes MACD et signal se sont croisées il y a ${nb(seancesDepuisCroisement)} séance(s) ; ce croisement hérite du retard des moyennes.`;
  }
  lecture += ` ${CONCLUSION}`;
  const alertes: string[] = [];
  if (rapide !== 12 || lente !== 26 || signal !== 9) alertes.push('Paramètres différents des réglages usuels (12, 26, 9) : la lecture n’est plus comparable à celle des autres outils.');
  return { points, etat, dernier: { macd: d.macd, signal: d.signal, hist: d.hist }, seancesDepuisCroisement, lecture, alertes };
}

// ── Chandelier japonais (hypothèses saisies) ─────────────────────────────────

export type FigureBougie = 'doji' | 'marteau' | 'etoile_filante' | 'haussiere' | 'baissiere';

export interface ResultatBougie extends Lecture {
  corps: number;
  amplitude: number;
  mecheHaute: number;
  mecheBasse: number;
  figure: FigureBougie;
  sens: 'hausse' | 'baisse' | 'neutre';
}

/** Conventions de ce simulateur : doji si corps ≤ 10 % de l'amplitude, mèche « longue » si ≥ 2 fois le corps. */
export const SEUIL_DOJI = 0.1;

const LECTURE_FIGURE: Record<FigureBougie, string> = {
  doji: 'Doji : ouverture et clôture presque égales. Hésitation entre acheteurs et vendeurs.',
  marteau: 'Marteau : petit corps en haut, longue mèche basse. Les vendeurs ont poussé, les acheteurs ont repris le dessus.',
  etoile_filante: 'Étoile filante : petit corps en bas, longue mèche haute. Les acheteurs ont poussé, les vendeurs ont repris le dessus.',
  haussiere: 'Bougie haussière : la clôture dépasse l’ouverture.',
  baissiere: 'Bougie baissière : la clôture est sous l’ouverture.',
};

export function lireBougie(p: { ouverture: number; haut: number; bas: number; cloture: number }): ResultatBougie {
  const { ouverture: o, haut: h, bas: b, cloture: c } = p;
  if (![o, h, b, c].every((x) => Number.isFinite(x) && x > 0)) throw new SaisieInvalide('Les quatre prix doivent être supérieurs à zéro.');
  if (h < Math.max(o, c)) throw new SaisieInvalide('Impossible : le plus haut doit être au moins égal à l’ouverture et à la clôture.');
  if (b > Math.min(o, c)) throw new SaisieInvalide('Impossible : le plus bas doit être au plus égal à l’ouverture et à la clôture.');
  const corps = Math.abs(c - o);
  const amplitude = h - b;
  const mecheHaute = h - Math.max(o, c);
  const mecheBasse = Math.min(o, c) - b;
  const sens = c > o ? 'hausse' : c < o ? 'baisse' : 'neutre';
  let figure: FigureBougie;
  if (amplitude === 0 || corps <= SEUIL_DOJI * amplitude) figure = 'doji';
  else if (mecheBasse >= 2 * corps && mecheHaute <= corps) figure = 'marteau';
  else if (mecheHaute >= 2 * corps && mecheBasse <= corps) figure = 'etoile_filante';
  else figure = sens === 'baisse' ? 'baissiere' : 'haussiere';
  let lecture = LECTURE_FIGURE[figure];
  if (figure === 'haussiere' && mecheHaute >= corps / 2) lecture += ' La mèche haute montre que les vendeurs ont repris une partie de la hausse avant la clôture.';
  if (figure === 'baissiere' && mecheBasse >= corps / 2) lecture += ' La mèche basse montre que les acheteurs ont repris une partie de la baisse avant la clôture.';
  lecture += ' Aucune bougie n’est un signal seule : on attend la séance suivante, et on regarde le volume.';
  const alertes: string[] = [];
  if (amplitude / b > 0.15) alertes.push(`Une amplitude de ${fmtPct((amplitude / b) * 100)} en une séance est très forte pour une action : vérifiez les prix saisis.`);
  return { corps, amplitude, mecheHaute, mecheBasse, figure, sens, lecture, alertes };
}
