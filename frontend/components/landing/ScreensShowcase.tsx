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

const CYCLE = 20; // secondes (5 écrans × 4 s)

export default function ScreensShowcase() {
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2 text-center">La plateforme en action</p>
      <div
        className="relative overflow-hidden rounded-panel border border-white/10"
        style={{ aspectRatio: '16/10', boxShadow: '0 22px 60px rgba(0,0,0,0.4)' }}
      >
        {SCREENS.map((s, i) => (
          <figure
            key={s.src}
            className="absolute inset-0 m-0 opacity-0"
            style={{
              animation: `showcase-fade ${CYCLE}s linear infinite`,
              animationDelay: `${i * (CYCLE / SCREENS.length)}s`,
            }}
          >
            <Image
              src={s.src}
              alt={s.label}
              fill
              sizes="(max-width: 1100px) 100vw, 1080px"
              className="object-cover object-top"
              priority={i === 0}
            />
            <figcaption
              className="absolute bottom-0 left-0 right-0 px-5 py-3 text-sm font-medium text-ivory"
              style={{ background: 'linear-gradient(0deg, rgba(3,3,3,0.92), rgba(3,3,3,0))' }}
            >
              {s.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
