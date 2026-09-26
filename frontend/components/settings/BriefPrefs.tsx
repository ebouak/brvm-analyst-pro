'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Consentement au brief de clôture quotidien (migration 0142).
 *
 * POURQUOI CE COMPOSANT EXISTE. La campagne d'annonce de la nouvelle landing
 * invite à « recevoir le brief chaque soir » et renvoie ici. Or
 * `notification_prefs` portait `alerts_email`, `dossiers_email` et
 * `brief_telegram` — mais AUCUN `brief_email` : le bouton principal de la
 * campagne aurait mené à une page où la case promise n'existait pas. On
 * n'appelle pas à un consentement qu'on est incapable d'enregistrer.
 *
 * RGPD. Deux cases DÉCOCHÉES PAR DÉFAUT, une par canal. Finalité : recevoir,
 * chaque soir de séance, le brief de clôture de la BRVM. Base légale :
 * consentement explicite. `brief_optin_at` n'existe pas — on réutilise
 * délibérément la convention des dossiers : l'horodatage vit dans
 * `dossiers_optin_at` pour ce qui le concerne, et ici la preuve du
 * consentement est la valeur booléenne elle-même, modifiable et retirable à
 * tout instant depuis cette page.
 *
 * Ce composant n'écrit JAMAIS `telegram_chat_id` : seul le webhook le pose,
 * après validation d'un code d'appairage. Son absence du patch est une
 * garantie, pas un oubli — même règle que TelegramPrefs et DossiersPrefs.
 *
 * La case Telegram reste inerte tant que la conversation n'est pas appairée :
 * cocher une case qui ne peut rien déclencher serait une promesse vide.
 */

interface Prefs {
  brief_email: boolean;
  brief_telegram: boolean;
  telegram_chat_id: number | null;
}

const DEFAUTS: Prefs = {
  brief_email: false,
  brief_telegram: false,
  telegram_chat_id: null,
};

const COLONNES = 'brief_email, brief_telegram, telegram_chat_id';

export default function BriefPrefs({ userId }: { userId: string }) {
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
      // 42703 = colonne absente, PGRST204/205 = schéma pas rechargé : la
      // migration 0142 n'est pas encore appliquée. On se tait plutôt que
      // d'afficher une erreur technique à un utilisateur qui n'y peut rien.
      if (['42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) {
        setEtat('indisponible');
        return;
      }
      setEtat('erreur');
      setMessage(error.message);
      return;
    }
    if (data) setPrefs({ ...DEFAUTS, ...(data as unknown as Prefs) });
    setEtat('pret');
  }, [supabase, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const enregistrer = async (patch: Partial<Pick<Prefs, 'brief_email' | 'brief_telegram'>>) => {
    setEtat('envoi');
    setMessage(null);
    const suivant = { ...prefs, ...patch };
    setPrefs(suivant);

    const { error } = await supabase.from('notification_prefs').upsert(
      {
        user_id: userId,
        brief_email: suivant.brief_email,
        brief_telegram: suivant.brief_telegram,
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
      <h2 className="font-display text-lg text-ivory">Brief de clôture</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Chaque soir de séance : l&apos;indice et sa variation, les valeurs en hausse et en baisse, les
        capitaux traités, et la part du premier échange dans le total. Rien d&apos;autre.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={prefs.brief_email}
            disabled={fige}
            onChange={(e) => void enregistrer({ brief_email: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Par email</span>
            <span className="mt-0.5 block text-xs text-faint">
              À l&apos;adresse de votre compte, après la clôture.
            </span>
          </span>
        </label>

        <label className={`flex items-start gap-3 text-sm ${appaire ? '' : 'opacity-60'}`}>
          <input
            type="checkbox"
            checked={prefs.brief_telegram}
            disabled={fige || !appaire}
            onChange={(e) => void enregistrer({ brief_telegram: e.target.checked })}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span>
            <span className="text-ivory">Sur Telegram</span>
            <span className="mt-0.5 block text-xs text-faint">
              {appaire
                ? 'Dans votre conversation privée avec le bot.'
                : 'Appairez d’abord votre conversation Telegram, plus haut sur cette page.'}
            </span>
          </span>
        </label>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-faint">
        Tout est décoché par défaut. Décocher arrête l&apos;envoi immédiatement, sans confirmation à
        demander.
      </p>

      {etat === 'erreur' && message && (
        <p className="mt-3 text-xs text-down">Enregistrement impossible : {message}</p>
      )}
    </section>
  );
}
