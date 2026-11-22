'use client';

import { heureMaj } from '@/lib/realtime/recomposer';

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
  className = '',
}: {
  enDirect: boolean;
  derniereMaj: Date | null;
  className?: string;
}) {
  if (!enDirect) return null;
  return (
    <p className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {/* Une impulsion à chaque cours reçu (clé = instant de la mise à jour),
          jamais de pulsation continue. */}
      <span key={derniereMaj?.getTime() ?? 0} aria-hidden className={`h-1.5 w-1.5 rounded-full bg-up ${derniereMaj ? 'direct-impulsion' : ''}`} />
      <span aria-live="polite" aria-atomic="true">
        {derniereMaj
          ? <>En direct · cours mis à jour à <span className="tabular">{heureMaj(derniereMaj)}</span> UTC</>
          : 'En direct pendant la séance'}
      </span>
    </p>
  );
}
