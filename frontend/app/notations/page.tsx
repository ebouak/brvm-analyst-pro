// Donnees marche publiques (RLS lecture publique), rafraichies toutes les 15 min
// par l'intraday : ISR 5 min (audit 2026-06-12).
export const revalidate = 300;

import { createPublicClient } from '@/lib/supabase/public';
import NotationsGrid from './NotationsGrid';
import NotationsExport from '@/components/NotationsExport';
import ViewTabs from '@/components/ViewTabs';
import { FONDA_TABS } from '@/lib/viewTabsPresets';
import {
  SectionHeader,
  MetricCard,
  EmptyStatePremium,
  StatPill,
} from '@/components/ui/premium';

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
  const supabase = createPublicClient();

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
  const coverageRatio = Math.round((totalNoted / COMPANIES.length) * 100);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <SectionHeader
        kicker="BRVM · Agences de notation"
        title="Notations financières"
        subtitle={`${COMPANIES.length} sociétés cotées — BloomField Investment · GCR Ratings`}
        actions={
          <div className="flex items-center gap-2">
            <StatPill tone="gold">{coverageRatio}% couverture</StatPill>
            <NotationsExport rows={data} />
          </div>
        }
      />
      <ViewTabs tabs={FONDA_TABS} current="/notations" />

      <div className="gold-rule" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Sociétés notées"
          value={String(totalNoted)}
          unit={`/ ${COMPANIES.length}`}
          accent="gold"
        />
        <MetricCard
          label="Sans notation"
          value={String(COMPANIES.length - totalNoted)}
          unit="titres"
          accent="neutral"
        />
        <MetricCard
          label="Notations historiques"
          value={String(totalHistory)}
          unit="entrées"
          accent="emerald"
        />
      </div>

      {/* Content or empty state */}
      {data.length === 0 ? (
        <EmptyStatePremium
          icon="◈"
          title="Aucune notation disponible"
          hint="Ingérez les notations via le scraper ou vérifiez la connexion Supabase."
        />
      ) : (
        <NotationsGrid data={data} />
      )}
    </div>
  );
}
