import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * Section « Vos secteurs » du dashboard : perf du JOUR des secteurs favoris de
 * l'utilisateur (légère — dernière séance seulement, pas d'agrégation 1 an).
 * Si aucun favori → invite à en choisir.
 */
export default async function FavoriteSectors({ favorites }: { favorites: string[] }) {
  if (!favorites || favorites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/60 p-5 text-center">
        <p className="text-sm text-muted">Personnalisez votre dashboard.</p>
        <Link href="/profil" className="mt-1 inline-block text-xs text-accent hover:underline">
          Choisir vos secteurs favoris →
        </Link>
      </div>
    );
  }

  const sb = createPublicClient();
  const { data: lastRow } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  const lastDate = lastRow?.[0]?.date_marche;
  const [{ data: rows }, { data: instruments }] = await Promise.all([
    lastDate ? sb.from('brvm_actions_daily').select('code, variation_pct').eq('date_marche', lastDate) : Promise.resolve({ data: [] }),
    sb.from('brvm_instruments').select('code, secteur'),
  ]);
  const sectorByCode = new Map((instruments ?? []).map((i: { code: string; secteur: string | null }) => [i.code, i.secteur]));

  // Agrège la variation du jour par secteur.
  const bySector = new Map<string, { sum: number; n: number; best: { code: string; v: number } | null; worst: { code: string; v: number } | null }>();
  for (const r of (rows ?? []) as { code: string; variation_pct: number | null }[]) {
    const sec = sectorByCode.get(r.code);
    if (!sec || r.variation_pct == null) continue;
    if (!bySector.has(sec)) bySector.set(sec, { sum: 0, n: 0, best: null, worst: null });
    const s = bySector.get(sec)!;
    s.sum += r.variation_pct; s.n += 1;
    if (!s.best || r.variation_pct > s.best.v) s.best = { code: r.code, v: r.variation_pct };
    if (!s.worst || r.variation_pct < s.worst.v) s.worst = { code: r.code, v: r.variation_pct };
  }

  const cards = favorites
    .map((fav) => ({ name: fav, s: bySector.get(fav) }))
    .filter((c) => c.s && c.s.n > 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ name, s }) => {
        const avg = s!.sum / s!.n;
        return (
          <Link key={name} href={`/actions?secteur=${encodeURIComponent(name)}`}
            className={`rounded-xl border bg-surface p-4 transition hover:bg-elevated ${avg >= 0 ? 'border-up/30' : 'border-down/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{name}</span>
              <span className={`tabular text-sm font-bold ${avg >= 0 ? 'text-up' : 'text-down'}`}>{avg >= 0 ? '+' : ''}{avg.toFixed(2)}%</span>
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              {s!.best && <div className="flex justify-between text-up"><span>↑ {s!.best.code}</span><span className="tabular">+{s!.best.v.toFixed(2)}%</span></div>}
              {s!.worst && <div className="flex justify-between text-down"><span>↓ {s!.worst.code}</span><span className="tabular">{s!.worst.v.toFixed(2)}%</span></div>}
            </div>
          </Link>
        );
      })}
      {cards.length === 0 && (
        <p className="col-span-full text-xs text-faint">Aucune donnée pour vos secteurs sur la dernière séance.</p>
      )}
    </div>
  );
}
