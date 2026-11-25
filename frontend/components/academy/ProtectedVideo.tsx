'use client';

import { useCallback, useEffect, useState, type MutableRefObject, type Ref } from 'react';

const COINS_FILIGRANE = [
  'top-3 right-3',
  'top-3 left-3',
  'bottom-12 right-3',
  'bottom-12 left-3',
] as const;

export interface ProtectedVideoProps {
  src: string;
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto';
  className?: string;
  wrapperClassName?: string;
  ariaLabel?: string;
  watermark?: string | null;
  videoRef?: Ref<HTMLVideoElement>;
  onEnded?: () => void;
}

/**
 * Lecteur vidéo durci contre le téléchargement accidentel ou direct :
 *  - bouton « Télécharger » et Picture-in-Picture désactivés (`controlsList`, `disablePictureInPicture`) ;
 *  - diffusion distante (`disableRemotePlayback`) désactivée ;
 *  - clic droit, glisser-déposer et Ctrl/Cmd+S bloqués sur le conteneur ;
 *  - filigrane discret rotatif contre la capture et la redistribution.
 *
 * Sans `crossOrigin` afin de suivre proprement la redirection 302 vers Supabase Storage.
 */
export default function ProtectedVideo({
  src,
  poster,
  preload = 'metadata',
  className,
  wrapperClassName,
  ariaLabel,
  watermark,
  videoRef,
  onEnded,
}: ProtectedVideoProps) {
  const [coin, setCoin] = useState(0);

  useEffect(() => {
    if (!watermark) return;
    const id = window.setInterval(() => {
      setCoin((c) => (c + 1) % COINS_FILIGRANE.length);
    }, 25_000);
    return () => window.clearInterval(id);
  }, [watermark]);

  const setRefs = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) {
        el.disableRemotePlayback = true;
      }
      if (typeof videoRef === 'function') {
        videoRef(el);
      } else if (videoRef && 'current' in videoRef) {
        (videoRef as MutableRefObject<HTMLVideoElement | null>).current = el;
      }
    },
    [videoRef],
  );

  return (
    <div
      className={`relative select-none ${wrapperClassName ?? ''}`.trim()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
        }
      }}
    >
      <video
        ref={setRefs}
        controls
        playsInline
        preload={preload}
        poster={poster}
        src={src}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onEnded={onEnded}
        className={className}
        aria-label={ariaLabel}
      >
        Votre navigateur ne prend pas en charge la lecture vidéo intégrée.
      </video>

      {watermark && (
        <span
          aria-hidden="true"
          className={`pointer-events-none select-none absolute ${COINS_FILIGRANE[coin]} rounded bg-black/25 px-2 py-0.5 text-[10px] font-medium tracking-wider text-white/30 backdrop-blur-[1px] transition-all duration-700`}
        >
          {watermark}
        </span>
      )}
    </div>
  );
}
