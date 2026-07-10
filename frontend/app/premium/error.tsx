'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';

/**
 * Error boundary du segment /premium : un crash d'un outil premium (DCF,
 * diagnostic, paper trading…) n'emporte plus tout le shell.
 */
export default function PremiumError({
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        <p className="text-sm text-muted">Mise à jour de l&apos;application…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-xl text-gold">◇</div>
      <div className="space-y-1">
        <h2 className="font-display text-lg text-white">Cet outil n&apos;a pas pu se charger</h2>
        <p className="max-w-sm text-sm text-muted">Le reste de l&apos;application fonctionne. Réessayez ou revenez aux outils.</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-[44px] items-center rounded-full bg-gold px-6 text-sm font-bold text-obsidian transition-transform active:scale-95"
        >
          Réessayer
        </button>
        <Link href="/premium/outils" className="text-sm text-muted underline underline-offset-4 hover:text-white">
          ← Outils Pro
        </Link>
      </div>
    </div>
  );
}
