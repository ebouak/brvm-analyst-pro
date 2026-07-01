'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';

/**
 * Error boundary du layout RACINE (rare) — remplace <html>/<body> quand une
 * erreur survient dans le layout lui-même. Styles inline car globals.css /
 * Tailwind ne sont pas garantis ici. Même récupération ChunkLoadError.
 */
export default function GlobalError({
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

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#030303',
          color: '#FCFCFC',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        {chunk ? (
          <p style={{ color: '#7a9ea8', fontSize: 14 }}>Mise à jour de l’application…</p>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Une erreur est survenue</h1>
            <p style={{ color: '#7a9ea8', fontSize: 14, maxWidth: 360 }}>
              La page n’a pas pu se charger. Réessayez.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 44,
                padding: '0 24px',
                borderRadius: 999,
                border: 'none',
                background: '#56D7FD',
                color: '#03222b',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Recharger
            </button>
          </>
        )}
      </body>
    </html>
  );
}
