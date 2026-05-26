'use client';

import { useState } from 'react';
import { createAlert } from '@/app/portefeuille/actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  instruments: { code: string; designation: string | null }[];
}

export default function NewAlertModal({ isOpen, onClose, instruments }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertType, setAlertType] = useState<'prix_au_dessus' | 'prix_en_dessous' | 'variation'>('prix_au_dessus');
  const [isActive, setIsActive] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface border border-border rounded-xl shadow-lg max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Créer une alerte</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg text-lg" aria-label="Fermer">✕</button>
        </div>

        <form
          action={createAlert}
          onSubmit={() => { setIsSubmitting(true); setTimeout(onClose, 100); }}
          className="p-6 space-y-4"
        >
          <input type="hidden" name="type" value={alertType} />
          <input type="hidden" name="actif" value={String(isActive)} />

          <div>
            <label htmlFor="am-code" className="block text-sm font-medium mb-1">Code *</label>
            <select id="am-code" name="code" required
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm">
              <option value="">— Sélectionner un titre —</option>
              {instruments.map((ins) => (
                <option key={ins.code} value={ins.code}>
                  {ins.code}{ins.designation ? ` — ${ins.designation}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="am-type" className="block text-sm font-medium mb-1">Type d'alerte *</label>
            <select id="am-type" value={alertType}
              onChange={(e) => setAlertType(e.target.value as typeof alertType)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm">
              <option value="prix_au_dessus">↑ Au-dessus d'un prix</option>
              <option value="prix_en_dessous">↓ En-dessous d'un prix</option>
              <option value="variation">↕ Variation en %</option>
            </select>
          </div>

          <div>
            <label htmlFor="am-seuil" className="block text-sm font-medium mb-1">Seuil *</label>
            <input id="am-seuil" name="seuil" type="number"
              placeholder={alertType === 'variation' ? 'ex : 5 (%)' : 'ex : 12500'}
              required step="any"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
            {alertType === 'variation' && (
              <p className="text-xs text-muted mt-1">Variation en pourcentage depuis la création</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input id="am-actif" type="checkbox" checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border border-border" />
            <label htmlFor="am-actif" className="text-sm font-medium cursor-pointer">
              Alerte active au démarrage
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-bg/40 transition">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded bg-up/90 hover:bg-up text-black text-sm font-medium transition disabled:opacity-50">
              {isSubmitting ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
