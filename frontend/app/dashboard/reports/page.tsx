import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { MarketEvent } from '@/lib/types';
import { deleteSnapshot } from './snapshots/actions';

export const dynamic = 'force-dynamic';

async function getRecent() {
  const supabase = createClient();
  const [{ data: events }, { data: lastAct }, { data: instr }] = await Promise.all([
    supabase.from('market_events').select('*').order('event_date', { ascending: false }).limit(8),
    supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    supabase.from('brvm_instruments').select('secteur').eq('type', 'action'),
  ]);
  const secteurs = [...new Set((instr ?? []).map((r) => r.secteur).filter(Boolean))].sort() as string[];
  const { data: { user } } = await supabase.auth.getUser();
  let snapshots: { id: string; title: string; report_type: string; params: Record<string, string> }[] = [];
  if (user) {
    const { data } = await supabase.from('report_snapshots').select('id, title, report_type, params').order('created_at', { ascending: false }).limit(20);
    snapshots = (data ?? []) as typeof snapshots;
  }
  return {
    events: (events ?? []) as MarketEvent[],
    lastDate: lastAct?.[0]?.date_marche ?? null,
    secteurs,
    snapshots,
  };
}

function snapshotHref(snap: { report_type: string; params: Record<string, string> }): string {
  if (snap.report_type === 'instrument' && snap.params.code) return `/dashboard/reports/instrument/${snap.params.code}?period=${snap.params.period ?? '3M'}`;
  if (snap.report_type === 'sector' && snap.params.sector) return `/dashboard/reports/sector/${encodeURIComponent(snap.params.sector)}?period=${snap.params.period ?? '3M'}`;
  return '/dashboard/reports';
}

export default async function ReportsHome() {
  const { events, lastDate, secteurs, snapshots } = await getRecent();
  const cards = [
    { href: '/dashboard/reports/market/daily', title: 'Rapport marché journalier', desc: 'Synthèse de séance, indices, top movers, breadth, événements.' },
    { href: '/dashboard/reports/events', title: 'Événements de marché', desc: 'Listing filtrable des communiqués, avis et annonces émetteurs.' },
    { href: '/actions', title: 'Rapport par instrument', desc: 'Choisissez un titre dans le marché actions pour son rapport détaillé.' },
  ];
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Rapports & Événements</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="bg-surface border border-border rounded-xl p-4 hover:border-up/50 transition">
            <h3 className="font-medium">{c.title}</h3>
            <p className="text-xs text-muted mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>

      {snapshots.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Mes rapports sauvegardés</h2>
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div key={snap.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                <Link href={snapshotHref(snap)} className="text-sm hover:text-up">{snap.title}</Link>
                <form action={deleteSnapshot}><input type="hidden" name="id" value={snap.id} /><button className="text-xs text-down hover:underline">×</button></form>
              </div>
            ))}
          </div>
        </div>
      )}

      {secteurs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Rapports sectoriels</h2>
          <div className="flex flex-wrap gap-2">
            {secteurs.map((sec) => (
              <Link key={sec} href={`/dashboard/reports/sector/${encodeURIComponent(sec)}`}
                className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/50">
                {sec}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Événements récents</h2>
          <Link href="/dashboard/reports/events" className="text-xs text-up">Tout voir →</Link>
        </div>
        {events.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center text-muted text-sm">
            Aucun événement ingéré. Lancez <code className="text-up">npm run events:mock</code> côté scraper.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <Link key={e.id} href={`/dashboard/reports/events/${e.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2 hover:border-up/40">
                <span className="text-sm truncate">{e.title}</span>
                <span className="text-xs text-muted tabular ml-3 shrink-0">{e.event_date}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      {lastDate && <p className="text-xs text-muted">Dernière séance disponible : {lastDate}</p>}
    </div>
  );
}
