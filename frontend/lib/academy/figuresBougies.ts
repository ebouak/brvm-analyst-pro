/**
 * Repérage des figures de chandeliers sur une suite de séances (2026-11-24).
 *
 * PUR et SANS IMPORT : ce fichier est aussi chargé tel quel par Node (types
 * effacés) pour calculer les statistiques de la leçon 2 du niveau 3. Ne pas y
 * ajouter d’import ni de syntaxe TypeScript non effaçable (enum, namespace…).
 *
 * Les règles sont écrites dans la leçon, à l’identique :
 *  - une bougie à une figure reprend les seuils de `lireBougie` (simTechnique) :
 *    doji si le corps fait au plus 10 % de l’amplitude ; mèche « longue » si
 *    elle mesure au moins deux fois le corps ;
 *  - « grande » bougie : corps d’au moins 1 % du cours d’ouverture ET d’au
 *    moins la moitié de l’amplitude de la séance ;
 *  - « petite » bougie : corps d’au plus 30 % de celui de la grande bougie de
 *    référence ;
 *  - aucun écart d’ouverture (gap) n’est exigé : à la BRVM, l’ouverture est
 *    souvent égale à la clôture de la veille, la définition classique ne
 *    s’y rencontrerait presque jamais.
 * Une séance sans échange (volume nul) ou sans ouverture/plus haut/plus bas
 * publiés n’est jamais lue comme une figure : elle ne contient rien.
 */

export interface BougieSeance {
  date: string;
  ouverture: number | null;
  haut: number | null;
  bas: number | null;
  cloture: number;
  volume?: number | null;
}

export type FigureNom =
  | 'doji'
  | 'marteau'
  | 'etoile_filante'
  | 'avalement_haussier'
  | 'avalement_baissier'
  | 'harami'
  | 'etoile_du_matin'
  | 'etoile_du_soir'
  | 'trois_soldats'
  | 'trois_corbeaux';

export type LectureFigure = 'haussiere' | 'baissiere' | 'indecision' | 'ralentissement';

export interface FigureReperee {
  figure: FigureNom;
  /** Index de la première et de la dernière séance de la figure. */
  debut: number;
  fin: number;
  /** Date de la dernière séance de la figure. */
  date: string;
  nb: 1 | 2 | 3;
  lecture: LectureFigure;
}

export const SEUILS_BOUGIES = {
  doji: 0.1,
  grandCorpsPctCours: 1,
  grandCorpsPartAmplitude: 0.5,
  petitCorpsRatio: 0.3,
  /** Trois soldats / trois corbeaux : corps d’au moins 0,5 % du cours chacun. */
  soldatCorpsPctCours: 0.5,
} as const;

export const FIGURES: Record<FigureNom, { libelle: string; nb: 1 | 2 | 3; lecture: LectureFigure }> = {
  doji: { libelle: 'Doji', nb: 1, lecture: 'indecision' },
  marteau: { libelle: 'Marteau', nb: 1, lecture: 'haussiere' },
  etoile_filante: { libelle: 'Étoile filante', nb: 1, lecture: 'baissiere' },
  avalement_haussier: { libelle: 'Avalement haussier', nb: 2, lecture: 'haussiere' },
  avalement_baissier: { libelle: 'Avalement baissier', nb: 2, lecture: 'baissiere' },
  harami: { libelle: 'Harami', nb: 2, lecture: 'ralentissement' },
  etoile_du_matin: { libelle: 'Étoile du matin', nb: 3, lecture: 'haussiere' },
  etoile_du_soir: { libelle: 'Étoile du soir', nb: 3, lecture: 'baissiere' },
  trois_soldats: { libelle: 'Trois soldats blancs', nb: 3, lecture: 'haussiere' },
  trois_corbeaux: { libelle: 'Trois corbeaux noirs', nb: 3, lecture: 'baissiere' },
};

interface B { o: number; h: number; b: number; c: number }

