'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Menu, Search, X } from 'lucide-react';
import {
  adminBreadcrumb,
  type AdminNavGroup,
  type AdminNavGroupId,
  type AdminNavItem,
} from '@/lib/admin-nav';
import type { AdminBadge } from '@/lib/admin/badges';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

const BADGE_CLASS: Record<AdminBadge['tone'], string> = {
  critical: 'border-down/40 bg-down/15 text-down',
  warning: 'border-warn/40 bg-warn/15 text-warn',
  info: 'border-accent/35 bg-accent/10 text-accent',
};

const DOT_CLASS: Record<AdminBadge['tone'], string> = {
  critical: 'bg-down',
  warning: 'bg-warn',
  info: 'bg-accent',
};

function worstTone(group: AdminNavGroup, badges: Record<string, AdminBadge>): AdminBadge['tone'] | null {
  let worst: AdminBadge['tone'] | null = null;
  for (const it of group.items) {
    const b = badges[it.href];
    if (!b || b.count <= 0) continue;
    if (b.tone === 'critical') return 'critical';
    if (b.tone === 'warning') worst = 'warning';
    else if (!worst) worst = 'info';
  }
  return worst;
}

export function AdminShell({
  groups: propGroups,
  items: legacyItems,
  badges = {},
  email,
  roles,
  children,
}: {
  groups?: AdminNavGroup[];
  items?: AdminNavItem[];
  badges?: Record<string, AdminBadge>;
  email: string;
  roles: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumb = adminBreadcrumb(pathname);

  const groups: AdminNavGroup[] = useMemo(() => {
    if (propGroups && propGroups.length > 0) return propGroups;
    return legacyItems && legacyItems.length > 0
      ? [{ id: 'pilotage', label: 'Administration', items: legacyItems }]
      : [];
  }, [propGroups, legacyItems]);

  const activeGroupId = useMemo<AdminNavGroupId | null>(() => {
    let best: { id: AdminNavGroupId; len: number } | null = null;
    for (const g of groups) {
      for (const it of g.items) {
        if (isActive(it.href, pathname) && (!best || it.href.length > best.len)) {
          best = { id: g.id, len: it.href.length };
        }
      }
    }
    return best?.id ?? null;
  }, [groups, pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    pilotage: true,
    donnees: true,
    systeme: true,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setQuery('');
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allItems = useMemo(
    () => groups.flatMap((g) => g.items.map((it) => ({ ...it, groupLabel: g.label }))),
    [groups],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.href.toLowerCase().includes(q) ||
        it.groupLabel.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNavGroups = (onNavigate?: () => void) => (
    <div className="space-y-2">
      {groups.map((g) => {
        const isOpen = openGroups[g.id] ?? g.id === activeGroupId;
        const tone = worstTone(g, badges);
        return (
          <div key={g.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(g.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-faint transition-colors hover:bg-elevated/60 hover:text-ivory"
            >
              <span className="flex items-center gap-2">
                {tone && <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />}
                {g.label}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div className="space-y-0.5 pl-1">
                {g.items.map((it) => {
                  const active = isActive(it.href, pathname);
                  const badge = badges[it.href];
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                        active
                          ? 'bg-accent/15 font-medium text-accent'
                          : 'text-muted hover:bg-elevated hover:text-ivory'
                      }`}
                    >
                      <span className="truncate">{it.label}</span>
                      {badge && badge.count > 0 && (
                        <span
                          className={`tabular shrink-0 rounded-full border px-1.5 py-0.2 text-[10px] font-semibold ${BADGE_CLASS[badge.tone]}`}
                        >
                          {badge.count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg text-ivory">
      {/* Sidebar admin desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 border-b border-border px-5 py-4">
          <AnimatedLogo size={34} variant="mark" animate={false} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ivory">Console admin</div>
            <div className="overline text-faint">WESTBOURSE</div>
          </div>
        </Link>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setPaletteOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-bg/70 px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-ivory"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Rechercher…
            </span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-faint">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Navigation administration">
          {renderNavGroups()}
        </nav>

        <div className="border-t border-border px-5 py-3">
          <Link href="/dashboard" className="text-xs text-muted transition-colors hover:text-ivory">
            ← Retour à l&apos;application
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + breadcrumbs */}
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/40 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu d'administration"
              className="rounded-lg border border-border p-1.5 text-muted hover:text-ivory lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm truncate">
              <Link href="/admin" className="text-muted transition-colors hover:text-ivory">
                Admin
              </Link>
              {crumb !== "Vue d'ensemble" && (
                <>
                  <span className="text-faint" aria-hidden>
                    /
                  </span>
                  <span className="truncate font-medium text-ivory">{crumb}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPaletteOpen(true);
              }}
              aria-label="Recherche rapide"
              className="rounded-lg border border-border p-1.5 text-muted hover:text-ivory lg:hidden"
            >
              <Search className="h-4 w-4" />
            </button>
            <span className="hidden text-xs text-muted sm:inline">{email}</span>
            {roles.length > 0 && (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                {roles.includes('super_admin') ? 'super admin' : roles[0]}
              </span>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>

      {/* Tiroir mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-ivory">Console admin</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-lg p-1 text-muted hover:text-ivory"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Navigation administration (mobile)">
              {renderNavGroups(() => setMobileOpen(false))}
            </nav>
            <div className="border-t border-border px-4 py-3">
              <Link href="/dashboard" className="text-xs text-muted hover:text-ivory">
                ← Retour à l&apos;application
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Palette Cmd+K */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-20"
          role="dialog"
          aria-modal="true"
          aria-label="Accès rapide administration"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
              <Search className="h-4 w-4 text-faint" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredItems[0]) {
                    setPaletteOpen(false);
                    router.push(filteredItems[0].href);
                  }
                }}
                placeholder="Aller vers une page admin (ex. contrôle, paiement, ops, boc)…"
                className="w-full bg-transparent text-sm text-ivory placeholder:text-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="text-xs text-faint hover:text-ivory"
              >
                Échap
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-border/40 p-1.5">
              {filteredItems.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-muted">Aucune page correspondante.</li>
              ) : (
                filteredItems.slice(0, 12).map((it) => {
                  const badge = badges[it.href];
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={() => setPaletteOpen(false)}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-elevated"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ivory">{it.label}</span>
                          <span className="block truncate text-[11px] text-faint">
                            {it.groupLabel} · {it.href}
                          </span>
                        </span>
                        {badge && badge.count > 0 && (
                          <span
                            className={`tabular shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE_CLASS[badge.tone]}`}
                          >
                            {badge.count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
