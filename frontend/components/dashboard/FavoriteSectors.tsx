import Link from 'next/link';
import { fmtPctSigne } from '@/lib/format';
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

  const ton = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');
  if (cards.length === 0) return <p className="text-sm text-muted">Aucune donnée pour vos secteurs sur la dernière séance.</p>;
  // Lignes plates de la surface à filets (spec §12) ; moyenne SIMPLE des valeurs du secteur.
  return (
    <>
      <ul>
        {cards.map(({ name, s }) => {
          const avg = s!.sum / s!.n;
          return (
            <li key={name} className="border-t border-border py-2 first:border-t-0 first:pt-0">
              <Link href={`/actions?secteur=${encodeURIComponent(name)}`} className="flex items-baseline justify-between gap-3 text-[13.5px] text-ivory hover:text-accent-ink">
                <span className="min-w-0 break-words">{name}</span>
                <span className={`tabular whitespace-nowrap ${ton(avg)}`}>{fmtPctSigne(avg)}</span>
              </Link>
              <p className="tabular mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-faint">
                {s!.best && <span>meilleure {s!.best.code} <span className={ton(s!.best.v)}>{fmtPctSigne(s!.best.v)}</span></span>}
                {s!.worst && <span>moins bonne {s!.worst.code} <span className={ton(s!.worst.v)}>{fmtPctSigne(s!.worst.v)}</span></span>}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-faint">Moyenne simple des variations des valeurs de chaque secteur, dernière séance.</p>
    </>
  );
}
