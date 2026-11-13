/**
 * Logique PURE des sections 3.7 à 3.11 de l'accueil (PR 2) : rail « Découvrir »,
 * explorateur des quatorze outils, méthode, tuiles de séance, encart publicitaire.
 * Aucune I/O ici : tout est testé (outilsPur.test.ts). Une donnée absente reste
 * `null` et le composant la dit « non disponible » ou se retire.
 */
import { estCheminPremium } from '@/lib/auth/cheminsPremium';
import { entreeParChemin, libelleRubrique } from '@/lib/navRegistre';
import { isPublicPath } from '@/lib/auth/cheminsPublics';
import { sensSignal } from '@/lib/signalLabel';
import { BAREME, PAYS_LABELS, type PaysUemoa } from '@/lib/tax/rates';
import { dividendeNet } from '@/lib/tax/compute';
import { traceSerie } from './seance';
import type { Slide } from '@/lib/landing/slides';
import type { SectorVariation } from '@/lib/landing/sectors';

// ── Accès d'un outil ─────────────────────────────────────────────────────

export type Acces = 'libre' | 'compte' | 'premium';
export const LIBELLE_ACCES: Record<Acces, string> = { libre: 'Accès libre', compte: 'Compte gratuit', premium: 'Premium' };

/**
 * Niveau d'accès d'une page, LU dans le registre de navigation (`premium`) et
 * dans la liste des chemins publics du middleware, jamais supposé. Tout
 * `/premium/*` est gardé par le middleware, même sans drapeau au registre.
 */
export function accesOutil(chemin: string): Acces {
  if (entreeParChemin(chemin)?.premium || estCheminPremium(chemin)) return 'premium';
  if (isPublicPath(chemin)) return 'libre';
  return 'compte';
}

/** Rubrique du menu d'une page (« Trouver une idée »), ou null hors registre. */
export function rubriqueOutil(chemin: string): string | null {
  return libelleRubrique(entreeParChemin(chemin)?.rubrique);
}

// ── Les quatorze outils ──────────────────────────────────────────────────

export type OutilId =
  | 'screener' | 'scanner' | 'signaux' | 'saison' | 'alpha' | 'backtest' | 'liquidite'
  | 'dividendes' | 'fiscalite' | 'simulateur' | 'virtuel' | 'valorisation' | 'diagnostic' | 'question';

export interface Outil {
  id: OutilId;
  /** Libellé de l'onglet. */
  nom: string;
  /** Titre du panneau, puis groupe final en italique. */
  titre: string;
  accent: string;
  route: string;
  description: string;
  lien: string;
}

