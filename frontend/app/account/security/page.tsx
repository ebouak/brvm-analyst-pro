import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { loadAuthEvents } from '@/lib/admin/auditLogs';
import { MfaPanel } from './MfaPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sécurité du compte' };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Page NON protégée par requireAdmin — et ce n'est pas un oubli.
 *
 * C'est la porte de sortie du verrou : un admin sans 2FA est renvoyé ICI par la
 * garde admin. Si cette page exigeait elle-même la 2FA, il serait enfermé dehors
 * sans aucun moyen de s'inscrire. Seule l'authentification simple est requise.
 */
export default async function SecurityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminCtx = await getAdminContext();
  const events = await loadAuthEvents(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
      <SectionHeader
        kicker="Compte"
        title="Sécurité"
        subtitle="Double authentification et historique de vos connexions."
      />

      <MfaPanel mustEnroll={adminCtx !== null} />

      {/* L'utilisateur doit pouvoir repérer lui-même une connexion qu'il ne
          reconnaît pas — c'est souvent lui, et non nous, qui la remarque. */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ivory">Connexions récentes</h2>
        <p className="mt-1 text-xs text-muted">
          Une connexion que vous ne reconnaissez pas ? Changez votre mot de passe et activez la 2FA.
        </p>
        {events.length === 0 ? (
          <p className="mt-3 text-xs text-faint">Aucune connexion enregistrée pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className={e.event === 'sign_in_failed' ? 'text-down' : 'text-muted'}>
                  {e.event === 'sign_in'
                    ? 'Connexion'
                    : e.event === 'sign_in_failed'
                      ? '⚠ Échec de connexion'
                      : e.event === 'sign_out'
                        ? 'Déconnexion'
                        : 'Réinit. mot de passe'}
                </span>
                <span className="tabular text-ivory">{e.ip_address ?? '—'}</span>
                <span className="tabular text-faint">{fmt(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/dashboard" className="inline-block text-sm text-muted hover:text-ivory">
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
