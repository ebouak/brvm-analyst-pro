/**
 * Page « INFORMATIONS » du Bulletin Officiel de la Cote — module pur.
 *
 * Trois sections, chacune un tableau (bulletin du 22/09/2026, page 10) :
 *   - OPERATIONS EN COURS : Emetteur | Opération
 *       premières cotations, paiements de dividendes ou d'intérêts en cours,
 *       avec leur échéance écrite dans le texte (« le 25/09/2026 ») ;
 *   - AVIS        : Entité | N° | Nature | Objet   (avis de la BRVM, numérotés)
 *   - COMMUNIQUES : Emetteur | N° | Nature | Objet (communiqués des émetteurs)
 *
 * Les opérations en cours sont REPRISES d'un bulletin à l'autre tant qu'elles
 * courent ; les avis sont ceux du jour. Le collecteur garde la première et la
 * dernière date de bulletin où chaque ligne a été vue.
 *
 * Règles de lecture, toutes tirées de la page réelle :
 *   - un titre de section est un texte seul sur sa ligne, reconnu par son nom ;
 *   - un texte long continue sur les lignes suivantes, dans sa colonne ;
 *   - un titre INCONNU (une section que la BRVM ajouterait) est un texte seul
 *     dans la première colonne, séparé de la ligne précédente par un grand
 *     écart vertical : il ferme la section en cours au lieu d'être collé, à
 *     tort, au nom de l'émetteur précédent. Il est nommé dans le rapport.
 */
import type { FragmentPdf } from '../carnet/parse.js';
import {
  cellules, cle, colonnesSi, dateFr, dateLongue, estNumeroDePage, joindre, lignes, nettoyer,
  type Colonne, type LignePdf,
} from './tableau.js';

export type CategorieInfo = 'operation' | 'avis' | 'communique';

export interface LigneOperation {
  emetteur: string;
  operation: string;
  typeOperation: TypeOperation;
  /** Échéance écrite dans le texte (dernière date citée), ISO, ou null. */
  dateOperation: string | null;
}

export interface LigneAvis {
  categorie: 'avis' | 'communique';
  entite: string;
  /** « 277-2026 », ou null si la cellule est vide. */
  numero: string | null;
  nature: string;
  objet: string;
}

export interface ResultatInformations {
  operations: LigneOperation[];
  avis: LigneAvis[];
  pages: number[];
  /** Sections reconnues sur la page, dans l'ordre (pour le rapport). */
  sections: string[];
  rejets: string[];
}

export type TypeOperation =
  | 'premiere_cotation' | 'dividende' | 'interets' | 'remboursement'
  | 'augmentation_capital' | 'fractionnement' | 'offre_publique' | 'radiation' | 'suspension' | 'autre';

const SECTIONS: Record<string, { categorie: CategorieInfo; entete: readonly string[] }> = {
  'OPERATIONS EN COURS': { categorie: 'operation', entete: ['Emetteur', 'Opération'] },
  AVIS: { categorie: 'avis', entete: ['Entité', 'N°', 'Nature', 'Objet'] },
  COMMUNIQUES: { categorie: 'communique', entete: ['Emetteur', 'N°', 'Nature', 'Objet'] },
};

/** Numéro d'avis ou de communiqué : « 277-2026 ». */
const NUMERO = /^\d{1,4}\s*-\s*\d{4}$/;

/** Grand écart vertical : au-delà, une ligne isolée est un titre, pas une suite. */
const ECART_TITRE = 20;

export function typeOperation(texte: string): TypeOperation {
  const t = cle(texte);
  if (/PREMIERE COTATION|INTRODUCTION EN BOURSE/.test(t)) return 'premiere_cotation';
  if (/DIVIDENDE/.test(t)) return 'dividende';
  if (/INTERETS?\b|COUPONS?\b/.test(t)) return 'interets';
  if (/REMBOURSEMENT|AMORTISSEMENT/.test(t)) return 'remboursement';
  if (/AUGMENTATION DE CAPITAL/.test(t)) return 'augmentation_capital';
  if (/FRACTIONNEMENT|SPLIT|REGROUPEMENT/.test(t)) return 'fractionnement';
  if (/\bOPV\b|\bOPA\b|\bOPR\b|\bOPE\b|OFFRE PUBLIQUE/.test(t)) return 'offre_publique';
  if (/RADIATION/.test(t)) return 'radiation';
  if (/SUSPENSION/.test(t)) return 'suspension';
  return 'autre';
}

/**
 * Échéance d'une opération : la DERNIÈRE date écrite après « le », numérique
 * (« le 25/09/2026 ») ou en toutes lettres (« le 25 septembre 2026 »).
 * Les millésimes d'un emprunt (« 2026-2031 ») ne sont pas des dates.
 */
export function echeance(texte: string): string | null {
  const t = nettoyer(texte);
  let trouvee: string | null = null;
  const re = /\ble\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}(?:er)?\s+[a-zA-Zéèêûôà]+\s+\d{4})/gi;
  for (const m of t.matchAll(re)) {
    const d = m[1]!.includes('/') ? dateFr(m[1]!) : dateLongue(m[1]!);
    if (d) trouvee = d;
  }
  return trouvee;
}

function titreConnu(l: LignePdf): string | null {
  if (l.fragments.length !== 1) return null;
  const t = cle(l.texte);
  return t in SECTIONS ? t : null;
}

