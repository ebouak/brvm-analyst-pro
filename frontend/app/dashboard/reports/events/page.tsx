import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDateCourte } from '@/lib/format';
import { libelleEvenement, TYPES_FILTRABLES } from '@/lib/evenements/libelles';
import { regrouperEvenements, type EvenementBrut } from '@/lib/evenements/regroupement';

export const dynamic = 'force-dynamic';

async function getEvents(type?: string, code?: string): Promise<EvenementBrut[]> {
  const supabase = createClient();
  let q = supabase
    .from('market_events')
    .select('id, event_date, title, event_type, instrument_code, source_url')
    .order('event_date', { ascending: false })
    .limit(300);
  if (type) q = q.eq('event_type', type);
  if (code) q = q.eq('instrument_code', code.toUpperCase());
  const { data } = await q;
  return (data ?? []) as EvenementBrut[];
}

export default async function EventsListPage(
  props: {
    searchParams: Promise<{ type?: string; code?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const type = searchParams.type && (TYPES_FILTRABLES as readonly string[]).includes(searchParams.type) ? searchParams.type : undefined;
  const events = regrouperEvenements(await getEvents(type, searchParams.code));

  return (
    <div className="p-6 space-y-4">
      <div>
        <Link href="/dashboard/reports" className="text-xs text-accent-ink">← Rapports</Link>
        <h1 className="text-2xl font-semibold mt-1">Événements de marché</h1>
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/dashboard/reports/events">
        <label className="sr-only" htmlFor="filtre-type">Type d&apos;événement</label>
        <select id="filtre-type" name="type" defaultValue={type ?? ''} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          <option value="">Tous les types</option>
          {TYPES_FILTRABLES.map((t) => <option key={t} value={t}>{libelleEvenement(t)}</option>)}
        </select>
        <label className="sr-only" htmlFor="filtre-code">Code de la valeur</label>
        <input id="filtre-code" name="code" defaultValue={searchParams.code ?? ''} placeholder="Code titre" className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-32" />
        <button className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5">Filtrer</button>
        <span className="text-xs text-muted ml-auto">{events.length} événement{events.length > 1 ? 's' : ''}</span>
      </form>

      {events.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun événement de marché pour ces critères. Les publications sont ingérées automatiquement.
        </div>
      ) : (
        <div className="relative overflow-x-auto bg-surface border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border bg-bg/40">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Publication</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-bg/40 align-top">
                  <td className="px-3 py-2 tabular text-muted whitespace-nowrap">{fmtDateCourte(e.date)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/reports/events/${e.id}`} className="hover:text-accent-ink">{e.titre}</Link>
                    {e.pieces.length > 1 && (
                      <p className="mt-0.5 text-xs text-muted">{e.pieces.length} documents publiés pour cette période</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{libelleEvenement(e.type)}</td>
                  <td className="px-3 py-2 text-xs">{e.code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
