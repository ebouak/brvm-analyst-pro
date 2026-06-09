import { createClient } from '@/lib/supabase/server';
import HeatmapGrid from '@/components/HeatmapGrid';
import brvmLogos from '@/lib/brvmLogos.json';
import brvmSectors from '@/lib/brvmSectors.json';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtDateFR } from '@/lib/format';
import Link from 'next/link';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Heatmap marché — BRVM Analyst Pro' };

/**
 * Légende du gradient : émeraude (#16b46a) / rubis (#e24b4b)
 * Alignés sur colorForVariation() dans lib/heatmap.ts (seuil MAX_VAR = 8 %).
 * bgClass = classe Tailwind arbitraire statique pour éviter tout style inline.
 */
const GRADIENT_STOPS: { pct: number; bgClass: string; label: string }[] = [
  { pct: -8, bgClass: 'bg-down',                        label: '−8 %' },
  { pct: -4, bgClass: 'bg-[#8a2828]',                   label: '−4 %' },
  { pct:  0, bgClass: 'bg-border-strong',                label:  '0 %' },
  { pct:  4, bgClass: 'bg-[#0d6b3f]',                   label: '+4 %' },
  { pct:  8, bgClass: 'bg-up',                           label: '+8 %' },
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
    <div className="min-h-screen bg-bg flex flex-col">
      {/* ── Glow atmosphérique ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 bg-obsidian-glow" aria-hidden />

      <div className="relative flex flex-col flex-1 max-w-7xl w-full mx-auto px-6 py-8 gap-6">

        {/* ── En-tête + filtres secteur ──────────────────────────────────── */}
        <div className="animate-rise-in flex flex-wrap items-end justify-between gap-5">
          <SectionHeader
            kicker="BRVM · Cartographie"
            title="Heatmap marché"
            subtitle={lastDate ? `Séance du ${fmtDateFR(lastDate)}` : undefined}
          />

          {/* Chips secteur ─────────────────── */}
          {allSectors.length > 0 && (
            <div className="flex flex-wrap gap-2 max-w-xl">
              <Link
                href="/heatmap"
                className={[
                  'px-3 py-1 rounded-chip text-xs font-medium transition-all duration-200',
                  secteurParam == null
                    ? 'bg-gold text-obsidian shadow-gold-sm'
                    : 'bg-elevated border border-border text-muted hover:border-border-strong hover:text-ivory',
                ].join(' ')}
              >
                Tous
              </Link>
              {allSectors.map((s) => (
                <Link
                  key={s}
                  href={`/heatmap?secteur=${encodeURIComponent(s)}`}
                  className={[
                    'px-3 py-1 rounded-chip text-xs font-medium transition-all duration-200',
                    secteurParam === s
                      ? 'bg-gold text-obsidian shadow-gold-sm'
                      : 'bg-elevated border border-border text-muted hover:border-border-strong hover:text-ivory',
                  ].join(' ')}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Règle dorée */}
        <div className="h-px bg-gold-line -mt-2" />

        {/* ── Corps : treemap ou état vide ──────────────────────────────────── */}
        {!lastDate ? (
          <div className="animate-rise-in [animation-delay:0.10s] flex-1 flex items-center justify-center">
            <EmptyStatePremium
              icon="◈"
              title="Aucune séance disponible"
              hint="Les données de marché apparaîtront ici dès la prochaine collecte."
              action={{ href: '/', label: "Retour à l'accueil" }}
            />
          </div>
        ) : (
          <div className="animate-rise-in [animation-delay:0.08s] flex-1 flex flex-col gap-4">
            <PremiumPanel>
              <div className="p-4 min-h-[420px]">
                <HeatmapGrid rows={rows} logos={brvmLogos as Record<string, string>} />
              </div>
            </PremiumPanel>

            {/* ── Légende gradient ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
              <span className="text-xs text-faint whitespace-nowrap">Variation du jour :</span>

              {/* Barre de gradient continue — segments colorés juxtaposés */}
              <div
                className="flex flex-1 min-w-[160px] max-w-xs h-3 rounded-full overflow-hidden"
                title="Du rubis (baisse max) à l'émeraude (hausse max)"
              >
                {GRADIENT_STOPS.map((stop) => (
                  <div key={stop.pct} className={`flex-1 ${stop.bgClass}`} />
                ))}
              </div>

              {/* Étiquettes */}
              <div className="flex items-center gap-3 text-xs tabular">
                {GRADIENT_STOPS.map((stop) => (
                  <span key={stop.pct} className="flex items-center gap-1">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm ${stop.bgClass}`} />
                    <span className="text-muted">{stop.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* ── Secteur vide après filtre ─────────────────────────────────── */}
            {rows.length === 0 && secteurParam && (
              <div className="animate-rise-in [animation-delay:0.04s]">
                <EmptyStatePremium
                  icon="◌"
                  title={`Aucune action dans « ${secteurParam} »`}
                  hint="Ce secteur ne comporte pas d'actions cotées pour cette séance."
                  action={{ href: '/heatmap', label: 'Voir tous les secteurs' }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Pied de page discret ─────────────────────────────────────────── */}
        <footer className="pt-4 pb-2 flex items-center justify-between border-t border-border text-xs text-faint">
          <span>BRVM Analyst Pro</span>
          {lastDate && (
            <span>
              Données au{' '}
              <span className="text-muted">{fmtDateFR(lastDate)}</span>
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
