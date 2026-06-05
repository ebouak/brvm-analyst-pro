'use client';

import { useState } from 'react';
import { setLiquidites } from '@/app/portefeuille/actions';

interface Props {
  current: number | null;
  onClose: () => void;
}

/** Modale de saisie du montant des liquidités (cash disponible) du portefeuille. */
export default function LiquiditesModal({ current, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">💵 Liquidités</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>

        <form
          action={setLiquidites}
          onSubmit={() => { setIsSubmitting(true); setTimeout(onClose, 100); }}
          className="p-6 space-y-4"
        >
          <div>
            <label htmlFor="liq-montant" className="block text-sm font-medium mb-1">Montant disponible (FCFA)</label>
            <input
              id="liq-montant"
              name="montant"
              type="number"
              min="0"
              step="any"
              required
              defaultValue={current ?? ''}
              placeholder="ex : 206 674"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted mt-1">
              Cash non investi chez ta SGI. Compté dans la valeur totale et la répartition.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50">
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
