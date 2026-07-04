import type { IndiceDaily } from '@/lib/types';

/** Libellés courts des 11 indices BRVM (mêmes codes que le dashboard). */
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

const nf = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Move({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={`tabular text-xs font-bold ${up ? 'text-up' : 'text-down'}`}>
      {up ? '+' : ''}{v.toFixed(2)} %
    </span>
  );
}

/** Grande carte (indices principaux) — esthétique glass de la landing. */
function MainCard({ i }: { i: IndiceDaily }) {
  const v = i.variation_pct ?? 0;
  return (
    <article className="rounded-card border border-border bg-surface/60 p-4 transition-colors hover:border-accent/30 hover:bg-elevated/40">
      <span className="overline text-faint">{LABELS[i.code] ?? i.libelle ?? i.code}</span>
      <div className="mt-2 tabular font-display text-ivory" style={{ fontSize: 'clamp(1.6rem,2.4vw,2.2rem)', lineHeight: 1, letterSpacing: '-0.04em' }}>
        {i.valeur != null ? nf(i.valeur as number) : '—'}
      </div>
      <div className="mt-1.5"><Move v={v} /></div>
    </article>
  );
}

/** Cellule compacte (indices sectoriels). */
function SectorCell({ i }: { i: IndiceDaily }) {
  const v = i.variation_pct ?? 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[11px] text-muted">{LABELS[i.code] ?? i.libelle ?? i.code}</div>
        <div className="tabular text-sm font-bold text-ivory">{i.valeur != null ? nf(i.valeur as number) : '—'}</div>
      </div>
      <Move v={v} />
    </div>
  );
}

/**
 * Section « Indices BRVM » de la landing : les 11 indices groupés en
 * principaux (4) + sectoriels (7), cohérente avec le dashboard. Rendue
 * uniquement si des indices sont disponibles (sinon section masquée).
 */
export function LandingIndices({ indices }: { indices: IndiceDaily[] }) {
  const byCode = new Map(indices.filter((i) => i.valeur != null).map((i) => [i.code, i]));
  const main = MAIN.map((c) => byCode.get(c)).filter((i): i is IndiceDaily => Boolean(i));
  const sector = SECTOR.map((c) => byCode.get(c)).filter((i): i is IndiceDaily => Boolean(i));
  if (main.length === 0 && sector.length === 0) return null;

  return (
    <section className="mt-10 overflow-hidden rounded-panel border border-border bg-surface/40 p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="overline text-gold-2">Indices BRVM</p>
        <span className="overline text-faint">{main.length + sector.length} indices · séance en direct</span>
      </div>

      {main.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {main.map((i) => <MainCard key={i.code} i={i} />)}
        </div>
      )}

      {sector.length > 0 && (
        <>
          <p className="overline mt-5 mb-2 text-faint">Sectoriels</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {sector.map((i) => <SectorCell key={i.code} i={i} />)}
          </div>
        </>
      )}
    </section>
  );
}
