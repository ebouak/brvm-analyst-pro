import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { MarketEvent } from '@/lib/types';
import { deleteSnapshot } from './snapshots/actions';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import {
  SectionHeader,
  PremiumPanel,
  EmptyStatePremium,
  Eyebrow,
  StatPill,
} from '@/components/ui/premium';

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

const EASE = 'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

export default async function ReportsHome() {
  const { events, lastDate, secteurs, snapshots } = await getRecent();

  const cards = [
    {
      href: '/dashboard/reports/market/daily',
      title: 'Rapport marché journalier',
      desc: 'Synthèse de séance, indices, top movers, breadth, événements.',
      kicker: 'Marché',
      icon: '▦',
    },
    {
      href: '/dashboard/reports/events',
      title: 'Événements de marché',
      desc: 'Listing filtrable des communiqués, avis et annonces émetteurs.',
      kicker: 'Communiqués',
      icon: '◈',
    },
    {
      href: '/actions',
      title: 'Rapport par instrument',
      desc: 'Choisissez un titre dans le marché actions pour son rapport détaillé.',
      kicker: 'Instrument',
      icon: '◎',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* ── En-tête ── */}
      <SectionHeader
        kicker="Centre de rapports"
        title="Rapports & Événements"
        subtitle="Synthèses de marché, analyses sectorielles et communiqués d'émetteurs BRVM/UEMOA."
        actions={
          lastDate && (
            <StatPill tone="neutral">
              Dernière séance : <span className="tabular ml-1 text-ivory">{lastDate}</span>
            </StatPill>
          )
        }
      />
      <ViewTabs tabs={REPORT_TABS} current="/dashboard/reports" />

      {/* ── Accès rapide ── */}
      <div>
        <Eyebrow className="mb-4">Accès rapide</Eyebrow>
        <div className="grid md:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex flex-col gap-3 bg-surface border border-border rounded-card p-5 shadow-card ${EASE} hover:border-gold/30 hover:shadow-[0_0_0_1px_rgba(183,140,78,0.1)]`}
            >
              <div className="flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-gold/20 bg-gold/[0.06] text-base text-gold/70">
                  {c.icon}
                </span>
                <StatPill tone="neutral">{c.kicker}</StatPill>
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-ivory group-hover:text-gold/90 transition-colors">
                  {c.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.desc}</p>
              </div>
              <span className={`self-start text-xs font-medium text-gold/60 ${EASE} group-hover:translate-x-0.5`}>
                Accéder →
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Rapports sauvegardés ── */}
      {snapshots.length > 0 && (
        <div>
          <Eyebrow className="mb-4">Mes rapports sauvegardés</Eyebrow>
          <PremiumPanel>
            <div className="divide-y divide-border">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className={`flex items-center justify-between px-5 py-3 ${EASE} hover:bg-elevated/60`}
                >
                  <Link
                    href={snapshotHref(snap)}
                    className={`text-sm text-ivory/80 hover:text-gold truncate ${EASE}`}
                  >
                    {snap.title}
                  </Link>
                  <form action={deleteSnapshot}>
                    <input type="hidden" name="id" value={snap.id} />
                    <button
                      className={`ml-4 shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-down ${EASE} hover:border-down/30 hover:bg-down/10`}
                      type="submit"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </PremiumPanel>
        </div>
      )}

      {/* ── Secteurs ── */}
      {secteurs.length > 0 && (
        <div>
          <Eyebrow className="mb-4">Rapports sectoriels</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {secteurs.map((sec) => (
              <Link
                key={sec}
                href={`/dashboard/reports/sector/${encodeURIComponent(sec)}`}
                className={`rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted shadow-card ${EASE} hover:border-gold/40 hover:bg-gold/[0.04] hover:text-gold`}
              >
                {sec}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Événements récents ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>Événements récents</Eyebrow>
          <Link
            href="/dashboard/reports/events"
            className={`text-xs font-medium text-gold/70 ${EASE} hover:text-gold`}
          >
            Tout voir →
          </Link>
        </div>

        {events.length === 0 ? (
          <EmptyStatePremium
            icon="◈"
            title="Aucun événement ingéré"
            hint="Les événements de marché sont ingérés automatiquement chaque jour ouvré."
            action={{ href: '/dashboard/reports/events', label: 'Explorer' }}
          />
        ) : (
          <PremiumPanel>
            <div className="divide-y divide-border">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/dashboard/reports/events/${e.id}`}
                  className={`flex items-center justify-between px-5 py-3 ${EASE} hover:bg-elevated/60`}
                >
                  <span className="text-sm text-ivory/80 truncate">{e.title}</span>
                  <span className="tabular ml-4 shrink-0 text-xs text-muted">{e.event_date}</span>
                </Link>
              ))}
            </div>
          </PremiumPanel>
        )}
      </div>

    </div>
  );
}
