'use client';

import { useState, useTransition } from 'react';
import { invalidateDiagnostic } from './actions';

export function InvalidateButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return <span className="text-xs text-faint">Invalidé</span>;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Invalider le diagnostic ${code} ? Il sera régénéré à la prochaine consultation.`)) return;
        startTransition(async () => {
          const r = await invalidateDiagnostic(code);
          if (r.ok) setDone(true);
          else alert(r.message ?? 'Échec de l’invalidation.');
        });
      }}
      className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
    >
      {pending ? '…' : 'Invalider'}
    </button>
  );
}
