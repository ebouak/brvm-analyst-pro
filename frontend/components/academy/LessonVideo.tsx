/**
 * Version vidéo d'une leçon (motion design + voix off). Les fichiers passent
 * par /api/academy/video/…, qui vérifie l'accès avant de signer l'URL.
 * `preload="metadata"` : rien n'est téléchargé tant que la personne ne lance
 * pas la lecture.
 */
export default function LessonVideo({ slug, numero }: { slug: string; numero: number }) {
  const base = `/api/academy/video/${slug}/lecon-${numero}`;
  return (
    <figure className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
      <video
        controls
        playsInline
        preload="metadata"
        poster={`${base}.jpg`}
        src={`${base}.mp4`}
        className="aspect-video w-full bg-bg"
        aria-label={`Version vidéo de la leçon ${numero}`}
      />
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted">
        <span>Version vidéo de la leçon · motion design et voix off</span>
        <span className="text-faint">Le texte complet suit, à lire à votre rythme.</span>
      </figcaption>
    </figure>
  );
}
