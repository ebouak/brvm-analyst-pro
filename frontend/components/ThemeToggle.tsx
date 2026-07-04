'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'westbourse-theme';

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Bouton pilule clair/sombre (icône + libellé). Le thème initial est déjà
 * posé avant hydratation par le script anti-flash dans layout.tsx ; ce
 * composant lit `data-theme` au montage pour rester synchronisé (jamais de
 * flash au clic), puis persiste le choix dans localStorage.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  }

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isLight ? 'true' : 'false'}
      aria-label={isLight ? 'Passer au thème sombre' : 'Passer au thème clair'}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ivory ${className}`}
    >
      {isLight ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.5A7 7 0 0 1 12 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {isLight ? 'Clair' : 'Sombre'}
    </button>
  );
}
