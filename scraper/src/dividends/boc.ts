/**
 * Dernier dividende payé, lu dans le Bulletin Officiel de la Cote (BRVM) —
 * module PUR et testé (tests/dividendesBoc.test.ts).
 *
 * POURQUOI. Le 2026-10-11, le recoupement des dividendes en base avec le
 * Bulletin officiel n'a trouvé que 17 valeurs sur 48 concordantes (montant ET
 * date de paiement). SNTS : 1 750 « détaché le 14/05 » en base, 1 740 payé le
 * 26/05 selon la BRVM. Le Bulletin, publié à chaque séance, donne pour CHAQUE
 * valeur cotée le dernier dividende payé, NET (en-tête « Rdt. Net ») et sa
 * date de paiement : c'est la source de référence.
 *
 * CE QU'IL NE DONNE PAS : l'ex-date. Aucune date de détachement officielle n'y
 * figure ; la « veille du paiement » publiée par RichBourse n'est pas vérifiée.
 *
 * LECTURE PAR POSITION, jamais par ordre des cellules : une valeur sans
 * rendement ou au dividende ancien décale les cellules suivantes (même piège
 * que le carnet d'ordres, scraper/src/carnet/parse.ts).
 */
import { parseFrNumber } from '../utils/parseNumber.js';

export interface ItemPdf {
  s: string;
  x: number;
  y: number;
}

export interface DividendeBoc {
  code: string;
  /** Montant NET par action, en FCFA. */
  montant: number;
  date_paiement: string;
  rendement_net_pct: number | null;
}

const MOIS: Record<string, string> = {
  'janv.': '01', 'févr.': '02', mars: '03', 'avr.': '04', mai: '05', juin: '06',
  'juil.': '07', août: '08', 'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12',
};

/** « 26-mai-26 » → « 2026-05-26 » ; null si la forme n'est pas reconnue. */
function dateBoc(s: string): string | null {
  const m = s.match(/^(\d{1,2})-([a-zéû]+\.?)-(\d{2})$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const mois = MOIS[m[2]];
  return mois ? `20${m[3]}-${mois}-${m[1].padStart(2, '0')}` : null;
}

/** Positions d'en-tête relevées sur le bulletin du 09/10/2026, en repli. */
const DEFAUT = { dividende: 454, date: 498, rdt: 525, per: 561 };

export function lireDerniersDividendes(pages: ItemPdf[][]): DividendeBoc[] {
  // Colonnes : relues sur la première page qui porte les en-têtes, puis
  // conservées pour les pages de continuation qui ne les répètent pas.
  let col = { ...DEFAUT };
  const sortie: DividendeBoc[] = [];
  for (const items of pages) {
    const en = (re: RegExp) => items.find((i) => re.test(i.s))?.x;
    const div = en(/^Dernier dividende$/);
    if (div != null) {
      col = {
        dividende: div,
        date: items.find((i) => i.s === 'Date' && i.x > div)?.x ?? col.date,
        rdt: en(/^Rdt\. Net$/) ?? col.rdt,
        per: items.find((i) => i.s === 'PER' && i.x > div)?.x ?? col.per,
      };
    }
    const codes = items.filter((i) => i.x < 60 && /^[A-Z][A-Z0-9]{2,5}$/.test(i.s));
    for (const c of codes) {
      const ligne = items.filter((i) => Math.abs(i.y - c.y) <= 2);
      const dans = (a: number, b: number) => ligne.filter((i) => i.x >= a && i.x < b);
      const montantBrut = dans(col.dividende - 25, col.date - 3).find((i) => /^\d[\d  ]*(,\d+)?$/.test(i.s));
      const dateBrute = dans(col.date - 10, col.rdt - 2).map((i) => dateBoc(i.s)).find(Boolean);
      const rdtBrut = dans(col.rdt - 5, col.per - 5).find((i) => /%$/.test(i.s));
      const montant = montantBrut ? parseFrNumber(montantBrut.s) : null;
      if (montant == null || montant <= 0 || !dateBrute) continue;
      sortie.push({
        code: c.s,
        montant,
        date_paiement: dateBrute,
        rendement_net_pct: rdtBrut ? parseFrNumber(rdtBrut.s.replace('%', '')) : null,
      });
    }
  }
  return sortie;
}
