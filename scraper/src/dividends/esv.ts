/**
 * Table HTML « Paiement de dividendes » de brvm.org (/fr/esv/paiement-de-dividendes)
 * — module PUR et testé.
 *
 * Deux usages, et pas davantage :
 *  1. TROUVER le dernier calendrier PDF. La page de liste officielle des
 *     calendriers est figée au 31/03/2026 ; chaque mise à jour du calendrier
 *     porte en revanche la date d'un avis de paiement, et ces dates figurent
 *     ici (lien de l'avis : AAAAMMJJ_-_avis_ndegNNN_brvmdg_…pdf).
 *  2. RECOUPER les dates du calendrier, avis par avis.
 * Elle ne sert PAS de source de montants : sa colonne « net » porte des bruts
 * (SGCI 2 606) et rien n'y distingue l'un de l'autre. Elle a aussi ses propres
 * erreurs (SOGB : ex-dividende 05/07 au lieu du 05/08) — d'où un recoupement,
 * jamais une confiance aveugle.
 */
import * as cheerio from 'cheerio';

export interface PaiementEsv {
  emetteur: string;
  exercice: number;
  paiement: string;
  ex_date: string | null;
  /** « 297-2026 BRVMDG », tiré du nom du fichier de l'avis ; null s'il n'est pas reconnu. */
  avis: string | null;
  avisUrl: string | null;
  /** Date de l'avis (préfixe du nom de fichier), ISO. */
  datePublication: string | null;
}

const FICHIERS = 'https://www.brvm.org/sites/default/files';
const isoDe = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function lireTableEsv(html: string): PaiementEsv[] {
  const $ = cheerio.load(html);
  const out: PaiementEsv[] = [];
  $('td.views-field-field-emetteur-esv').each((_, td) => {
    const tr = $(td).closest('tr');
    const champ = (cls: string) => tr.find(`td.views-field-${cls}`);
    const exercice = isoDe(champ('field-exercice-comptable-esv').find('[content]').attr('content'));
    const paiement = isoDe(champ('field-date-de-paiement-esv').find('[content]').attr('content'));
    if (!exercice || !paiement) return;
    const avisUrl = champ('field-avis-dividende-esv').find('a').attr('href') ?? null;
    const m = avisUrl ? /\/(\d{4})(\d{2})(\d{2})_-_avis_n(?:deg|°|o)?_?(\d{1,4})_brvmdg/i.exec(avisUrl) : null;
    out.push({
      emetteur: $(td).text().replace(/\s+/g, ' ').trim(),
      exercice: Number(exercice.slice(0, 4)),
      paiement,
      ex_date: isoDe(champ('field-date-ex-dividende').find('[content]').attr('content')),
      avis: m ? `${Number(m[4])}-${m[1]} BRVMDG` : null,
      avisUrl,
      datePublication: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
    });
  });
  return out;
}

export function urlCalendrier(datePublication: string, exercice: number): string {
  return `${FICHIERS}/${datePublication.replace(/-/g, '')}_-_calendrier_de_paiement_des_dividendes_-_exercice_${exercice}.pdf`;
}

/** URL candidates du calendrier, de la date d'avis la plus récente à la plus ancienne. */
export function urlsCandidatesCalendrier(paiements: PaiementEsv[], max = 5): string[] {
  const urls = paiements
    .filter((p): p is PaiementEsv & { datePublication: string } => p.datePublication != null)
    .sort((a, b) => b.datePublication.localeCompare(a.datePublication))
    .map((p) => urlCalendrier(p.datePublication, p.exercice));
  return [...new Set(urls)].slice(0, max);
}

export function exerciceDepuisUrlCalendrier(url: string): number | null {
  const m = /_exercice_(\d{4})\.pdf$/i.exec(url);
  return m ? Number(m[1]) : null;
}
