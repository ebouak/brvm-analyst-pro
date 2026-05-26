'use client';

import { useState } from 'react';

interface EditPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  position?: {
    id: string;
    code: string;
    quantite: number;
    prix_entree: number;
    date_entree: string | null;
    note: string | null;
  };
}

export default function EditPositionModal({
  isOpen,
  onClose,
  onSubmit,
  position,
}: EditPositionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(0);

  if (!isOpen || !position) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append('id', position.id);
      formData.append('rating', String(rating));
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Modifier position</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-lg"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              Code *
            </label>
            <input
              id="code"
              name="code"
              type="text"
              placeholder="ex: SNTS"
              required
              defaultValue={position.code}
              autoComplete="off"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quantite" className="block text-sm font-medium mb-1">
                Quantité *
              </label>
              <input
                id="quantite"
                name="quantite"
                type="number"
                placeholder="0"
                required
                step="any"
                defaultValue={position.quantite}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="prix_entree" className="block text-sm font-medium mb-1">
                Prix d'entrée *
              </label>
              <input
                id="prix_entree"
                name="prix_entree"
                type="number"
                placeholder="0"
                required
                step="any"
                defaultValue={position.prix_entree}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="date_entree" className="block text-sm font-medium mb-1">
              Date d'entrée
            </label>
            <input
              id="date_entree"
              name="date_entree"
              type="date"
              defaultValue={position.date_entree ?? ''}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="note" className="block text-sm font-medium mb-1">
              Note
            </label>
            <textarea
              id="note"
              name="note"
              placeholder="Notes personnelles…"
              rows={3}
              defaultValue={position.note ?? ''}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Note personnelle</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl transition ${rating >= star ? 'text-yellow-400' : 'text-muted'}`}
                  aria-label={`Note ${star} étoile(s)`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