/** Bougie exploitable : quatre prix publiés, cohérents, et des échanges. */
export function bougieExploitable(s: BougieSeance): boolean {
  const { ouverture: o, haut: h, bas: b, cloture: c } = s;
  if (o == null || h == null || b == null) return false;
  if (![o, h, b, c].every((x) => Number.isFinite(x) && x > 0)) return false;
  if (h < Math.max(o, c) || b > Math.min(o, c)) return false;
  if (s.volume != null && s.volume <= 0) return false;
  return true;
}

const corps = (x: B) => Math.abs(x.c - x.o);
const amplitude = (x: B) => x.h - x.b;
const hausse = (x: B) => x.c > x.o;
const baisse = (x: B) => x.c < x.o;
const grande = (x: B) =>
  corps(x) >= (SEUILS_BOUGIES.grandCorpsPctCours / 100) * x.o && corps(x) >= SEUILS_BOUGIES.grandCorpsPartAmplitude * amplitude(x);
const petite = (x: B, ref: B) => corps(x) <= SEUILS_BOUGIES.petitCorpsRatio * corps(ref);
const milieu = (x: B) => (x.o + x.c) / 2;

/** Figure à une bougie, mêmes seuils que lireBougie ; null pour une bougie ordinaire. */
export function figureUneBougie(x: B): FigureNom | null {
  const a = amplitude(x);
  if (a <= 0) return null;
  const k = corps(x);
  const mecheHaute = x.h - Math.max(x.o, x.c);
  const mecheBasse = Math.min(x.o, x.c) - x.b;
  if (k <= SEUILS_BOUGIES.doji * a) return 'doji';
  if (mecheBasse >= 2 * k && mecheHaute <= k) return 'marteau';
  if (mecheHaute >= 2 * k && mecheBasse <= k) return 'etoile_filante';
  return null;
}

export function figureDeuxBougies(p: B, x: B): FigureNom | null {
  if (baisse(p) && hausse(x) && x.c >= p.o && x.o <= p.c && corps(x) > corps(p)) return 'avalement_haussier';
  if (hausse(p) && baisse(x) && x.o >= p.c && x.c <= p.o && corps(x) > corps(p)) return 'avalement_baissier';
  if (grande(p) && corps(x) <= 0.5 * corps(p) && Math.max(x.o, x.c) <= Math.max(p.o, p.c) && Math.min(x.o, x.c) >= Math.min(p.o, p.c)) return 'harami';
  return null;
}

export function figureTroisBougies(a: B, b: B, c: B): FigureNom | null {
  // Étoile du matin : grande baissière, petit corps dans le bas du corps précédent,
  // puis haussière qui clôture au-dessus du milieu du corps de la première.
  if (grande(a) && baisse(a) && petite(b, a) && Math.max(b.o, b.c) <= milieu(a) && hausse(c) && c.c > milieu(a)) return 'etoile_du_matin';
  if (grande(a) && hausse(a) && petite(b, a) && Math.min(b.o, b.c) >= milieu(a) && baisse(c) && c.c < milieu(a)) return 'etoile_du_soir';
  // Trois soldats blancs : trois haussières à corps dominant, clôtures croissantes,
  // chacune ouvrant dans le corps de la précédente ou à sa clôture.
  const pleine = (x: B) =>
    corps(x) >= SEUILS_BOUGIES.grandCorpsPartAmplitude * amplitude(x) && corps(x) >= (SEUILS_BOUGIES.soldatCorpsPctCours / 100) * x.o;
  if ([a, b, c].every((x) => hausse(x) && pleine(x)) && b.c > a.c && c.c > b.c && b.o >= a.o && b.o <= a.c && c.o >= b.o && c.o <= b.c) return 'trois_soldats';
  if ([a, b, c].every((x) => baisse(x) && pleine(x)) && b.c < a.c && c.c < b.c && b.o <= a.o && b.o >= a.c && c.o <= b.o && c.o >= b.c) return 'trois_corbeaux';
  return null;
}

