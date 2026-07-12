import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';

export const revalidate = 300;
export const metadata: Metadata = {
  // `absolute` : évite le suffixe « | WESTBOURSE » du template racine.
  title: { absolute: 'Heatmap BRVM du jour — WESTBOURSE' },
  robots: { index: false },
};

/** Intensité de la tuile selon l'ampleur de la variation. */
function tileClass(v: number | null): string {
  if (v == null) return 'bg-[#1a2a30] text-[#8b93a7]';
  if (v > 3) return 'bg-[#3fe18b] text-[#03222b]';
  if (v > 0) return 'bg-[#3fe18b]/40 text-[#FCFCFC]';
  if (v === 0) return 'bg-[#1a2a30] text-[#FCFCFC]';
  if (v > -3) return 'bg-[#ff6b6b]/40 text-[#FCFCFC]';
  return 'bg-[#ff6b6b] text-[#2b0303]';
}

export default async function EmbedHeatmapPage({
  searchParams,
}: {
  searchParams: { theme?: string; lang?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);

  const sb = createPublicClient();
  const { data: last } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = last?.[0]?.date_marche ?? null;

  const { data } = date
    ? await sb
        .from('brvm_actions_daily')
        .select('code, variation_pct')
        .eq('date_marche', date)
        .order('code')
    : { data: null };
  const rows = (data ?? []) as { code: string; variation_pct: number | null }[];

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <>
          <p className="px-1 text-[10px] opacity-60">
            {T[lang].seance} {date}
          </p>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {rows.map((r) => (
              <div
                key={r.code}
                className={`rounded px-1.5 py-2 text-center ${tileClass(r.variation_pct)}`}
              >
                <div className="text-[11px] font-semibold">{r.code}</div>
                <div className="tabular-nums text-[11px]">
                  {r.variation_pct == null
                    ? '—'
                    : `${r.variation_pct >= 0 ? '+' : ''}${r.variation_pct.toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </EmbedFrame>
  );
}
