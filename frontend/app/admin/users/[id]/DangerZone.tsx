'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  setSuspended,
  deleteUser,
  updateUserEmail,
  signOutUser,
  sendPasswordReset,
} from './actions';

type R = { ok: boolean; message?: string };

/**
 * Actions sensibles sur un compte. Toutes sont journalisées (`admin_audit_logs`,
 * sévérité critical/warning) et refusées sur soi-même ou sur un super-admin.
 */
export function DangerZone({
  userId,
  email,
  suspended,
  canSuspend,
}: {
  userId: string;
  email: string | null;
  suspended: boolean;
  canSuspend: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [newEmail, setNewEmail] = useState('');

  function run(fn: () => Promise<R>, success: string, thenRedirect?: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? success : (r.message ?? 'Échec.') });
      if (r.ok && thenRedirect) router.push(thenRedirect);
      else if (r.ok) router.refresh();
    });
  }

  const btn =
    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40';

  return (
    <div className="space-y-5">
      {/* ── Accès ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ivory">Accès au compte</h2>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => signOutUser(userId), 'Sessions révoquées.')}
            className={`${btn} border-border text-muted hover:text-ivory`}
          >
            Déconnecter de tous les appareils
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => sendPasswordReset(userId), 'Lien de réinitialisation envoyé.')
            }
            className={`${btn} border-border text-muted hover:text-ivory`}
          >
            Envoyer un lien de réinitialisation
          </button>
        </div>
        <p className="text-[11px] text-faint">
          L&apos;administrateur ne choisit jamais le mot de passe : l&apos;utilisateur le
          définit lui-même via le lien.
        </p>
      </section>

      {/* ── Email ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ivory">Adresse email</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={email ?? 'nouvelle@adresse.com'}
            className="min-w-[16rem] flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={pending || !newEmail.trim()}
            onClick={() =>
              run(() => updateUserEmail(userId, newEmail), 'Email mis à jour.')
            }
            className={`${btn} border-warn/40 text-warn hover:bg-warn/10`}
          >
            Modifier l&apos;email
          </button>
        </div>
        <p className="text-[11px] text-faint">
          L&apos;email est le facteur de récupération du compte : ce changement est
          journalisé comme action critique.
        </p>
      </section>

      {/* ── Zone dangereuse ───────────────────────────────────────────────── */}
      {canSuspend && (
        <section className="rounded-xl border border-down/40 bg-down/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-down">Zone dangereuse</h2>

          <div className="space-y-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => setSuspended(userId, !suspended),
                  suspended ? 'Compte réactivé.' : 'Compte suspendu.',
                )
              }
              className={`${btn} ${
                suspended
                  ? 'border-up/40 text-up hover:bg-up/10'
                  : 'border-down/40 text-down hover:bg-down/10'
              }`}
            >
              {suspended ? 'Réactiver le compte' : 'Suspendre le compte'}
            </button>
            <p className="text-[11px] text-faint">
              La suspension bloque la connexion <strong>et</strong> invalide les sessions en
              cours — sinon l&apos;utilisateur resterait actif jusqu&apos;à expiration de son jeton.
            </p>
          </div>

          <div className="space-y-2 border-t border-down/20 pt-4">
            <p className="text-xs text-muted">
              Supprimer définitivement le compte et ses données. <strong className="text-down">Irréversible.</strong>{' '}
              Pour confirmer, saisissez l&apos;email exact : <code className="text-ivory">{email}</code>
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder="email de confirmation"
                className="min-w-[16rem] flex-1 rounded-lg border border-down/30 bg-bg px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                disabled={pending || !confirmDelete.trim()}
                onClick={() =>
                  run(() => deleteUser(userId, confirmDelete), 'Compte supprimé.', '/admin/users')
                }
                className={`${btn} border-down bg-down/20 text-down hover:bg-down/30`}
              >
                Supprimer définitivement
              </button>
            </div>
            <p className="text-[11px] text-faint">
              Les justificatifs de paiement sont conservés de façon anonymisée (obligation
              comptable légale).
            </p>
          </div>
        </section>
      )}

      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>
      )}
    </div>
  );
}
