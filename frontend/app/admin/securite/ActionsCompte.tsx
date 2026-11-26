'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deconnecterCompte, envoyerAvertissement, leverSuspension, marquerLegitime, suspendrePremium } from './actions';

type Action = 'legitime' | 'deconnexion' | 'avertissement' | 'suspension' | 'levee';

const LIBELLE: Record<Action, string> = {
  legitime: 'Marquer légitime (90 j)',
  deconnexion: 'Déconnecter tous les appareils',
  avertissement: 'Envoyer un avertissement',
  suspension: 'Suspendre le Premium',
  levee: 'Lever la suspension',
};

/**
 * Décisions graduées. Deux temps (choisir, puis confirmer avec un motif) :
 * aucune sanction ne part d'un seul clic. Le motif reste interne.
 */
export function ActionsCompte({ userId, suspendu, premium }: { userId: string; suspendu: boolean; premium: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [motif, setMotif] = useState('');
  const [jours, setJours] = useState(30);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const proposees: Action[] = suspendu
    ? ['levee', 'deconnexion', 'legitime']
    : ['legitime', 'deconnexion', 'avertissement', ...(premium ? (['suspension'] as Action[]) : [])];

  const valider = () =>
    demarrer(async () => {
      if (!action) return;
      const r =
        action === 'legitime' ? await marquerLegitime(userId, motif)
        : action === 'deconnexion' ? await deconnecterCompte(userId, motif)
        : action === 'avertissement' ? await envoyerAvertissement(userId, motif)
        : action === 'suspension' ? await suspendrePremium(userId, motif, jours)
        : await leverSuspension(userId, motif);
      setMessage({ ok: r.ok, texte: r.message ?? (r.ok ? 'Fait.' : 'Échec.') });
      if (r.ok) {
        setAction(null);
        setMotif('');
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {proposees.map((a) => (
          <button key={a} type="button" onClick={() => { setAction(a); setMessage(null); }}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${action === a ? 'border-accent text-accent' : 'border-border text-muted hover:text-ivory'}`}>
            {LIBELLE[a]}
          </button>
        ))}
      </div>

      {action && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <label className="block text-xs text-muted" htmlFor="motif-securite">
            Motif (interne, jamais envoyé à l’utilisateur)
          </label>
          <textarea id="motif-securite" value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-ivory" />
          {action === 'suspension' && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Durée
              <select value={jours} onChange={(e) => setJours(Number(e.target.value))}
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-ivory">
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={90}>90 jours</option>
                <option value={0}>Jusqu’à levée</option>
              </select>
            </label>
          )}
          {(action === 'avertissement' || action === 'suspension') && (
            <p className="text-xs text-faint">Un e-mail neutre part à l’utilisateur, avec une voie de réponse. Le motif n’y figure pas.</p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={enCours || motif.trim().length < 3} onClick={valider}
              className="rounded-lg border border-accent px-3 py-1.5 text-xs text-accent disabled:opacity-40">
              Confirmer : {LIBELLE[action].toLowerCase()}
            </button>
            <button type="button" onClick={() => setAction(null)} className="px-2 text-xs text-faint hover:text-muted">Annuler</button>
          </div>
        </div>
      )}

      {message && <p role="status" className={`text-xs ${message.ok ? 'text-up' : 'text-down'}`}>{message.texte}</p>}
    </div>
  );
}
