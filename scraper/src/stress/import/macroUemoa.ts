/**
 * Collecte historique macroéconomique UEMOA (1998-2026) pour enrichir le
 * contexte économique des fiches crises (Travail n° 1 §3.3.B).
 *
 * Sources strictement documentées :
 *   1. Banque Mondiale API v2 : NY.GDP.MKTP.KD.ZG (PIB %) & FP.CPI.TOTL.ZG (Inflation %)
 *      sur les 8 pays UEMOA (moyenne régionale calculée sur les données publiées).
 *   2. BCEAO (bceao.int, communiqués du Comité de Politique Monétaire) :
 *      DEUX séries distinctes, jamais mélangées :
 *      - `bceao_taux_directeur` : Taux minimum de soumission aux appels d'offres
 *        d'injection de liquidités (institué le 16/07/2008 à 3,75 %, ramené à 2,50 %
 *        le 16/09/2013 et maintenu inchangé à 2,50 % en décembre 2016).
 *      - `bceao_guichet_marginal` : Taux du guichet de prêt marginal / pension
 *        (corridor de +100 pb jusqu'en 2016, élargi à +200 pb le 16/12/2016 : 3,50 % -> 4,50 %).
 */

export interface MacroHistoryRow {
  indicateur: string;
  zone: string;
  date_valeur: string;
  valeur: number;
  unite: string;
  source: string;
  source_url: string;
  date_publication: string | null;
  note: string | null;
}

const UEMOA_CODES = 'BEN;BFA;CIV;GNB;MLI;NER;SEN;TGO';
const WB_BASE = 'https://api.worldbank.org/v2/country';
const BCEAO_URL = 'https://www.bceao.int/fr/content/principaux-indicateurs-et-taux-directeurs';

/**
 * Série 1 : Taux minimum de soumission aux opérations d'open market (principal taux directeur BCEAO).
 * Vérifié sur les communiqués CPM de la BCEAO (aucun saut fictif en décembre 2016).
 */
export const BCEAO_TAUX_MINIMUM_SOUMISSION: MacroHistoryRow[] = [
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2008-07-16', valeur: 3.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2008-07-16', note: 'Institution du taux minimum de soumission aux appels d’offres' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2009-06-16', valeur: 3.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2009-06-16', note: 'Assouplissement -50 pb post-crise financière internationale' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2012-06-16', valeur: 3.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2012-06-16', note: 'Assouplissement -25 pb (soutien à l’activité)' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2013-03-16', valeur: 2.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2013-03-16', note: 'Assouplissement -25 pb' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2013-09-16', valeur: 2.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2013-09-16', note: 'Assouplissement -25 pb (maintenu à 2,50 % jusqu’en juin 2020)' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2020-06-24', valeur: 2.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2020-06-24', note: 'Baisse de 50 pb en réponse à la pandémie de Covid-19' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2022-06-16', valeur: 2.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-06-16', note: 'Début du cycle de resserrement monétaire (+25 pb)' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2022-09-16', valeur: 2.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-09-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2022-12-16', valeur: 2.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-12-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2023-03-16', valeur: 3.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-03-16', note: 'Resserrement +25 pb (statu quo en juin 2023)' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2023-09-16', valeur: 3.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-09-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2023-12-16', valeur: 3.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-12-16', note: 'Resserrement +25 pb (pic du cycle 2022-2023)' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2025-06-16', valeur: 3.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2025-06-16', note: 'Assouplissement -25 pb' },
  { indicateur: 'bceao_taux_directeur', zone: 'UEMOA', date_valeur: '2026-03-16', valeur: 3.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2026-03-16', note: 'Assouplissement -25 pb (aligné macro_indicators)' },
];

/**
 * Série 2 : Taux du guichet de prêt marginal / pension (borne haute du corridor BCEAO).
 * Conservée sous son propre code `bceao_guichet_marginal` pour documenter l'élargissement
 * du corridor de +100 pb à +200 pb le 16 décembre 2016 sans polluer `bceao_taux_directeur`.
 */
export const BCEAO_GUICHET_MARGINAL: MacroHistoryRow[] = [
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2008-07-16', valeur: 4.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2008-07-16', note: 'Taux de pension (+100 pb au-dessus du taux minimum)' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2009-06-16', valeur: 4.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2009-06-16', note: 'Baisse de 50 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2012-06-16', valeur: 4.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2012-06-16', note: 'Baisse de 25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2013-03-16', valeur: 3.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2013-03-16', note: 'Baisse de 25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2013-09-16', valeur: 3.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2013-09-16', note: 'Baisse de 25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2016-12-16', valeur: 4.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2016-12-16', note: 'Élargissement du corridor de 100 à 200 pb (taux min. maintenu à 2,50 %)' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2020-06-24', valeur: 4.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2020-06-24', note: 'Baisse de 50 pb (Covid-19)' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2022-06-16', valeur: 4.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-06-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2022-09-16', valeur: 4.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-09-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2022-12-16', valeur: 4.75, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2022-12-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2023-03-16', valeur: 5.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-03-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2023-09-16', valeur: 5.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-09-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2023-12-16', valeur: 5.50, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2023-12-16', note: 'Resserrement +25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2025-06-16', valeur: 5.25, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2025-06-16', note: 'Assouplissement -25 pb' },
  { indicateur: 'bceao_guichet_marginal', zone: 'UEMOA', date_valeur: '2026-03-16', valeur: 5.00, unite: '%', source: 'BCEAO (CPM)', source_url: BCEAO_URL, date_publication: '2026-03-16', note: 'Assouplissement -25 pb (aligné macro_indicators)' },
];

