/**
 * Parser de la réponse de l'API Banque mondiale (indicateur FP.CPI.TOTL.ZG).
 *
 * Forme de la réponse : un tableau de DEUX éléments —
 *   [ { page, pages, total, … },            <- métadonnées
 *     [ { countryiso3code, date, value }… ] ]  <- les observations
 * `value` est `null` quand l'année n'est pas encore publiée : on l'IGNORE plutôt
 * que de la convertir en 0. Un 0 inventé afficherait « inflation nulle » et
 * ferait passer un rendement médiocre pour un bon rendement réel.
 *
 * Fonction PURE : aucun I/O, testable sans réseau (convention du dépôt).
 */

export interface InflationPoint {
  paysCode: string;
  annee: number;
  tauxPct: number;
}

/** Les 8 États membres de l'UEMOA (zone franc CFA / BCEAO / BRVM). */
export const UEMOA: { code: string; nom: string }[] = [
  { code: 'BEN', nom: 'Bénin' },
  { code: 'BFA', nom: 'Burkina Faso' },
  { code: 'CIV', nom: "Côte d'Ivoire" },
  { code: 'GNB', nom: 'Guinée-Bissau' },
  { code: 'MLI', nom: 'Mali' },
  { code: 'NER', nom: 'Niger' },
  { code: 'SEN', nom: 'Sénégal' },
  { code: 'TGO', nom: 'Togo' },
];

export function parseWorldBankInflation(payload: unknown): InflationPoint[] {
  if (!Array.isArray(payload) || payload.length < 2) return [];
  const rows = payload[1];
  if (!Array.isArray(rows)) return [];

  const out: InflationPoint[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;

    const paysCode = typeof row.countryiso3code === 'string' ? row.countryiso3code : null;
    const annee = Number.parseInt(String(row.date ?? ''), 10);
    const value = row.value;

    // `value: null` = année non encore publiée. On la saute : mieux vaut un trou
    // assumé (« donnée indisponible ») qu'un zéro fabriqué.
    if (!paysCode || !Number.isFinite(annee) || typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }

    out.push({ paysCode, annee, tauxPct: Math.round(value * 100) / 100 });
  }
  return out;
}
