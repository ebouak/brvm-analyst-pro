'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
  alerts_email: boolean;
  agent_optin: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
  alerts_email: false,
  agent_optin: false,
};

const SELECT_COLS =
  'whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp, alerts_email, agent_optin';

/**
 * Numéro WhatsApp professionnel vers lequel envoyer le code d'appairage.
 * Uniquement l'environnement : si la variable n'est pas définie, on l'écrit
 * en toutes lettres plutôt que d'afficher un numéro deviné — un code envoyé
 * au mauvais numéro ne lierait rien et resterait sans réponse.
 */
const AGENT_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

interface Pairing {
  code: string;
  expiresAt: string;
}

/**
 * Opt-in WhatsApp (RGPD : consentement explicite, retrait libre).
 * Lit/écrit notification_prefs via la clé anon — la RLS owner fait autorité.
 * Dégrade proprement si la migration 0087 n'est pas encore appliquée.
 *
 * La liaison du numéro passe par un CODE D'APPAIRAGE et non par une saisie
 * manuelle : l'utilisateur envoie le code depuis son propre WhatsApp, et c'est
 * Meta qui communique le numéro au webhook. La possession est donc prouvée, et
 * aucune faute de frappe n'est possible. La génération du code vit côté serveur
 * (`POST /api/whatsapp/pairing`) : elle a besoin de `node:crypto` et d'une
 * écriture service-role.
 */
