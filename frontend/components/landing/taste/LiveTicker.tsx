'use client';

import { useRealtimeActions } from '@/lib/realtime/useRealtimeActions';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import { toTick } from '@/lib/realtime/formatTick';
import { FlashValue } from '@/components/ui/FlashValue';

/**
 * Ticker de séance en TEMPS RÉEL : part des cours rendus par le serveur
 * (`initialRows`, ordre choisi côté serveur) et met à jour valeurs + flash
 * dès qu'un cours change en base (Supabase Realtime). Rendu identique au SSR
 * au premier paint (même `initialRows`) → hydratation cohérente ; les patchs
 * n'arrivent qu'ensuite.
 */
export function LiveTicker({
  initialRows,
  dateMarche,
}: {
  initialRows: RealtimeActionRow[];
  dateMarche: string | null;
}) {
  const { rows, flashes } = useRealtimeActions(initialRows, dateMarche);
  // On garde l'ORDRE des initialRows (movers choisis côté serveur) : les mises
  // à jour changent les valeurs en place, jamais l'ordre.
  const ordered = initialRows
    .map((seed) => rows.find((r) => r.code === seed.code) ?? seed)
    .filter(Boolean);
  const doubled = [...ordered, ...ordered];

  if (ordered.length === 0) {
    return <div className="text-[11px] text-faint">Séance à venir</div>;
  }

  return (
    <div className="flex w-max animate-ticker gap-8 whitespace-nowrap font-mono">
      {doubled.map((row, i) => {
        const t = toTick(row);
        const dir = flashes[row.code] ?? 'none';
        return (
          <span key={`${t.sym}-${i}`} className="inline-flex items-center gap-[0.45rem] text-[11px] font-bold">
            <span className="text-muted">{t.sym}</span>
            <FlashValue direction={dir} className="text-ivory">{t.val}</FlashValue>
            <span className={t.dir === 'up' ? 'text-up' : 'text-down'}>{t.pct}</span>
          </span>
        );
      })}
    </div>
  );
}
