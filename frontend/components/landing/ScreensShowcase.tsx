'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * Diaporama des écrans réels de la plateforme (vidéo Remotion).
 * PERF : la vidéo (~3,7 Mo) n'est montée QUE lorsque la section approche du
 * viewport (IntersectionObserver). Avant ça, un poster optimisé next/image
 * (AVIF/WebP, ~quelques dizaines de Ko) occupe la place → le chargement initial
 * de la landing n'embarque plus la vidéo ni le PNG poster brut de 842 Ko.
 */
export default function ScreensShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoadVideo(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2 text-center">La plateforme en action</p>
      <div
        ref={ref}
        className="relative overflow-hidden rounded-panel border border-white/10"
        style={{ aspectRatio: '16/9', boxShadow: '0 22px 60px rgba(0,0,0,0.4)' }}
      >
        {loadVideo ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/landing-video.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Démonstration : sociétés notées, fiches, simulateur et note de conjoncture"
          />
        ) : (
          <Image
            src="/screens/app-dashboard.png"
            alt="Aperçu de la plateforme WESTBOURSE"
            fill
            sizes="(max-width: 768px) 100vw, 1100px"
            className="object-cover object-top"
          />
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-faint">
        Écrans réels de l&apos;application — tableau de bord, fiche instrument, signaux, heatmap, screener.
      </p>
    </section>
  );
}
