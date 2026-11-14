'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Consentement à l'envoi mensuel du relevé de portefeuille (migration 0233).
 *
 * RGPD. Deux cases DÉCOCHÉES PAR DÉFAUT, une par canal. Finalité : recevoir
 * chaque mois le PDF du relevé de son portefeuille. Base légale : consentement
 * explicite (la consultation du relevé dans l'application relève, elle, du
 * service Premium). `releve_optin_at` horodate la première activation et
 * redevient nul quand les deux cases retombent : preuve du consentement et date
 * de son retrait.
 *
 * ⚠️ Verrou 0162 : ce composant n'écrit JAMAIS `telegram_chat_id`,
 * `whatsapp_phone` ni `whatsapp_chat_id`. Son upsert ne porte que les colonnes
 * `releve_*`. `telegram_chat_id` est lu pour savoir si la conversation est
 * appairée, mais seul le webhook le pose.
 *
 * La case Telegram reste inerte tant que la conversation n'est pas appairée.
 * WhatsApp n'est pas proposé : le numéro y est déclaratif.
 */

interface Prefs {
  releve_email: boolean;
  releve_telegram: boolean;
  releve_optin_at: string | null;
  telegram_chat_id: number | null;
}

const DEFAUTS: Prefs = {
  releve_email: false,
  releve_telegram: false,
  releve_optin_at: null,
  telegram_chat_id: null,
};

const COLONNES = 'releve_email, releve_telegram, releve_optin_at, telegram_chat_id';

export default function RelevePrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAUTS);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'envoi' | 'erreur' | 'indisponible'>('chargement');
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select(COLONNES)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      /* 42703 = colonne inconnue : la migration 0233 n'est pas appliquée. On
         masque la section plutôt que d'afficher une erreur que l'utilisateur
         ne peut pas résoudre (même parti pris que DossiersPrefs). */
      setEtat(error.code === '42703' || error.code === '42P01' ? 'indisponible' : 'erreur');
      setMessage(error.message);
      return;
    }
    if (data) setPrefs({ ...DEFAUTS, ...(data as unknown as Prefs) });
    setEtat('pret');
  }, [supabase, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const enregistrer = async (patch: Partial<Pick<Prefs, 'releve_email' | 'releve_telegram'>>) => {
    setEtat('envoi');
    setMessage(null);
    const suivant = { ...prefs, ...patch };
    const actif = suivant.releve_email || suivant.releve_telegram;
    // Posé à la PREMIÈRE activation, conservé tant qu'un canal reste actif, effacé au retrait complet.
    const optinAt = actif ? (prefs.releve_optin_at ?? new Date().toISOString()) : null;
    setPrefs({ ...suivant, releve_optin_at: optinAt });

    const { error } = await supabase.from('notification_prefs').upsert(
      {
        user_id: userId,
        releve_email: suivant.releve_email,
        releve_telegram: suivant.releve_telegram,
        releve_optin_at: optinAt,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    setEtat('pret');
  };

  if (etat === 'indisponible') return null;

  const appaire = prefs.telegram_chat_id != null;
  const fige = etat !== 'pret';

  return (
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-ivory">Relevé mensuel du portefeuille</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Le 2 de chaque mois, le PDF de votre relevé : valeur et variation du mois, contribution de chaque
        ligne, dividendes, publications des sociétés détenues et rendez-vous à venir. Rien n&apos;est envoyé
        sans position dans votre portefeuille. Le relevé reste consultable dans l&apos;application dans tous les cas.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.releve_email}
            disabled={fige}
            onChange={(e) => void enregistrer({ releve_email: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Par email</span>
            <span className="mt-0.5 block text-xs text-faint">
              Le PDF en pièce jointe, à l&apos;adresse de votre compte.
            </span>
          </span>
        </label>

        <label className={`flex items-start gap-3 text-sm ${appaire ? '' : 'opacity-60'}`}>
          <input
            type="checkbox"
            checked={prefs.releve_telegram}
            disabled={fige || !appaire}
            onChange={(e) => void enregistrer({ releve_telegram: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Sur Telegram</span>
            <span className="mt-0.5 block text-xs text-faint">
              {appaire
                ? 'Le PDF dans votre conversation appairée.'
                : 'Appairez d’abord Telegram ci-dessus pour activer ce canal.'}
            </span>
          </span>
        </label>
      </div>

      {prefs.releve_optin_at && (
        <p className="mt-4 text-[11px] text-faint">
          Activé le {new Date(prefs.releve_optin_at).toLocaleDateString('fr-FR')}. Décochez pour ne plus rien
          recevoir, le retrait prend effet immédiatement.
        </p>
      )}
      {etat === 'erreur' && message && <p className="mt-3 text-xs text-down">{message}</p>}
    </section>
  );
}
