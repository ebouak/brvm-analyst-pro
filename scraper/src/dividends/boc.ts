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
  /** Cours de référence publié sur la MÊME ligne ; null s'il est illisible. */
  cours_reference: number | null;
}

/**
 * Écart toléré, en points, entre le rendement recalculé (montant ÷ cours de
 * référence) et le rendement net publié sur la même ligne. Le bulletin arrondit
 * à deux décimales : un écart réel de lecture se compte en dizaines de points.
 */
export const TOLERANCE_RENDEMENT_POINTS = 0.5;

export interface RejetBoc {
  code: string;
  boc: DividendeBoc;
  motif: string;
}

/**
 * CONTRÔLE DE COHÉRENCE. Le bulletin publie, sur la ligne de chaque valeur, le
 * dividende, le cours de référence ET le rendement net qui les relie. Si le
 * montant lu ÷ la référence lue ne redonne pas le rendement publié, l'une des
 * trois cases a été mal lue (colonne décalée, cellule voisine) : la ligne est
 * REJETÉE et nommée, jamais écrite. Sans rendement publié ou sans référence
 * lisible, rien à recouper : la ligne passe comme avant.
 */
export function controlerRendement(d: DividendeBoc): string | null {
  if (d.rendement_net_pct == null || d.cours_reference == null || d.cours_reference <= 0) return null;
  const calcule = (d.montant / d.cours_reference) * 100;
  if (Math.abs(calcule - d.rendement_net_pct) <= TOLERANCE_RENDEMENT_POINTS) return null;
  return (
    `rendement incohérent : ${d.montant} ÷ ${d.cours_reference} (référence) = ${calcule.toFixed(2)} %, ` +
    `le bulletin publie ${d.rendement_net_pct} % sur la même ligne`
  );
}

/** Sépare les lignes cohérentes des lignes à rejeter (voir controlerRendement). */
export function separerIncoherents(lus: DividendeBoc[]): { retenus: DividendeBoc[]; rejets: RejetBoc[] } {
  const retenus: DividendeBoc[] = [];
  const rejets: RejetBoc[] = [];
  for (const d of lus) {
    const motif = controlerRendement(d);
    if (motif) rejets.push({ code: d.code, boc: d, motif });
    else retenus.push(d);
  }
  return { retenus, rejets };
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
const DEFAUT = { dividende: 454, date: 498, rdt: 525, per: 561, reference: 359, variationAnnee: 399 };

const NOMBRE = /^-?\d[\d  ]*(,\d+)?$/;

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
        // Même page que « Dernier dividende » : une autre page peut porter un
        // autre tableau avec ses propres « Référence ».
        reference: en(/^Référence$/) ?? col.reference,
        variationAnnee: en(/^Variation de$/) ?? col.variationAnnee,
      };
    }
    const codes = items.filter((i) => i.x < 60 && /^[A-Z][A-Z0-9]{2,5}$/.test(i.s));
    for (const c of codes) {
      const ligne = items.filter((i) => Math.abs(i.y - c.y) <= 2);
      const dans = (a: number, b: number) => ligne.filter((i) => i.x >= a && i.x < b);
      const montantBrut = dans(col.dividende - 25, col.date - 3).find((i) => /^\d[\d  ]*(,\d+)?$/.test(i.s));
      const dateBrute = dans(col.date - 10, col.rdt - 2).map((i) => dateBoc(i.s)).find(Boolean);
      const rdtBrut = dans(col.rdt - 5, col.per - 5).find((i) => /%$/.test(i.s));
      /* Référence = le nombre le plus À DROITE de la fenêtre, comme boc/cote.ts :
         la valeur échangée, alignée à droite, peut déborder sur son début. */
      const refBrute = dans(col.reference - 15, col.variationAnnee + 10)
        .filter((i) => NOMBRE.test(i.s))
        .sort((a, b) => b.x - a.x)[0];
      const montant = montantBrut ? parseFrNumber(montantBrut.s) : null;
      if (montant == null || montant <= 0 || !dateBrute) continue;
      sortie.push({
        code: c.s,
        montant,
        date_paiement: dateBrute,
        rendement_net_pct: rdtBrut ? parseFrNumber(rdtBrut.s.replace('%', '')) : null,
        cours_reference: refBrute ? parseFrNumber(refBrute.s) : null,
      });
    }
  }
  return sortie;
}
