'use client';

import { useState, useTransition } from 'react';
import { startCheckout } from '@/lib/billing/checkout';
import type { BillingCycle, CheckoutResult } from '@/lib/billing/types';

export interface PlanOption {
  code: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  currency: string;
}

const nf = new Intl.NumberFormat('fr-FR');

export function PlanClient({ plans, canSubscribe }: { plans: PlanOption[]; canSubscribe: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckoutResult | null>(null);

  function subscribe(planCode: string, cycle: BillingCycle) {
    setResult(null);
    startTransition(async () => {
      const r = await startCheckout(planCode, cycle);
      setResult(r);
    });
  }

  if (!canSubscribe) {
    return (
      <div className="rounded-panel border border-border bg-surface p-6 text-sm text-muted">
        Vous avez déjà un abonnement en cours. Consultez{' '}
        <a href="/account/billing" className="text-accent hover:underline">votre facturation</a>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result && (
        <div
          role="status"
          className={`rounded-card border p-4 text-sm ${
            result.status === 'error'
              ? 'border-down/40 bg-down/5 text-down'
              : 'border-up/40 bg-up/5 text-ivory'
          }`}
        >
          {result.instructions ?? result.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.code} className="rounded-panel border border-border bg-surface p-5">
            <h3 className="font-display text-lg text-ivory">{p.name}</h3>
            <p className="mt-1 tabular text-2xl font-bold text-ivory">
              {nf.format(p.price_monthly)} <span className="text-sm text-muted">{p.currency}/mois</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => subscribe(p.code, 'monthly')}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
              >
                Mensuel
              </button>
              {p.price_yearly != null && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => subscribe(p.code, 'yearly')}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition active:scale-95 disabled:opacity-50"
                >
                  Annuel · {nf.format(p.price_yearly)} {p.currency}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