interface Etat {
  nom: string;
  categorie: CategorieInfo;
  colonnes: Colonne[];
}

/**
 * Extrait les trois sections de la page « Informations ».
 * `pages[i]` contient les fragments de la page i+1.
 */
export function parseInformations(pages: readonly FragmentPdf[][]): ResultatInformations {
  const res: ResultatInformations = { operations: [], avis: [], pages: [], sections: [], rejets: [] };

  // Section ouverte en bas de la page précédente : un tableau d'avis peut
  // déborder sur la page suivante, sans titre ni en-tête.
  let suite: Etat | null = null;

  for (let p = 0; p < pages.length; p++) {
    const ls = lignes(pages[p]!);
    const aDesTitres = ls.some((l) => titreConnu(l) != null);
    const enSuite: Etat | null =
      !aDesTitres && suite && suite.categorie !== 'operation' && res.pages[res.pages.length - 1] === p
        ? (ls.some((l) => NUMERO.test(cellules(l, suite!.colonnes)[1] ?? '')) ? suite : null)
        : null;
    suite = null;
    if (!aDesTitres && !enSuite) continue;
    res.pages.push(p + 1);

    let etat: Etat | null = enSuite;
    let attenteEntete: string | null = null;
    let precedenteY: number | null = null;
    let op: LigneOperation | null = null;
    let av: LigneAvis | null = null;
    // Sur une page de suite, tout ce qui précède la première ligne numérotée
    // (la date de séance en tête de page) est ignoré.
    let avantDonnees = enSuite != null;

    const clore = () => {
      if (op) res.operations.push(finirOperation(op));
      if (av) res.avis.push(av);
      op = null;
      av = null;
    };

    for (const l of ls) {
      const ecart = precedenteY == null ? 0 : precedenteY - l.y;
      precedenteY = l.y;
      if (estNumeroDePage(l)) continue;

      const titre = titreConnu(l);
      if (titre) {
        clore();
        etat = null;
        attenteEntete = titre;
        res.sections.push(titre);
        continue;
      }
      if (attenteEntete) {
        const def = SECTIONS[attenteEntete]!;
        const cols = colonnesSi(l, def.entete);
        if (cols) {
          etat = { nom: attenteEntete, categorie: def.categorie, colonnes: cols };
          attenteEntete = null;
        } else {
          res.rejets.push(`page ${p + 1} : en-tête attendu pour ${attenteEntete}, lu « ${l.texte} »`);
          attenteEntete = null;
        }
        continue;
      }
      if (!etat) continue;

      const c = cellules(l, etat.colonnes);
      if (avantDonnees) {
        if (!NUMERO.test(c[1] ?? '')) continue;
        avantDonnees = false;
      }
      const seulEnPremiere = c[0] !== '' && c.slice(1).every((x) => x === '');
      if (seulEnPremiere && ecart >= ECART_TITRE) {
        // Section inconnue : on ferme, on nomme, on n'invente pas son tableau.
        clore();
        res.rejets.push(`page ${p + 1} : section non reconnue « ${l.texte} », ignorée`);
        etat = null;
        continue;
      }

      if (etat.categorie === 'operation') {
        const nouvelle = c[0] !== '' && c[1] !== '';
        if (nouvelle) {
          clore();
          op = { emetteur: c[0]!, operation: c[1]!, typeOperation: 'autre', dateOperation: null };
        } else if (op) {
          const o: LigneOperation = op;
          if (c[0] !== '') o.emetteur = joindre(o.emetteur, c[0]!);
          if (c[1] !== '') o.operation = joindre(o.operation, c[1]!);
        } else {
          res.rejets.push(`page ${p + 1} : ligne orpheline dans ${etat.nom} « ${l.texte} »`);
        }
        continue;
      }

      // Avis ou communiqué : une nouvelle ligne porte un numéro, ou à défaut une
      // entité ET un objet sur la même ligne.
      const nouvelle = c[1] !== '' || (c[0] !== '' && c[3] !== '');
      if (nouvelle) {
        clore();
        av = {
          categorie: etat.categorie as 'avis' | 'communique',
          entite: c[0]!,
          numero: c[1] ? c[1] : null,
          nature: c[2]!,
          objet: c[3]!,
        };
      } else if (av) {
        const a: LigneAvis = av;
        if (c[0] !== '') a.entite = joindre(a.entite, c[0]!);
        if (c[2] !== '') a.nature = joindre(a.nature, c[2]!);
        if (c[3] !== '') a.objet = joindre(a.objet, c[3]!);
      } else {
        res.rejets.push(`page ${p + 1} : ligne orpheline dans ${etat.nom} « ${l.texte} »`);
      }
    }
    clore();
    suite = etat;
  }

  // Une ligne sans entité ou sans objet n'est pas exploitable : nommée, écartée.
  res.avis = res.avis.filter((a) => {
    if (a.entite && a.objet) return true;
    res.rejets.push(`${a.categorie} incomplet « ${[a.entite, a.numero, a.nature, a.objet].filter(Boolean).join(' | ')} »`);
    return false;
  });
  return res;
}

function finirOperation(o: LigneOperation): LigneOperation {
  return { ...o, typeOperation: typeOperation(o.operation), dateOperation: echeance(o.operation) };
}
