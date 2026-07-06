'use client';

import { useRef } from 'react';
import { phCapture } from '@/lib/analytics/posthogClient';

/** Champ minimal — copie locale du PremiumField défini dans app/portefeuille/page.tsx. */
function Field({ name, placeholder, type = 'text', required, step }: {
  name: string; placeholder?: string; type?: string; required?: boolean; step?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      step={step}
      className="w-full rounded-chip border border-border bg-sunken px-3 py-2 text-xs text-ivory placeholder:text-faint focus:border-gold/50 outline-none transition-colors duration-200"
    />
  );
}

/**
 * Formulaire d'ajout à la watchlist — même Server Action que la version
 * précédente (progressive enhancement conservée), enveloppé côté client
 * uniquement pour capturer l'événement produit 'watchlist_add'. Capture
 * optimiste à la soumission (avant confirmation serveur) : standard pour un
 * signal d'engagement, l'ajout watchlist échoue en pratique très rarement.
 */
export function AddWatchForm({
  action,
  watchlistId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  watchlistId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => {
        const code = (formRef.current?.elements.namedItem('code') as HTMLInputElement | null)?.value;
        if (code) void phCapture('watchlist_add', { code: code.toUpperCase() });
      }}
      className="flex flex-col gap-2"
    >
      {watchlistId && <input type="hidden" name="watchlist_id" value={watchlistId} />}
      <Field name="code" placeholder="Code BRVM (ex: SGBCI)" required />
      <div className="grid grid-cols-2 gap-2">
        <Field name="prix_alerte_haut" type="number" placeholder="Alerte ▲" step="any" />
        <Field name="prix_alerte_bas" type="number" placeholder="Alerte ▼" step="any" />
      </div>
      <Field name="note" placeholder="Note (optionnel)" />
      <button
        type="submit"
        className="w-full rounded-chip bg-gold/90 py-2 text-xs font-semibold text-obsidian transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-gold active:scale-[0.98]"
      >
        Suivre ce titre
      </button>
    </form>
  );
}
