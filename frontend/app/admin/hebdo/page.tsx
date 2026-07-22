import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import HebdoStatutButton from '@/components/admin/HebdoStatutButton';

export const dynamic = 'force-dynamic';

export default async function AdminHebdoPage() {
  await requirePermission('content.publish');
  const svc = getServiceClient();
  const { data } = await svc
    .from('hebdo_editions')
    .select('id, date_edition, statut, auto, published_at')
    .order('date_edition', { ascending: false })
    .limit(30);
  const editions = (data ?? []) as { id: string; date_edition: string; statut: string; auto: boolean }[];

  return (
    <div className="space-y-4 p-6">
      <h1 className="font-display text-xl text-white">Analyses hebdomadaires</h1>
      <p className="text-sm text-muted">
        Les éditions sont publiées automatiquement chaque samedi. Vous pouvez en dépublier une si
        elle doit être corrigée.
      </p>
      {editions.length === 0 ? (
        <p className="text-sm text-faint">Aucune édition pour le moment.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-faint">
              <th className="px-3 py-2">Semaine</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Origine</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((e) => (
              <tr key={e.id} className="border-b border-border/40">
                <td className="px-3 py-2 text-ivory">
                  <Link href={`/analyses/hebdo/${e.date_edition}`} className="hover:text-accent">
                    {e.date_edition}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span className={e.statut === 'publie' ? 'text-up' : 'text-faint'}>{e.statut}</span>
                </td>
                <td className="px-3 py-2 text-muted">{e.auto ? 'auto' : 'manuel'}</td>
                <td className="px-3 py-2">
                  <HebdoStatutButton id={e.id} statut={e.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
