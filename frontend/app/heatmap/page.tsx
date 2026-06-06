import { createClient } from '@/lib/supabase/server';
import HeatmapGrid from '@/components/HeatmapGrid';
import brvmLogos from '@/lib/brvmLogos.json';
import brvmSectors from '@/lib/brvmSectors.json';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtDateFR } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Heatmap marché — BRVM Analyst Pro' };

const GRADIENT_STOPS: { pct: number; color: string; label: string }[] = [
  { pct: -8, color: '#f44336', label: '-8%' },
  { pct: -4, color: '#b03028', label: '-4%' },
  { pct: 0, color: '#232733', label: '0%' },
  { pct: 4, color: '#007a33', label: '+4%' },
  { pct: 8, color: '#00c853', label: '+8%' },
];

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

async function getData(secteur: string | null) {
  const supabase = createClient();

  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as HeatmapNode[], allSectors: [] as string[] };

  // Référentiel : le secteur fiable vit dans brvm_instruments (celui de
  // brvm_actions_daily est quasi vide). On l'utilise pour filtrer les actifs
  // ET enrichir le secteur de chaque ligne.
  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, secteur, actif')
    .eq('actif', true);

  const activeCodes = new Set<string>((instruments ?? []).map((i: { code: string }) => i.code));
  const sectorByCode = new Map<string, string>(
    (instruments ?? [])
      .filter((i: { secteur: string | null }) => i.secteur != null && i.secteur.length > 0)
      .map((i: { code: string; secteur: string | null }) => [i.code, i.secteur as string]),
  );

  const { data: actions } = await supabase
    .from('brvm_actions_daily')
    .select('code, designation, secteur, pays, cours_jour, variation_pct, volume, valeur_echangee')
    .eq('date_marche', lastDate);

  // Secteur : classification fiable du fichier brvmSectors (GICS, par ticker),
  // sinon référentiel Supabase, sinon « Autre ».
  const logoSectors = brvmSectors as Record<string, string>;
  const enriched: HeatmapNode[] = ((actions ?? []) as HeatmapNode[])
    .filter((r) => !activeCodes.size || activeCodes.has(r.code))
    .map((r) => ({ ...r, secteur: logoSectors[r.code] ?? sectorByCode.get(r.code) ?? r.secteur ?? 'Autre' }));

  // Liste complète des secteurs (avant filtre) pour les chips.
  const allSectors = Array.from(new Set<string>(enriched.map((r) => r.secteur ?? 'Autre'))).sort();

  const rows = secteur ? enriched.filter((r) => r.secteur === secteur) : enriched;

  return { lastDate, rows, allSectors };
}

export default async function HeatmapPage({ searchParams }: PageProps) {
  const secteurParam = typeof searchParams.secteur === 'string' ? searchParams.secteur : null;
  const { lastDate, rows, allSectors } = await getData(secteurParam);

  return (
    <div className="flex flex-col gap-4 p-4 h-full" style={{ minHeight: '100vh', background: '#0f1117' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#e6e9f0' }}>
            Heatmap marché
          </h1>
          {lastDate && (
            <p className="text-xs mt-0.5" style={{ color: '#8b93a7' }}>
              Séance du {fmtDateFR(lastDate)}
            </p>
          )}
        </div>

        {/* Sector filter chips */}
        {allSectors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/heatmap"
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={
                secteurParam == null
                  ? { background: '#e6e9f0', color: '#0f1117' }
                  : { background: '#232733', color: '#8b93a7' }
              }
            >
              Tous
            </Link>
            {allSectors.map((s) => (
              <Link
                key={s}
                href={`/heatmap?secteur=${encodeURIComponent(s)}`}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={
                  secteurParam === s
                    ? { background: '#e6e9f0', color: '#0f1117' }
                    : { background: '#232733', color: '#8b93a7' }
                }
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Treemap or empty state */}
      {!lastDate ? (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-lg flex-1"
          style={{ minHeight: 400, background: '#161922', border: '1px solid #232733' }}
        >
          <p style={{ color: '#8b93a7' }}>Aucune séance disponible.</p>
          <Link href="/" className="text-sm underline" style={{ color: '#4a9eff' }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      ) : (
        <div className="rounded-lg p-4" style={{ background: '#161922', border: '1px solid #232733', flex: 1 }}>
          <HeatmapGrid rows={rows} logos={brvmLogos as Record<string, string>} />
        </div>
      )}

      {/* Gradient legend */}
      {lastDate && (
        <div className="flex items-center gap-3 px-2">
          <span className="text-xs" style={{ color: '#8b93a7', whiteSpace: 'nowrap' }}>
            Variation :
          </span>
          <div className="flex items-center gap-1 flex-1 max-w-xs">
            {GRADIENT_STOPS.map((stop, idx) => (
              <div key={stop.pct} className="flex items-center gap-1">
                <div
                  className="rounded-sm"
                  style={{
                    width: idx === 0 || idx === GRADIENT_STOPS.length - 1 ? 32 : 24,
                    height: 12,
                    background: stop.color,
                  }}
                />
                <span className="text-xs" style={{ color: '#8b93a7' }}>
                  {stop.label}
                </span>
              </div>
            ))}
          </div>
          <span className="text-xs" style={{ color: '#8b93a7' }}>
            Couleur = variation du jour
          </span>
        </div>
      )}

      {/* Fallback note when filtered to an empty sector */}
      {lastDate && rows.length === 0 && secteurParam && (
        <div
          className="rounded-lg p-6 text-center"
          style={{ background: '#161922', border: '1px solid #232733', color: '#8b93a7' }}
        >
          Aucune action dans le secteur &laquo;{secteurParam}&raquo; pour cette séance.{' '}
          <Link href="/heatmap" className="underline" style={{ color: '#4a9eff' }}>
            Voir tous les secteurs
          </Link>
        </div>
      )}
    </div>
  );
}
