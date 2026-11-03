'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { HeatmapNode } from '@/lib/heatmap';
import { colorForVariation, groupBySector } from '@/lib/heatmap';
import { fmtPctSigne } from '@/lib/format';

/** Couleur stable dérivée du code (fallback monogramme quand pas de logo). */
const MONO_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#84cc16', '#a855f7', '#14b8a6',
];
function monoColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return MONO_COLORS[h % MONO_COLORS.length];
}

function fmtPct(pct: number | null): string {
  if (pct == null) return '—';
  const s = pct > 0 ? '+' : '';
  return `${s}${pct.toFixed(2)}%`;
}

/** « SNTS : +1,95 % » — libellé accessible d'une tuile (format français). */
function libelleTuile(code: string, pct: number | null): string {
  return `${code} : ${pct == null ? 'variation indisponible' : fmtPctSigne(pct)}`;
}

/** Texte lisible (blanc) ou sombre selon la luminance du fond. */
function textOn(bg: string): string {
  const c = bg.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0f1117' : '#ffffff';
}

interface LogoTileProps {
  node: HeatmapNode;
  logoUrl?: string | null;
}

function Tile({ node, logoUrl }: LogoTileProps) {
  const bg = colorForVariation(node.variation_pct);
  const fg = textOn(bg);
  const initials = node.code.slice(0, 2);
  const [imgError, setImgError] = useState(false);
  const showLogo = logoUrl && !imgError;
  const libelle = libelleTuile(node.code, node.variation_pct);

  return (
    <Link
      href={`/actions/${node.code}`}
      className="relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg p-1.5 sm:p-2 aspect-square transition-transform hover:scale-[1.04] hover:z-10"
      style={{ background: bg, color: fg }}
      title={node.designation ? `${libelle} — ${node.designation}` : libelle}
      aria-label={libelle}
    >
      {showLogo ? (
        // Logo réduit sur mobile : la tuile (≈ 70 px en 4 colonnes) doit
        // d'abord porter le code et la variation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="h-7 w-7 shrink-0 rounded-md object-contain sm:h-10 sm:w-10"
          style={{ background: '#fff', padding: 2 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold sm:h-10 sm:w-10 sm:text-[11px]"
          style={{ background: monoColor(node.code), color: '#fff' }}
        >
          {initials}
        </div>
      )}
      <span className="mt-1 sm:mt-1.5 max-w-full truncate text-[11px] font-semibold leading-none tabular">{node.code}</span>
      <span className="mt-0.5 max-w-full truncate text-[10px] font-medium leading-none tabular opacity-90">
        {fmtPct(node.variation_pct)}
      </span>
    </Link>
  );
}

interface HeatmapGridProps {
  rows: HeatmapNode[];
  /** Logos par code (optionnel, branché plus tard). */
  logos?: Record<string, string | null>;
}

type SortMode = 'sector' | 'gainers' | 'losers' | 'volume';

export default function HeatmapGrid({ rows, logos = {} }: HeatmapGridProps) {
  const [sort, setSort] = useState<SortMode>('sector');

  if (rows.length === 0) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ background: '#161922', border: '1px solid #232733', color: '#8b93a7' }}>
        Aucune action pour cette séance.
      </div>
    );
  }

  const SortBtn = ({ mode, label }: { mode: SortMode; label: string }) => (
    <button
      type="button"
      onClick={() => setSort(mode)}
      className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
      style={sort === mode ? { background: '#e6e9f0', color: '#0f1117' } : { background: '#232733', color: '#8b93a7' }}
    >
      {label}
    </button>
  );

  // Vue groupée par secteur
  if (sort === 'sector') {
    const groups = groupBySector(rows).map((g) => ({
      ...g,
      children: [...g.children].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)),
    }));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <SortBtn mode="sector" label="Par secteur" />
          <SortBtn mode="gainers" label="Hausses" />
          <SortBtn mode="losers" label="Baisses" />
          <SortBtn mode="volume" label="Volume" />
        </div>
        {groups.map((g) => (
          <div key={g.name}>
            <h3 className="text-xs font-semibold mb-2" style={{ color: '#8b93a7' }}>
              {g.name} <span className="opacity-60">· {g.children.length}</span>
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {g.children.map((n) => (
                <Tile key={n.code} node={n} logoUrl={logos[n.code]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vues triées à plat
  const flat = [...rows];
  if (sort === 'gainers') flat.sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0));
  else if (sort === 'losers') flat.sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0));
  else if (sort === 'volume') flat.sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SortBtn mode="sector" label="Par secteur" />
        <SortBtn mode="gainers" label="Hausses" />
        <SortBtn mode="losers" label="Baisses" />
        <SortBtn mode="volume" label="Volume" />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {flat.map((n) => (
          <Tile key={n.code} node={n} logoUrl={logos[n.code]} />
        ))}
      </div>
    </div>
  );
}
