'use client';

import { useState } from 'react';
import { updatePosition } from '@/app/portefeuille/actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  position: {
    id: string;
    code: string;
    quantite: number;
    prix_entree: number;
    date_entree: string | null;
    note: string | null;
  };
}

export default function EditPositionModal({ isOpen, onClose, position }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Modifier position</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>

        <form
          action={updatePosition}
          onSubmit={() => { setIsSubmitting(true); setTimeout(onClose, 100); }}
          className="p-6 space-y-4"
        >
          <input type="hidden" name="id" value={position.id} />

          <div>
            <label className="block text-sm font-medium mb-1">Titre</label>
            <div className="w-full bg-bg/40 border border-border rounded px-3 py-2 text-sm text-muted">
              {position.code} <span className="text-[10px]">(non modifiable)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ep-quantite" className="block text-sm font-medium mb-1">Quantité *</label>
              <input id="ep-quantite" name="quantite" type="number" placeholder="0" required step="any"
                defaultValue={position.quantite}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="ep-prix" className="block text-sm font-medium mb-1">Prix d'entrée *</label>
              <input id="ep-prix" name="prix_entree" type="number" placeholder="0" required step="any"
                defaultValue={position.prix_entree}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label htmlFor="ep-date" className="block text-sm font-medium mb-1">Date d'entrée</label>
            <input id="ep-date" name="date_entree" type="date"
              defaultValue={position.date_entree ?? ''}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
          </div>

          <div>
            <label htmlFor="ep-note" className="block text-sm font-medium mb-1">Note</label>
            <textarea id="ep-note" name="note" placeholder="Notes personnelles…" rows={3}
              defaultValue={position.note ?? ''}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm resize-none" />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50">
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
