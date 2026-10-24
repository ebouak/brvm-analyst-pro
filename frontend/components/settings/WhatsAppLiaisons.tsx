'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * WhatsApp liés au compte (migration 0165, au plus 2). Chacun reçoit tout.
 * Le client LIT et DÉLIE (policies owner select/delete) ; il ne crée jamais
 * de liaison : seul le webhook en crée, après un code envoyé depuis le
 * WhatsApp à lier — c'est ce qui prouve qu'il appartient à l'utilisateur.
 */
const MAX = 2;
const NUMERO = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

type Liaison = { id: string; telephone: string | null; lie_le: string };

export default function WhatsAppLiaisons({ userId }: { userId: string }) {
  const [liaisons, setLiaisons] = useState<Liaison[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await createClient()
      .from('whatsapp_liaisons')
      .select('id, telephone, lie_le')
      .eq('user_id', userId)
      .order('lie_le', { ascending: true });
    // Migration 0165 absente : la section garde son affichage historique.
    setLiaisons(error ? [] : ((data ?? []) as Liaison[]));
    return error ? null : ((data ?? []) as Liaison[]);
  }, [userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function delier(id: string) {
    setOccupe(true);
    const { error } = await createClient().from('whatsapp_liaisons').delete().eq('id', id);
    setOccupe(false);
    if (error) return setMessage('Déliement impossible : réessayez.');
    await charger();
  }

  async function nouveauCode() {
    setOccupe(true);
    setMessage(null);
    try {
      const r = await fetch('/api/whatsapp/pairing', { method: 'POST' });
      const corps = (await r.json()) as { code?: string; error?: string };
      if (!r.ok || !corps.code) return setMessage(corps.error ?? 'Génération du code impossible.');
      setCode(corps.code);
    } catch {
      setMessage('Génération du code impossible : vérifiez votre connexion.');
    } finally {
      setOccupe(false);
    }
  }

  async function verifier() {
    const avant = liaisons?.length ?? 0;
    const apres = (await charger())?.length ?? 0;
    if (apres > avant) {
      setCode(null);
      setMessage(null);
    } else {
      setMessage('Pas encore reçu : l’envoi met quelques secondes à nous parvenir. Réessayez.');
    }
  }

  if (liaisons === null) return null;

  return (
    <div className="space-y-2">
      {liaisons.length === 0 ? (
        <p className="text-sm text-white">WhatsApp lié</p>
      ) : (
        <ul className="space-y-2">
          {liaisons.map((l, i) => (
            <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
              <span className="tabular text-sm text-white">
                {l.telephone ?? `WhatsApp ${i + 1} (numéro masqué par WhatsApp)`}
                <span className="ml-2 text-[11px] text-faint">lié le {new Date(l.lie_le).toLocaleDateString('fr-FR')}</span>
              </span>
              <button type="button" disabled={occupe} onClick={() => void delier(l.id)} className="text-xs text-muted underline underline-offset-2 hover:text-down disabled:opacity-40">
                Délier
              </button>
            </li>
          ))}
        </ul>
      )}

      {liaisons.length > 0 && liaisons.length < MAX && !code && (
        <button type="button" disabled={occupe} onClick={() => void nouveauCode()} className="text-xs font-semibold text-accent underline underline-offset-2 disabled:opacity-40">
          + Lier un autre WhatsApp ({liaisons.length}/{MAX})
        </button>
      )}

      {code && (
        <div className="space-y-2 rounded-lg border border-accent/30 p-3">
          <p className="text-xs text-muted">
            Depuis l&apos;autre WhatsApp, envoyez ce code {NUMERO ? <>au <span className="tabular text-white">+{NUMERO}</span></> : 'au numéro WESTBOURSE'} (valable 15 minutes) :
          </p>
          <p className="select-all font-mono text-2xl font-bold tracking-[0.2em] text-accent">{code}</p>
          <div className="flex flex-wrap gap-3">
            {NUMERO && (
              <a href={`https://wa.me/${NUMERO}?text=${encodeURIComponent(code)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-[#03222b]">
                Ouvrir WhatsApp avec le code
              </a>
            )}
            <button type="button" onClick={() => void verifier()} className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-white">
              J&apos;ai envoyé le code
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-down">{message}</p>}
    </div>
  );
}
