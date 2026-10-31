'use client';
import { useEffect, useState } from 'react';
import { basculerOpposition, lireOpposition } from '@/app/parametres/compte/oppositionAction';

export default function OppositionProfilage() {
  const [charge, setCharge] = useState(false);
  const [oppose, setOppose] = useState<boolean | null>(null);
  useEffect(() => {
    void lireOpposition().then((v) => { setOppose(v); setCharge(true); });
  }, []);
  const indisponible = charge && oppose === null;
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" disabled={!charge || oppose === null} checked={oppose === true}
          onChange={async (e) => setOppose(await basculerOpposition(e.target.checked))} />
        <span>
          Ne pas utiliser mon activité pour me proposer l&apos;offre Premium.
          <span className="block text-xs text-faint">WESTBOURSE ne vous adressera alors plus de proposition commerciale.</span>
        </span>
      </label>
      {indisponible && <p className="text-xs text-faint">Préférence momentanément indisponible.</p>}
    </div>
  );
}
