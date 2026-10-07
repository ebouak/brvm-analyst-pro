import { createPublicClient } from '@/lib/supabase/public';
import { fetchAllRows } from '@/lib/supabase/paginate';
import ActionsTable from '@/components/ActionsTable';
import brvmSectors from '@/lib/brvmSectors.json';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';

export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Actions (hybride)' };

async function getData() {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [] as ActionDaily[], signals: {} as Record<string, SignalDaily>, sparklines: {} as Record<string, number[]> };
  const [{ data: actions }, { data: signals }, { data: instruments }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays').eq('type', 'action'),
  ]);
  const sectorByCode = brvmSectors as Record<string, string>;
  const instrMap: Record<string, { secteur: string | null; pays: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null; pays: string | null }[]) instrMap[i.code] = { secteur: i.secteur, pays: i.pays };
  const enriched = ((actions ?? []) as ActionDaily[]).map((a) => ({ ...a, secteur: sectorByCode[a.code] ?? instrMap[a.code]?.secteur ?? a.secteur ?? null, pays: instrMap[a.code]?.pays ?? a.pays ?? null }));
  const sigMap: Record<string, SignalDaily> = {};
  for (const s of (signals ?? []) as SignalDaily[]) sigMap[s.code] = s;
  const sparklines: Record<string, number[]> = {};
  const since = new Date(lastDate); since.setDate(since.getDate() - 50);
  const sinceIso = since.toISOString().slice(0, 10);
  const hist = await fetchAllRows<{ code: string; date_marche: string; cours_jour: number | null }>((from, to) => supabase.from('brvm_actions_daily').select('code, date_marche, cours_jour').gte('date_marche', sinceIso).lte('date_marche', lastDate).order('date_marche', { ascending: true }).range(from, to));
  for (const r of hist as { code: string; cours_jour: number | null }[]) if (r.cours_jour != null) (sparklines[r.code] ??= []).push(r.cours_jour);
  for (const k of Object.keys(sparklines)) sparklines[k] = sparklines[k]!.slice(-30);
  return { lastDate, actions: enriched, signals: sigMap, sparklines };
}

export default async function ApercuActionsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { lastDate, actions, signals, sparklines } = await getData();
  if (!lastDate) return <ApercuFrame title="Aperçu — Actions" subtitle="Marché BRVM en lecture seule."><ApercuNav /><p style={{ color: 'rgb(var(--color-muted))', fontSize: 13 }}>Aucune séance.</p></ApercuFrame>;
  return (
    <ApercuFrame title="Aperçu — Actions" subtitle="Même tableau que prod, isolé en sombre sous .apv (noindex).">
      <ApercuNav />
      <SeanceStrip asOf={lastDate} nbActions={actions.length} href="/apercu/actions" />
      <p style={{ fontSize: 11, color: 'rgb(var(--color-faint))' }}>Preview lecture seule — colonnes calculées affichées sans gating (prod masque selon <code>feature_flags</code>). <a href="/actions" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir prod</a></p>
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
        <ActionsTable actions={actions} signals={signals} sparklines={sparklines} initialSecteur={typeof searchParams?.secteur === 'string' ? searchParams.secteur : ''} showMetrics />
      </div>
    </ApercuFrame>
  );
}
