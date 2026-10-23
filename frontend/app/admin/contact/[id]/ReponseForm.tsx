'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { validerBrouillon } from '@/lib/contact/validerBrouillon';
import { AVERTISSEMENT, SIGNATURE } from '@/lib/contact/rendu';
import { changerStatut, envoyerReponse, genererBrouillonAction } from '../actions';
import type { StatutContact } from '@/lib/admin/contact';

/**
 * Brouillon éditable + envoi en deux temps (« Envoyer » puis « Confirmer ») :
 * un envoi part chez un inconnu sans retour possible. Le contrôle affiché ici
 * est un confort ; le serveur revalide avant tout envoi.
 */
export default function ReponseForm({
  id,
  email,
  canal,
  statut,
  brouillonInitial,
  peutRepondre,
}: {
  id: string;
  email: string;
  canal: 'email' | 'whatsapp';
  statut: StatutContact;
  brouillonInitial: string;
  peutRepondre: boolean;
}) {
  const router = useRouter();
  const [texte, setTexte] = useState(brouillonInitial);
  const [info, setInfo] = useState<{ ton: 'ok' | 'erreur' | 'neutre'; texte: string } | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [pending, start] = useTransition();
  const lance = useRef(false);

  const verdict = useMemo(() => validerBrouillon(texte), [texte]);
  const actif = statut === 'nouveau';

  async function generer() {
    setGeneration(true);
    setInfo({ ton: 'neutre', texte: 'Rédaction du brouillon…' });
    const r = await genererBrouillonAction(id);
    setGeneration(false);
    if (r.ok && r.brouillon) {
      setTexte(r.brouillon);
      setInfo({ ton: 'neutre', texte: 'Brouillon rédigé par l’IA : relisez-le avant d’envoyer.' });
    } else if (!r.ok) {
      setInfo({ ton: 'erreur', texte: r.message });
    }
  }

  // Un brouillon est rédigé à la première ouverture d'un message en attente.
  useEffect(() => {
    if (lance.current || !peutRepondre || !actif || brouillonInitial) return;
    lance.current = true;
    void generer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!peutRepondre) {
    return <p className="text-sm text-muted">Votre rôle permet de lire ce message, pas d’y répondre.</p>;
  }

  return (
    <div className="space-y-4">
      {actif ? (
        <>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-faint">Réponse à {email}</span>
            <textarea
              value={texte}
              onChange={(e) => {
                setTexte(e.target.value);
                setConfirmer(false);
              }}
              rows={14}
              disabled={generation || pending}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed text-ivory disabled:opacity-60"
              placeholder="Bonjour …,"
            />
          </label>

          <div className="rounded-lg border border-border/60 bg-elevated/40 px-4 py-3 text-xs text-muted">
            {canal === 'whatsapp' ? (
              <>
                Envoyé <b>sur WhatsApp</b>, depuis le numéro WESTBOURSE, en texte simple. Ajouté automatiquement : l&apos;offre
                formation en version courte (prix lu au catalogue Chariow), « {AVERTISSEMENT} » et la signature « {SIGNATURE} ».
                N&apos;écrivez ni prix ni offre dans votre texte.
              </>
            ) : (
              <>
                Ajouté automatiquement sous votre texte : le bloc « Pour aller plus loin » (formation complète, 4 niveaux à vie
                + 1 mois Premium, prix lu au catalogue Chariow à l&apos;envoi, lien d&apos;inscription vers l&apos;offre), « {AVERTISSEMENT} »,
                la signature « {SIGNATURE} », puis le message du visiteur cité. Envoi depuis support@westbourse.com. N&apos;écrivez
                ni prix ni offre dans votre texte.
              </>
            )}
          </div>

          {texte.trim() && !verdict.ok && (
            <p className="text-sm text-down" role="alert">
              Envoi bloqué : {verdict.raison}
            </p>
          )}
          {info && (
            <p
              className={`text-sm ${info.ton === 'erreur' ? 'text-down' : info.ton === 'ok' ? 'text-up' : 'text-muted'}`}
              role="status"
            >
              {info.texte}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!confirmer ? (
              <button
                type="button"
                disabled={!verdict.ok || pending || generation}
                onClick={() => setConfirmer(true)}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
              >
                Envoyer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await envoyerReponse(id, texte);
                      if (r.ok) {
                        setInfo({ ton: 'ok', texte: 'Réponse envoyée.' });
                        router.refresh();
                      } else {
                        setConfirmer(false);
                        setInfo({ ton: 'erreur', texte: r.message });
                      }
                    })
                  }
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
                >
                  {pending ? 'Envoi…' : `Confirmer l’envoi à ${email}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmer(false)}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm text-ivory"
                >
                  Annuler
                </button>
              </>
            )}
            <button
              type="button"
              disabled={generation || pending}
              onClick={() => void generer()}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ivory hover:bg-surface disabled:opacity-40"
            >
              {generation ? 'Rédaction…' : 'Régénérer le brouillon'}
            </button>
            <span className="flex-1" />
            {(['clos', 'spam'] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await changerStatut(id, s);
                    if (r.ok) router.refresh();
                    else setInfo({ ton: 'erreur', texte: r.message });
                  })
                }
                className="rounded-lg px-3 py-2 text-xs text-muted hover:text-ivory"
              >
                {s === 'clos' ? 'Clore sans réponse' : 'Marquer comme spam'}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            {statut === 'envoi' ? 'Un envoi est en cours pour ce message.' : 'Message clos.'}
          </p>
          {statut !== 'envoi' && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await changerStatut(id, 'nouveau');
                  if (r.ok) router.refresh();
                  else setInfo({ ton: 'erreur', texte: r.message });
                })
              }
              className="rounded-lg border border-border px-4 py-2 text-sm text-ivory"
            >
              Rouvrir
            </button>
          )}
          {info && <p className="text-sm text-down">{info.texte}</p>}
        </div>
      )}
    </div>
  );
}