export const OUTILS: Outil[] = [
  { id: 'screener', nom: 'Screener', titre: 'Screener', accent: 'multi-critères.', route: '/screener', description: 'Filtrez les actions par RSI, volume, score, secteur et dividende. Essayez les trois filtres ci-contre.', lien: 'Ouvrir le screener' },
  { id: 'scanner', nom: 'Scanner technique', titre: 'Scanner', accent: 'technique.', route: '/scanner', description: 'Combinez RSI, MACD, moyennes mobiles et volume, recalculés à chaque séance.', lien: 'Lancer un scan' },
  { id: 'signaux', nom: 'Signaux', titre: 'Signaux,', accent: 'facteur par facteur.', route: '/signaux', description: 'Une lecture technique recalculée à chaque séance, avec le détail des facteurs qui la composent.', lien: 'Voir les signaux' },
  { id: 'saison', nom: 'Saisonnalité', titre: 'Saisonnalité,', accent: 'mois par mois.', route: '/saisonnalite', description: "L'habitude d'un titre selon le mois, et sa fiabilité mesurée.", lien: 'Explorer les saisons' },
  { id: 'alpha', nom: 'Combined Alpha', titre: 'Combined Alpha,', accent: 'un score sur 100.', route: '/analyse/combined-alpha', description: 'Un seul score pour comparer les actions : valorisation, momentum, qualité, solidité, dividende.', lien: 'Voir le classement' },
  { id: 'backtest', nom: 'Backtest', titre: 'Backtest,', accent: "rejouer avant d'agir.", route: '/backtest', description: "Rejouez une règle sur l'historique d'un titre, sur un mois, trois mois, six mois ou un an.", lien: 'Lancer un backtest' },
  { id: 'liquidite', nom: 'Liquidité', titre: 'Liquidité', accent: 'du marché.', route: '/liquidite', description: 'Peut-on vraiment traiter ce titre ? Un score de 0 à 100 et une classe de A à D pour chaque valeur.', lien: 'Voir les scores' },
  { id: 'dividendes', nom: 'Dividendes', titre: 'Dividendes,', accent: 'dates et rendements.', route: '/dividendes', description: 'Prochains détachements, rendements du dernier exercice et historique des distributions.', lien: 'Voir les dividendes' },
  { id: 'fiscalite', nom: 'Fiscalité', titre: 'Fiscalité,', accent: 'le net par pays.', route: '/fiscalite', description: "L'IRVM (impôt sur le revenu des valeurs mobilières) dépend du pays de l'émetteur. Choisissez-en un pour voir le net.", lien: 'Calculer mon net' },
  { id: 'simulateur', nom: 'Et si vous aviez investi ?', titre: 'Et si vous aviez', accent: 'investi ?', route: '/simulateur', description: "Ce qu'un placement passé dans une société cotée aurait donné, dividendes inclus.", lien: 'Ouvrir le simulateur' },
  { id: 'virtuel', nom: 'Portefeuille virtuel', titre: 'Portefeuille', accent: 'virtuel.', route: '/premium/paper-trading', description: "Entraînez-vous avec un capital fictif, aux cours réels de la séance, avant d'engager le vôtre.", lien: 'Créer mon portefeuille virtuel' },
  { id: 'valorisation', nom: 'Valorisation', titre: 'Valorisation,', accent: 'par les multiples.', route: '/premium/valorisation', description: 'Valeur estimée par multiples sectoriels et dividendes actualisés, à comparer au cours.', lien: 'Voir la valorisation' },
  { id: 'diagnostic', nom: 'Diagnostic', titre: 'Diagnostic', accent: "d'une société.", route: '/premium/diagnostic', description: 'Une analyse rédigée à partir des états financiers publiés, contrôlée avant publication.', lien: 'Lire un diagnostic' },
  { id: 'question', nom: 'Poser une question', titre: 'Poser', accent: 'une question.', route: '/assistant', description: 'Interrogez le marché, une valeur ou votre portefeuille : les réponses partent des données de la plateforme.', lien: 'Poser une question' },
];

/** Comptes par accès (« Dix outils en accès libre ou avec un compte gratuit… »), dérivés, jamais écrits. */
export function comptesAcces(outils: Outil[] = OUTILS): Record<Acces, number> {
  const c: Record<Acces, number> = { libre: 0, compte: 0, premium: 0 };
  for (const o of outils) c[accesOutil(o.route)]++;
  return c;
}

// ── Navigation et rotation de l'explorateur ──────────────────────────────

/** Onglet voisin au clavier (flèches, Début, Fin) ; null pour toute autre touche. */
export function ongletVoisin(i: number, touche: string, n: number): number | null {
  if (n <= 0) return null;
  if (touche === 'ArrowRight') return (i + 1) % n;
  if (touche === 'ArrowLeft') return (i - 1 + n) % n;
  if (touche === 'Home') return 0;
  if (touche === 'End') return n - 1;
  return null;
}

/**
 * Un pas de la rotation automatique (toutes les 6 s). Elle s'arrête d'elle-même
 * après `tours` tours complets (charte §10 : deux tours puis arrêt).
 */
export function apresTic(index: number, rotations: number, n: number, tours = 2): { index: number; rotations: number; arrete: boolean } {
  if (n <= 0) return { index: 0, rotations, arrete: true };
  const r = rotations + 1;
  return { index: (index + 1) % n, rotations: r, arrete: r >= n * tours };
}

/** La rotation ne tourne que visible, jamais après une interaction ni sous mouvement réduit. */
export function doitTourner(o: { visible: boolean; arrete: boolean; calme: boolean }): boolean {
  return o.visible && !o.arrete && !o.calme;
}

// ── Méthode en sept étapes ───────────────────────────────────────────────

/**
 * Étape allumée à l'instant t (ms) : chacune à son tour, `tours` fois, puis
 * arrêt (`fini`, plus aucune étape « active » : toutes reviennent allumées).
 * `trait` : position du trait lumineux sur la ligne, 0..1.
 */
export function etatMethode(tMs: number, n: number, pasMs: number, tours = 2): { active: number | null; trait: number; fini: boolean } {
  if (n <= 0 || pasMs <= 0 || !(tMs >= 0)) return { active: null, trait: 1, fini: true };
  const cycle = n * pasMs;
  if (tMs >= cycle * tours) return { active: null, trait: 1, fini: true };
  const dans = tMs % cycle;
  return { active: Math.floor(dans / pasMs), trait: dans / cycle, fini: false };
}

