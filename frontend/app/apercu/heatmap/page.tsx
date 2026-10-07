import { createPublicClient } from '@/lib/supabase/public';
import brvmLogos from '@/lib/brvmLogos.json';
import { loadHeatmap } from '@/lib/heatmapData';
import HeatmapViews from '@/components/HeatmapViews';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';

export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Heatmap (hybride)' };

export default async function ApercuHeatmapPage() {
  const supabase = createPublicClient();
  const { lastDate, rows } = await loadHeatmap(supabase as never);
  const logos = brvmLogos as Record<string, string | null>;
  return (
    <ApercuFrame title="Aperçu — Heatmap" subtitle="Cartographie par capitalisation · couleur = variation.">
      <ApercuNav />
      <SeanceStrip asOf={lastDate} nbActions={rows.length} href="/apercu/heatmap" />
      <p style={{ fontSize: 11, color: 'rgb(var(--color-faint))' }}>Preview noindex. <a href="/heatmap" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir prod</a></p>
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 12 }}>
        {rows.length === 0 ? <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13 }}>Aucune donnée heatmap.</p> : <HeatmapViews rows={rows} logos={logos} />}
      </div>
    </ApercuFrame>
  );
}
