// frontend/app/formations/sessions/[id]/BoutonReserver.tsx
'use client';
import { useState, useTransition } from 'react';
import { reserverPlace } from '../actions';

export default function BoutonReserver({ sessionId, libelle }: { sessionId: string; libelle: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || ok}
        onClick={() => start(async () => {
          const r = await reserverPlace(sessionId);
          setMessage(r.message);
          setOk(r.ok);
        })}
        className="inline-flex min-h-[48px] items-center rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Réservation…' : libelle}
      </button>
      {message && (
        <p role="status" className={`text-sm ${ok ? 'text-up' : 'text-down'}`}>{message}</p>
      )}
    </div>
  );
}
