'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actualiserAppelVocal, rappelerVocal } from '../actions';
import { LIBELLE_STATUT } from '@/lib/voix/statut';
import type { RappelVocal as Etat } from '@/lib/voix/lecture';

/**
 * Rappel par l'assistant vocal (Bland). Affiché seulement si la personne a
 * laissé un numéro ET coché la case de rappel vocal. Deux temps : « Rappeler »
 * puis « Confirmer l'appel » — un appel sonne chez quelqu'un, sans retour
 * possible. Le serveur revérifie tout avant d'appeler.
 */
function fmt(d: string): string {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function RappelVocal({ messageId, etat, peutRappeler }: { messageId: string; etat: Etat; peutRappeler: boolean }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState(false);
  const [info, setInfo] = useState<{ ton: 'ok' | 'erreur'; texte: string } | null>(null);
  const [pending, start] = useTransition();

  if (!etat.disponible) {
    return <p className="text-xs text-faint">Rappel vocal indisponible : {etat.raisonIndisponible}</p>;
  }
  if (!etat.aNumero || !etat.consentAt) return null;

  return (
    <div className="rounded-[calc(var(--radius-panel,16px)-6px)] bg-surface p-5 space-y-3">
      <div className="text-[11px] text-faint">
        Rappel par l&apos;assistant vocal — consentement donné le {fmt(etat.consentAt)}
        {etat.opposition ? ' · ce numéro a demandé à ne plus être appelé' : ''}
      </div>

      {peutRappeler && (
        <div className="flex flex-wrap items-center gap-2">
          {!confirmer ? (
            <button
              type="button"
              disabled={!etat.eligibilite.ok || pending}
              onClick={() => setConfirmer(true)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ivory hover:bg-bg disabled:opacity-40"
            >
              Rappeler (assistant vocal)
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await rappelerVocal(messageId);
                    setConfirmer(false);
                    setInfo(r.ok ? { ton: 'ok', texte: 'Appel lancé. Actualisez dans une ou deux minutes.' } : { ton: 'erreur', texte: r.message });
                    router.refresh();
                  })
                }
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
              >
                {pending ? 'Appel…' : 'Confirmer l’appel'}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirmer(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm text-ivory">
                Annuler
              </button>
            </>
          )}
          {!etat.eligibilite.ok && <span className="text-xs text-muted">{etat.eligibilite.raison}</span>}
        </div>
      )}

      {info && <p className={`text-xs ${info.ton === 'ok' ? 'text-up' : 'text-down'}`}>{info.texte}</p>}

      {etat.appels.length > 0 && (
        <ul className="space-y-3">
          {etat.appels.map((a) => (
            <li key={a.id} className="border-t border-border pt-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ivory">{fmt(a.cree_le)}</span>
                <span className={a.statut === 'echec' || a.statut === 'peut_etre_parti' ? 'text-down' : 'text-muted'}>{LIBELLE_STATUT[a.statut]}</span>
                {a.duree_min != null && <span className="tabular text-muted">{a.duree_min.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} min</span>}
                {a.prix != null && <span className="tabular text-muted">{a.prix.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $</span>}
                {a.fin_par && <span className="text-faint">fin : {a.fin_par}</span>}
                {a.bland_call_id && peutRappeler && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await actualiserAppelVocal(messageId, a.id);
                        setInfo(r.ok ? null : { ton: 'erreur', texte: r.message });
                        router.refresh();
                      })
                    }
                    className="text-xs text-accent underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    Actualiser
                  </button>
                )}
              </div>
              {a.erreur && <p className="mt-1 text-xs text-down">{a.erreur === 'transcription absente' ? 'Transcription absente : appel terminé sans texte reçu de Bland.' : a.erreur}</p>}
              {a.statut === 'peut_etre_parti' && (
                <p className="mt-1 text-xs text-down">Bland n&apos;a pas confirmé l&apos;appel : il a pu sonner. Aucun nouvel essai automatique.</p>
              )}
              {a.statut === 'en_cours' && !a.bland_call_id && (
                <p className="mt-1 text-xs text-muted">En attente de la confirmation de Bland.</p>
              )}
              {a.transcription && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{a.transcription}</p>}
              {a.transcription_purgee_le && <p className="mt-1 text-xs text-faint">Transcription effacée le {fmt(a.transcription_purgee_le)} (conservation 30 jours).</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
