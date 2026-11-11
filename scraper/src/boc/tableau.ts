/**
 * Lecture générique des tableaux du Bulletin Officiel de la Cote — module pur.
 *
 * Les pages « Calendrier des assemblées générales » et « Informations » sont
 * des tableaux dont les colonnes ont une position horizontale fixe, donnée par
 * la ligne d'en-tête. Une cellule trop longue continue sur une ou plusieurs
 * lignes SOUS la ligne de données, dans la même colonne (un lieu d'AG, l'objet
 * d'un avis). On découpe donc par POSITION, comme le carnet d'ordres
 * (`carnet/parse.ts`), et jamais par index : l'ordre des fragments dans le PDF
 * ne dit rien de leur colonne.
 *
 * Ce module ne sait rien des AG ni des avis : il range des fragments en lignes,
 * et les lignes en cellules.
 */
import type { FragmentPdf } from '../carnet/parse.js';

/** Écart vertical maximal entre deux fragments d'une même ligne (unités PDF). */
const TOLERANCE_LIGNE = 2;
/** Marge à gauche d'une colonne : un fragment commence rarement pile sur l'en-tête. */
const MARGE_COLONNE = 4;

export interface LignePdf {
  y: number;
  fragments: FragmentPdf[];
  /** Texte complet de la ligne, fragments dans l'ordre horizontal. */
  texte: string;
}

export interface Colonne {
  nom: string;
  x: number;
}

/** Espaces multiples, insécables et fines ramenés à une espace simple. */
export function nettoyer(s: string): string {
  return s.replace(/[\s  ]+/g, ' ').trim();
}

/**
 * Recolle une cellule et sa ligne de suite. Un mot coupé en fin de ligne
 * (« Abidjan-⏎Plateau », « ag2026-⏎orangeci@… ») se recolle SANS espace.
 */
export function joindre(a: string | null, b: string): string {
  const g = nettoyer(a ?? '');
  const d = nettoyer(b);
  if (!g) return d;
  if (!d) return g;
  // Seul un trait d'union collé au mot (« Abidjan- ») coupe un mot ; « … - » est un séparateur.
  return /\S-$/.test(g) ? `${g}${d}` : `${g} ${d}`;
}

/** Majuscules sans accents : pour comparer un titre ou un libellé d'en-tête. */
export function cle(s: string): string {
  return nettoyer(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/** Regroupe les fragments en lignes, du haut de la page vers le bas (y décroissant). */
export function lignes(fragments: FragmentPdf[]): LignePdf[] {
  const tries = fragments
    .filter((f) => nettoyer(f.texte) !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const out: LignePdf[] = [];
  for (const f of tries) {
    const derniere = out[out.length - 1];
    if (derniere && Math.abs(derniere.y - f.y) <= TOLERANCE_LIGNE) derniere.fragments.push(f);
    else out.push({ y: f.y, fragments: [f], texte: '' });
  }
  for (const l of out) {
    l.fragments.sort((a, b) => a.x - b.x);
    l.texte = nettoyer(l.fragments.map((f) => f.texte).join(' '));
  }
  return out;
}

/**
 * Colonnes d'une ligne d'en-tête, si elle porte EXACTEMENT les libellés
 * attendus dans cet ordre (comparaison sans accents ni casse). Sinon `null` :
 * on ne reconnaît pas un tableau à moitié.
 *
 * pdfjs rend en général un libellé par fragment ; s'il en coupe un en deux
 * (« N » + « ° »), le texte de la ligne reste identique et chaque colonne
 * commence au premier fragment de son libellé.
 */
export function colonnesSi(ligne: LignePdf, libelles: readonly string[]): Colonne[] | null {
  const attendus = libelles.map(cle);
  const lus = ligne.fragments.map((f) => ({ nom: cle(f.texte), x: f.x }));
  if (lus.length === attendus.length && attendus.every((a, i) => lus[i]!.nom === a)) {
    return lus.map((c, i) => ({ nom: libelles[i]!, x: c.x }));
  }
  if (cle(ligne.texte).replace(/ /g, '') !== attendus.join('').replace(/ /g, '')) return null;
  // Découpage plus fin que les libellés : on avance fragment par fragment.
  const out: Colonne[] = [];
  let k = 0;
  for (let i = 0; i < attendus.length; i++) {
    const cible = attendus[i]!.replace(/ /g, '');
    const debut = lus[k];
    if (!debut) return null;
    let acc = '';
    while (k < lus.length && acc.length < cible.length) acc += lus[k++]!.nom.replace(/ /g, '');
    if (acc !== cible) return null;
    out.push({ nom: libelles[i]!, x: debut.x });
  }
  return k === lus.length ? out : null;
}

/** Indice de la colonne d'un fragment : la plus à droite dont le bord gauche le précède. */
export function colonneDe(x: number, colonnes: readonly Colonne[]): number {
  let i = 0;
  for (let k = 0; k < colonnes.length; k++) if (x + MARGE_COLONNE >= colonnes[k]!.x) i = k;
  return i;
}

/**
 * Cellules d'une ligne, une par colonne ('' si vide). Deux fragments dont l'un
 * commence là où l'autre finit (largeur connue) sont un même mot coupé par le
 * PDF : collés sans espace.
 */
export function cellules(ligne: LignePdf, colonnes: readonly Colonne[]): string[] {
  const parts: FragmentPdf[][] = colonnes.map(() => []);
  for (const f of ligne.fragments) parts[colonneDe(f.x, colonnes)]!.push(f);
  return parts.map((p) => {
    let s = '';
    for (let i = 0; i < p.length; i++) {
      const f = p[i]!;
      const prec = p[i - 1];
      const colle = prec?.largeur != null && f.x - (prec.x + prec.largeur) < 0.5
        && !/\s$/.test(prec.texte) && !/^\s/.test(f.texte);
      s += i === 0 ? f.texte : colle ? f.texte : ` ${f.texte}`;
    }
    return nettoyer(s);
  });
}

/** Numéro de page seul en pied de page (« 17 »). Jamais une donnée. */
export function estNumeroDePage(l: LignePdf): boolean {
  return l.fragments.length === 1 && /^\d{1,3}$/.test(l.texte);
}

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** « 25/09/2026 » → « 2026-09-25 » ; toute date impossible → null. */
export function dateFr(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return isoValide(Number(m[3]), Number(m[2]), Number(m[1]));
}

/** « 25 septembre 2026 », « 1er octobre 2026 » → ISO ; sinon null. */
export function dateLongue(s: string): string | null {
  const m = /^(\d{1,2})(?:er)?\s+([a-zéèêûô]+)\s+(\d{4})$/i.exec(nettoyer(s));
  if (!m) return null;
  const mois = MOIS.indexOf(cle(m[2]!).toLowerCase());
  if (mois < 0) return null;
  return isoValide(Number(m[3]), mois + 1, Number(m[1]));
}

function isoValide(a: number, m: number, j: number): string | null {
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Date de séance portée en tête de chaque page (« mardi 22 septembre 2026 »).
 * Sert à vérifier qu'un PDF est bien le bulletin annoncé par son nom de fichier.
 */
export function dateEnTete(ls: readonly LignePdf[]): string | null {
  for (const l of ls.slice(0, 4)) {
    const m = new RegExp(`^(?:${JOURS.join('|')})\\s+(.+)$`, 'i').exec(cle(l.texte).toLowerCase());
    if (m) {
      const d = dateLongue(m[1]!);
      if (d) return d;
    }
  }
  return null;
}
