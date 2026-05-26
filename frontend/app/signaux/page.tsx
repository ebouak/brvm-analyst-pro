import { createClient } from '@/lib/supabase/server';
import SignalsTable, { type SignalRow } from '@/components/SignalsTable';
import type { ActionDaily, SignalDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signaux — BRVM Analyst Pro' };

async function getData() {
  const supabase = createClient();

  const { data: lastRow } = await supabase
    .from('signals_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as SignalRow[] };

  const [{ data: signals }, { data: actions }, { data: instruments }] = await Promise.all([
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase
      .from('brvm_actions_daily')
      .select('code, designation, cours_jour, variation_pct, secteur, pays')
      .eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays'),
  ]);

  const actMap: Record<string, ActionDaily & { secteur?: string | null; pays?: string | null }> = {};
  for (const a of (actions ?? []) as ActionDaily[]) actMap[a.code] = a;

  const instrMap: Record<string, { secteur?: string | null; pays?: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur?: string | null; pays?: string | null }[]) {
    instrMap[i.code] = i;
  }

  const rows: SignalRow[] = ((signals ?? []) as SignalDaily[]).map((s) => {
    const act = actMap[s.code];
    const instr = instrMap[s.code];
    return {
      ...s,
      designation: act?.designation ?? null,
      cours_jour: act?.cours_jour ?? null,
      variation_pct: act?.variation_pct ?? null,
      secteur: instr?.secteur ?? act?.secteur ?? null,
      pays: instr?.pays ?? act?.pays ?? null,
    };
  });

  return { lastDate, rows };
}

export default async function SignauxPage() {
  const { lastDate, rows } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">🔔 Signaux d'opportunité</h1>
        <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-muted">Aucun signal généré pour le moment.</p>
          <p className="text-xs text-muted">
            Lancez <code className="text-up bg-up/10 px-1 rounded">npm run score</code> côté scraper.
          </p>
        </div>
      </div>
    );
  }

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-5 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">🔔 Signaux d'opportunité</h1>
          <p className="text-xs text-muted mt-0.5">Séance : <span className="tabular">{lastDate}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/signaux" className="text-xs border border-border rounded px-2 py-1 text-muted hover:text-white transition">
            🔄 Actualiser
          </a>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3 max-w-sm">
        <StatPill label="🟢 Achat"    value={counts.BUY  ?? 0} cls="border-up/30 text-up bg-up/5" />
        <StatPill label="⚪ Attente"   value={counts.HOLD ?? 0} cls="border-border text-muted" />
        <StatPill label="🔴 Vente"    value={counts.SELL ?? 0} cls="border-down/30 text-down bg-down/5" />
      </div>

      {/* Table interactive avec filtres */}
      <SignalsTable rows={rows} />

      {/* Légende */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3">💡 Comment lire les signaux ?</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-up mt-0.5 shrink-0">🟢 BUY</span>
            <div>
              <span className="text-white font-medium">Score &gt; +0.60</span>
              <span className="text-muted ml-2">— Opportunité d'achat détectée</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-muted mt-0.5 shrink-0">⚪ HOLD</span>
            <div>
              <span className="text-white font-medium">-0.60 ≤ Score ≤ +0.60</span>
              <span className="text-muted ml-2">— Attente / Surveillance</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-down mt-0.5 shrink-0">🔴 SELL</span>
            <div>
              <span className="text-white font-medium">Score &lt; -0.60</span>
              <span className="text-muted ml-2">— Opportunité de vente détectée</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted italic">
          ⚠️ Les signaux sont calculés automatiquement à partir d'indicateurs techniques et ne constituent
          pas un conseil en investissement. Consultez un conseiller agréé COSUMAF avant toute décision.
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`border rounded-xl p-3 text-center ${cls}`}>
      <div className="tabular text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}
