'use client';

import { useState } from 'react';
import Link from 'next/link';
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

/** Actions par ligne de position : dossier valeur, historique des cours, modifier, supprimer. */
export default function PositionRowActions({ position }: { position: RowPosition }) {
  const [modal, setModal] = useState<'edit' | 'history' | null>(null);

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Le dossier A4 est la raison d'être de cette ligne pour un porteur :
          c'est ici, sur SA position, qu'il le cherche — pas dans un menu. */}
      <Link
        href={`/rapports/dossier/${position.code}`}
        className="text-xs text-muted hover:text-up transition"
        title="Dossier valeur (12 panneaux, imprimable)"
        aria-label={`Dossier valeur ${position.code}`}
      >
        📄
      </Link>
      {/* Le PDF du samedi. Lien natif (pas <Link>) : c'est une redirection
          vers une URL signée, pas une navigation dans l'app. */}
      <a
        href={`/api/dossier/${position.code}/pdf`}
        className="text-xs text-muted hover:text-up transition"
        title="Télécharger le dossier en PDF (produit chaque samedi)"
        aria-label={`Télécharger le dossier PDF ${position.code}`}
      >
        ⬇
      </a>
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
