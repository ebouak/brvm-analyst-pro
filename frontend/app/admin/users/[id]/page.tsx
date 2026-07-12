import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, StatPill } from '@/components/ui/premium';
import { getUserRights, listRoles } from '@/lib/admin/roles';
import { loadAuthEvents } from '@/lib/admin/auditLogs';
import { can } from '@/lib/server/rbac';
import { RightsPanel } from './RightsPanel';
import { DangerZone } from './DangerZone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Utilisateur — Administration' };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'jamais';

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requirePermission('users.read');
  const [rights, allRoles, authEvents] = await Promise.all([
    getUserRights(params.id),
    listRoles(),
    loadAuthEvents(params.id),
  ]);
  if (!rights) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/users" className="text-sm text-muted hover:text-ivory">← Utilisateurs</Link>
      <SectionHeader
        kicker="Administration"
        title={rights.email ?? params.id}
        subtitle="Droits, statut du compte, accès et actions sensibles."
      />
      <div className="flex flex-wrap items-center gap-2">
        {rights.suspended && <StatPill tone="gold">⛔ Suspendu</StatPill>}
        {rights.is_premium ? <StatPill tone="gold">Premium</StatPill> : <StatPill tone="neutral">Gratuit</StatPill>}
        {!rights.email_confirmed && <StatPill tone="neutral">Email non confirmé</StatPill>}
        {rights.roleCodes.map((c) => <StatPill key={c} tone="sapphire">{c}</StatPill>)}
      </div>

      {/* Métadonnées d'authentification (source : auth.users). */}
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted">Dernière connexion</dt>
          <dd className="tabular mt-0.5 text-ivory">{fmtDate(rights.last_sign_in_at)}</dd>
        </div>
        <div>
          <dt className="text-muted">Compte créé le</dt>
          <dd className="tabular mt-0.5 text-ivory">{fmtDate(rights.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted">Premium depuis</dt>
          <dd className="tabular mt-0.5 text-ivory">{fmtDate(rights.premium_since)}</dd>
        </div>
      </dl>

      {/* Connexions récentes — IP et appareil. C'est ce qui permet de répondre à
          « ce compte a-t-il été piraté ? » : les échecs répétés sont visibles. */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ivory">Connexions récentes</h2>
        {authEvents.length === 0 ? (
          <p className="text-xs text-muted">
            Aucune connexion enregistrée (le journal démarre à la migration 0092).
          </p>
        ) : (
          <ul className="divide-y divide-border/40 text-xs">
            {authEvents.map((e) => (
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
                <span className="max-w-[16rem] truncate text-faint">{e.user_agent ?? '—'}</span>
                <span className="tabular text-faint">{fmtDate(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="gold-rule" />
      <RightsPanel
        userId={rights.id}
        isPremium={rights.is_premium}
        roleCodes={rights.roleCodes}
        allRoles={allRoles}
        canManageRoles={ctx.isSuperAdmin}
      />

      <DangerZone
        userId={rights.id}
        email={rights.email}
        suspended={rights.suspended}
        canSuspend={can(ctx, 'users.suspend')}
      />
    </div>
  );
}
