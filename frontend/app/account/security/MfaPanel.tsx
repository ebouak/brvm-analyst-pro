'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Gestion du second facteur (TOTP).
 *
 * Tout se passe côté navigateur : le secret TOTP transite entre Supabase et
 * l'utilisateur, jamais par notre serveur. Nous ne le voyons pas et ne pouvons
 * donc pas le divulguer — c'est une propriété, pas un raccourci.
 */

interface Factor {
  id: string;
  friendly_name?: string;
  status: string;
}

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

export function MfaPanel({ mustEnroll }: { mustEnroll: boolean }) {
  const supabase = createClient();
  const router = useRouter();

  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) {
      setError(e.message);
      setFactors([]);
      return;
    }
    setFactors((data?.totp ?? []) as Factor[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toLocaleDateString('fr-FR')}`,
    });
    setBusy(false);
    if (e || !data) {
      setError(e?.message ?? "Impossible de démarrer l'inscription.");
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    // challengeAndVerify = challenge + verify en un appel. La vérification prouve
    // que l'application d'authentification est bien configurée AVANT que le facteur
    // ne devienne actif : on ne peut pas se verrouiller dehors avec un QR mal scanné.
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (e) {
      setError('Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.');
      return;
    }
    setEnrolling(null);
    setCode('');
    setDone(true);
    await load();
    // La session vient de passer en aal2 : on rafraîchit pour que les gardes
    // serveur voient le nouveau niveau.
    router.refresh();
  }

  async function remove(factorId: string) {
    if (!confirm('Retirer la double authentification de ce compte ?')) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await load();
    router.refresh();
  }

  const verified = (factors ?? []).filter((f) => f.status === 'verified');
  const field =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50';

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold text-ivory">Double authentification (2FA)</h2>
        <p className="mt-1 text-xs text-muted">
          Un code à 6 chiffres, généré par une application (Google Authenticator, Authy, 1Password…),
          demandé en plus de votre mot de passe.
        </p>
      </div>

      {mustEnroll && verified.length === 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-3">
          <p className="text-xs font-semibold text-warn">Obligatoire pour votre compte</p>
          <p className="mt-1 text-xs text-muted">
            Votre compte dispose de droits d’administration : suppression de comptes, révocation de
            clés, coupure de fonctionnalités. Un mot de passe seul ne suffit pas à protéger ce
            pouvoir. La console d’administration reste fermée tant que la 2FA n’est pas activée.
          </p>
        </div>
      )}

      {done && verified.length > 0 && (
        <p className="rounded-lg border border-up/40 bg-up/5 p-3 text-xs text-up">
          Double authentification activée. Elle vous sera demandée à chaque connexion.
        </p>
      )}

      {factors === null ? (
        <p className="text-xs text-muted">Chargement…</p>
      ) : verified.length > 0 ? (
        <ul className="space-y-2">
          {verified.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-bg px-3 py-2"
            >
              <span className="text-xs text-ivory">
                ✓ {f.friendly_name || 'Application d’authentification'}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(f.id)}
                className="text-xs text-down hover:underline disabled:opacity-40"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : enrolling ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            1. Scannez ce QR code avec votre application d’authentification.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolling.qr}
            alt="QR code de configuration de la double authentification"
            className="h-44 w-44 rounded-lg bg-white p-2"
          />
          <details className="text-xs text-faint">
            <summary className="cursor-pointer hover:text-muted">
              Impossible de scanner ? Saisir la clé à la main
            </summary>
            <code className="mt-1 block break-all rounded bg-bg p-2 text-[11px] text-ivory">
              {enrolling.secret}
            </code>
          </details>

          <p className="text-xs text-muted">2. Saisissez le code à 6 chiffres affiché.</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`tabular max-w-[10rem] ${field}`}
            />
            <button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={confirmEnroll}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#03222b] disabled:opacity-40"
            >
              {busy ? 'Vérification…' : 'Activer'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEnrolling(null);
                setCode('');
                setError(null);
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-ivory"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={startEnroll}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-[#03222b] disabled:opacity-40"
        >
          {busy ? 'Préparation…' : 'Activer la double authentification'}
        </button>
      )}

      {error && <p className="text-xs text-down">{error}</p>}
    </section>
  );
}
