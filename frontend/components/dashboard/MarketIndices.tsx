import { TrendingUp, TrendingDown } from '@/components/icons';
import type { IndiceDaily } from '@/lib/types';

const LABELS: Record<string, string> = {
  BRVMC: 'BRVM Composite',
  BRVM30: 'BRVM 30',
  BRVMPRES: 'BRVM Prestige',
  BRVMPRIN: 'BRVM Principal',
  BRVMCBASE: 'Consommation de base',
  BRVMCDISC: 'Consommation discrétionnaire',
  BRVMENER: 'Énergie',
  BRVMINDU: 'Industriels',
  BRVMFINS: 'Services financiers',
  BRVMSPUB: 'Services publics',
  BRVMTELE: 'Télécommunications',
};

const MAIN = ['BRVMC', 'BRVM30', 'BRVMPRES', 'BRVMPRIN'];
const SECTOR = ['BRVMCBASE', 'BRVMCDISC', 'BRVMENER', 'BRVMINDU', 'BRVMFINS', 'BRVMSPUB', 'BRVMTELE'];

function Cell({ i }: { i: IndiceDaily }) {
  const v = i.variation_pct ?? 0;
  const up = v >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[10px] uppercase tracking-wider text-faint">
          {LABELS[i.code] ?? i.libelle ?? i.code}
        </div>
        <div className="tabular mt-0.5 text-base font-bold leading-none text-ivory">
          {i.valeur != null
            ? (i.valeur as number).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '—'}
        </div>
      </div>
      <div className={`flex shrink-0 items-center gap-1 tabular text-xs font-semibold ${up ? 'text-up' : 'text-down'}`}>
        <Icon size={12} />
        {up ? '+' : ''}{v.toFixed(2)}%
      </div>
    </div>
  );
}

/** Tous les indices BRVM (4 principaux + 7 sectoriels) — valeur + variation du jour. */
export default function MarketIndices({ indices }: { indices: IndiceDaily[] }) {
  const byCode = new Map(indices.filter((i) => i.valeur != null).map((i) => [i.code, i]));
  const main = MAIN.map((c) => byCode.get(c)).filter((i): i is IndiceDaily => Boolean(i));
  const sector = SECTOR.map((c) => byCode.get(c)).filter((i): i is IndiceDaily => Boolean(i));
  if (main.length === 0 && sector.length === 0) return null;

  return (
    <div className="space-y-4">
      {main.length > 0 && (
        <div>
          <p className="overline mb-2 text-faint">Indices principaux</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {main.map((i) => <Cell key={i.code} i={i} />)}
          </div>
        </div>
      )}
      {sector.length > 0 && (
        <div>
          <p className="overline mb-2 text-faint">Indices sectoriels</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {sector.map((i) => <Cell key={i.code} i={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}
