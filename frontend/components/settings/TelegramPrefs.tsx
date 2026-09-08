'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Prefs {
  telegram_chat_id: number | null;
  telegram_optin: boolean;
  brief_telegram: boolean;
  alerts_telegram: boolean;
  agent_optin: boolean;
}

const DEFAULTS: Prefs = {
  telegram_chat_id: null,
  telegram_optin: false,
  brief_telegram: false,
  alerts_telegram: false,
  agent_optin: false,
};

const SELECT_COLS = 'telegram_chat_id, telegram_optin, brief_telegram, alerts_telegram, agent_optin';

/**
 * Identifiant du bot vers lequel envoyer le code. Uniquement l'environnement :
 * si la variable manque, on l'écrit en toutes lettres plutôt que d'afficher un
 * nom deviné — un code envoyé au mauvais bot ne lierait rien et resterait sans
 * réponse.
 */
const BOT = (process.env.NEXT_PUBLIC_TELEGRAM_BOT || '').replace(/^@/, '').trim();

interface Pairing {
  code: string;
  expiresAt: string;
}

/**
 * Liaison et préférences Telegram (RGPD : consentement explicite, retrait
 * libre). Lit/écrit notification_prefs via la clé anon — la RLS owner fait
 * autorité. Dégrade proprement si la migration 0129 n'est pas appliquée.
 *
 * DIFFÉRENCE DE FOND AVEC WHATSAPP : il n'y a aucun champ de saisie. Le
 * chat_id n'est jamais tapé par l'utilisateur, il est communiqué par Telegram
 * au webhook après réception du code. La possession est donc prouvée — là où
 * un numéro WhatsApp reste déclaratif (voir migration 0127).
 */
