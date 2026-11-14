/**
 * Calendrier des assemblées générales — extraction depuis le Bulletin Officiel
 * de la Cote. Module pur.
 *
 * Pourquoi : jusqu'ici, une AG n'existait chez nous que par l'avis de
 * convocation publié par la société, daté du jour de sa PUBLICATION. L'agenda
 * du tableau de bord laissait donc les assemblées vides (« tant qu'aucune date
 * de RÉUNION n'est collectée »). Le bulletin publie, lui, la date, l'heure, la
 * nature et le lieu de chaque AG de l'année.
 *
 * Forme de la page (bulletin du 22/09/2026, pages 17-18) :
 *   - le bandeau « CALENDRIER DES ASSEMBLEES GENERALES » est une IMAGE, pas du
 *     texte : la page se reconnaît à « ANNEE : 2026 » suivi de l'en-tête
 *     « Société  Nature  Date  Heure  Lieu » ;
 *   - le tableau continue sur la page suivante SANS en-tête : une page de suite
 *     se reconnaît à des lignes portant une date et une heure aux abscisses des
 *     colonnes Date et Heure ;
 *   - un lieu long continue sur les lignes suivantes, dans la colonne Lieu.
 *
 * La liste est CUMULATIVE sur l'année : chaque bulletin reprend toutes les AG
 * de l'année. Un seul bulletin récent couvre donc toute l'année en cours.
 */
import type { FragmentPdf } from '../carnet/parse.js';
import { cellules, cle, colonnesSi, dateFr, estNumeroDePage, joindre, lignes, type Colonne } from './tableau.js';

export const ENTETE_AG = ['Société', 'Nature', 'Date', 'Heure', 'Lieu'] as const;

export type NatureAg = 'ordinaire' | 'extraordinaire' | 'mixte' | 'autre';

export interface LigneAg {
  /** Nom tel que publié (« SONATEL », « BANK OF AFRICA CI »). */
  societe: string;
  /** Libellé tel que publié (« Ordinaire »). */
  nature: string;
  natureCle: NatureAg;
  /** Date de la RÉUNION, ISO. */
  date: string;
  /** « 15:00:00 », ou null si la cellule est vide ou illisible. */
  heure: string | null;
  lieu: string | null;
  /** Année du bloc « ANNEE : AAAA » qui précède la ligne, si présente. */
  annee: number | null;
}

export interface ResultatAg {
  lignes: LigneAg[];
  /** Pages lues (numérotées à partir de 1), pour le rapport. */
  pages: number[];
  /** Lignes que l'on n'a pas su interpréter : nommées, jamais devinées. */
  rejets: string[];
}

export function natureCle(nature: string): NatureAg {
  const n = cle(nature);
  if (n.includes('MIXTE')) return 'mixte';
  const ord = /\bORDINAIRE\b/.test(n);
  const ext = n.includes('EXTRAORDINAIRE');
  if (ord && ext) return 'mixte';
  if (ext) return 'extraordinaire';
  if (ord) return 'ordinaire';
  return 'autre';
}

function heureValide(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  const sec = Number(m[3] ?? '0');
  if (h > 23 || mn > 59 || sec > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}:${String(sec).padStart(2, '0')}`;
}

const ANNEE = /^ANNEE\s*:\s*(\d{4})$/;

/** Une ligne de données porte une date valide dans la colonne Date. */
function estLigneDeDonnees(c: string[]): boolean {
  return dateFr(c[2] ?? '') != null;
}

/**
 * Extrait le calendrier des AG d'un bulletin, toutes pages confondues.
 * `pages[i]` contient les fragments de la page i+1.
 */
export function parseAssemblees(pages: readonly FragmentPdf[][]): ResultatAg {
  const res: ResultatAg = { lignes: [], pages: [], rejets: [] };
  let colonnes: Colonne[] | null = null;
  let annee: number | null = null;
  let courante: LigneAg | null = null;

  const clore = () => {
    if (courante) res.lignes.push(courante);
    courante = null;
  };

  for (let p = 0; p < pages.length; p++) {
    const ls = lignes(pages[p]!);
    // Page d'en-tête : « ANNEE : AAAA » puis la ligne d'en-tête du tableau.
    let debut = -1;
    for (let i = 0; i < ls.length; i++) {
      const a = ANNEE.exec(cle(ls[i]!.texte));
      if (a) annee = Number(a[1]);
      const c = colonnesSi(ls[i]!, ENTETE_AG);
      if (c) {
        clore();
        colonnes = c;
        debut = i + 1;
        break;
      }
    }
    if (debut < 0) {
      // Page de suite ? Seulement si le tableau est ouvert ET que la page porte
      // au moins une ligne de données aux positions connues.
      if (!colonnes || res.pages[res.pages.length - 1] !== p) {
        clore();
        if (res.pages.length > 0 && colonnes) break; // le tableau est terminé
        continue;
      }
      const cols: Colonne[] = colonnes;
      if (!ls.some((l) => estLigneDeDonnees(cellules(l, cols)))) {
        clore();
        break;
      }
      debut = 0;
    }

    const cols: Colonne[] = colonnes!;
    res.pages.push(p + 1);
    let vuDonnees = false;
    for (let i = debut; i < ls.length; i++) {
      const l = ls[i]!;
      if (estNumeroDePage(l)) continue;
      const c = cellules(l, cols);
      if (estLigneDeDonnees(c)) {
        clore();
        vuDonnees = true;
        const heureBrute = c[3] ?? '';
        const heure = heureValide(heureBrute);
        if (c[0] === '' || c[1] === '') {
          res.rejets.push(`page ${p + 1} : société ou nature absente — « ${l.texte} »`);
          continue;
        }
        if (heureBrute !== '' && heure == null) {
          res.rejets.push(`page ${p + 1} : heure illisible « ${heureBrute} » — ${c[0]}`);
        }
        courante = {
          societe: c[0]!,
          nature: c[1]!,
          natureCle: natureCle(c[1]!),
          date: dateFr(c[2]!)!,
          heure,
          lieu: c[4] ? c[4] : null,
          annee,
        };
        continue;
      }
      // Avant la première ligne de données d'une page de suite : la date de
      // séance en tête de page, rien d'autre.
      if (!vuDonnees) continue;
      if (!courante) continue;
      const cur: LigneAg = courante;
      // Ligne de suite : le lieu (et, rarement, un nom de société) continuent.
      if (c[1] !== '' || c[2] !== '' || c[3] !== '') {
        res.rejets.push(`page ${p + 1} : ligne de suite inattendue « ${l.texte} »`);
        continue;
      }
      if (c[0] !== '') cur.societe = joindre(cur.societe, c[0]!);
      if (c[4] !== '') cur.lieu = joindre(cur.lieu, c[4]!);
    }
    clore();
  }
  clore();
  return res;
}
