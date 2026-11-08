import type React from 'react';
import { createClient } from '@/lib/supabase/server';
import HeatmapViews, { SecteurSelect } from '@/components/HeatmapViews';
import brvmLogos from '@/lib/brvmLogos.json';
import { loadHeatmap } from '@/lib/heatmapData';
import type { HeatmapNode } from '@/lib/heatmap';
import Link from 'next/link';
import { fmtPctSigne } from '@/lib/format';
import {
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
/** "2026-11-03" → "3 nov. 2026" (affichage seul). */
function fmtDateFR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const metadata = { title: 'Heatmap marché' };

/**
 * Légende du gradient : jetons up / down
 * Alignés sur couleurVariation() dans lib/heatmap.ts (pleine intensité à ±4 %).
 * bgClass = classe Tailwind arbitraire statique pour éviter tout style inline.
 */
const GRADIENT_STOPS: { pct: number; bgClass: string; label: string }[] = [
  { pct: -4, bgClass: 'bg-down',                        label: '−4 %' },
  { pct: -2, bgClass: 'bg-down/60',                   label: '−2 %' },
  { pct:  0, bgClass: 'bg-border-strong',                label:  '0 %' },
  { pct:  2, bgClass: 'bg-up/60',                   label: '+2 %' },
  { pct:  4, bgClass: 'bg-up',                           label: '+4 %' },
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

      <div className="relative flex flex-col flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 gap-5 sm:gap-6">

        {/* ── En-tête + filtres secteur ──────────────────────────────────── */}
        <div className="animate-rise-in flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight text-ivory">Heatmap marché</h1>
            {lastDate && <p className="mt-2 text-sm text-muted">Séance du {fmtDateFR(lastDate)}</p>}
          </div>

          {/* Secteur — mobile : liste déroulante (les 8 puces occupaient tout
              le premier écran) ; puces à partir de md. */}
          {allSectors.length > 0 && (
            <SecteurSelect secteurs={allSectors} courant={secteurParam} className="w-full md:hidden" />
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
              <div className="p-3 sm:p-4 min-h-[420px]">
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
                <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted">
                    Performance par secteur
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-faint hidden sm:inline">
                      Cliquez pour filtrer la carte
                    </span>
                    <Link href="/secteurs" className="text-xs text-accent-ink hover:underline">
                      Analyse sectorielle complète
                    </Link>
                  </div>
                </div>
                {/* md+ : liste compacte, hiérarchie inférieure à la cartographie */}
                <ul className="hidden md:block divide-y divide-border rounded-lg border border-border">
                  {sectorStats.map((s) => {
                    const avg = s.avgVar;
                    const color = avg > 0 ? 'text-up' : avg < 0 ? 'text-down' : 'text-muted';
                    const stables = s.count - s.hausses - s.baisses;
                    const actif = secteurParam === s.secteur;
                    return (
                      <li key={s.secteur}>
                        <Link
                          href={actif ? '/heatmap' : `/heatmap?secteur=${encodeURIComponent(s.secteur)}`}
                          aria-current={actif ? 'true' : undefined}
                          className={`grid grid-cols-[minmax(0,1.6fr)_5.5rem_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 px-3 py-2 text-xs transition-colors hover:bg-elevated ${actif ? 'bg-elevated' : ''}`}
                        >
                          <span className="truncate font-medium text-ivory">{s.secteur}</span>
                          <span className={`tabular text-right font-semibold ${color}`}>{fmtPctSigne(avg)}</span>
                          <span className="tabular text-muted">
                            {s.hausses} hausse{s.hausses > 1 ? 's' : ''} · {s.baisses} baisse{s.baisses > 1 ? 's' : ''} · {stables} stable{stables > 1 ? 's' : ''}
                          </span>
                          <span className="tabular truncate text-right text-muted">
                            {s.topHausse ? `${s.topHausse.code} ${fmtPctSigne(s.topHausse.pct, 1)}` : '—'}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {/* Mobile : grille de cartes inchangée */}
                <div className="grid md:hidden grid-cols-1 sm:grid-cols-2 gap-3">
                  {sectorStats.map((s) => {
                    const avg = s.avgVar;
                    const color = avg > 0 ? 'text-up' : avg < 0 ? 'text-down' : 'text-muted';
                    const borderColor = avg > 0 ? 'border-up/30' : avg < 0 ? 'border-down/30' : 'border-border';
                    const breadth = s.count > 0 ? (s.hausses / s.count) * 100 : 0;
                    return (
                      <Link
                        key={s.secteur}
                        href={secteurParam === s.secteur ? '/heatmap' : `/heatmap?secteur=${encodeURIComponent(s.secteur)}`}
                        className={`group flex flex-col gap-2 rounded-xl border bg-elevated/50 p-3.5 transition-colors duration-200 hover:bg-elevated ${borderColor} ${secteurParam === s.secteur ? 'ring-1 ring-gold/40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-ivory leading-tight">{s.secteur}</span>
                          <span className={`tabular text-xs font-bold shrink-0 ${color}`}>
                            {fmtPctSigne(avg)}
                          </span>
                        </div>
                        {/* Barre breadth : hausses/total */}
                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                          {/* eslint-disable-next-line react/forbid-dom-props */}
                          <div
                            className={`h-full rounded-full ${avg < 0 ? 'bg-down' : avg > 0 ? 'bg-up' : 'bg-muted'} transition-[width] motion-reduce:transition-none [width:var(--breadth)]`}
                            style={{ '--breadth': `${breadth.toFixed(0)}%` } as React.CSSProperties}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-faint">
                          <span>{s.hausses} hausse{s.hausses > 1 ? 's' : ''} · {s.baisses} baisse{s.baisses > 1 ? 's' : ''} · {s.count - s.hausses - s.baisses} stable{s.count - s.hausses - s.baisses > 1 ? 's' : ''}</span>
                          {s.topHausse && (
                            <span className="text-up">
                              Top : {s.topHausse.code} {fmtPctSigne(s.topHausse.pct, 1)}
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
          <span>WESTBOURSE</span>
          {lastDate && (
            <span>
              Source BRVM · données au{' '}
              <span className="text-muted">{fmtDateFR(lastDate)}</span>
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
