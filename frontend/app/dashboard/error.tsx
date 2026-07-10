'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';

/**
 * Error boundary du segment /dashboard : un crash d'une page du tableau de bord
 * n'emporte plus tout le shell (la sidebar reste utilisable).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkLoadError(error);
  useEffect(() => {
    reloadOnceForChunkError(error);
  }, [error]);

  if (chunk) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <p className="text-sm text-muted">Mise à jour de l&apos;application…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-xl text-accent">◇</div>
      <div className="space-y-1">
        <h2 className="font-display text-lg text-white">Cette section n&apos;a pas pu se charger</h2>
        <p className="max-w-sm text-sm text-muted">Le reste de l&apos;application fonctionne. Réessayez ou changez de page.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-bold text-[#03222b] transition-transform active:scale-95"
        >
          Réessayer
        </button>
        <Link href="/dashboard" className="text-sm text-muted underline underline-offset-4 hover:text-white">
          ← Tableau de bord
        </Link>
      </div>
    </div>
  );
}
