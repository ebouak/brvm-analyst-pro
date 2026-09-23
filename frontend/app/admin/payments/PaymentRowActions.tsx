'use client';

import { useTransition } from 'react';
import { confirmPayment, rejectPayment } from './actions';

/**
 * Boutons d'une ligne de paiement.
 *
 * Indexés sur l'identifiant de la TRANSACTION, jamais sur celui de
 * l'abonnement : `subscription_id` est nul pour une vente de formation, et le
 * garde-fou qui s'en suivait masquait purement et simplement les boutons sur
 * ces lignes — la vente devenait inconfirmable.
 */
export function PaymentRowActions({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await confirmPayment(transactionId); })}
        className="rounded-md border border-up/40 px-2 py-1 text-xs font-medium text-up transition active:scale-95 disabled:opacity-50"
      >
        Confirmer
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await rejectPayment(transactionId); })}
        className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
      >
        Rejeter
      </button>
    </span>
  );
}
