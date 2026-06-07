export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import NotationsGrid from './NotationsGrid';

// Classification officielle BRVM (richbourse.com)
const COMPANIES: { ticker: string; name: string; sector: string }[] = [
  // Consommation de base
  { ticker: 'NTLC', name: "NESTLE CÔTE D'IVOIRE",         sector: 'Consommation de base' },
  { ticker: 'PALC', name: "PALM CÔTE D'IVOIRE",            sector: 'Consommation de base' },
  { ticker: 'SPHC', name: "SAPH CÔTE D'IVOIRE",            sector: 'Consommation de base' },
  { ticker: 'SICC', name: "SICOR CÔTE D'IVOIRE",           sector: 'Consommation de base' },
  { ticker: 'STBC', name: "SITAB CÔTE D'IVOIRE",           sector: 'Consommation de base' },
  { ticker: 'SOGC', name: "SOGB CÔTE D'IVOIRE",            sector: 'Consommation de base' },
  { ticker: 'SLBC', name: "SOLIBRA CÔTE D'IVOIRE",         sector: 'Consommation de base' },
  { ticker: 'SCRC', name: "SUCRIVOIRE CÔTE D'IVOIRE",      sector: 'Consommation de base' },
  { ticker: 'UNLC', name: "UNILEVER CÔTE D'IVOIRE",        sector: 'Consommation de base' },
  // Consommation discrétionnaire
  { ticker: 'BNBC', name: "BERNABÉ CÔTE D'IVOIRE",         sector: 'Consommation discrétionnaire' },
  { ticker: 'CFAC', name: "CFAO MOTORS CÔTE D'IVOIRE",     sector: 'Consommation discrétionnaire' },
  { ticker: 'LNBB', name: 'LOTERIE NATIONALE DU BÉNIN',    sector: 'Consommation discrétionnaire' },
  { ticker: 'NEIC', name: "NEI-CEDA CÔTE D'IVOIRE",        sector: 'Consommation discrétionnaire' },
  { ticker: 'ABJC', name: "SERVAIR ABIDJAN CÔTE D'IVOIRE", sector: 'Consommation discrétionnaire' },
  { ticker: 'PRSC', name: "TRACTAFRIC MOTORS CI",          sector: 'Consommation discrétionnaire' },
  { ticker: 'UNXC', name: "UNIWAX CÔTE D'IVOIRE",          sector: 'Consommation discrétionnaire' },
  // Energie
  { ticker: 'SMBC', name: "SMB CÔTE D'IVOIRE",             sector: 'Énergie' },
  { ticker: 'TTLC', name: "TOTAL CÔTE D'IVOIRE",           sector: 'Énergie' },
  { ticker: 'TTLS', name: 'TOTAL SÉNÉGAL',                  sector: 'Énergie' },
  { ticker: 'SHEC', name: "VIVO ENERGY CÔTE D'IVOIRE",     sector: 'Énergie' },
  // Industriels
  { ticker: 'SDSC', name: 'AFRICA GLOBAL LOGISTICS CI',    sector: 'Industriels' },
  { ticker: 'SEMC', name: "CROWN SIEM CÔTE D'IVOIRE",      sector: 'Industriels' },
  { ticker: 'SIVC', name: "ERIUM CI",                       sector: 'Industriels' },
  { ticker: 'FTSC', name: "FILTISAC CÔTE D'IVOIRE",        sector: 'Industriels' },
  { ticker: 'STAC', name: "SETAO CÔTE D'IVOIRE",           sector: 'Industriels' },
  { ticker: 'CABC', name: "SICABLE CÔTE D'IVOIRE",         sector: 'Industriels' },
  // Services financiers
  { ticker: 'BOAB',  name: 'BANK OF AFRICA BÉNIN',                  sector: 'Services financiers' },
  { ticker: 'BOABF', name: 'BANK OF AFRICA BURKINA FASO',           sector: 'Services financiers' },
  { ticker: 'BOAC',  name: "BANK OF AFRICA CÔTE D'IVOIRE",          sector: 'Services financiers' },
  { ticker: 'BOAM',  name: 'BANK OF AFRICA MALI',                   sector: 'Services financiers' },
  { ticker: 'BOAN',  name: 'BANK OF AFRICA NIGER',                  sector: 'Services financiers' },
  { ticker: 'BOAS',  name: 'BANK OF AFRICA SÉNÉGAL',                sector: 'Services financiers' },
  { ticker: 'BICB',  name: 'BICB BÉNIN',                            sector: 'Services financiers' },
  { ticker: 'BICC',  name: "BICI CÔTE D'IVOIRE",                    sector: 'Services financiers' },
  { ticker: 'CBIBF', name: 'CORIS BANK INTERNATIONAL BURKINA FASO', sector: 'Services financiers' },
  { ticker: 'ECOC',  name: "ECOBANK CÔTE D'IVOIRE",                 sector: 'Services financiers' },
  { ticker: 'ETIT',  name: 'ECOBANK TRANSNATIONAL INC. TOGO',       sector: 'Services financiers' },
  { ticker: 'NSBC',  name: "NSIA BANQUE CÔTE D'IVOIRE",             sector: 'Services financiers' },
  { ticker: 'ORGT',  name: 'ORAGROUP TOGO',                         sector: 'Services financiers' },
  { ticker: 'SAFC',  name: "SAFCA — ALIOS FINANCE CI",              sector: 'Services financiers' },
  { ticker: 'SGBC',  name: "SGB CÔTE D'IVOIRE",                     sector: 'Services financiers' },
  { ticker: 'SIBC',  name: "SOCIÉTÉ IVOIRIENNE DE BANQUE CI",       sector: 'Services financiers' },
  // Services publics
  { ticker: 'CIEC', name: "CIE CÔTE D'IVOIRE",                      sector: 'Services publics' },
  { ticker: 'SDCC', name: "SODE CÔTE D'IVOIRE",                     sector: 'Services publics' },
  // Télécommunications
  { ticker: 'ONTBF', name: 'ONATEL BURKINA FASO',                   sector: 'Télécommunications' },
  { ticker: 'ORAC',  name: "ORANGE CÔTE D'IVOIRE",                  sector: 'Télécommunications' },
  { ticker: 'SNTS',  name: 'SONATEL SÉNÉGAL',                       sector: 'Télécommunications' },
];

