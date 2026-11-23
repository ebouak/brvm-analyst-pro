'use client';

import { heureMaj } from '@/lib/realtime/recomposer';
import { phraseReleveCourte } from '@/lib/realtime/releve';
import { useMaintenant, useReleve } from '@/lib/realtime/useReleve';

/**
 * Indicateur « En direct » des pages de l'application (hors landing).
 *
 * - Absent hors séance : rien ne doit laisser croire qu'un cours bouge quand le
 *   marché est fermé.
 * - Point fixe, sans pulsation continue : il marque d'UNE impulsion chaque
 *   cours reçu. Le direct est un état, pas un appel à agir.
 * - Une seule région `aria-live` : une annonce par mise à jour reçue, jamais
 *   une par cellule (un lecteur d'écran en serait saturé).
 */
export function EnDirect({
  enDirect,
  derniereMaj,
  heure = true,
  className = '',
}: {
  enDirect: boolean;
  derniereMaj: Date | null;
  /**
   * Faux là où la pastille de fraîcheur dit déjà l'heure du relevé, sur la
   * même ligne (fiche action) : deux phrases voisines sur le même fait.
   */
  heure?: boolean;
  className?: string;
}) {
  // Heure du RELEVÉ partagée avec la pastille (une seule source, plus de
  // contradiction) ; « prochain vers » et « en retard » suivent l'horloge.
  const { releve, echanges } = useReleve();
  const maintenant = useMaintenant();
  if (!enDirect) return null;
  const texte = !heure
    ? 'En direct'
    : releve != null && maintenant
      ? `En direct · ${phraseReleveCourte({ dernier: new Date(releve), maintenant, echanges })}`
      : derniereMaj
        ? `En direct · cours mis à jour à ${heureMaj(derniereMaj)} UTC`
        : 'En direct pendant la séance';
  return (
    <p className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {/* Une impulsion à chaque cours reçu (clé = instant de la mise à jour),
          jamais de pulsation continue. */}
      <span key={derniereMaj?.getTime() ?? 0} aria-hidden className={`h-1.5 w-1.5 rounded-full bg-up ${derniereMaj ? 'direct-impulsion' : ''}`} />
      <span aria-live="polite" aria-atomic="true">{texte}</span>
    </p>
  );
}