// ── Données de séance : garde-fous ───────────────────────────────────────

/**
 * Coupe une série de clôtures (chronologique) après sa dernière rupture : un
 * écart d'une séance à l'autre au-delà de `seuil` (40 %) ne peut pas être un
 * mouvement de marché à la BRVM (variation plafonnée par séance) ; c'est une
 * opération sur titres, un fractionnement par exemple. Calculer un RSI à
 * travers elle fabriquerait un chiffre faux.
 */
export function serieSansRupture(closes: number[], seuil = 0.4): number[] {
  const propres = closes.filter((c) => Number.isFinite(c) && c > 0);
  let debut = 0;
  for (let i = 1; i < propres.length; i++) {
    if (Math.abs(propres[i] / propres[i - 1] - 1) > seuil) debut = i;
  }
  return propres.slice(debut);
}

// ── Screener ─────────────────────────────────────────────────────────────

export type FiltreScreener = 'div' | 'liq' | 'rsi';
export const FILTRES_SCREENER: { id: FiltreScreener; libelle: string }[] = [
  { id: 'div', libelle: 'Dividende > 3 %' },
  { id: 'liq', libelle: 'Liquidité A ou B' },
  { id: 'rsi', libelle: 'RSI < 45' },
];

export interface LigneScreener { code: string; cours: number | null; rsi: number | null; rendement: number | null; classe: string | null }

/** Une donnée absente ne passe pas un filtre qui la demande : on ne présume rien. */
export function filtrerScreener(lignes: LigneScreener[], actifs: FiltreScreener[]): LigneScreener[] {
  return lignes.filter((l) =>
    (!actifs.includes('div') || (l.rendement != null && l.rendement > 3)) &&
    (!actifs.includes('liq') || l.classe === 'A' || l.classe === 'B') &&
    (!actifs.includes('rsi') || (l.rsi != null && l.rsi < 45)),
  );
}

// ── Signaux ──────────────────────────────────────────────────────────────

export interface Repartition { haussier: number; neutre: number; baissier: number }

export function repartitionSignaux(signaux: { signal: string | null }[]): Repartition {
  const r: Repartition = { haussier: 0, neutre: 0, baissier: 0 };
  for (const s of signaux) {
    const sens = sensSignal(s.signal);
    if (sens) r[sens]++;
  }
  return r;
}

// ── Saisonnalité ─────────────────────────────────────────────────────────

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
export interface CelluleSaison { mois: string; mediane: number | null; part: number | null; n: number; verdict: 'etabli' | 'indicatif' | 'hasard' }

/** Grille des douze mois : médiane en %, part des années en hausse ; null sans année observée. */
export function grilleSaison(matrice: { month: number; medianReturn: number; bullPct: number; n: number; verdict: 'etabli' | 'indicatif' | 'hasard' }[]): CelluleSaison[] {
  return MOIS.map((mois, i) => {
    const m = matrice.find((x) => x.month === i + 1);
    if (!m || m.n === 0) return { mois, mediane: null, part: null, n: 0, verdict: 'hasard' };
    return { mois, mediane: m.medianReturn * 100, part: m.bullPct, n: m.n, verdict: m.verdict };
  });
}

// ── Indice : périodes et performance ─────────────────────────────────────

export interface PeriodeIndice { libelle: string; debut: string; fin: string; variation: number; trace: string }
const PERIODES = [
  { libelle: '1 mois', points: 21 },
  { libelle: '3 mois', points: 63 },
  { libelle: '6 mois', points: 126 },
  { libelle: '1 an', points: 250 },
];

/** Périodes rejouables sur la série réelle de l'indice ; une période plus longue que la série est retirée. */
export function periodesIndice(serie: { d: string; v: number }[]): PeriodeIndice[] {
  const pts = serie.filter((p) => Number.isFinite(p.v) && p.v > 0);
  return PERIODES.filter((p) => pts.length >= p.points).map((p) => {
    const s = pts.slice(-p.points);
    return { libelle: p.libelle, debut: s[0].d, fin: s[s.length - 1].d, variation: (s[s.length - 1].v / s[0].v - 1) * 100, trace: traceSerie(s.map((x) => x.v)) };
  });
}

/** Variation d'une série de bout en bout, avec son nombre de séances ; null sous deux points. */
export function perfSerie(serie: { d: string; v: number }[]): { variation: number; seances: number; debut: string; fin: string } | null {
  const pts = serie.filter((p) => Number.isFinite(p.v) && p.v > 0);
  if (pts.length < 2) return null;
  return { variation: (pts[pts.length - 1].v / pts[0].v - 1) * 100, seances: pts.length, debut: pts[0].d, fin: pts[pts.length - 1].d };
}

