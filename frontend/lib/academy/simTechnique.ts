/**
 * Simulateurs techniques des leçons du niveau 3 — fonctions PURES et testées
 * (simTechnique.test.ts). Les indicateurs viennent de lib/indicators (jamais
 * recodés) ; les clôtures sont RÉELLES, lues par /api/academy/serie.
 *
 * Chaque lecture DÉCRIT ce qui s'est passé. Aucune ne prévoit, aucune ne
 * recommande : « au-dessus des moyennes » n'est pas « à acheter ».
 */
import { macdSeries, rsiSeries, smaSeries } from '@/lib/indicators';
import { SaisieInvalide, fmtPct, type Lecture } from './simulateurs';

export interface PointSerie {
  date: string;
  cours: number;
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

export interface ResultatMoyennes extends Lecture {
  points: PointMoyennes[];
  position: PositionMoyennes;
  pente: PenteMoyenne;
  pentePct: number;
  derniere: PointMoyennes;
  /** Séances entre la dernière fois où le cours a croisé la moyenne longue et aujourd'hui (null si jamais). */
  seancesDepuisCroisement: number | null;
}

/** Une moyenne longue qui varie de moins de ±1 % en 10 séances est dite « plate » (convention de ce simulateur). */
export const SEUIL_PENTE_PCT = 1;

export function lectureMoyennes(serie: PointSerie[], courte: number, longue: number): ResultatMoyennes {
  if (!(Number.isInteger(courte) && Number.isInteger(longue) && courte >= 2 && longue > courte && longue <= 200)) {
    throw new SaisieInvalide('La moyenne courte doit compter moins de séances que la longue (2 à 200).');
  }
  const s = nettoyerSerie(serie);
  if (s.length < longue + 10) throw new SaisieInvalide(`Historique insuffisant : il faut au moins ${longue + 10} séances cotées.`);
  const closes = s.map((p) => p.cours);
  const c = smaSeries(closes, courte);
  const l = smaSeries(closes, longue);
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
    'au-dessus des deux': 'le mouvement récent et la tendance de fond vont ensemble vers le haut',
    'sous les deux': 'le mouvement récent et la tendance de fond vont ensemble vers le bas',
    'entre les deux': 'court terme et fond divergent : souvent une phase d’hésitation',
  };
  const PENTE: Record<PenteMoyenne, string> = {
    monte: 'monte : une tendance installée',
    baisse: 'baisse : une tendance de fond orientée vers le bas',
    plate: 'est plate : un marché sans direction, où les croisements perdent leur sens',
  };
  let lecture =
    `Le cours (${fmtFcfa(derniere.cours)}) est ${position} moyennes (${courte} séances : ${fmtFcfa(mc)} ; ${longue} séances : ${fmtFcfa(ml)}) : ${LECT[position]}. ` +
    `La moyenne longue ${PENTE[pente]} (${fmtPct(pentePct)} en 10 séances).`;
  if (seancesDepuisCroisement != null) lecture += ` Le cours a croisé sa moyenne longue il y a ${nb(seancesDepuisCroisement)} séance(s).`;
  lecture += ` ${CONCLUSION}`;
  const alertes: string[] = [];
  if (courte < 5) alertes.push('Une moyenne sur moins de 5 séances suit presque chaque mouvement : elle lisse très peu.');
  return { points, position, pente, pentePct, derniere, seancesDepuisCroisement, lecture, alertes };
}

// ── RSI ─────────────────────────────────────────────────────────────────────

export type ZoneRsi = 'surachat' | 'survente' | 'neutre';

export interface ResultatRsi extends Lecture {
  points: { date: string; rsi: number | null }[];
  dernier: number;
  zone: ZoneRsi;
  /** Séances passées dans chaque zone sur la fenêtre affichée. */
  repartition: Record<ZoneRsi, number>;
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
  if (periode < 7) alertes.push('Sur une période très courte, le RSI passe d’une zone extrême à l’autre au gré de quelques séances : il devient du bruit.');
  if (haut - bas < 30) alertes.push('Des seuils aussi rapprochés classent presque toutes les séances en excès : la zone perd son sens.');
  return { points, dernier, zone, repartition, lecture, alertes };
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
