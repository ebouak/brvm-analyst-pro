// frontend/app/admin/crm/DecisionForms.tsx
'use client';
import { useState, useTransition } from 'react';
import { cloturer, rouvrir, marquerReponse, marquerTraite, assignerResponsable, fixerEcheance } from './[cle]/actions';
import type { MotifCloture } from '@/lib/crm/types';

type Retour = { ok: boolean; message: string };
const BTN = 'rounded-full border border-border px-4 py-1.5 text-sm text-ivory hover:border-accent disabled:opacity-50';
const CHAMP = 'rounded-md border border-border bg-sunken px-3 py-1.5 text-sm text-ivory';

function useAction() {
  const [retour, setRetour] = useState<Retour | null>(null);
  const [envoi, demarrer] = useTransition();
  const lancer = (f: () => Promise<Retour>) => demarrer(async () => {
    try { setRetour(await f()); } catch { setRetour({ ok: false, message: 'Erreur serveur : décision non enregistrée.' }); }
  });
  return { retour, envoi, lancer };
}
const Msg = ({ r }: { r: Retour | null }) => (r ? <p role="status" className={`text-xs ${r.ok ? 'text-up' : 'text-down'}`}>{r.message}</p> : null);

export function ClotureForm({ cle }: { cle: string }) {
  const [motif, setMotif] = useState<MotifCloture>('pas_interesse');
  const { retour, envoi, lancer } = useAction();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select value={motif} onChange={(e) => setMotif(e.target.value as MotifCloture)} className={CHAMP} aria-label="Motif de clôture">
          <option value="pas_interesse">Pas intéressé</option>
          <option value="doublon">Doublon</option>
          <option value="deja_abonne">Déjà abonné</option>
        </select>
        <button disabled={envoi} onClick={() => lancer(() => cloturer(cle, motif))} className={BTN}>Clôturer</button>
      </div>
      <Msg r={retour} />
    </div>
  );
}

export function ActionSimple({ cle, type, libelle }: { cle: string; type: 'rouvrir' | 'reponse' | 'traite'; libelle: string }) {
  const { retour, envoi, lancer } = useAction();
  return (
    <div className="space-y-1">
      <button disabled={envoi} onClick={() => lancer(() => (type === 'rouvrir' ? rouvrir(cle) : type === 'traite' ? marquerTraite(cle) : marquerReponse(cle)))} className={BTN}>{libelle}</button>
      <Msg r={retour} />
    </div>
  );
}

export function ResponsableForm({ cle, courant, responsables }: { cle: string; courant: string | null; responsables: { id: string; email: string }[] }) {
  const [id, setId] = useState(courant ?? '');
  const { retour, envoi, lancer } = useAction();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <select value={id} onChange={(e) => setId(e.target.value)} className={CHAMP} aria-label="Responsable">
          <option value="">— choisir —</option>
          {responsables.map((r) => <option key={r.id} value={r.id}>{r.email}</option>)}
        </select>
        <button disabled={envoi || !id} onClick={() => lancer(() => assignerResponsable(cle, id))} className={BTN}>Assigner</button>
      </div>
      <Msg r={retour} />
    </div>
  );
}

export function EcheanceForm({ cle, courante }: { cle: string; courante: string | null }) {
  const [date, setDate] = useState(courante ?? '');
  const { retour, envoi, lancer } = useAction();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} aria-label="Date de suivi" />
        <button disabled={envoi || !date} onClick={() => lancer(() => fixerEcheance(cle, date))} className={BTN}>Fixer l&apos;échéance</button>
      </div>
      <Msg r={retour} />
    </div>
  );
}
