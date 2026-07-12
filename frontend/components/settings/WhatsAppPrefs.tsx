'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { normalizeE164, UEMOA_DIAL_CODES } from '@/lib/notifications/phone';

interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
};

/**
 * Opt-in WhatsApp (RGPD : consentement explicite, retrait libre).
 * Lit/écrit notification_prefs via la clé anon — la RLS owner fait autorité.
 * Dégrade proprement si la migration 0087 n'est pas encore appliquée.
 */
export default function WhatsAppPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [dial, setDial] = useState('+225');
  const [phoneInput, setPhoneInput] = useState('');
  // Case de consentement décochée par défaut (RGPD : consentement actif).
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'unavailable'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from('notification_prefs')
        .select('whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Table absente (migration non appliquée) ou indispo → section neutre.
        setState('unavailable');
        return;
      }
      const p = (data as Prefs | null) ?? DEFAULTS;
      setPrefs(p);
      setPhoneInput(p.whatsapp_phone ?? '');
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  function handleActivate() {
    const e164 = normalizeE164(phoneInput, dial);
    if (!e164) {
      setState('error');
      setErrMsg('Numéro invalide — vérifiez l’indicatif et le nombre de chiffres.');
      return;
    }
    void save({ ...prefs, whatsapp_phone: e164, whatsapp_optin: true, brief_whatsapp: true });
  }

  function handleWithdraw() {
    void save({ ...prefs, whatsapp_optin: false, brief_whatsapp: false, alerts_whatsapp: false });
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

  return (
    <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ivory">Notifications WhatsApp</h2>
          <p className="mt-0.5 text-xs text-muted">
            Brief quotidien et alertes de vos titres, directement sur WhatsApp.
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
          <div className="flex flex-wrap gap-2">
            <select
              value={dial}
              onChange={(e) => setDial(e.target.value)}
              aria-label="Indicatif pays"
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-white"
            >
              {UEMOA_DIAL_CODES.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <input
              inputMode="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="07 01 02 03 04"
              aria-label="Numéro WhatsApp"
              className="tabular min-w-[12rem] flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
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
            disabled={!consent || state === 'saving'}
            onClick={handleActivate}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state === 'saving' ? 'Activation…' : 'Activer WhatsApp'}
          </button>
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

      {state === 'saved' && <p className="text-xs text-up">✓ Préférences enregistrées.</p>}
      {state === 'error' && <p className="text-xs text-down">{errMsg ?? 'Erreur — réessayez.'}</p>}
    </section>
  );
}
