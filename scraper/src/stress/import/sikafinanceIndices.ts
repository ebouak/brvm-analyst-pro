/**
 * Collecteur historique des indices BRVM depuis Sikafinance (`GetHistos`),
 * respectueux du robots.txt (`Allow: /` hors `/listes/displaylist`, `/portif/displayp`, `/docs/*`),
 * découpé en fenêtres de 85 jours calendaires pour respecter la limite API.
 *
 * Règle de protection : ne jamais écraser les clôtures officielles `brvm.org`
 * déjà stockées dans `brvm_indices_daily` (`ignoreDuplicates: true`).
 */
import { validerSerieIndice } from '../pure/dataQuality.js';
import { DATES_CREATION_INDICES, type AnomalieQualite, type PointIndice } from '../pure/types.js';

const SIKA_API = 'https://www.sikafinance.com/api/general/GetHistos';
const SIKA_REFERER = 'https://www.sikafinance.com/marches/historiques/BRVMC';
const UA = 'WestBourse-HistoricalSync/1.0 (+https://www.westbourse.com)';

export interface MappingIndiceSika {
  sikaTicker: string;
  codeWb: string;
  libelle: string;
  debutDefaut: string;
}

export const MAPPING_INDICES_SIKA: MappingIndiceSika[] = [
  { sikaTicker: 'BRVMC', codeWb: 'BRVMC', libelle: 'BRVM COMPOSITE', debutDefaut: '2007-01-01' },
  { sikaTicker: 'BRVM30', codeWb: 'BRVM30', libelle: 'BRVM-30', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVMPR', codeWb: 'BRVMPRES', libelle: 'BRVM Prestige', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVMPA', codeWb: 'BRVMPRIN', libelle: 'BRVM Principal', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-CB', codeWb: 'BRVMCBASE', libelle: 'BRVM - Consommation de base', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-CD', codeWb: 'BRVMCDISC', libelle: 'BRVM - Consommation discrétionnaire', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-EN', codeWb: 'BRVMENER', libelle: 'BRVM - Énergie', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-IN', codeWb: 'BRVMINDU', libelle: 'BRVM - Industriels', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-SF', codeWb: 'BRVMFINS', libelle: 'BRVM - Services financiers', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-SP', codeWb: 'BRVMSPUB', libelle: 'BRVM - Services publics', debutDefaut: '2023-01-01' },
  { sikaTicker: 'BRVM-TEL', codeWb: 'BRVMTELE', libelle: 'BRVM - Télécommunications', debutDefaut: '2023-01-01' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SikaHistoRow {
  Date: string; // DD/MM/YYYY
  Close: number;
  Open?: number;
  Volume?: number;
}

function parseSikaDate(fr: string): string | null {
  const m = fr?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function decouperFenetres(debutIso: string, finIso: string, pasJours = 85): Array<{ deb: string; fin: string }> {
  const out: Array<{ deb: string; fin: string }> = [];
  let cur = Date.parse(`${debutIso}T00:00:00Z`);
  const end = Date.parse(`${finIso}T00:00:00Z`);
  const msJour = 86_400_000;
  while (cur <= end) {
    const finFen = Math.min(end, cur + (pasJours - 1) * msJour);
    out.push({
      deb: new Date(cur).toISOString().slice(0, 10),
      fin: new Date(finFen).toISOString().slice(0, 10),
    });
    cur = finFen + msJour;
  }
  return out;
}

async function fetchFenetreSika(ticker: string, datedeb: string, datefin: string): Promise<SikaHistoRow[]> {
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const res = await fetch(SIKA_API, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: SIKA_REFERER,
        },
        body: JSON.stringify({ ticker, datedeb, datefin, xperiod: '0' }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * essai);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} sur Sikafinance (${ticker})`);
      const json = (await res.json()) as { lst?: SikaHistoRow[] | string; error?: string };
      if (json.error === 'nodata') return [];
      if (json.error) throw new Error(`Sikafinance ${ticker} (${datedeb}..${datefin}): ${json.error}`);
      return Array.isArray(json.lst) ? json.lst : [];
    } catch (err) {
      if (essai === 3) throw err;
      await sleep(1200 * essai);
    }
  }
  return [];
}

export async function collecterHistoriqueSikafinance(
  mapping: MappingIndiceSika,
  opts: { debut?: string; fin?: string; delayMs?: number } = {},
): Promise<{ seriePropre: PointIndice[]; anomalies: AnomalieQualite[]; fenetres: number }> {
  const dateCreation = DATES_CREATION_INDICES[mapping.codeWb] ?? mapping.debutDefaut;
  const debutDemande = opts.debut && opts.debut > dateCreation ? opts.debut : mapping.debutDefaut > dateCreation ? mapping.debutDefaut : dateCreation;
  const finDemande = opts.fin ?? new Date().toISOString().slice(0, 10);
  const delayMs = opts.delayMs ?? 350;

  const fenetres = decouperFenetres(debutDemande, finDemande, 85);
  const bruts: PointIndice[] = [];

  for (const f of fenetres) {
    const rows = await fetchFenetreSika(mapping.sikaTicker, f.deb, f.fin);
    for (const r of rows) {
      const d = parseSikaDate(r.Date);
      if (!d || !(Number(r.Close) > 0)) continue;
      bruts.push({
        date_marche: d,
        valeur: Number(r.Close),
        volume: r.Volume != null && r.Volume >= 0 ? Math.round(r.Volume) : null,
        source: 'sikafinance',
        qualite: 'historique_reconstitue',
      });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  const { seriePropre, anomalies } = validerSerieIndice(mapping.codeWb, bruts);
  for (let i = 1; i < seriePropre.length; i++) {
    const prev = seriePropre[i - 1]!;
    const cur = seriePropre[i]!;
    if (prev.valeur > 0) {
      cur.variation_pct = Math.round(((cur.valeur / prev.valeur) - 1) * 10_000) / 100;
    }
  }

  return { seriePropre, anomalies, fenetres: fenetres.length };
}
