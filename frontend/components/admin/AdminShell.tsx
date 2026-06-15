'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { adminBreadcrumb, type AdminNavItem } from '@/lib/admin-nav';

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminShell({
  items,
  email,
  roles,
  children,
}: {
  items: AdminNavItem[];
  email: string;
  roles: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const crumb = adminBreadcrumb(pathname);

  return (
    <div className="flex min-h-screen bg-bg text-ivory">
      {/* Sidebar admin */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/40 bg-accent/10 font-display text-lg font-bold text-accent">B</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ivory">Console admin</div>
            <div className="overline text-faint">BRVM Analyst Pro</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 p-3" aria-label="Navigation administration">
          {items.map((it) => {
            const active = isActive(it.href, pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-accent/15 font-medium text-accent' : 'text-muted hover:bg-elevated hover:text-ivory'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-5 py-3">
          <Link href="/dashboard" className="text-xs text-muted transition-colors hover:text-ivory">
            ← Retour à l'application
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + breadcrumbs */}
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/40 px-6 py-3">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm">
            <Link href="/admin" className="text-muted transition-colors hover:text-ivory">Admin</Link>
            {crumb !== "Vue d'ensemble" && (
              <>
                <span className="text-faint" aria-hidden>/</span>
                <span className="font-medium text-ivory">{crumb}</span>
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            {roles.length > 0 && (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {roles.includes('super_admin') ? 'super admin' : roles[0]}
              </span>
            )}
          </div>
        </header>

        {/* Mobile nav (sélecteur simple) */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface/40 px-3 py-2 lg:hidden" aria-label="Navigation administration (mobile)">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                isActive(it.href, pathname) ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {it.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
