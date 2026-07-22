'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Bascule publier/dépublier une édition hebdo. */
export default function HebdoStatutButton({ id, statut }: { id: string; statut: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const cible = statut === 'publie' ? 'brouillon' : 'publie';

  async function toggle() {
    setBusy(true);
    const r = await fetch(`/api/admin/hebdo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: cible }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
        statut === 'publie'
          ? 'border-down/40 text-down hover:bg-down/10'
          : 'border-up/40 text-up hover:bg-up/10'
      }`}
    >
      {busy ? '…' : statut === 'publie' ? 'Dépublier' : 'Publier'}
    </button>
  );
}
