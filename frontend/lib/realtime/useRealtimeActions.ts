'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mergeActionRow, type RealtimeActionRow, type FlashDirection } from './mergeActions';

/**
 * Abonnement temps réel aux cours d'une séance (Supabase Realtime). Surcouche
 * PROGRESSIVE : part de `initialRows` (fourni par le SSR) et patche l'état à
 * chaque changement en base. Toute erreur d'abonnement laisse l'état initial
 * intact — jamais d'écran cassé. La logique de fusion est pure (mergeActions),
 * ce hook ne gère que l'I/O (abonnement, flash transitoire, refocus).
 *
 * @param initialRows  cours de la séance rendus côté serveur
 * @param dateMarche   date de la séance à écouter (filtre Realtime) ; si null,
 *                     l'abonnement est désactivé (rien à écouter).
 */
export function useRealtimeActions<T extends RealtimeActionRow>(
  initialRows: T[],
  dateMarche: string | null,
): { rows: T[]; flashes: Record<string, FlashDirection> } {
  const [rows, setRows] = useState<T[]>(initialRows);
  const [flashes, setFlashes] = useState<Record<string, FlashDirection>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Resynchronise si le SSR fournit un nouvel initialRows (revalidation ISR).
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const applyChange = useCallback((change: T) => {
    setRows((prev) => {
      const res = mergeActionRow(prev, change);
      if (res.changed && res.direction !== 'none') {
        const code = change.code;
        setFlashes((f) => ({ ...f, [code]: res.direction }));
        clearTimeout(flashTimers.current[code]);
        flashTimers.current[code] = setTimeout(() => {
          setFlashes((f) => {
            const next = { ...f };
            delete next[code];
            return next;
          });
        }, 600);
      }
      return res.rows;
    });
  }, []);

  useEffect(() => {
    if (!dateMarche) return;
    const supabase = createClient();
    const timers = flashTimers.current;

    const channel = supabase
      .channel(`cours-live-${dateMarche}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brvm_actions_daily',
          filter: `date_marche=eq.${dateMarche}`,
        },
        (payload) => {
          const row = payload.new as Partial<T> | null;
          if (row && typeof row.code === 'string') applyChange(row as T);
        },
      )
      .subscribe();

    // Les navigateurs coupent les websockets en veille d'onglet : au retour au
    // premier plan, on force une resynchro de la séance courante.
    const onFocus = async () => {
      const { data } = await supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour, variation_pct, volume')
        .eq('date_marche', dateMarche);
      if (data) setRows((prev) => data.map((d) => ({ ...(prev.find((p) => p.code === d.code) ?? {}), ...d }) as T));
    };
    window.addEventListener('visibilitychange', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('visibilitychange', onFocus);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [dateMarche, applyChange]);

  return { rows, flashes };
}