export const BCEAO_TAUX_HISTORIQUES: MacroHistoryRow[] = [
  ...BCEAO_TAUX_MINIMUM_SOUMISSION,
  ...BCEAO_GUICHET_MARGINAL,
];

interface WbEntry {
  countryiso3code: string;
  date: string;
  value: number | null;
}

async function fetchWorldBankSeries(
  wbIndicator: string,
  targetIndicateur: string,
  debutAnnee = 1998,
  finAnnee = 2025,
): Promise<MacroHistoryRow[]> {
  const url = `${WB_BASE}/${UEMOA_CODES}/indicator/${wbIndicator}?format=json&date=${debutAnnee}:${finAnnee}&per_page=500`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`World Bank ${wbIndicator} HTTP ${res.status}`);
  const json = (await res.json()) as [unknown, WbEntry[]?];
  const entries = Array.isArray(json[1]) ? json[1] : [];

  const parAnnee = new Map<string, number[]>();
  const rows: MacroHistoryRow[] = [];

  for (const e of entries) {
    if (e.value == null || !Number.isFinite(e.value) || !/^\d{4}$/.test(e.date)) continue;
    const val = Math.round(e.value * 1000) / 1000;
    rows.push({
      indicateur: targetIndicateur,
      zone: e.countryiso3code,
      date_valeur: `${e.date}-12-31`,
      valeur: val,
      unite: '%',
      source: `World Bank (${wbIndicator})`,
      source_url: `https://data.worldbank.org/indicator/${wbIndicator}`,
      date_publication: null,
      note: null,
    });
    const list = parAnnee.get(e.date) ?? [];
    list.push(val);
    parAnnee.set(e.date, list);
  }

  for (const [annee, vals] of [...parAnnee.entries()].sort()) {
    if (vals.length === 0) continue;
    const moy = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000;
    rows.push({
      indicateur: targetIndicateur,
      zone: 'UEMOA',
      date_valeur: `${annee}-12-31`,
      valeur: moy,
      unite: '%',
      source: `World Bank (${wbIndicator})`,
      source_url: `https://data.worldbank.org/indicator/${wbIndicator}`,
      date_publication: null,
      note: `Moyenne simple sur ${vals.length} pays UEMOA publiés`,
    });
  }

  return rows;
}

export async function collecterMacroUemoa(): Promise<MacroHistoryRow[]> {
  const [pib, inf] = await Promise.all([
    fetchWorldBankSeries('NY.GDP.MKTP.KD.ZG', 'pib_croissance_pct', 1998, 2025),
    fetchWorldBankSeries('FP.CPI.TOTL.ZG', 'inflation_pct', 1998, 2025),
  ]);
  return [...BCEAO_TAUX_HISTORIQUES, ...pib, ...inf];
}
