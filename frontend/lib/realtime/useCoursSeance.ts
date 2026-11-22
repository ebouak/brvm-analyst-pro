'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { estEnSeance } from '@/lib/freshness';
import { useRealtimeActions } from './useRealtimeActions';
import { recomposer } from './recomposer';
import { lignesAuMoment, veillesDe } from './rejeu';
import { useRejeu } from '@/components/rejeu/RejeuProvider';
import type { FlashDirection, RealtimeActionRow } from './mergeActions';

/**
 * Cours en direct pour les pages de l'application (hors landing).
 *
 * - N'écoute QUE pendant la séance (`estEnSeance`) : hors séance, aucune
 *   connexion ouverte, et rien ne prétend être « en direct ».
 * - Ne touche jamais aux champs serveur des lignes (voir `recomposer`).
 * - Sans `dateMarche`, ou en cas d'échec d'abonnement, les lignes de départ
 *   restent affichées telles quelles.
 * - Dans un RejeuProvider en cours de lecture, les lignes sont celles du
 *   relevé rejoué (`lignesAuMoment`) : la page rejoue sans rien savoir du
 *   rejeu. `enRejeu` le signale ; `enDirect` est alors faux.
 *
 * `base` doit être une référence stable (useMemo côté appelant), sinon
 * `useRealtimeActions` se resynchronise à chaque rendu.
 */
export function useCoursSeance<T extends RealtimeActionRow & { cours_precedent?: number | null }>(
  base: T[],
  dateMarche: string | null,
): {
  rows: T[];
  flashes: Record<string, FlashDirection>;
  /** Vrai pendant la séance, quand l'abonnement est ouvert (et hors rejeu). */
  enDirect: boolean;
  /** Vrai pendant un rejeu de séance. */
  enRejeu: boolean;
  /** Instant de la dernière mise à jour reçue (ou du relevé rejoué). */
  derniereMaj: Date | null;
} {
  // Faux au premier rendu (serveur compris) : pas d'écart d'hydratation.
  const [enSeance, setEnSeance] = useState(false);
  useEffect(() => {
    const maj = () => setEnSeance(estEnSeance(new Date()));
    maj();
    const t = setInterval(maj, 60_000);
    return () => clearInterval(t);
  }, []);

  const enDirect = enSeance && dateMarche != null;
  const { rows: recus, flashes } = useRealtimeActions(base, enDirect ? dateMarche : null);
  const rows = useMemo(() => recomposer(base, recus), [base, recus]);

  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const premier = useRef(true);
  useEffect(() => {
    // Le premier passage est l'état serveur, pas une mise à jour reçue.
    if (premier.current) { premier.current = false; return; }
    if (recus !== base) setDerniereMaj(new Date());
  }, [recus, base]);

  // Rejeu de séance : l'image courante remplace les cours, rien d'autre.
  const rejeu = useRejeu();
  const veilles = useMemo(() => veillesDe(base), [base]);
  const image = rejeu?.actif ? rejeu.image : null;
  const rowsRejeu = useMemo(() => (image ? lignesAuMoment(base, image, veilles) : null), [image, base, veilles]);

  if (rowsRejeu && image && rejeu) {
    return { rows: rowsRejeu, flashes: rejeu.directions, enDirect: false, enRejeu: true, derniereMaj: new Date(image.t) };
  }
  return { rows, flashes, enDirect, enRejeu: false, derniereMaj };
}
