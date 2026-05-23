import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { MarketEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPES = ['', 'dividende', 'resultats', 'assemblee', 'admission', 'suspension', 'autre'];
const SOURCES = ['', 'communique', 'avis', 'info_permanente', 'rapport', 'bulletin', 'publication'];

async function getEvents(type?: string, source?: string, code?: string) {
  const supabase = createClient();
  let q = supabase.from('market_events').select('*').order('event_date', { ascending: false }).limit(200);
  if (type) q = q.eq('event_type', type);
  if (source) q = q.eq('source_type', source);
  if (code) q = q.eq('instrument_code', code.toUpperCase());
  const { data } = await q;
  return (data ?? []) as MarketEvent[];
}

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: { type?: string; source?: string; code?: string };
}) {
  const events = await getEvents(searchParams.type, searchParams.source, searchParams.code);

  return (
    <div className="p-6 space-y-4">
      <div>
        <Link href="/dashboard/reports" className="text-xs text-up">← Rapports</Link>
        <h1 className="text-2xl font-semibold mt-1">Événements de marché</h1>
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/dashboard/reports/events">
        <select name="type" defaultValue={searchParams.type ?? ''} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          {TYPES.map((t) => <option key={t} value={t}>{t || 'Tous types'}</option>)}
        </select>
        <select name="source" defaultValue={searchParams.source ?? ''} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          {SOURCES.map((s) => <option key={s} value={s}>{s || 'Toutes sources'}</option>)}
        </select>
        <input name="code" defaultValue={searchParams.code ?? ''} placeholder="Code titre" className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-32" />
        <button className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5">Filtrer</button>
        <span className="text-xs text-muted ml-auto">{events.length} événements</span>
      </form>

      {events.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          Aucun événement. Lancez l’ingestor (<code className="text-up">npm run events:mock</code>).
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border bg-bg/40">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Titre</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Titre lié</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-bg/40">
                  <td className="px-3 py-2 tabular text-muted whitespace-nowrap">{e.event_date}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/reports/events/${e.id}`} className="hover:text-up">{e.title}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{e.event_type}</td>
                  <td className="px-3 py-2 text-xs text-muted">{e.source_type}</td>
                  <td className="px-3 py-2 text-xs">{e.instrument_code ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
