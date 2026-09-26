'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Consentement à l'envoi hebdomadaire des dossiers valeur (migration 0132).
 *
 * RGPD. Deux cases DÉCOCHÉES PAR DÉFAUT, une par canal. Finalité : recevoir
 * chaque samedi le dossier PDF de chaque valeur détenue. Base légale :
 * consentement explicite. `dossiers_optin_at` horodate la première activation
 * et redevient nul quand les deux cases retombent — c'est la preuve du
 * consentement, et sa date de retrait.
 *
 * Ce composant n'écrit JAMAIS `telegram_chat_id` : seul le webhook le pose,
 * après validation d'un code d'appairage. Son absence du patch est une
 * garantie, pas un oubli — même règle que TelegramPrefs.
 *
 * La case Telegram reste inerte tant que la conversation n'est pas appairée :
 * cocher une case qui ne peut rien déclencher serait une promesse vide.
 */

interface Prefs {
  dossiers_email: boolean;
  dossiers_telegram: boolean;
  dossiers_optin_at: string | null;
  telegram_chat_id: number | null;
}

const DEFAUTS: Prefs = {
  dossiers_email: false,
  dossiers_telegram: false,
  dossiers_optin_at: null,
  telegram_chat_id: null,
};

const COLONNES = 'dossiers_email, dossiers_telegram, dossiers_optin_at, telegram_chat_id';

export default function DossiersPrefs({ userId }: { userId: string }) {
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
      /* 42703 = colonne inconnue, 42P01 = table inconnue : la migration 0132
         n'est pas appliquée. On masque la section plutôt que d'afficher une
         erreur que l'utilisateur ne peut pas résoudre. Même parti pris que
         TelegramPrefs face à la migration 0129. */
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

  const enregistrer = async (patch: Partial<Pick<Prefs, 'dossiers_email' | 'dossiers_telegram'>>) => {
    setEtat('envoi');
    setMessage(null);
    const suivant = { ...prefs, ...patch };
    const actif = suivant.dossiers_email || suivant.dossiers_telegram;
    // Posé à la PREMIÈRE activation, conservé tant qu'un canal reste actif,
    // effacé au retrait complet.
    const optinAt = actif ? (prefs.dossiers_optin_at ?? new Date().toISOString()) : null;
    setPrefs({ ...suivant, dossiers_optin_at: optinAt });

    const { error } = await supabase.from('notification_prefs').upsert(
      {
        user_id: userId,
        dossiers_email: suivant.dossiers_email,
        dossiers_telegram: suivant.dossiers_telegram,
        dossiers_optin_at: optinAt,
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
      <h2 className="font-display text-lg text-ivory">Dossiers valeur du samedi</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Chaque samedi, le dossier PDF de sept pages de chaque valeur de votre portefeuille. Rien
        n&apos;est envoyé si votre portefeuille est vide.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.dossiers_email}
            disabled={fige}
            onChange={(e) => void enregistrer({ dossiers_email: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Par email</span>
            <span className="mt-0.5 block text-xs text-faint">
              Les dossiers en pièces jointes, à l&apos;adresse de votre compte.
            </span>
          </span>
        </label>

        <label className={`flex items-start gap-3 text-sm ${appaire ? '' : 'opacity-60'}`}>
          <input
            type="checkbox"
            checked={prefs.dossiers_telegram}
            disabled={fige || !appaire}
            onChange={(e) => void enregistrer({ dossiers_telegram: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Sur Telegram</span>
            <span className="mt-0.5 block text-xs text-faint">
              {appaire
                ? 'Un document par valeur, dans votre conversation appairée.'
                : 'Appairez d’abord Telegram ci-dessus pour activer ce canal.'}
            </span>
          </span>
        </label>
      </div>

      {prefs.dossiers_optin_at && (
        <p className="mt-4 text-[11px] text-faint">
          Activé le {new Date(prefs.dossiers_optin_at).toLocaleDateString('fr-FR')}. Décochez pour ne
          plus rien recevoir, le retrait prend effet immédiatement.
        </p>
      )}
      {etat === 'erreur' && message && <p className="mt-3 text-xs text-down">{message}</p>}
    </section>
  );
}
