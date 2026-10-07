import Link from 'next/link';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Aperçu — Portefeuille (hybride)' };

async function getAsOf() {
  const supabase = createPublicClient();
  const { data } = await supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  return (data?.[0] as { date_marche?: string } | undefined)?.date_marche ?? null;
}

export default async function ApercuPortefeuillePage() {
  const asOf = await getAsOf();
  return (
    <ApercuFrame title="Aperçu — Portefeuille" subtitle="Preview statique — les données utilisateur restent sur le prod authentifié.">
      <ApercuNav />
      <SeanceStrip asOf={asOf} nbActions={null} href="/apercu/portefeuille" />
      <div style={{ background: 'rgb(var(--color-surface))', border: '1px dashed rgb(var(--color-border))', borderRadius: 14, padding: 16, display: 'grid', gap: 8 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>Portefeuille — preview statique</h2>
        <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13, margin: 0 }}>Cet écran prod est authentifié (portfolios_positions, watchlists). Le preview ne duplique pas les données utilisateur : il montre le squelette sombre hybride et renvoie vers le prod.</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'rgb(var(--color-muted))', display: 'grid', gap: 4 }}>
          <li>Bento 2×2 (Analyser / Surveiller / Simuler / Explorer) — voir <Link href="/apercu/dashboard" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>dashboard preview</Link></li>
          <li>SeanceStrip + Hero hybride (IndexChart · JaugeSentiment)</li>
        </ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <Link href="/portefeuille" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid rgb(var(--color-accent)/.3)', background: 'rgb(var(--color-accent)/.12)', fontSize: 12, fontWeight: 600 }}>Ouvrir le portefeuille prod</Link>
          <Link href="/apercu/actions" style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid rgb(var(--color-border))', fontSize: 12 }}>Voir Actions (preview)</Link>
        </div>
      </div>
    </ApercuFrame>
  );
}
