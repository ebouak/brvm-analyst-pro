'use client';

import { useState, useTransition } from 'react';
import { changerModePlafond } from './actions';

type Mode = 'off' | 'simulation' | 'actif';

const LIBELLE: Record<Mode, string> = { actif: 'Actif', simulation: 'Simulation', off: 'Coupé' };
const AIDE: Record<Mode, string> = {
  actif: 'Les sessions au-delà du plafond sont fermées et l’abonné est prévenu par e-mail.',
  simulation: 'Rien n’est fermé : chaque fermeture qui aurait eu lieu est journalisée.',
  off: 'Aucun calcul, aucune fermeture.',
};

export function ReglagePlafond({ mode, plafond, peutModifier }: { mode: Mode; plafond: number; peutModifier: boolean }) {
  const [courant, setCourant] = useState<Mode>(mode);
  const [arme, setArme] = useState<Mode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const confirmer = (m: Mode) =>
    demarrer(async () => {
      const r = await changerModePlafond(m);
      setArme(null);
      setMessage(r.ok ? r.message ?? null : r.message);
      if (r.ok) setCourant(m);
    });

  return (
    <div className="space-y-2">
      <div className="text-sm text-ivory">
        Plafond Premium : <span className="tabular">{plafond}</span> appareils · <span className="font-medium">{LIBELLE[courant]}</span>
      </div>
      <p className="text-xs text-muted">{AIDE[courant]}</p>
      {peutModifier && (
        <div className="flex flex-wrap items-center gap-2">
          {(['actif', 'simulation', 'off'] as Mode[])
            .filter((m) => m !== courant)
            .map((m) =>
              arme === m ? (
                <button key={m} type="button" disabled={enCours} onClick={() => confirmer(m)}
                  className="rounded-lg border border-down/60 px-3 py-1.5 text-xs text-down disabled:opacity-50">
                  Confirmer : {LIBELLE[m].toLowerCase()}
                </button>
              ) : (
                <button key={m} type="button" disabled={enCours} onClick={() => setArme(m)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ivory disabled:opacity-50">
                  Passer en {LIBELLE[m].toLowerCase()}
                </button>
              ),
            )}
        </div>
      )}
      {message && <p role="status" className="text-xs text-muted">{message}</p>}
    </div>
  );
}
