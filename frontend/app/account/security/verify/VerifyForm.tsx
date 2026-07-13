'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Élève la session en aal2 : l'utilisateur a déjà la 2FA, il doit la présenter. */
export function VerifyForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  // `next` : on renvoie l'utilisateur là où il allait, pas sur une page générique.
  // Interne uniquement (doit commencer par « / ») — sinon c'est une redirection
  // ouverte : un attaquant forgerait ?next=https://site-piege et la 2FA elle-même
  // servirait d'hameçon.
  const rawNext = params.get('next') ?? '/admin';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/admin';

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const f = (data?.totp ?? []).find((x) => x.status === 'verified');
      if (!f) {
        // Aucun facteur : rien à présenter. On renvoie vers l'inscription.
        router.replace('/account/security');
        return;
      }
      setFactorId(f.id);
    })();
  }, [supabase, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (err) {
      setError('Code incorrect ou expiré. Réessayez avec le code affiché à l’instant.');
      setCode('');
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div>
        <h1 className="font-display text-xl text-white">Vérification en deux étapes</h1>
        <p className="mt-1 text-sm text-muted">
          Saisissez le code à 6 chiffres affiché par votre application d’authentification.
        </p>
      </div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        aria-label="Code à six chiffres"
        className="tabular w-full rounded-lg border border-border bg-bg px-3 py-3 text-center text-lg tracking-[0.4em] text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
      />

      {error && <p className="text-xs text-down">{error}</p>}

      <button
        type="submit"
        disabled={busy || code.length !== 6 || !factorId}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[#03222b] disabled:opacity-40"
      >
        {busy ? 'Vérification…' : 'Vérifier'}
      </button>

      <p className="text-[11px] text-faint">
        Le code change toutes les 30 secondes. Si l’échec persiste, vérifiez que l’heure de votre
        téléphone est réglée automatiquement — un décalage d’horloge invalide les codes.
      </p>
    </form>
  );
}
