'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CRUMBS: Record<string, { label: string; href: string }[]> = {
  '/apercu': [{ label: 'Aperçu', href: '/apercu' }],
  '/apercu/dashboard': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Marché', href: '/apercu/dashboard' }],
  '/apercu/portefeuille': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Portefeuille', href: '/apercu/portefeuille' }],
  '/apercu/actions': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Actions', href: '/apercu/actions' }],
  '/apercu/societes': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Sociétés', href: '/apercu/societes' }],
  '/apercu/signaux': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Signaux', href: '/apercu/signaux' }],
  '/apercu/obligations': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Obligations', href: '/apercu/obligations' }],
  '/apercu/heatmap': [{ label: 'Aperçu', href: '/apercu' }, { label: 'Heatmap', href: '/apercu/heatmap' }],
};

function crumbs(path: string) {
  if (CRUMBS[path]) return CRUMBS[path];
  // fallback : parent + leaf
  const parts = path.replace(/^\/apercu\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return CRUMBS['/apercu'];
  return [{ label: 'Aperçu', href: '/apercu' }, { label: parts[parts.length - 1], href: path }];
}

export function ApercuFrame({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const path = usePathname() ?? '/apercu';
  const cs = crumbs(path);
  return (
    <div className="apv">
      <div className="apv-bar">
        <nav aria-label="Fil d'Ariane" className="apv-crumbs">
          {cs.map((c, i) => (
            <span key={c.href} className="apv-crumb">
              {i > 0 && <span aria-hidden className="apv-sep">/</span>}
              <Link href={c.href}>{c.label}</Link>
            </span>
          ))}
        </nav>
        <span className="apv-badge">PREVIEW — noindex</span>
      </div>
      {(title || subtitle) && (
        <header className="apv-head">
          {title && <h1 className="apv-title">{title}</h1>}
          {subtitle && <p className="apv-sub">{subtitle}</p>}
        </header>
      )}
      {children}
      <p className="apv-foot">
        Mode aperçu — données réelles, lecture seule. <Link href="/">Retour prod</Link> · <Link href="/dashboard">Dashboard prod</Link>
      </p>
    </div>
  );
}

export function ApercuNav() {
  const path = usePathname() ?? '/apercu';
  const links = [
    { href: '/apercu', label: 'Landing' },
    { href: '/apercu/dashboard', label: 'Marché' },
    { href: '/apercu/portefeuille', label: 'Portefeuille' },
    { href: '/apercu/actions', label: 'Actions' },
    { href: '/apercu/societes', label: 'Sociétés' },
    { href: '/apercu/signaux', label: 'Signaux' },
    { href: '/apercu/obligations', label: 'Obligations' },
    { href: '/apercu/heatmap', label: 'Heatmap' },
  ];
  return (
    <nav aria-label="Aperçu app" className="apv-nav">
      {links.map((l) => {
        const active = path === l.href || (l.href !== '/apercu' && path.startsWith(l.href));
        return (
          <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
