import Image from 'next/image';

/**
 * Diaporama des écrans réels de la plateforme (effet vidéo, CSS pur).
 * Les captures sont de vraies pages de prod (frontend/public/screens/).
 * Sera remplacé par la balise <video> dès que le MP4 Remotion est rendu.
 */
const SCREENS = [
  { src: '/screens/societes.png', label: 'Les 48 sociétés notées A–F' },
  { src: '/screens/fiche-snts.png', label: 'Fiche société : cours, fondamentaux, dividendes' },
  { src: '/screens/simulateur.png', label: 'Simulateur — dividendes inclus' },
  { src: '/screens/note-conjoncture.png', label: 'Note de conjoncture quotidienne' },
  { src: '/screens/landing.png', label: 'Le marché en direct' },
];

const CYCLE = 20; // secondes (5 écrans × 4 s) — utilisé par le repli sans vidéo

export default function ScreensShowcase() {
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2 text-center">La plateforme en action</p>
      <div
        className="relative overflow-hidden rounded-panel border border-white/10"
        style={{ aspectRatio: '16/9', boxShadow: '0 22px 60px rgba(0,0,0,0.4)' }}
      >
        {/* Vidéo générée depuis les écrans réels (remotion/ + ffmpeg).
            Muette + autoplay + loop : autorisé par tous les navigateurs.
            Le diaporama CSS ci-dessous sert de repli si la vidéo ne charge pas. */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/landing-video.mp4"
          poster="/screens/landing.png"
          autoPlay
          muted
          loop
          playsInline
          aria-label="Démonstration des fonctionnalités : sociétés notées, fiches, simulateur et note de conjoncture"
        >
          {/* Repli diaporama si <video> non supporté */}
          {SCREENS.map((s, i) => (
            <figure
              key={s.src}
              className="absolute inset-0 m-0 opacity-0"
              style={{
                animation: `showcase-fade ${CYCLE}s linear infinite`,
                animationDelay: `${i * (CYCLE / SCREENS.length)}s`,
              }}
            >
              <Image src={s.src} alt={s.label} fill className="object-cover object-top" />
            </figure>
          ))}
        </video>
      </div>
      <p className="mt-2 text-center text-[11px] text-faint">
        Écrans réels de la plateforme — sociétés notées A–F, fiche, simulateur, note de conjoncture.
      </p>
    </section>
  );
}
