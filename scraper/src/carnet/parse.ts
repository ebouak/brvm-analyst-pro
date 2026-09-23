/**
 * Carnet d'ordres de la BRVM — extraction depuis le Bulletin Officiel de la Cote.
 *
 * ── Pourquoi cette source ──
 * `CLAUDE.md` a longtemps noté que « le carnet d'ordres n'étant pas publié par
 * la BRVM, profondeur et coût d'exécution sont estimés, jamais inventés ».
 * C'était faux : la BRVM publie chaque séance un bulletin PDF dont une page
 * porte, par valeur, les quantités résiduelles à l'achat et à la vente et les
 * cours des deux côtés. La profondeur devient donc MESURÉE, et le spread
 * RÉEL — là où `liquidity/compute.ts` l'estime par Roll.
 *
 * ── Ce que fait ce module, et ce qu'il ne fait pas ──
 * Il transforme les fragments de texte d'une page PDF en lignes structurées.
 * Il ne télécharge rien et ne calcule aucun indicateur : fonction pure,
 * testable sur une fixture.
 *
 * ── Le piège de ce PDF ──
 * Les colonnes ne peuvent pas être lues par index : le séparateur « / » tombe
 * tantôt dans la ligne, tantôt sur une ligne à lui seul, et une valeur sans
 * acheteur décale tous les champs suivants. On découpe donc par POSITION
 * HORIZONTALE, les colonnes étant fixes dans le bulletin.
 *
 * Deuxième piège : les nombres mélangent deux conventions dans le même
 * tableau. Les quantités utilisent l'espace comme séparateur de milliers
 * (« 12 790 ») et les cours la virgule (« 3,955 » vaut 3 955 francs, pas
 * 3,955). Lire « 3,955 » comme un décimal donnerait un cours mille fois trop
 * bas, et personne ne le verrait sur un écran.
 */

export interface FragmentPdf {
  /** Abscisse du fragment dans la page (unités PDF). */
  x: number;
  /** Ordonnée : deux fragments de même y appartiennent à la même ligne. */
  y: number;
  texte: string;
}

export interface LigneCarnet {
  code: string;
  designation: string;
  /** Quantité résiduelle à l'achat. `null` = aucun acheteur en attente. */
  qteAchat: number | null;
  /** Cours de la meilleure offre d'achat. `null` si absent ou « au marché ». */
  coursAchat: number | null;
  qteVente: number | null;
  coursVente: number | null;
  /** Ordre « au marché » : sans limite de cours — ce n'est pas un cours nul. */
  achatAuMarche: boolean;
  venteAuMarche: boolean;
  coursReference: number | null;
}

/**
 * Bornes des colonnes, mesurées sur le bulletin. Le séparateur « / » est à
 * x ≈ 355 et sert de pivot entre le côté achat et le côté vente.
 */
const COLONNES = {
  code: [0, 70],
  designation: [70, 245],
  qteAchat: [245, 316],
  coursAchat: [316, 352],
  coursVente: [360, 425],
  qteVente: [425, 525],
  reference: [525, Number.POSITIVE_INFINITY],
} as const;

/** Un code d'instrument : trois à six lettres, éventuellement suffixé (obligations). */
const CODE = /^[A-Z]{3,6}(\.[A-Z0-9]+)?$/;

/**
 * Nombre du bulletin. Les espaces (y compris insécables) et les virgules sont
 * des séparateurs de MILLIERS ; seul le point est décimal. « Marché » et les
 * cellules vides rendent `null` — jamais zéro, qui se lirait comme un cours.
 */
export function nombreBulletin(brut: string | null | undefined): number | null {
  if (brut == null) return null;
  const t = String(brut).replace(/ /g, ' ').trim();
  if (!t || !/\d/.test(t)) return null;
  const n = Number(t.replace(/[\s,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const dansZone = (x: number, [min, max]: readonly [number, number]) => x >= min && x < max;

/**
 * Reconstruit les lignes du carnet à partir des fragments d'une page.
 *
 * Une ligne est retenue seulement si son premier fragment est un code
 * d'instrument placé dans la colonne de gauche : les en-têtes, les pieds de
 * page et les titres de section sont ainsi écartés sans liste à maintenir.
 */
export function parseCarnet(fragments: FragmentPdf[]): LigneCarnet[] {
  const parLigne = new Map<number, FragmentPdf[]>();
  for (const f of fragments) {
    const texte = f.texte.trim();
    if (!texte) continue;
    const y = Math.round(f.y);
    parLigne.set(y, [...(parLigne.get(y) ?? []), { ...f, texte }]);
  }

  const lignes: LigneCarnet[] = [];
  for (const [, bruts] of [...parLigne.entries()].sort((a, b) => b[0] - a[0])) {
    const items = [...bruts].sort((a, b) => a.x - b.x);
    const premier = items[0];
    if (!premier || !CODE.test(premier.texte) || !dansZone(premier.x, COLONNES.code)) continue;

    const reste = items.slice(1).filter((i) => i.texte !== '/');
    const zone = (bornes: readonly [number, number]) =>
      reste.filter((i) => dansZone(i.x, bornes)).map((i) => i.texte).join('');

    const brutAchat = zone(COLONNES.coursAchat);
    const brutVente = zone(COLONNES.coursVente);

    lignes.push({
      code: premier.texte,
      designation: reste.filter((i) => dansZone(i.x, COLONNES.designation)).map((i) => i.texte).join(' ').trim(),
      qteAchat: nombreBulletin(zone(COLONNES.qteAchat)),
      coursAchat: nombreBulletin(brutAchat),
      qteVente: nombreBulletin(zone(COLONNES.qteVente)),
      coursVente: nombreBulletin(brutVente),
      achatAuMarche: /march/i.test(brutAchat),
      venteAuMarche: /march/i.test(brutVente),
      coursReference: nombreBulletin(zone(COLONNES.reference)),
    });
  }
  return lignes;
}

/**
 * Spread affiché en pourcentage du milieu de fourchette.
 *
 * `null` dès qu'un côté manque ou qu'un ordre est « au marché » : un carnet
 * borgne n'a pas de fourchette, et l'inventer donnerait un coût d'exécution
 * rassurant là où il n'y a tout simplement pas de contrepartie.
 */
export function spreadPct(l: Pick<LigneCarnet, 'coursAchat' | 'coursVente' | 'achatAuMarche' | 'venteAuMarche'>): number | null {
  if (l.achatAuMarche || l.venteAuMarche) return null;
  const { coursAchat: a, coursVente: v } = l;
  if (a == null || v == null || a <= 0 || v <= 0 || v < a) return null;
  return ((v - a) / ((v + a) / 2)) * 100;
}