/**
 * Repère, à chaque séance, la figure la plus longue qui s’y termine (trois
 * bougies, sinon deux, sinon une). Une figure n’enjambe jamais une séance
 * inexploitable, et une même figure ne réutilise jamais une séance d’un
 * repérage précédent : cinq baisses de suite font UN « trois corbeaux », pas trois.
 */
export function repererFigures(seances: BougieSeance[]): FigureReperee[] {
  const ok = seances.map(bougieExploitable);
  const v = seances.map((s): B => ({ o: s.ouverture ?? s.cloture, h: s.haut ?? s.cloture, b: s.bas ?? s.cloture, c: s.cloture }));
  const out: FigureReperee[] = [];
  const derniereFin = new Map<FigureNom, number>();
  const libre = (f: FigureNom, debut: number) => debut > (derniereFin.get(f) ?? -1);
  for (let i = 0; i < seances.length; i += 1) {
    if (!ok[i]) continue;
    let figure: FigureNom | null = null;
    let debut = i;
    if (i >= 2 && ok[i - 1] && ok[i - 2]) {
      const f = figureTroisBougies(v[i - 2]!, v[i - 1]!, v[i]!);
      if (f && libre(f, i - 2)) { figure = f; debut = i - 2; }
    }
    if (!figure && i >= 1 && ok[i - 1]) {
      const f = figureDeuxBougies(v[i - 1]!, v[i]!);
      if (f && libre(f, i - 1)) { figure = f; debut = i - 1; }
    }
    if (!figure) {
      const f = figureUneBougie(v[i]!);
      if (f) figure = f;
    }
    if (figure) {
      derniereFin.set(figure, i);
      out.push({ figure, debut, fin: i, date: seances[i]!.date, nb: FIGURES[figure].nb, lecture: FIGURES[figure].lecture });
    }
  }
  return out;
}

const DESCRIPTION: Record<FigureNom, string> = {
  doji: 'ouverture et clôture presque égales : acheteurs et vendeurs se sont neutralisés.',
  marteau: 'les vendeurs ont fait baisser le cours, les acheteurs l’ont fait remonter avant la clôture.',
  etoile_filante: 'les acheteurs ont fait monter le cours, les vendeurs l’ont fait redescendre avant la clôture.',
  avalement_haussier: 'une séance haussière dont le corps englobe celui de la séance baissière précédente.',
  avalement_baissier: 'une séance baissière dont le corps englobe celui de la séance haussière précédente.',
  harami: 'une petite séance contenue dans le corps d’une grande : le mouvement s’essouffle.',
  etoile_du_matin: 'une grande baisse, une séance hésitante, puis une hausse qui reprend plus de la moitié de la baisse.',
  etoile_du_soir: 'une grande hausse, une séance hésitante, puis une baisse qui efface plus de la moitié de la hausse.',
  trois_soldats: 'trois hausses franches de suite, chacune clôturant plus haut que la précédente.',
  trois_corbeaux: 'trois baisses franches de suite, chacune clôturant plus bas que la précédente.',
};

export interface PrixBougie { ouverture: number; haut: number; bas: number; cloture: number }

/**
 * Atelier : nomme la figure que forment des bougies FICTIVES (de deux à cinq),
 * en lisant d’abord les trois dernières, puis les deux dernières, puis la
 * dernière. Lève une Error en français si une bougie est impossible.
 */
