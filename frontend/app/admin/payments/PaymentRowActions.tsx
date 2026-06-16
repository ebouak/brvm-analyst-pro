'use client';

import { useTransition } from 'react';
import { confirmPayment, rejectPayment } from './actions';

export function PaymentRowActions({ subscriptionId }: { subscriptionId: string | null }) {
  const [pending, startTransition] = useTransition();
  if (!subscriptionId) return <span className="text-faint">—</span>;

  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await confirmPayment(subscriptionId); })}
        className="rounded-md border border-up/40 px-2 py-1 text-xs font-medium text-up transition active:scale-95 disabled:opacity-50"
      >
        Confirmer
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await rejectPayment(subscriptionId); })}
        className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
      >
        Rejeter
      </button>
    </span>
  );
}
