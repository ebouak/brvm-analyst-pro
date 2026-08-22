import type { SectorVariation } from '@/lib/landing/sectors';

/**
 * Rangée des variations sectorielles du jour (section 07).
 *
 * Les valeurs sont calculées à partir de la classification `brvmSectors.json`
 * et des variations réelles de la séance — voir lib/landing/sectors.ts.
 * Un secteur sans donnée exploitable n'apparaît pas : aucune pastille à 0 %
 * par défaut.
 */
export function SectorStrip({ sectors, dateLabel }: { sectors: SectorVariation[]; dateLabel: string | null }) {
  if (sectors.length === 0) return null;

  return (
    <section aria-labelledby="secteurs-titre" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="secteurs-titre" className="overline text-gold-2">
          Secteurs · variation du jour
        </h2>
        {dateLabel && <span className="overline text-faint">Séance du {dateLabel}</span>}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {sectors.map((s) => {
          const up = s.variation_pct > 0;
          const down = s.variation_pct < 0;
          const tone = up ? 'text-up' : down ? 'text-down' : 'text-muted';
          return (
            <li
              key={s.secteur}
              className="rounded-xl border border-border/60 bg-surface/60 px-3 py-2.5"
              title={`${s.nb} valeur${s.nb > 1 ? 's' : ''} · moyenne pondérée par la capitalisation`}
            >
              <p className="truncate text-[10.5px] leading-tight text-muted">{s.secteur}</p>
              <p className={`tabular mt-1 text-sm font-bold ${tone}`}>
                {up ? '+' : ''}
                {s.variation_pct.toFixed(2)}&nbsp;%
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
