import * as cheerio from 'cheerio';
import { parseFrNumber } from '../utils/parseNumber.js';

/**
 * Historique des dividendes depuis la FICHE SOCIÉTÉ Sikafinance.
 *   https://www.sikafinance.com/marches/societe/{TICKER}   (ex. BOAC.ci)
 *
 * ── Pourquoi cette source plutôt que la page /marches/dividendes ──
 * La page « dividendes » ne liste que les détachements À VENIR. Elle ne dit rien
 * de l'historique. La fiche société, elle, contient un tableau financier avec une
 * ligne « Dividende » sur CINQ exercices — c'est la seule source d'historique
 * accessible, et elle donne UNE valeur par exercice (pas de doublons à arbitrer).
 *
 * ── Le « - » n'est pas une donnée manquante ──
 * Quand une société n'a rien distribué, la fiche affiche « - ». C'est un FAIT
 * (dividende = 0), pas un trou. Confondre les deux fausserait tout : traiter un
 * vrai zéro comme « inconnu » exclurait le titre à tort ; traiter un trou comme
 * un zéro sous-estimerait son rendement. On distingue donc explicitement :
 *   « - »            → montant 0, connu
 *   ligne absente    → rien n'est renvoyé, l'appelant sait que c'est inconnu
 *
 * Fonction PURE (parsing seul), testée sur fixture.
 */

export interface DividendeHistorique {
  exercice: number;
  /** Montant brut par action, en FCFA. 0 = aucun dividende distribué (fait établi). */
  montant: number;
}

/** Normalise un libellé : minuscules, sans accents, espaces réduits. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSikaSociete(html: string): DividendeHistorique[] {
  const $ = cheerio.load(html);
  const out: DividendeHistorique[] = [];

  $('table').each((_, table) => {
    if (out.length > 0) return; // premier tableau pertinent seulement

    const rows = $(table).find('tr').toArray();
    if (rows.length < 2) return;

    // En-tête : les exercices. On les repère par leur forme (4 chiffres), jamais
    // par position — un ajout de colonne ne doit pas décaler tout le tableau.
    const headerCells = $(rows[0]).find('th, td').toArray().map((c) => $(c).text().trim());
    const annees: { index: number; annee: number }[] = [];
    headerCells.forEach((txt, i) => {
      const m = txt.match(/^(19|20)\d{2}$/);
      if (m) annees.push({ index: i, annee: Number.parseInt(txt, 10) });
    });
    if (annees.length === 0) return;

    // Ligne « Dividende » — repérée par LIBELLÉ, pas par index.
    for (const tr of rows) {
      const cells = $(tr).find('th, td').toArray().map((c) => $(c).text().trim());
      const label = norm(cells[0] ?? '');
      if (!label.startsWith('dividende')) continue;

      for (const { index, annee } of annees) {
        const raw = (cells[index] ?? '').trim();
        if (raw === '') continue; // cellule vide : on ne sait rien

        // « - » (ou tiret long) = aucun dividende distribué. C'est un fait.
        if (/^[-–—]$/.test(raw)) {
          out.push({ exercice: annee, montant: 0 });
          continue;
        }

        const montant = parseFrNumber(raw);
        // Un montant non parsable est IGNORÉ, jamais converti en 0 : on ne fabrique
        // pas un « pas de dividende » à partir d'une cellule qu'on n'a pas comprise.
        if (montant === null || !Number.isFinite(montant) || montant < 0) continue;

        out.push({ exercice: annee, montant });
      }
      break;
    }
  });

  return out.sort((a, b) => a.exercice - b.exercice);
}
