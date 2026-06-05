'use client';

import { useState } from 'react';
import { deletePosition } from '@/app/portefeuille/actions';
import EditPositionModal from './EditPositionModal';
import PriceHistoryModal from './PriceHistoryModal';

export interface RowPosition {
  id: string;
  code: string;
  quantite: number;
  prix_entree: number;
  date_entree: string | null;
  note: string | null;
}

/** Actions par ligne de position : modifier, voir l'historique des cours, supprimer. */
export default function PositionRowActions({ position }: { position: RowPosition }) {
  const [modal, setModal] = useState<'edit' | 'history' | null>(null);

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setModal('history')}
        className="text-xs text-muted hover:text-up transition"
        title="Voir l'historique des cours"
      >
        📈
      </button>
      <button
        type="button"
        onClick={() => setModal('edit')}
        className="text-xs text-muted hover:text-up transition"
        title="Modifier la position"
      >
        ✏️
      </button>
      <form action={deletePosition} className="inline">
        <input type="hidden" name="id" value={position.id} />
        <button
          type="submit"
          className="text-xs text-down hover:underline transition"
          title="Supprimer la position"
        >
          ✕
        </button>
      </form>

      {modal === 'edit' && (
        <EditPositionModal isOpen position={position} onClose={() => setModal(null)} />
      )}
      {modal === 'history' && (
        <PriceHistoryModal code={position.code} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
