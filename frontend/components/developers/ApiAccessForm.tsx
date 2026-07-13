'use client';

import { useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

// Clé de site Turnstile — publique par nature (elle est lue dans le HTML). Le
// secret, lui, ne vit que côté serveur (TURNSTILE_SECRET_KEY). Même clé que /login.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAADvOkfhEvBYZQ45q';

/** Demande d'accès à l'API — crée une demande `pending` examinée par un admin. */
export default function ApiAccessForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/api-access/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: fd.get('nom'),
        email: fd.get('email'),
        organisation: fd.get('organisation'),
        site_url: fd.get('site_url'),
        motif: fd.get('motif'),
        captchaToken,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };

    if (!res.ok) {
      setState('error');
      setMessage(json.error ?? 'Envoi impossible.');
      // Les jetons Turnstile sont à USAGE UNIQUE : sans ce reset, une seconde
      // tentative rejouerait un jeton déjà consommé et échouerait toujours.
      captchaRef.current?.reset();
      setCaptchaToken(null);
      return;
    }
    setState('sent');
    setMessage(json.message ?? 'Demande enregistrée.');
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-up/40 bg-up/5 p-5">
        <p className="text-sm font-semibold text-up">Demande enregistrée</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
    );
  }

  const field =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50';

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted">Nom *</span>
          <input name="nom" required maxLength={120} className={`mt-1 ${field}`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Email *</span>
          <input name="email" type="email" required maxLength={160} className={`mt-1 ${field}`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Organisation</span>
          <input name="organisation" maxLength={160} className={`mt-1 ${field}`} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Site web</span>
          <input name="site_url" maxLength={300} placeholder="https://…" className={`mt-1 ${field}`} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-muted">Usage prévu *</span>
        <textarea
          name="motif"
          required
          rows={3}
          maxLength={1000}
          placeholder="Ex. : afficher les cours BRVM sur notre site d'actualité économique."
          className={`mt-1 ${field}`}
        />
      </label>

      <Turnstile
        ref={captchaRef}
        siteKey={TURNSTILE_SITE_KEY}
        options={{ theme: 'dark', size: 'flexible' }}
        onSuccess={setCaptchaToken}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />

      {state === 'error' && <p className="text-xs text-down">{message}</p>}

      <button
        type="submit"
        disabled={state === 'sending' || !captchaToken}
        className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] transition active:scale-95 disabled:opacity-40"
      >
        {state === 'sending' ? 'Envoi…' : "Demander un accès"}
      </button>
      <p className="text-[11px] text-faint">
        Gratuit pour un usage éditorial ou de recherche. Réponse sous 48 h ouvrées.
        Vos données ne servent qu&apos;à l&apos;examen de la demande.
      </p>
    </form>
  );
}
