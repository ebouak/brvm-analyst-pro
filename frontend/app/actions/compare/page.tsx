import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompareChart, { type ComparePoint } from '@/components/CompareChart';
import type { ActionDaily } from '@/lib/types';

export const dynamic = 'force-dynamic';

const HISTORY = 180;

async function getSeries(codes: string[]) {
  const supabase = createClient();
  const map: Record<string, ActionDaily[]> = {};
  await Promise.all(
    codes.map(async (code) => {
      const { data } = await supabase
        .from('brvm_actions_daily')
        .select('date_marche, cours_jour, code, designation, cours_precedent, pays, secteur, variation_pct, volume, nb_transactions, valeur_echangee')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(HISTORY);
      map[code] = ((data ?? []) as ActionDaily[]).reverse();
    }),
  );
  return map;
}

// Rebase chaque série à 100 sur sa première valeur et aligne par date.
function buildCompare(map: Record<string, ActionDaily[]>, codes: string[]): ComparePoint[] {
  const byDate: Record<string, ComparePoint> = {};
  for (const code of codes) {
    const rows = map[code] ?? [];
    const base = rows.find((r) => r.cours_jour != null)?.cours_jour ?? null;
    for (const r of rows) {
      if (!byDate[r.date_marche]) byDate[r.date_marche] = { date: r.date_marche };
      byDate[r.date_marche]![code] =
        base && r.cours_jour != null ? Math.round((r.cours_jour / base) * 1000) / 10 : null;
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { codes?: string };
}) {
  const codes = (searchParams.codes ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="p-6 space-y-4">
      <div>
        <Link href="/actions" className="text-xs text-up">← Marché actions</Link>
        <h1 className="text-2xl font-semibold mt-1">Comparaison multi-titres</h1>
      </div>

      <form className="flex gap-2 items-center" action="/actions/compare">
        <input
          name="codes"
          defaultValue={codes.join(',')}
          placeholder="Ex: SNTS,SGBC,ETIT"
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-72"
        />
        <button className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5">
          Comparer
        </button>
      </form>

      {codes.length === 0 ? (
        <p className="text-sm text-muted">Saisissez 2 à 6 codes séparés par des virgules.</p>
      ) : (
        <CompareChart data={buildCompare(await getSeries(codes), codes)} codes={codes} />
      )}
    </div>
  );
}
