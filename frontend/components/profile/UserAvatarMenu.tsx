'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import UserAvatar from './UserAvatar';

interface Me { email: string; displayName: string; avatarUrl: string | null; isPremium: boolean }

export default function UserAvatarMenu() {
  const [me, setMe] = useState<Me | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    fetch('/api/profile', { cache: 'no-store' }).then(async (r) => {
      if (!alive) return;
      if (r.status === 401) { setAuthed(false); return; }
      const j = await r.json();
      const p = j.profile ?? {};
      setMe({
        email: j.email ?? p.email ?? '',
        displayName: p.display_name || (j.email ?? '').split('@')[0] || 'Membre',
        avatarUrl: p.avatar_url ?? null,
        isPremium: Boolean(p.is_premium),
      });
      setAuthed(true);
    }).catch(() => alive && setAuthed(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function logout() {
    await createClient().auth.signOut();
    router.push('/login'); router.refresh();
  }

  if (authed === false) {
    return <Link href="/login" className="text-xs text-info hover:underline">Connexion</Link>;
  }
  if (!me) return <div className="h-7 w-7 rounded-full bg-border animate-pulse" />;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        aria-label="Menu utilisateur" aria-haspopup="true" aria-expanded={open}
        className="flex items-center gap-2 rounded-full transition hover:ring-2 hover:ring-accent/30">
        <UserAvatar src={me.avatarUrl} name={me.displayName} size="sm" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-60 overflow-hidden rounded-xl border border-border bg-elevated shadow-modal">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <UserAvatar src={me.avatarUrl} name={me.displayName} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{me.displayName}</p>
              <p className="truncate text-[11px] text-faint">{me.email}</p>
            </div>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold ${me.isPremium ? 'bg-gradient-to-r from-accent to-up text-bg' : 'border border-border text-faint'}`}>
              {me.isPremium ? 'PRO' : 'FREE'}
            </span>
          </div>
          <div className="py-1 text-sm">
            {[
              { href: '/profil', label: '🙍 Mon profil' },
              { href: '/portefeuille', label: '📊 Mon portefeuille' },
              { href: '/parametres/compte', label: '⚙️ Paramètres' },
            ].map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                className="block px-4 py-2 text-muted hover:bg-white/[0.04] hover:text-white transition">
                {it.label}
              </Link>
            ))}
            <button type="button" onClick={logout}
              className="block w-full border-t border-border px-4 py-2 text-left text-down hover:bg-down/5 transition">
              🚪 Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
