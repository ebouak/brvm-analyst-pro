'use client';
import { useState } from 'react';
import NewPositionModal from './NewPositionModal';
import NewAlertModal from './NewAlertModal';
import LiquiditesModal from './LiquiditesModal';

interface Props {
  watchlistId: string | null;
  instruments: { code: string; designation: string | null }[];
  liquidites?: number | null;
}

export default function PortefeuilleModals({ watchlistId, instruments, liquidites = null }: Props) {
  const [modal, setModal] = useState<'position' | 'alert' | 'liquidites' | null>(null);
  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setModal('position')}
          className="text-xs bg-up/10 border border-up/30 text-up rounded px-3 py-1.5 hover:bg-up/20 transition">
          ➕ Nouvelle position
        </button>
        <button type="button" onClick={() => setModal('liquidites')}
          className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-white hover:border-up/40 transition">
          💵 Liquidités
        </button>
        <button type="button" onClick={() => setModal('alert')}
          className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-white hover:border-up/40 transition">
          🔔 Créer une alerte
        </button>
      </div>
      {modal === 'position' && (
        <NewPositionModal
          isOpen={true}
          onClose={() => setModal(null)}
          instruments={instruments}
          watchlistId={watchlistId}
        />
      )}
      {modal === 'liquidites' && (
        <LiquiditesModal
          current={liquidites}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'alert' && (
        <NewAlertModal
          isOpen={true}
          onClose={() => setModal(null)}
          instruments={instruments}
        />
      )}
    </>
  );
}
