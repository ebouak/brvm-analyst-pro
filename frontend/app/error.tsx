'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';

/**
 * Error boundary racine (couvre toutes les routes sous le layout).
 * ChunkLoadError (chunk périmé après déploiement) → rechargement auto transparent.
 * Autre erreur → écran soigné + « Réessayer ».
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkLoadError(error);

  useEffect(() => {
    reloadOnceForChunkError(error);
  }, [error]);

  // Pendant le rechargement auto : écran neutre (pas de message d'erreur alarmant).
  if (chunk) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#56D7FD]/30 border-t-[#56D7FD]" />
        <p className="text-sm text-muted">Mise à jour de l&apos;application…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#56D7FD]/25 bg-[#56D7FD]/10 text-2xl text-[#56D7FD]">
        ◇
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-xl text-white">Une erreur est survenue</h1>
        <p className="max-w-sm text-sm text-muted">
          La page n&apos;a pas pu se charger correctement. Réessayez — si le problème persiste,
          revenez au tableau de bord.
        </p>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-[44px] items-center rounded-full bg-[#56D7FD] px-6 text-sm font-bold text-[#03222b] transition-transform active:scale-95"
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
