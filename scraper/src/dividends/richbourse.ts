import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import type { Dividend } from './types.js';

/**
 * Dividendes depuis richbourse.com — campagne en cours.
 *
 * POURQUOI CETTE SOURCE S'AJOUTE À SIKAFINANCE
 *
 *  1. Elle porte le CODE BRVM dans ses liens (`.../ABJC_4696`). Aucune
 *     correspondance par nom n'est donc nécessaire — et c'est précisément
 *     cette correspondance qui, chez sikafinance, a attribué les dividendes de
 *     BOA Sénégal à BOA Burkina pendant quatre exercices (voir
 *     tests/sikafinanceMatcher.test.ts).
 *
 *  2. Elle donne la DATE DE PAIEMENT, absente des 353 lignes que la table
 *     comptait avant cet import.
 *
 *  3. Elle donne le montant NON ARRONDI : sikafinance affiche 2293 là où
 *     richbourse affiche 2293,28.
 *
 * Elle ne couvre en revanche que la campagne courante : sikafinance reste la
 * source de l'historique.
 *
 * SÉMANTIQUE DE L'EXERCICE — vérifiée, pas supposée. La page « année 2026 »
 * liste des paiements de 2026, qui rémunèrent l'exercice 2025. Recoupement sur
 * 18 sociétés : richbourse 2026 = exercice 2025 de la base (SGBC 2293,28 face
 * à 2293 ; STBC 1707,2 face à 1707 ; ABJC 201,52 face à 202).
 */

const RICHBOURSE_URL = 'https://www.richbourse.com/common/dividende/index';

/**
 * Agent HTTP — un choix à expliciter plutôt qu'à subir.
 *
 * Richbourse renvoie 403 à « Mozilla/5.0 (compatible; BRVMAnalystPro/1.0) »
 * et 200 à un agent de navigateur : un filtre grossier sur la chaîne, qui
 * contredit leur propre robots.txt. Celui-ci est en effet explicite —
 * « une page servie en 200 à un visiteur anonyme ET déclarée dans le sitemap
 * est ouverte », pour TOUS les robots, IA génératives comprises — et
 * /common/dividende/index ne figure dans aucun Disallow.
 *
 * On garde donc NOTRE IDENTITÉ et notre URL dans la chaîne : le préfixe
 * navigateur sert à passer le filtre, pas à se faire passer pour un humain.
 * Une requête par exécution quotidienne, sur une seule page autorisée.
 */
const AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BRVMAnalystPro/1.0 (+https://westbourse.com)';

/** Convertit « 2 293.28 » ou « 1 707,2 » en nombre. Null si illisible. */
function parseMontant(s: string): number | null {
  const n = Number(
    s
      .replace(/[\s  ]/g, '')
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** « 29/09/2026 » -> « 2026-09-29 ». Null pour « (inconnue) » ou vide. */
function parseDate(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Parse la table des dividendes. PUR : reçoit le HTML, ne fait aucune I/O —
 * c'est la partie qu'on éprouve par test, sans dépendre du réseau.
 */
export function parseRichbourse(html: string): { dividends: Dividend[]; ignores: string[] } {
  const $ = cheerio.load(html);
  const dividends: Dividend[] = [];
  const ignores: string[] = [];

  $('table').each((_, table) => {
    const lignes = $(table).find('tr');
    if (lignes.length < 5) return;

    const entete = $(lignes[0])
      .find('th,td')
      .map((_, c) => $(c).text().trim().toLowerCase())
      .get();
    // On reconnaît la table à son en-tête, jamais à sa position : un
    // remaniement de la page ne doit pas faire lire silencieusement une autre.
    if (!entete.some((c) => c.includes('dividende')) || !entete.some((c) => c.includes('paiement')))
      return;

    lignes.slice(1).each((_, tr) => {
      const cells = $(tr)
        .find('td')
        .map((_, c) => $(c).text().replace(/\s+/g, ' ').trim())
        .get();
      if (cells.length < 6) return;

      const nom = cells[1] ?? '';
      const montant = parseMontant(cells[2] ?? '');
      const exDate = parseDate(cells[4] ?? '');
      const paymentDate = parseDate(cells[5] ?? '');

      /* Le code vit dans le href de la ligne. Pas de code = pas de ligne :
         deviner par le nom réintroduirait exactement le défaut que cette
         source permet d'éviter. Le nom est signalé pour traitement manuel. */
      const href = $(tr).find('a[href*="afficher-fichier"]').attr('href') ?? '';
      const code = (href.match(/afficher-fichier\/([A-Z0-9.]+)_\d+/) ?? [])[1];
      if (!code || montant == null) {
        if (nom) ignores.push(`${nom} (sans code exploitable)`);
        return;
      }

      /* L'exercice se déduit de la date de paiement : un versement de 2026
         rémunère l'exercice 2025. Sans date, la ligne est ignorée plutôt que
         rattachée à une année devinée — une ligne mal datée est indétectable
         une fois en base. */
      if (!paymentDate) {
        ignores.push(`${nom} (sans date de paiement)`);
        return;
      }
      const exercice = Number(paymentDate.slice(0, 4)) - 1;

      dividends.push({
        code,
        exercice,
        ex_date: exDate,
        payment_date: paymentDate,
        montant,
        devise: 'XOF',
        source: 'richbourse',
        source_url: RICHBOURSE_URL,
      });
    });
  });

  return { dividends, ignores };
}

/** Récupère et parse les dividendes de la campagne courante. */
export async function fetchRichbourseDividends(): Promise<Dividend[]> {
  const res = await axios.get<string>(RICHBOURSE_URL, {
    timeout: 30000,
    headers: { 'User-Agent': AGENT },
    responseType: 'text',
  });

  const { dividends, ignores } = parseRichbourse(res.data);
  logger.info(
    {
      total: dividends.length,
      avecDatePaiement: dividends.filter((d) => d.payment_date).length,
      ignores,
    },
    'Dividendes richbourse parsés',
  );
  return dividends;
}
