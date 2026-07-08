'use client';

import { useState } from 'react';

export interface ImageGalleryProps {
  images: string[];
  altPrefix?: string;
}

/**
 * Responsive image gallery with lightbox.
 * Grid layout (1/2/3 cols based on count) with click-to-expand.
 */
export function ImageGallery({ images, altPrefix = 'Image' }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const cols = images.length === 1 ? 1 : images.length === 2 ? 2 : 3;
  const gridClass = {
    1: 'grid-cols-1 max-w-sm',
    2: 'grid-cols-2 max-w-2xl',
    3: 'grid-cols-3 max-w-4xl',
  }[cols];

  return (
    <>
      <div className={`grid ${gridClass} gap-2 my-3`}>
        {images.map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="relative overflow-hidden rounded-lg bg-surface border border-border hover:border-accent/40 transition group"
            style={{ paddingBottom: '100%' }}
          >
            <img
              src={src}
              alt={`${altPrefix} ${idx + 1}`}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIndex]!}
              alt={`${altPrefix} ${lightboxIndex + 1}`}
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              onClick={() => setLightboxIndex(null)}
              title="Fermer"
              aria-label="Fermer"
            >
              ✕
            </button>
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              onClick={() => setLightboxIndex((i) => (i! - 1 + images.length) % images.length)}
              title="Image précédente"
              aria-label="Image précédente"
            >
              ◀
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              onClick={() => setLightboxIndex((i) => (i! + 1) % images.length)}
              title="Image suivante"
              aria-label="Image suivante"
            >
              ▶
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/40 text-white text-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
