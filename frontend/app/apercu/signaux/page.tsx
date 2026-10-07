import { createPublicClient } from '@/lib/supabase/public';
import SignalsTable, { type SignalRow } from '@/components/SignalsTable';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Signaux (hybride)' };

async function getData() {
  const supabase = createPublicClient();
  const { data: lastRow } = await supabase.from('signals_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as SignalRow[] };
  const [{ data: signals }, { data: actions }, { data: instruments }] = await Promise.all([
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase.from('brvm_actions_daily').select('code, designation, cours_jour, variation_pct, secteur, pays').eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays'),
  ]);
  const actMap: Record<string, ActionDaily & { secteur?: string | null; pays?: string | null }> = {};
  for (const a of (actions ?? []) as ActionDaily[]) actMap[a.code] = a;
  const instrMap: Record<string, { secteur?: string | null; pays?: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur?: string | null; pays?: string | null }[]) instrMap[i.code] = i;
  const rows: SignalRow[] = ((signals ?? []) as SignalDaily[]).map((s) => ({ ...s, designation: actMap[s.code]?.designation ?? null, cours_jour: actMap[s.code]?.cours_jour ?? null, variation_pct: actMap[s.code]?.variation_pct ?? null, secteur: instrMap[s.code]?.secteur ?? actMap[s.code]?.secteur ?? null, pays: instrMap[s.code]?.pays ?? actMap[s.code]?.pays ?? null }));
  return { lastDate, rows };
}

export default async function ApercuSignauxPage() {
  const { lastDate, rows } = await getData();
  return (
    <ApercuFrame title="Aperçu — Signaux" subtitle="BUY / HOLD / SELL — même table que prod, noindex.">
      <ApercuNav />
      <SeanceStrip asOf={lastDate} nbActions={rows.length} href="/apercu/signaux" />
      <p style={{ fontSize: 11, color: 'rgb(var(--color-faint))' }}>Preview lecture seule. <a href="/signaux" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir prod</a></p>
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
        {rows.length === 0 ? <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13 }}>Aucun signal.</p> : <SignalsTable rows={rows} />}
      </div>
    </ApercuFrame>
  );
}
