'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Consentement à la récap du portefeuille jointe au point du soir (0164).
 *
 * Une seule case, DÉCOCHÉE par défaut : l'image part sur les canaux où le
 * compte reçoit déjà le point du soir (WhatsApp, Telegram, e-mail). Premium :
 * la case est affichée à tous, mais le texte le dit, et les workers
 * vérifient le niveau côté serveur — cocher ne suffit pas.
 *
 * N'écrit QUE `recap_soir` : jamais whatsapp_chat_id ni telegram_chat_id
 * (verrou de 0162 ; un upsert qui les contiendrait les viderait).
 */
export default function RecapPrefs({ userId }: { userId: string }) {
  const [actif, setActif] = useState(false);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'envoi' | 'erreur' | 'indisponible'>('chargement');
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('notification_prefs').select('recap_soir').eq('user_id', userId).maybeSingle();
    if (error) {
      // Migration 0164 pas encore appliquée : on se tait.
      if (['42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) return setEtat('indisponible');
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    setActif(Boolean((data as { recap_soir?: boolean } | null)?.recap_soir));
    setEtat('pret');
  }, [supabase, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function basculer(v: boolean) {
    setEtat('envoi');
    setMessage(null);
    setActif(v);
    const { error } = await supabase.from('notification_prefs').upsert({ user_id: userId, recap_soir: v }, { onConflict: 'user_id' });
    if (error) {
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    setEtat('pret');
  }

  if (etat === 'indisponible') return null;

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-ivory">Récap de mon portefeuille, chaque soir</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Une image de votre portefeuille à la clôture : valeur, plus-value, effet de la séance, lignes en hausse et en
        baisse, répartition et détachements à venir. Elle accompagne le point du soir, sur les canaux où vous le
        recevez (WhatsApp, Telegram, e-mail). À tout moment, écrivez aussi <b>RECAP</b> sur WhatsApp ou Telegram.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={actif}
          disabled={etat !== 'pret'}
          onChange={(e) => void basculer(e.target.checked)}
          className="mt-1 h-4 w-4 accent-accent"
        />
        <span>
          <span className="text-ivory">Joindre la récap au point du soir</span>
          <span className="mt-0.5 block text-xs text-faint">
            Réservé aux abonnés Premium. Image générée à l&apos;envoi, conservée nulle part. Sur le site, la récap est
            gratuite : bouton « Mon récap en image » sur votre portefeuille.
          </span>
        </span>
      </label>
      {etat === 'erreur' && message && <p className="mt-3 text-xs text-down">{message}</p>}
    </section>
  );
}
