'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { estEnSeance } from '@/lib/freshness';
import { majIndice, type IndiceDirect } from './indices';
import { estEnDirect } from './recomposer';
import type { FlashDirection } from './mergeActions';

/**
 * Indices en direct (brvm_indices_daily, publiée dans `supabase_realtime`,
 * migration 0066). N'écoute que pendant la séance ; en cas d'échec, les
 * valeurs de départ restent affichées. Un seul abonnement par appelant.
 */
export function useIndicesSeance<T extends IndiceDirect>(
  base: T[],
  dateMarche: string | null,
): { indices: T[]; flashes: Record<string, FlashDirection>; enDirect: boolean; derniereMaj: Date | null } {
  const [indices, setIndices] = useState<T[]>(base);
  const [flashes, setFlashes] = useState<Record<string, FlashDirection>>({});
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const [enSeance, setEnSeance] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // État courant lu par le gestionnaire Realtime, hors fonction de mise à jour
  // (qui doit rester pure : React peut la rejouer).
  const courant = useRef<T[]>(base);

  useEffect(() => { courant.current = base; setIndices(base); }, [base]);

  const [jour, setJour] = useState<string | null>(null);
  useEffect(() => {
    const maj = () => {
      const maintenant = new Date();
      setEnSeance(estEnSeance(maintenant));
      setJour(maintenant.toISOString().slice(0, 10));
    };
    maj();
    const t = setInterval(maj, 60_000);
    return () => clearInterval(t);
  }, []);

  // On écoute la date du JOUR, jamais celle rendue par le serveur : avant le
  // premier relevé, elle désigne la séance précédente (revue Fable).
  const ecoute = enSeance && dateMarche != null ? jour : null;
  const enDirect = estEnDirect({ enSeance, dateMarche, jour, majRecue: derniereMaj != null });

  useEffect(() => {
    if (!ecoute) return;
    const supabase = createClient();
    const minuteurs = timers.current;
    const channel = supabase
      .channel(`indices-live-${ecoute}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brvm_indices_daily', filter: `date_marche=eq.${ecoute}` },
        (payload) => {
          const recu = payload.new as Partial<IndiceDirect> | null;
          if (!recu || typeof recu.code !== 'string') return;
          const code = recu.code;
          const r = majIndice(courant.current, { ...recu, code });
          if (!r.change) return;
          courant.current = r.indices;
          setIndices(r.indices);
          setDerniereMaj(new Date());
          if (r.direction !== 'none') {
            const dir = r.direction;
            setFlashes((f) => ({ ...f, [code]: dir }));
            clearTimeout(minuteurs[code]);
            minuteurs[code] = setTimeout(() => {
              setFlashes((f) => { const n = { ...f }; delete n[code]; return n; });
            }, 600);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      Object.values(minuteurs).forEach(clearTimeout);
    };
  }, [ecoute]);

  return { indices, flashes, enDirect, derniereMaj };
}
