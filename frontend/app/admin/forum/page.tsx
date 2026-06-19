import { listOpenReports, setHidden, resolveReport } from '@/lib/forum/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modération forum — Admin' };

export default async function AdminForumPage() {
  const reports = await listOpenReports();
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
      <h1 className="text-xl font-semibold text-white">Modération du forum</h1>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">Aucun signalement en attente.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <p className="text-white">
                {r.target_type} · {r.target_id}
              </p>
              {r.reason && <p className="text-muted mt-1">« {r.reason} »</p>}
              <div className="mt-3 flex gap-2">
                <form
                  action={async () => {
                    'use server';
                    await setHidden(r.target_type, r.target_id, true);
                    await resolveReport(r.id);
                  }}
                >
                  <button className="rounded border border-down/40 px-3 py-1 text-xs text-down">
                    Masquer + résoudre
                  </button>
                </form>
                <form
                  action={async () => {
                    'use server';
                    await resolveReport(r.id);
                  }}
                >
                  <button className="rounded border border-border px-3 py-1 text-xs text-muted">
                    Ignorer
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