export function lireFigureFictive(bougies: PrixBougie[]): { figure: FigureNom | null; lecture: string; alertes: string[] } {
  if (bougies.length < 2) throw new Error('Il faut au moins deux bougies.');
  bougies.forEach((x, i) => {
    if (![x.ouverture, x.haut, x.bas, x.cloture].every((v) => Number.isFinite(v) && v > 0)) throw new Error(`Bougie ${i + 1} : les quatre prix doivent être supérieurs à zéro.`);
    if (x.haut < Math.max(x.ouverture, x.cloture)) throw new Error(`Bougie ${i + 1} : le plus haut doit être au moins égal à l’ouverture et à la clôture.`);
    if (x.bas > Math.min(x.ouverture, x.cloture)) throw new Error(`Bougie ${i + 1} : le plus bas doit être au plus égal à l’ouverture et à la clôture.`);
  });
  const v = bougies.map((x): B => ({ o: x.ouverture, h: x.haut, b: x.bas, c: x.cloture }));
  const n = v.length;
  const figure = (n >= 3 ? figureTroisBougies(v[n - 3]!, v[n - 2]!, v[n - 1]!) : null)
    ?? figureDeuxBougies(v[n - 2]!, v[n - 1]!)
    ?? figureUneBougie(v[n - 1]!);
  const lecture = figure
    ? `${FIGURES[figure].libelle} : ${DESCRIPTION[figure]} Une figure décrit ce qui s’est passé ; elle ne dit rien de la séance suivante.`
    : 'Aucune figure reconnue avec les règles de la leçon. Modifiez un prix pour voir à quel moment une figure apparaît.';
  return { figure, lecture, alertes: [] };
}

export interface LectureSeances {
  seances: number;
  exploitables: number;
  sansEchange: number;
  sansPrixComplets: number;
  ouvertureEgaleVeille: number;
  figures: FigureReperee[];
  lecture: string;
  alertes: string[];
}

const nb = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const jour = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Lecture des dernières séances réelles d’une valeur : une description, jamais un conseil. */
export function lireSeances(seances: BougieSeance[]): LectureSeances {
  const sansPrix = seances.filter((s) => s.ouverture == null || s.haut == null || s.bas == null).length;
  const sansEchange = seances.filter((s) => s.volume != null && s.volume <= 0).length;
  const exploitables = seances.filter(bougieExploitable).length;
  let ouvertureEgaleVeille = 0;
  for (let i = 1; i < seances.length; i += 1) {
    const o = seances[i]!.ouverture;
    if (o != null && o === seances[i - 1]!.cloture) ouvertureEgaleVeille += 1;
  }
  const figures = repererFigures(seances);
  const alertes: string[] = [];
  let lecture: string;
  if (exploitables === 0) {
    lecture = sansPrix > 0
      ? 'Ouverture, plus haut et plus bas ne sont pas publiés pour ces séances : aucune bougie ne peut être lue, seulement la clôture.'
      : 'Aucune séance exploitable sur la période : la valeur ne s’est pas échangée.';
  } else {
    const parFigure = new Map<FigureNom, number>();
    for (const f of figures) parFigure.set(f.figure, (parFigure.get(f.figure) ?? 0) + 1);
    const liste = [...parFigure.entries()].map(([f, n]) => `${FIGURES[f].libelle.toLowerCase()} (${nb(n)})`).join(', ');
    const derniere = figures.at(-1);
    lecture = `Sur ${nb(seances.length)} séances, ${nb(exploitables)} bougies sont lisibles. `
      + (figures.length === 0 ? 'Aucune figure n’y est repérée.' : `Figures repérées : ${liste}.`)
      + (derniere ? ` La plus récente : ${FIGURES[derniere.figure].libelle.toLowerCase()}, séance du ${jour(derniere.date)}.` : '')
      + ' Une figure décrit ce qui s’est passé ; elle ne dit rien de la séance suivante.';
  }
  if (sansEchange > 0) alertes.push(`${nb(sansEchange)} séance(s) sans échange : leur bougie est plate et ne contient aucune information.`);
  if (seances.length > 1 && ouvertureEgaleVeille / (seances.length - 1) >= 0.25) {
    alertes.push(`L’ouverture a égalé la clôture de la veille ${nb(ouvertureEgaleVeille)} fois sur ${nb(seances.length - 1)} : à la BRVM, les écarts d’ouverture sont rares.`);
  }
  return { seances: seances.length, exploitables, sansEchange, sansPrixComplets: sansPrix, ouvertureEgaleVeille, figures, lecture, alertes };
}