export interface NotationEntry {
  note: string;
  court_terme: string | null;
  long_terme: string | null;
  perspective: string;
  date_notation: string;
}

export interface InstrumentNotation {
  ticker: string;
  name: string;
  sector: string;
  agence: string | null;
  note: string | null;
  history: NotationEntry[];
}

export default async function NotationsPage() {
  const supabase = createClient();

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, notation_json')
    .in('code', COMPANIES.map((c) => c.ticker));

  const notationMap = new Map<string, { agence: string; note: string; history: NotationEntry[] }>();
  for (const row of instruments ?? []) {
    const n = row.notation_json as {
      agence?: string; note?: string;
      history?: NotationEntry[];
    } | null;
    if (!n?.note) continue;
    notationMap.set(row.code, {
      agence: n.agence ?? 'Inconnu',
      note: n.note,
      history: n.history ?? [],
    });
  }

  const data: InstrumentNotation[] = COMPANIES.map((c) => {
    const n = notationMap.get(c.ticker);
    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      agence: n?.agence ?? null,
      note: n?.note ?? null,
      history: n?.history ?? [],
    };
  });

  const totalNoted = data.filter((d) => d.note !== null).length;
  const totalHistory = data.reduce((acc, d) => acc + d.history.length, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <p className="text-xs text-muted uppercase tracking-widest mb-1">
          BRVM · Bourse Régionale des Valeurs Mobilières
        </p>
        <h1 className="text-2xl font-bold text-white">Notations Financières</h1>
        <p className="text-sm text-muted mt-1">
          {COMPANIES.length} sociétés cotées · Agences : BloomField Investment, GCR Ratings
        </p>

        <div className="flex gap-8 mt-5">
          <div>
            <p className="tabular text-2xl font-bold text-info">{totalNoted}</p>
            <p className="text-xs text-muted">sociétés notées</p>
          </div>
          <div>
            <p className="tabular text-2xl font-bold text-faint">{COMPANIES.length - totalNoted}</p>
            <p className="text-xs text-muted">sans notation</p>
          </div>
          <div>
            <p className="tabular text-2xl font-bold text-up">{totalHistory}</p>
            <p className="text-xs text-muted">notations historiques</p>
          </div>
        </div>
      </div>

      <NotationsGrid data={data} />
    </div>
  );
}
