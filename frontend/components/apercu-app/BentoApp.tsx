'use client';
import Link from 'next/link';
type Item = { t: string; d: string; href: string };
function Card({ k, title, desc, items, href, accent }: { k: string; title: string; desc: string; items: Item[]; href: string; accent: string }) {
  return (
    <article className="bento-app-card" style={{ ['--acc' as string]: accent }}>
      <header>
        <span className="num" style={{ fontWeight: 700, letterSpacing: '.1em', color: 'rgb(var(--color-faint))', fontSize: 11 }}>{k}</span>
        <h3 style={{ fontSize: 18, margin: '2px 0 0', fontFamily: 'var(--font-display)' }}>{title}</h3>
        <p style={{ color: 'rgb(var(--color-muted))', fontSize: 13, marginTop: 4 }}>{desc}</p>
      </header>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {items.map((it) => (
          <li key={it.t}>
            <Link href={it.href} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderRadius: 10, border: '1px solid rgb(var(--color-border))', background: 'rgb(var(--color-sunken))' }}>
              <span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 13 }}>{it.t}</b><small style={{ color: 'rgb(var(--color-muted))', fontSize: 11 }}>{it.d}</small></span>
              <span aria-hidden style={{ marginLeft: 'auto', color: 'rgb(var(--color-faint))' }}>→</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} style={{ fontWeight: 600, fontSize: 12 }}>Voir →</Link>
    </article>
  );
}
export function BentoApp() {
  return (
    <section className="bento-app" aria-labelledby="h-bento-app">
      <h2 id="h-bento-app" style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '14px 0 8px' }}>Quatre façons de travailler le marché</h2>
      <div className="bento-app-grid">
        <Card k="01" title="Analyser" desc="Fondamentaux, notes A–F, screener." accent="rgb(var(--color-accent))" href="/societes" items={[{ t: 'Fondamentaux', d: 'Bilans & ratios', href: '/fondamentaux' },{ t: 'Signaux', d: 'Notes A–F', href: '/signaux' },{ t: 'Screener', d: 'Filtrer 46 sociétés', href: '/screener' }]} />
        <Card k="02" title="Surveiller" desc="Portefeuille, alertes, brief." accent="rgb(var(--color-up))" href="/portefeuille" items={[{ t: 'Portefeuille', d: 'Positions & perf.', href: '/portefeuille' },{ t: 'Alertes', d: 'Seuils email', href: '/parametres/alertes' },{ t: 'Brief', d: 'L’essentiel 18h', href: '/weekly' }]} />
        <Card k="03" title="Simuler" desc="Paper-trading, backtest, SGI." accent="rgb(var(--color-warn))" href="/simulateur" items={[{ t: 'Paper trading', d: 'Capital virtuel', href: '/premium/paper-trading' },{ t: 'Backtest', d: '10 ans rejoués', href: '/backtest' },{ t: 'Comparateur SGI', d: 'Trouver la SGI', href: '/comparateur-sgi' }]} />
        <Card k="04" title="Explorer" desc="Obligations, heatmap, academy." accent="rgb(var(--color-purple))" href="/obligations" items={[{ t: 'Obligations', d: 'YTM & duration', href: '/obligations' },{ t: 'Heatmap', d: 'Vue d’ensemble', href: '/heatmap' },{ t: 'Academy', d: 'Se former', href: '/formations' }]} />
      </div>
    </section>
  );
}