// ── Fiscalité ────────────────────────────────────────────────────────────

export interface LigneFiscale { pays: PaysUemoa; nom: string; taux: number | null; retenue: number | null; net: number | null }

/**
 * Retenue et net pour un brut donné, pays par pays, depuis le barème vérifié
 * (`lib/tax/rates`). Un taux non confirmé reste non confirmé : `taux` null.
 */
export function fiscaliteParPays(brut = 100_000): LigneFiscale[] {
  return (Object.keys(BAREME) as PaysUemoa[])
    .map((pays) => {
      const r = dividendeNet(brut, pays);
      const nom = PAYS_LABELS[pays];
      return r.indisponible ? { pays, nom, taux: null, retenue: null, net: null } : { pays, nom, taux: r.taux, retenue: r.impot, net: r.net };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

// ── Dividendes d'une valeur ──────────────────────────────────────────────

export interface LigneDividende { exercice: number | null; montant: number | null; base_fiscale?: string | null }
export interface BarreDividende { exercice: number; montant: number }

/**
 * Montants par exercice d'une valeur. Lignes écartées comme le fait l'agent
 * (audit du 2026-09-08) : sans exercice, montant nul, ou montant égal à l'année.
 * Deux sources pour un même exercice : la plus élevée, jamais la somme.
 */
export function barresDividendes(rows: LigneDividende[], n = 5): BarreDividende[] {
  const parEx = new Map<number, number>();
  for (const r of rows) {
    if (r.exercice == null || r.montant == null || !(r.montant > 0) || r.montant === r.exercice) continue;
    parEx.set(r.exercice, Math.max(parEx.get(r.exercice) ?? 0, r.montant));
  }
  return [...parEx.entries()].sort(([a], [b]) => a - b).slice(-n).map(([exercice, montant]) => ({ exercice, montant }));
}

/** « 4 hausses en 5 exercices », dérivé des barres ; null sous deux exercices. */
export function titreDividendes(barres: BarreDividende[]): string | null {
  if (barres.length < 2) return null;
  let h = 0;
  for (let i = 1; i < barres.length; i++) if (barres[i].montant > barres[i - 1].montant) h++;
  const ex = `${barres.length} exercices`;
  return h === 0 ? `Aucune hausse en ${ex}.` : `${h} hausse${h > 1 ? 's' : ''} en ${ex}.`;
}

// ── Secteurs ─────────────────────────────────────────────────────────────

export interface BarreSecteur { secteur: string; variation: number; part: number }

/** Secteurs triés de la plus forte hausse à la plus forte baisse ; `part` = |variation| / max, 0..1. */
export function barresSecteurs(secteurs: SectorVariation[]): BarreSecteur[] {
  const max = Math.max(0, ...secteurs.map((s) => Math.abs(s.variation_pct)));
  return [...secteurs]
    .sort((a, b) => b.variation_pct - a.variation_pct)
    .map((s) => ({ secteur: s.secteur, variation: s.variation_pct, part: max > 0 ? Math.abs(s.variation_pct) / max : 0 }));
}

/** Titre de la tuile secteurs, dérivé du classement. */
export function titreSecteurs(barres: BarreSecteur[]): string | null {
  if (barres.length === 0) return null;
  const premier = barres[0];
  return premier.variation > 0 ? `${premier.secteur} en tête.` : 'Aucun secteur en hausse.';
}

// ── Encart publicitaire ──────────────────────────────────────────────────

/** Campagnes d'annonceurs seules (`kind === 'ad'`, image présente), sans doublon. Les annonces maison n'y vont pas. */
export function campagnesPub(slides: Slide[], bandeaux: Slide[]): Slide[] {
  const vus = new Set<string>();
  return [...slides, ...bandeaux].filter((s) => {
    if (s.kind !== 'ad' || !s.imageUrl || vus.has(s.id)) return false;
    vus.add(s.id);
    return true;
  });
}

// ── Événement : réaction mesurée ─────────────────────────────────────────

/** Horizons effectivement mesurés (J+1, J+3…) d'une étude d'événement. */
export function horizonsMesures(horizons: Record<string, number | null>): { horizon: string; variation: number }[] {
  return Object.entries(horizons)
    .filter((e): e is [string, number] => e[1] != null && Number.isFinite(e[1]))
    .map(([horizon, variation]) => ({ horizon, variation }));
}
