'use client';

import { useState, useTransition } from 'react';

interface Props {
  id: string;
  slug: string;
  initialTitre: string;
  initialResume: string;
  initialStatus: 'draft' | 'published';
}

export function EditWeeklyForm({ id, slug, initialTitre, initialResume, initialStatus }: Props) {
  const [titre, setTitre] = useState(initialTitre);
  const [resume, setResume] = useState(initialResume);
  const [status, setStatus] = useState<'draft' | 'published'>(initialStatus);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function save(newStatus?: 'draft' | 'published') {
    const nextStatus = newStatus ?? status;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/weekly/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titre, resume, status: nextStatus }),
        });
        const json = await res.json();
        if (!res.ok) {
          setMsg({ ok: false, text: json.error ?? 'Erreur serveur' });
        } else {
          setStatus(nextStatus);
          setMsg({ ok: true, text: nextStatus === 'published' ? 'Rapport publié.' : 'Repassé en brouillon.' });
        }
      } catch {
        setMsg({ ok: false, text: 'Impossible de joindre le serveur.' });
      }
    });
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.ok
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
              : 'border-red-500/30 bg-red-500/5 text-red-400'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#6b8a9a]">Titre</label>
        <input
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          className="w-full rounded-lg border border-[#1a2a30] bg-[#0a1417] px-3 py-2 text-sm text-[#FCFCFC] focus:border-cyan-400 focus:outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#6b8a9a]">Résumé</label>
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-[#1a2a30] bg-[#0a1417] px-3 py-2 text-sm text-[#FCFCFC] focus:border-cyan-400 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => save()}
          className="rounded-lg border border-[#1a2a30] bg-[#0a1417] px-4 py-2 text-sm text-[#FCFCFC] transition hover:border-cyan-400 active:scale-95 disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        {status === 'draft' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save('published')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
          >
            {pending ? '…' : 'Publier'}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => save('draft')}
            className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10 active:scale-95 disabled:opacity-50"
          >
            {pending ? '…' : 'Repasser en brouillon'}
          </button>
        )}

        <a
          href={`/weekly/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[#1a2a30] px-4 py-2 text-sm text-[#6b8a9a] transition hover:text-[#FCFCFC]"
        >
          Voir l'article
        </a>

        <button
          type="button"
          disabled
          className="rounded-lg border border-[#1a2a30] px-4 py-2 text-sm text-[#3a5a6a] cursor-not-allowed"
          title="Disponible prochainement"
        >
          Newsletter (bientôt)
        </button>
      </div>
    </div>
  );
}
