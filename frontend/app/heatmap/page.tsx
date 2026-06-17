import type React from 'react';
import { createClient } from '@/lib/supabase/server';
import HeatmapViews from '@/components/HeatmapViews';
import brvmLogos from '@/lib/brvmLogos.json';
import { loadHeatmap } from '@/lib/heatmapData';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtDateFR } from '@/lib/format';
import Link from 'next/link';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
} from '@/components/ui/premium';

interface SectorStat {
  secteur: string;
  count: number;
  hausses: number;
  baisses: number;
  avgVar: number;
  volume: number;
  topHausse: { code: string; pct: number } | null;
  topBaisse: { code: string; pct: number } | null;
}

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
  const { lastDate, rows: enriched } = await loadHeatmap(supabase);
  if (!lastDate) return { lastDate: null, rows: [] as HeatmapNode[], allSectors: [] as string[] };

  // Liste complète des secteurs (avant filtre) pour les chips.
  const allSectors = Array.from(new Set<string>(enriched.map((r) => r.secteur ?? 'Autre'))).sort();

  const rows = secteur ? enriched.filter((r) => r.secteur === secteur) : enriched;

  // Statistiques par secteur pour le panel d'information
  const sectorMap = new Map<string, SectorStat>();
  for (const r of enriched) {
    const sec = r.secteur ?? 'Autre';
    if (!sectorMap.has(sec)) {
      sectorMap.set(sec, { secteur: sec, count: 0, hausses: 0, baisses: 0, avgVar: 0, volume: 0, topHausse: null, topBaisse: null });
    }
    const s = sectorMap.get(sec)!;
    const v = (r as { variation_pct?: number | null }).variation_pct ?? 0;
    const vol = (r as { volume?: number | null }).volume ?? 0;
    s.count++;
    s.avgVar += v;
    s.volume += vol;
    if (v > 0) { s.hausses++; if (!s.topHausse || v > s.topHausse.pct) s.topHausse = { code: r.code, pct: v }; }
    if (v < 0) { s.baisses++; if (!s.topBaisse || v < s.topBaisse.pct) s.topBaisse = { code: r.code, pct: v }; }
  }
  const sectorStats: SectorStat[] = Array.from(sectorMap.values()).map((s) => ({
    ...s,
    avgVar: s.count > 0 ? s.avgVar / s.count : 0,
  })).sort((a, b) => b.avgVar - a.avgVar);

  return { lastDate, rows, allSectors, sectorStats } as const;
}

export default async function HeatmapPage({ searchParams }: PageProps) {
  const secteurParam = typeof searchParams.secteur === 'string' ? searchParams.secteur : null;
  const result = await getData(secteurParam);
  const { lastDate, rows, allSectors } = result;
  const sectorStats: SectorStat[] = result.sectorStats ?? [];

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
                <HeatmapViews rows={rows} logos={brvmLogos as Record<string, string>} />
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

            {/* ── Panel statistiques sectorielles ──────────────────────────── */}
            {sectorStats.length > 0 && (
              <div className="animate-rise-in [animation-delay:0.14s]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Performance par secteur
                  </span>
                  <span className="text-[10px] text-faint">
                    Taille = part du volume · couleur = variation moyenne
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectorStats.map((s) => {
                    const avg = s.avgVar;
                    const color = avg > 0 ? 'text-up' : avg < 0 ? 'text-down' : 'text-muted';
                    const borderColor = avg > 0 ? 'border-up/30' : avg < 0 ? 'border-down/30' : 'border-border';
                    const breadth = s.count > 0 ? (s.hausses / s.count) * 100 : 0;
                    return (
                      <Link
                        key={s.secteur}
                        href={secteurParam === s.secteur ? '/heatmap' : `/heatmap?secteur=${encodeURIComponent(s.secteur)}`}
                        className={`group flex flex-col gap-2 rounded-xl border bg-elevated/50 p-3.5 transition-all duration-200 hover:bg-elevated ${borderColor} ${secteurParam === s.secteur ? 'ring-1 ring-gold/40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-ivory leading-tight">{s.secteur}</span>
                          <span className={`tabular text-xs font-bold shrink-0 ${color}`}>
                            {avg >= 0 ? '+' : ''}{avg.toFixed(2)}%
                          </span>
                        </div>
                        {/* Barre breadth : hausses/total */}
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          {/* eslint-disable-next-line react/forbid-dom-props */}
                          <div
                            className="h-full rounded-full bg-up transition-all [width:var(--breadth)]"
                            style={{ '--breadth': `${breadth.toFixed(0)}%` } as React.CSSProperties}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-faint">
                          <span>{s.hausses}↑ {s.baisses}↓ {s.count - s.hausses - s.baisses}→</span>
                          {s.topHausse && (
                            <span className="text-up/80">
                              ↑ {s.topHausse.code} +{s.topHausse.pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

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
