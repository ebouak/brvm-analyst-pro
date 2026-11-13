/**
 * Cote officielle par valeur, lue dans le Bulletin Officiel de la Cote (BRVM).
 * Module PUR, testé (tests/bocCote.test.ts).
 *
 * POURQUOI. L'audit du 2026-11-13 a comparé les ratios affichés par
 * WESTBOURSE au bulletin du 09/11 : cinq PER en écart (SEMC, SDCC, CABC,
 * TTLS, ONTBF) et deux valeurs SUSPENDUES (SEMC, SICC) affichées comme
 * cotées. Le bulletin donne, pour chaque valeur : clôture, cours de
 * référence, dernier dividende net, rendement net et PER — et « SP » à la
 * place des cours quand la valeur est suspendue. C'est la référence du
 * contrôle quotidien des écarts (frontend/lib/boc/ecarts.ts).
 *
 * LECTURE PAR POSITION, jamais par ordre des cellules : une valeur suspendue
 * n'a ni volume ni valeur, une valeur sans dividende récent n'a pas de
 * rendement, et chacune décale les cellules suivantes (même piège que
 * carnet/parse.ts et dividends/boc.ts). Les colonnes sont relues sur la page
 * qui porte les en-têtes, puis conservées pour la page de continuation.
 */
import { parseFrNumber } from '../utils/parseNumber.js';
import { lireDerniersDividendes, type ItemPdf } from '../dividends/boc.js';

export type { ItemPdf };

export interface CoteBoc {
  code: string;
  statut: 'cote' | 'suspendu';
  /** Clôture de la séance ; null si la valeur est suspendue. */
  cours_cloture: number | null;
  cours_reference: number | null;
  /** PER publié par la BRVM ; null si la case est vide. */
  per: number | null;
  rendement_net_pct: number | null;
  dividende_net: number | null;
  dividende_date: string | null;
}

/** Positions d'en-tête relevées sur le bulletin du 22/09/2026, en repli. */
const DEFAUT = { cloture: 222, variation: 246, reference: 366, variationAnnee: 400, per: 561 };

const NOMBRE = /^-?\d[\d  ]*(,\d+)?$/;

export function lireCoteBoc(pages: ItemPdf[][]): CoteBoc[] {
  let col = { ...DEFAUT };
  const dividendes = new Map(lireDerniersDividendes(pages).map((d) => [d.code, d]));
  const sortie: CoteBoc[] = [];
  const vus = new Set<string>();

  for (const items of pages) {
    const x = (re: RegExp) => items.find((i) => re.test(i.s))?.x;
    const cloture = x(/^Clôt\.$/);
    if (cloture != null) {
      col = {
        cloture,
        variation: x(/^Variation$/) ?? col.variation,
        reference: x(/^Référence$/) ?? col.reference,
        variationAnnee: x(/^Variation de$/) ?? col.variationAnnee,
        per: items.find((i) => i.s === 'PER' && i.x > cloture)?.x ?? col.per,
      };
    }

    const codes = items.filter((i) => i.x < 60 && /^[A-Z][A-Z0-9]{2,5}$/.test(i.s));
    for (const c of codes) {
      if (vus.has(c.s)) continue;
      const ligne = items.filter((i) => Math.abs(i.y - c.y) <= 2);
      // Une vraie ligne de cote porte au moins un nombre dans la zone des cours.
      const dans = (a: number, b: number) => ligne.filter((i) => i.x >= a && i.x < b);
      const zoneCloture = dans(col.cloture - 8, col.variation + 8);
      const suspendu = zoneCloture.some((i) => i.s === 'SP');
      const clotureBrute = zoneCloture.find((i) => NOMBRE.test(i.s));
      const refBrute = dans(col.reference - 15, col.variationAnnee + 10).find((i) => NOMBRE.test(i.s));
      const perBrut = ligne.find((i) => i.x >= col.per - 8 && NOMBRE.test(i.s));
      if (!suspendu && !clotureBrute) continue; // en-tête d'indice, ligne de titre…

      const d = dividendes.get(c.s);
      sortie.push({
        code: c.s,
        statut: suspendu ? 'suspendu' : 'cote',
        cours_cloture: suspendu || !clotureBrute ? null : parseFrNumber(clotureBrute.s),
        cours_reference: refBrute ? parseFrNumber(refBrute.s) : null,
        per: perBrut ? parseFrNumber(perBrut.s) : null,
        rendement_net_pct: d?.rendement_net_pct ?? null,
        dividende_net: d?.montant ?? null,
        dividende_date: d?.date_paiement ?? null,
      });
      vus.add(c.s);
    }
  }
  return sortie;
}

/** « mardi 22 septembre 2026 » (pied de page du bulletin) → « 2026-09-22 ». */
const MOIS_LONGS: Record<string, string> = {
  janvier: '01', février: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
};

export function dateSeanceBoc(pages: ItemPdf[][]): string | null {
  for (const items of pages) {
    for (const i of items) {
      const m = /^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+([a-zéû]+)\s+(\d{4})$/i.exec(i.s);
      const mois = m?.[2] ? MOIS_LONGS[m[2].toLowerCase()] : undefined;
      if (m?.[1] && m[3] && mois) return `${m[3]}-${mois}-${m[1].padStart(2, '0')}`;
    }
  }
  return null;
}
