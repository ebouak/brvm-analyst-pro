/**
 * Calendrier officiel de paiement des dividendes (BRVM) — module PUR et testé
 * (tests/calendrierDividendes.test.ts, sur les PDF réels du 06/10 et du 09/10/2026).
 *
 * POURQUOI. Au 2026-10-20, 2 dividendes sur 36 de l'exercice 2025 avaient une
 * date de détachement en base. Ce document les donne toutes, avec le numéro
 * de l'avis, et il est le SEUL à distinguer brut et net : l'en-tête annonce
 * un « montant net », mais les lignes marquées « (*) » sont BRUTES (note de bas
 * de page : IRVM 12 % personnes physiques, 10 % personnes morales). Le marqueur
 * prime sur l'en-tête ; le taux est lu dans la note, jamais supposé.
 *
 * LECTURE PAR POSITION, ancrée sur le fragment « BRVMDG » de chaque ligne : un
 * nom peut tenir sur deux lignes de texte, un montant tomber au-dessus de son
 * nom (même piège que dividends/boc.ts et carnet/parse.ts).
 *
 * La virgule est ici un vrai séparateur décimal (0,9184 FCFA pour ETI ; 594,528
 * pour BOA CI) — contrairement au carnet d'ordres, où « 3,955 » vaut 3 955.
 */
import { parseFrNumber } from '../utils/parseNumber.js';
import type { ItemPdf } from './boc.js';

export interface LigneCalendrier {
  /** Libellé publié, sans « (*) ». */
  nom: string;
  /** Montant par action tel que publié : BRUT si `brut`, NET sinon. */
  montant: number;
  brut: boolean;
  /** « 102-2026 BRVMDG » (numéro sans zéro de tête, comme la table HTML). */
  avis: string;
  publication: string | null;
  ex_date: string;
  paiement: string;
}

export interface RejetCalendrier {
  nom: string;
  avis: string | null;
  motif: string;
}

export interface Calendrier {
  exercice: number;
  tauxPersonnePhysique: number | null;
  tauxPersonneMorale: number | null;
  lignes: LigneCalendrier[];
  rejets: RejetCalendrier[];
}

/** Colonnes relevées sur les calendriers de 2026 (x en points PDF). */
const COL = {
  montant: [190, 258],
  avis: [258, 330],
  publication: [370, 440],
  ex: [440, 510],
  paiement: [510, 600],
} as const;
const NOM_X_MAX = 190;
const MEME_LIGNE = 3;
/** Un nom sur deux lignes s'écarte de 6 à 7 points de son ancre ; la ligne voisine, de 17 et plus. */
const NOM_ECART_MAX = 9;

const joindre = (items: ItemPdf[]) => [...items].sort((a, b) => a.x - b.x).map((i) => i.s).join('');

/** « 06/10/2026 » → « 2026-10-06 » ; null pour toute autre forme ou une date impossible. */
export function dateFr(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.replace(/\s/g, ''));
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function lireCalendrier(pages: ItemPdf[][]): Calendrier {
  const ligneDe = (re: RegExp): string | null => {
    for (const p of pages) {
      const a = p.find((i) => re.test(i.s));
      if (a) return joindre(p.filter((i) => Math.abs(i.y - a.y) <= 2));
    }
    return null;
  };
  const titre = ligneDe(/^ANNEE/);
  const annee = titre ? /ANNEE\s*:\s*(\d{4})/.exec(titre) : null;
  if (!annee?.[1]) throw new Error('calendrier : ligne « ANNEE : AAAA » introuvable');
  const note = ligneDe(/IRVM/) ?? '';
  const taux =
    /de\s*(\d+(?:,\d+)?)\s*%\s*pour\s*les\s*personnes\s*physiques\s*et\s*(\d+(?:,\d+)?)\s*%\s*pour\s*les\s*personnes\s*morales/i.exec(
      note,
    );
  const pct = (s: string | undefined) => {
    const n = parseFrNumber(s);
    return n == null ? null : n / 100;
  };

  const lignes: LigneCalendrier[] = [];
  const rejets: RejetCalendrier[] = [];
  for (const items of pages) {
    const ancres = items.filter((i) => /BRVMDG/.test(i.s) && i.x >= COL.avis[0] && i.x < COL.avis[1]);
    const ancreLaPlusProche = (y: number) => ancres.reduce((m, a) => (Math.abs(a.y - y) < Math.abs(m.y - y) ? a : m));
    for (const a of ancres) {
      const cellule = ([x0, x1]: readonly [number, number]) =>
        joindre(items.filter((i) => Math.abs(i.y - a.y) <= MEME_LIGNE && i.x >= x0 && i.x < x1));
      const nomBrut = items
        .filter((i) => i.x < NOM_X_MAX && Math.abs(i.y - a.y) <= NOM_ECART_MAX && ancreLaPlusProche(i.y) === a)
        .sort((p, q) => q.y - p.y || p.x - q.x)
        .map((i) => i.s)
        .join(' ');
      const nom = nomBrut.replace(/\(\*\)/g, '').replace(/\s+/g, ' ').trim();
      const brut = /\(\*\)/.test(nomBrut);
      const avisM = /^(\d{1,4})-(\d{4})BRVMDG$/.exec(cellule(COL.avis).replace(/\s/g, ''));
      const avis = avisM ? `${Number(avisM[1])}-${avisM[2]} BRVMDG` : null;
      const montant = parseFrNumber(cellule(COL.montant));
      const exDate = dateFr(cellule(COL.ex));
      const paiement = dateFr(cellule(COL.paiement));
      const rejeter = (motif: string) => rejets.push({ nom, avis, motif });
      if (!nom) { rejeter('nom illisible'); continue; }
      if (!avis) { rejeter('numéro d’avis illisible'); continue; }
      if (montant == null || montant <= 0) { rejeter('montant illisible'); continue; }
      if (!exDate || !paiement) { rejeter('date illisible'); continue; }
      if (exDate > paiement) { rejeter(`ex-dividende (${exDate}) postérieur au paiement (${paiement})`); continue; }
      lignes.push({ nom, montant, brut, avis, publication: dateFr(cellule(COL.publication)), ex_date: exDate, paiement });
    }
  }
  return {
    exercice: Number(annee[1]),
    tauxPersonnePhysique: pct(taux?.[1]),
    tauxPersonneMorale: pct(taux?.[2]),
    lignes,
    rejets,
  };
}
