import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang, parseCodes } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';
import TickerStrip, { type TickerItem } from '@/components/embed/TickerStrip';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Cours BRVM en direct — WESTBOURSE',
  robots: { index: false }, // widget : pas de page d'index concurrente du site
};

export default async function EmbedTickerPage({
  searchParams,
}: {
  searchParams: { theme?: string; lang?: string; codes?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);
  const codes = parseCodes(searchParams.codes);

  const sb = createPublicClient();
  const { data: last } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const date = last?.[0]?.date_marche ?? null;

  let items: TickerItem[] = [];
  if (date) {
    let q = sb
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct')
      .eq('date_marche', date)
      .order('code');
    if (codes) q = q.in('code', codes);
    const { data } = await q;
    items = (
      (data ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[]
    ).map((a) => ({ code: a.code, cours: a.cours_jour, variation: a.variation_pct }));
  }

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <TickerStrip items={items} theme={theme} />
      )}
    </EmbedFrame>
  );
}