export default function TelegramPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  // Case décochée par défaut (RGPD : consentement actif, jamais présumé).
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<
    'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'unavailable'
  >('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);

  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // 42703 = colonne inconnue, 42P01 = table inconnue : la migration 0129
      // n'est pas appliquée. On masque la section plutôt que d'afficher une
      // erreur incompréhensible.
      setState(error.code === '42703' || error.code === '42P01' ? 'unavailable' : 'error');
      setErrMsg(error.message);
      return;
    }
    if (data) {
      const p = { ...DEFAULTS, ...(data as unknown as Prefs) };
      setPrefs(p);
      setConsent(Boolean(p.telegram_optin));
    }
    setState('ready');
  }, [supabase, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const enregistrer = async (patch: Partial<Prefs>) => {
    setState('saving');
    setErrMsg(null);
    const suivant = { ...prefs, ...patch };
    setPrefs(suivant);

    // telegram_chat_id n'est JAMAIS écrit ici : seul le webhook le pose, après
    // validation d'un code. Son absence du patch est une garantie, pas un oubli.
    const { error } = await supabase.from('notification_prefs').upsert(
      {
        user_id: userId,
        telegram_optin: suivant.telegram_optin,
        brief_telegram: suivant.brief_telegram,
        alerts_telegram: suivant.alerts_telegram,
        agent_optin: suivant.agent_optin,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      setState('error');
      setErrMsg(error.message);
      return;
    }
    setState('saved');
    setTimeout(() => setState('ready'), 1800);
  };

  const genererCode = async () => {
    setPairingBusy(true);
    setErrMsg(null);
    try {
      const r = await fetch('/api/telegram/pairing', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setErrMsg(j.error ?? 'Génération impossible.');
        return;
      }
      setPairing(j as Pairing);
    } catch {
      setErrMsg('Génération impossible pour le moment.');
    } finally {
      setPairingBusy(false);
    }
  };

  const delier = async () => {
    setState('saving');
    // Le retrait remet telegram_optin à false ET efface le chat_id : laisser
    // l'identifiant en base après un retrait de consentement conserverait une
    // donnée personnelle sans base légale.
    const { error } = await supabase
      .from('notification_prefs')
      .update({
        telegram_chat_id: null,
        telegram_optin: false,
        alerts_telegram: false,
        brief_telegram: false,
      })
      .eq('user_id', userId);
    if (error) {
      setState('error');
      setErrMsg(error.message);
      return;
    }
    setPrefs({
      ...prefs,
      telegram_chat_id: null,
      telegram_optin: false,
      alerts_telegram: false,
      brief_telegram: false,
    });
    setConsent(false);
    setPairing(null);
    setState('ready');
  };

  if (state === 'loading') {
    return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface p-6" />;
  }
  // Section entièrement masquée tant que la migration n'est pas appliquée :
  // mieux vaut une fonctionnalité absente qu'une promesse en erreur.
  if (state === 'unavailable') return null;

  const lie = prefs.telegram_chat_id != null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-white">Telegram</h2>
        <span className={`text-xs ${lie ? 'text-up' : 'text-muted'}`}>
          {lie ? '● Lié à votre compte' : '○ Non lié'}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        Recevez vos alertes directement dans Telegram, et posez vos questions à l’agent
        WESTBOURSE. Gratuit, sans SMS.
      </p>

      {!lie && (
        <div className="mt-4 rounded-lg border border-border/60 bg-bg/40 p-4">
          {!pairing ? (
            <>
              <p className="text-sm text-muted">
                Générez un code, puis envoyez-le au bot depuis votre Telegram. C’est ce message qui
                prouve que le compte est bien le vôtre — rien à recopier de notre côté.
              </p>
              <button
                type="button"
                onClick={() => void genererCode()}
                disabled={pairingBusy}
                className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {pairingBusy ? 'Génération…' : 'Générer mon code'}
              </button>
            </>
          ) : (
            <>
              <p className="overline text-muted">Votre code</p>
              <p className="tabular mt-1 text-2xl font-bold tracking-widest text-accent">
                {pairing.code}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Envoyez ce code à{' '}
                {BOT ? (
                  <a
                    href={`https://t.me/${BOT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    @{BOT}
                  </a>
                ) : (
                  <span className="text-white">notre bot Telegram</span>
                )}
                . Il expire à{' '}
                <span className="tabular text-white">
                  {new Date(pairing.expiresAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                .
              </p>
              <button
                type="button"
                onClick={() => void charger()}
                className="mt-3 text-xs font-semibold text-muted transition-colors hover:text-white"
              >
                J’ai envoyé le code — vérifier
              </button>
            </>
          )}
        </div>
      )}

      {lie && (
        <>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                void enregistrer({ telegram_optin: e.target.checked });
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-muted">
              J’accepte de recevoir des messages de WESTBOURSE sur Telegram. Retirable à tout
              moment.
            </span>
          </label>

          <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
            {[
              { k: 'alerts_telegram' as const, l: 'Mes alertes sur titres' },
              { k: 'brief_telegram' as const, l: 'Le brief quotidien' },
              { k: 'agent_optin' as const, l: 'Agent conversationnel (poser des questions)' },
            ].map(({ k, l }) => (
              <label key={k} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  disabled={!consent}
                  onChange={(e) => void enregistrer({ [k]: e.target.checked } as Partial<Prefs>)}
                  className="h-4 w-4 accent-[var(--accent)] disabled:opacity-40"
                />
                <span className={consent ? 'text-white' : 'text-faint'}>{l}</span>
              </label>
            ))}
            {/* L'agent est commun aux canaux : le dire évite de croire qu'on
                l'active deux fois. */}
            <p className="pt-1 text-xs text-faint">
              L’agent conversationnel est le même sur WhatsApp et Telegram : ce réglage vaut pour
              les deux.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void delier()}
            className="mt-4 text-xs font-semibold text-down transition-opacity hover:opacity-80"
          >
            Délier mon Telegram
          </button>
        </>
      )}

      {state === 'saved' && <p className="mt-3 text-xs text-up">Enregistré.</p>}
      {errMsg && <p className="mt-3 text-xs text-down">{errMsg}</p>}
    </section>
  );
}
