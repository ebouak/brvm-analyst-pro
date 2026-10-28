'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Publier / Rejeter / Dépublier un article de presse. */
export default function ArticleStatutBoutons({ id, statut }: { id: string; statut: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function poser(cible: string) {
    setBusy(true);
    const r = await fetch(`/api/admin/articles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: cible }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
  }

  const bouton = (cible: string, libelle: string, ton: string) => (
    <button
      type="button"
      onClick={() => poser(cible)}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-40 ${ton}`}
    >
      {busy ? '…' : libelle}
    </button>
  );

  return (
    <div className="flex gap-2">
      {statut !== 'publie' && bouton('publie', 'Publier', 'border-up/40 text-up hover:bg-up/10')}
      {statut !== 'publie' && statut !== 'rejete' && bouton('rejete', 'Rejeter', 'border-down/40 text-down hover:bg-down/10')}
      {statut === 'publie' && bouton('brouillon', 'Dépublier', 'border-down/40 text-down hover:bg-down/10')}
    </div>
  );
}
