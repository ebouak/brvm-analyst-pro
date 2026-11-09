'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { HeatmapNode } from '@/lib/heatmap';
import type { PaletteVariation } from '@/lib/heatmap';
import { couleurVariation, groupBySector, paletteDepuisTheme } from '@/lib/heatmap';
import { chartTheme } from '@/lib/chartTheme';
import { encreSur, encresDuTheme } from '@/lib/contrasteTuile';
import { fmtPctSigne } from '@/lib/format';

function fmtPct(pct: number | null): string {
  if (pct == null) return '—';
  return fmtPctSigne(pct);
}

/** « SNTS : +1,95 % » — libellé accessible d'une tuile (format français). */
function libelleTuile(code: string, pct: number | null): string {
  return `${code} : ${pct == null ? 'variation indisponible' : fmtPctSigne(pct)}`;
}

/** Couleurs lues dans les jetons du thème, après le montage. */
interface Teintes {
  palette: PaletteVariation;
  encres: readonly [string, string] | null;
}

interface LogoTileProps {
  node: HeatmapNode;
  logoUrl?: string | null;
  /** Teintes du thème (les mêmes que la cartographie). */
  teintes?: Teintes;
}

function Tile({ node, logoUrl, teintes }: LogoTileProps) {
  // Avant le montage, les jetons ne sont pas lisibles : tuile neutre en
  // classes de thème, puis la couleur de variation dès qu'elle est connue.
  const bg = teintes ? couleurVariation(node.variation_pct, teintes.palette) : null;
  const fg = bg && teintes?.encres ? encreSur(bg, teintes.encres) : null;
  const initials = node.code.slice(0, 2);
  const [imgError, setImgError] = useState(false);
  const showLogo = logoUrl && !imgError;
  const libelle = libelleTuile(node.code, node.variation_pct);

  return (
    <Link
      href={`/actions/${node.code}`}
      className={[
        'relative flex min-w-0 aspect-square flex-col items-center justify-center overflow-hidden rounded-lg p-1.5 sm:p-2',
        'transition-transform duration-150 hover:z-10 hover:scale-[1.04] active:scale-[0.98]',
        'motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
        'focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        bg ? '' : 'bg-elevated text-ivory',
      ].join(' ')}
      style={bg ? { background: bg, color: fg ?? undefined } : undefined}
      title={node.designation ? `${libelle} (${node.designation})` : libelle}
      aria-label={libelle}
    >
      {showLogo ? (
        // Logo réduit sur mobile : la tuile (≈ 70 px en 4 colonnes) doit
        // d'abord porter le code et la variation. Fond `sur-nuit` : clair et
        // identique dans les deux thèmes, comme l'exige un logo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="h-7 w-7 shrink-0 rounded-md bg-sur-nuit object-contain p-0.5 sm:h-10 sm:w-10"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface/85 text-[11px] font-semibold text-ivory sm:h-10 sm:w-10"
        >
          {initials}
        </div>
      )}
      <span className="mt-1 max-w-full truncate text-xs font-semibold leading-none tabular sm:mt-1.5">{node.code}</span>
      <span className="mt-0.5 max-w-full truncate text-xs leading-none tabular">{fmtPct(node.variation_pct)}</span>
    </Link>
  );
}

interface HeatmapGridProps {
  rows: HeatmapNode[];
  /** Logos par code (optionnel, branché plus tard). */
  logos?: Record<string, string | null>;
}

type SortMode = 'sector' | 'gainers' | 'losers' | 'volume';

const TRIS: { mode: SortMode; label: string }[] = [
  { mode: 'sector', label: 'Par secteur' },
  { mode: 'gainers', label: 'Hausses' },
  { mode: 'losers', label: 'Baisses' },
  { mode: 'volume', label: 'Volume' },
];

const GRILLE = 'grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10';

export default function HeatmapGrid({ rows, logos = {} }: HeatmapGridProps) {
  const [sort, setSort] = useState<SortMode>('sector');
  // Lu après le montage (les jetons CSS n'existent pas au rendu serveur).
  const [teintes, setTeintes] = useState<Teintes | undefined>(undefined);
  useEffect(() => {
    setTeintes({ palette: paletteDepuisTheme(chartTheme()), encres: encresDuTheme() });
  }, []);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-elevated p-8 text-center text-sm text-muted">
        Aucune action pour cette séance.
      </p>
    );
  }

  const tri = (
    <div
      className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-sunken p-0.5"
      role="group"
      aria-label="Ordre des tuiles"
    >
      {TRIS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => setSort(mode)}
          aria-pressed={sort === mode}
          className={[
            'relative h-8 rounded-md px-3 text-xs font-medium transition-colors',
            "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            'active:bg-elevated disabled:cursor-not-allowed disabled:opacity-55',
            sort === mode ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:bg-elevated hover:text-ivory',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // Vue groupée par secteur
  if (sort === 'sector') {
    const groups = groupBySector(rows).map((g) => ({
      ...g,
      children: [...g.children].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)),
    }));
    return (
      <div className="space-y-5">
        {tri}
        {groups.map((g) => (
          <div key={g.name}>
            <h3 className="mb-2 flex items-baseline gap-2 text-xs font-semibold text-muted">
              <span>{g.name}</span>
              <span className="tabular font-normal text-faint">{g.children.length}</span>
            </h3>
            <div className={GRILLE}>
              {g.children.map((n) => (
                <Tile key={n.code} node={n} logoUrl={logos[n.code]} teintes={teintes} />
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
    <div className="space-y-5">
      {tri}
      <div className={GRILLE}>
        {flat.map((n) => (
          <Tile key={n.code} node={n} logoUrl={logos[n.code]} teintes={teintes} />
        ))}
      </div>
    </div>
  );
}
