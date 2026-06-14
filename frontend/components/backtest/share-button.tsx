'use client';

import { useRef, useState, type ReactNode } from 'react';
import { toPng } from 'html-to-image';

/**
 * Enveloppe l'infographie et ajoute un bouton « Partager / Télécharger » qui
 * exporte le bloc en image PNG (html-to-image). Idéal pour les réseaux sociaux.
 */
export function ShareableInfographic({ children, filename = 'backtest' }: { children: ReactNode; filename?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function exportPng() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#f9fafb', cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${filename}.png`, { type: 'image/png' });

      // Partage natif si disponible, sinon téléchargement.
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: 'Backtest BRVM Analyst Pro' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${filename}.png`;
        a.click();
      }
    } catch {
      /* annulation utilisateur ou export impossible — silencieux */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportPng}
          disabled={busy}
          aria-label="Partager ou télécharger l'infographie en image"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Génération…' : '↗ Partager / Télécharger'}
        </button>
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}
