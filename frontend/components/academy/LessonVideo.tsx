import ProtectedVideo from './ProtectedVideo';

/**
 * Version vidéo d'une leçon (motion design + voix off). Les fichiers passent
 * par /api/academy/video/…, qui vérifie l'accès avant de signer l'URL.
 * `preload="metadata"` : rien n'est téléchargé tant que la personne ne lance
 * pas la lecture.
 */
export default function LessonVideo({
  slug,
  numero,
  watermark,
}: {
  slug: string;
  numero: number;
  watermark?: string | null;
}) {
  const base = `/api/academy/video/${slug}/lecon-${numero}`;
  return (
    <figure className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
      <ProtectedVideo
        src={`${base}.mp4`}
        poster={`${base}.jpg`}
        preload="metadata"
        className="aspect-video w-full bg-bg"
        ariaLabel={`Version vidéo de la leçon ${numero}`}
        watermark={watermark ?? 'WESTBOURSE Academy'}
      />
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted">
        <span>Version vidéo de la leçon · lecture uniquement sur la plateforme</span>
        <span className="text-faint">Le texte complet suit, à lire à votre rythme.</span>
      </figcaption>
    </figure>
  );
}