export default function WhatsAppPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  // Case de consentement décochée par défaut (RGPD : consentement actif).
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'unavailable'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingMsg, setPairingMsg] = useState<string | null>(null);
  // Tick pour le décompte de validité — n'avance que tant qu'un code est affiché.
  const [now, setNow] = useState(() => Date.now());

  /** Relit les préférences. Renvoie la ligne lue pour permettre un test immédiat. */
  const loadPrefs = useCallback(async (): Promise<Prefs | null> => {
    const sb = createClient();
    const { data, error } = await sb
      .from('notification_prefs')
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return (data as Prefs | null) ?? DEFAULTS;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await loadPrefs();
      if (cancelled) return;
      if (!p) {
        // Table absente (migration non appliquée) ou indispo → section neutre.
        setState('unavailable');
        return;
      }
      setPrefs(p);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPrefs]);

  useEffect(() => {
    if (!pairing) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [pairing]);

  async function save(next: Prefs) {
    setState('saving');
    setErrMsg(null);
    const sb = createClient();
    const { error } = await sb.from('notification_prefs').upsert(
      {
        user_id: userId,
        whatsapp_phone: next.whatsapp_phone,
        whatsapp_optin: next.whatsapp_optin,
        whatsapp_optin_at: next.whatsapp_optin ? new Date().toISOString() : null,
        brief_whatsapp: next.brief_whatsapp,
        alerts_whatsapp: next.alerts_whatsapp,
        alerts_email: next.alerts_email,
        agent_optin: next.agent_optin,
        agent_optin_at: next.agent_optin ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      setState('error');
      setErrMsg(error.message);
      return;
    }
    setPrefs(next);
    setState('saved');
    setTimeout(() => setState('ready'), 2000);
  }

  /** Demande un code d'appairage au serveur (la table n'accepte pas d'écriture anon). */
  async function handleGenerateCode() {
    setPairingBusy(true);
    setPairingMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/whatsapp/pairing', { method: 'POST' });
      const body = (await res.json()) as { code?: string; expiresAt?: string; error?: string };
      if (!res.ok || !body.code || !body.expiresAt) {
        setPairingMsg(body.error ?? 'Génération du code impossible — réessayez.');
        return;
      }
      setPairing({ code: body.code, expiresAt: body.expiresAt });
      setNow(Date.now());
    } catch {
      setPairingMsg('Génération du code impossible — vérifiez votre connexion.');
    } finally {
      setPairingBusy(false);
    }
  }

  /** Vérifie si le webhook a lié le numéro depuis l'envoi du code. */
  async function handleCheckLink() {
    setPairingBusy(true);
    setPairingMsg(null);
    const fresh = await loadPrefs();
    setPairingBusy(false);
    if (!fresh) {
      setPairingMsg('Vérification impossible — réessayez dans un instant.');
      return;
    }
    if (fresh.whatsapp_optin) {
      setPrefs(fresh);
      setPairing(null);
      setPairingMsg(null);
      return;
    }
    setPairingMsg(
      'Aucune liaison détectée pour l’instant. L’envoi met quelques secondes à nous parvenir — patientez, puis réessayez.',
    );
  }

  function handleWithdraw() {
    // Le retrait coupe aussi l'agent : sa case n'est visible que si WhatsApp est
    // actif, un consentement resté à true serait un consentement invisible.
    void save({
      ...prefs,
      whatsapp_optin: false,
      brief_whatsapp: false,
      alerts_whatsapp: false,
      agent_optin: false,
    });
  }

  if (state === 'loading') {
    return <div className="animate-pulse rounded-xl border border-border bg-surface h-24" />;
  }
  if (state === 'unavailable') {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-xs text-muted">
        Notifications WhatsApp : bientôt disponibles.
      </div>
    );
  }

  const remainingMs = pairing ? new Date(pairing.expiresAt).getTime() - now : 0;
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000));
  const codeExpired = pairing !== null && remainingMs <= 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ivory">Notifications d&apos;alertes</h2>
          <p className="mt-0.5 text-xs text-muted">
            Brief quotidien et alertes de vos titres, sur WhatsApp et par email.
          </p>
        </div>
        {prefs.whatsapp_optin && (
          <span className="shrink-0 rounded-full border border-up/30 bg-up/10 px-2.5 py-1 text-[10px] font-semibold text-up">
            Activé
          </span>
        )}
      </div>

      {!prefs.whatsapp_optin ? (
        <>
          {!pairing ? (
            <>
              <p className="text-xs text-muted">
                Pour lier votre numéro, vous enverrez un code depuis votre propre WhatsApp : c&apos;est
                ce qui nous prouve que le numéro est bien le vôtre. Rien à saisir à la main.
              </p>
              <label className="flex items-start gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-[#56D7FD]"
                />
                <span>
                  J&apos;accepte de recevoir le brief quotidien et mes alertes sur ce numéro WhatsApp.
                  Retrait possible à tout moment ici même ; le numéro n&apos;est utilisé que pour ces
                  envois (<Link href="/confidentialite" className="underline underline-offset-2">confidentialité</Link>).
                </span>
              </label>
              <button
                type="button"
                disabled={!consent || pairingBusy}
                onClick={() => void handleGenerateCode()}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pairingBusy ? 'Génération…' : 'Lier mon numéro WhatsApp'}
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-border/70 bg-bg/60 p-4">
              <p className="text-xs text-muted">
                {AGENT_NUMBER ? (
                  <>
                    Envoyez ce code par WhatsApp au{' '}
                    <span className="tabular font-semibold text-white">+{AGENT_NUMBER}</span>, depuis
                    le numéro que vous voulez lier.
                  </>
                ) : (
                  <>
                    Envoyez ce code par WhatsApp au numéro professionnel WESTBOURSE, depuis le numéro
                    que vous voulez lier.
                  </>
                )}
              </p>

              <p
                className="select-all font-mono text-3xl font-bold tracking-[0.2em] text-accent"
                aria-label={`Code d'appairage ${pairing.code.split('').join(' ')}`}
              >
                {pairing.code}
              </p>

              <p className="text-xs text-muted">
                {codeExpired
                  ? 'Code expiré — générez-en un nouveau.'
                  : `Valide encore ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`}
              </p>

              {AGENT_NUMBER && !codeExpired && (
                <a
                  href={`https://wa.me/${AGENT_NUMBER}?text=${encodeURIComponent(pairing.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95"
                >
                  Ouvrir WhatsApp avec le code
                </a>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {!codeExpired && (
                  <button
                    type="button"
                    disabled={pairingBusy}
                    onClick={() => void handleCheckLink()}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-40"
                  >
                    {pairingBusy ? 'Vérification…' : 'J’ai envoyé le code'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pairingBusy}
                  onClick={() => void handleGenerateCode()}
                  className="text-xs text-muted underline underline-offset-2 hover:text-white disabled:opacity-40"
                >
                  Générer un nouveau code
                </button>
              </div>

              {pairingMsg && <p className="text-xs text-down">{pairingMsg}</p>}
            </div>
          )}

          {!pairing && pairingMsg && <p className="text-xs text-down">{pairingMsg}</p>}
        </>
      ) : (
        <>
          <p className="tabular text-sm text-white">{prefs.whatsapp_phone}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={prefs.brief_whatsapp}
                onChange={(e) => void save({ ...prefs, brief_whatsapp: e.target.checked })}
                className="accent-[#56D7FD]"
              />
              Brief quotidien
            </label>
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={prefs.alerts_whatsapp}
                onChange={(e) => void save({ ...prefs, alerts_whatsapp: e.target.checked })}
                className="accent-[#56D7FD]"
              />
              Alertes de mes titres
            </label>
          </div>

          <label className="flex items-start gap-2 border-t border-border/60 pt-3 text-xs text-muted">
            <input
              type="checkbox"
              checked={prefs.agent_optin}
              onChange={(e) => void save({ ...prefs, agent_optin: e.target.checked })}
              className="mt-0.5 accent-[#56D7FD]"
            />
            <span>
              J&apos;accepte que l&apos;agent conversationnel WESTBOURSE garde l&apos;historique de nos
              échanges (90 jours) pour personnaliser ses réponses. Retrait possible à tout moment ici même.
            </span>
          </label>

          <button
            type="button"
            onClick={handleWithdraw}
            disabled={state === 'saving'}
            className="text-xs text-muted underline underline-offset-2 hover:text-down"
          >
            Retirer mon consentement (désactiver WhatsApp)
          </button>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-muted border-t border-border/60 pt-3">
        <input
          type="checkbox"
          checked={prefs.alerts_email}
          onChange={(e) => void save({ ...prefs, alerts_email: e.target.checked })}
          className="accent-[#56D7FD]"
        />
        Recevoir un email si une de mes thèses d&apos;investissement est à revoir
      </label>

      {state === 'saved' && <p className="text-xs text-up">✓ Préférences enregistrées.</p>}
      {state === 'error' && <p className="text-xs text-down">{errMsg ?? 'Erreur — réessayez.'}</p>}
    </section>
  );
}
