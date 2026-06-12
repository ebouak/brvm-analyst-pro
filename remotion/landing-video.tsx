import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';

/**
 * Vidéo de présentation BRVM Analyst Pro (16 s, 1920×1080, 30 fps).
 * Écrans réels du site hébergés en prod (frontend/public/screens/).
 * Rendu via : scripts/render-landing-video.ps1 (belt / inference.sh).
 */

const BASE = 'https://frontend-zeta-ten-22.vercel.app/screens';

const SCREENS = [
  { src: `${BASE}/societes.png`, label: 'Les 48 sociétés notées A–F, en direct' },
  { src: `${BASE}/fiche-snts.png`, label: 'Fiche société : cours, fondamentaux, dividendes' },
  { src: `${BASE}/simulateur.png`, label: 'Simulateur — « et si vous aviez investi ? »' },
  { src: `${BASE}/note-conjoncture.png`, label: 'Note de conjoncture quotidienne, PDF inclus' },
];

const ACCENT = '#56d7fd';
const BG = '#030303';
const INTRO = 75; // 2.5 s
const PER_SCREEN = 83; // ~2.75 s par écran
const OUTRO = 72; // 2.4 s

function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const subOpacity = interpolate(frame, [18, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <div
        style={{
          color: '#fcfcfc', fontSize: 76, fontWeight: 800, letterSpacing: -2, textAlign: 'center',
          maxWidth: 1100, lineHeight: 1.1,
          transform: `translateY(${(1 - titleIn) * 60}px)`, opacity: titleIn,
        }}
      >
        Décidez sur la BRVM avec des <span style={{ color: ACCENT }}>données</span>, pas des rumeurs.
      </div>
      <div style={{ color: '#8b93a7', fontSize: 30, marginTop: 28, opacity: subOpacity }}>
        Cours 15 min · Note A–F · Fondamentaux officiels · Gratuit
      </div>
    </AbsoluteFill>
  );
}

function Screen({ src, label }: { src: string; label: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, PER_SCREEN - 12, PER_SCREEN], [0, 1, 1, 0]);
  // Ken Burns : zoom lent 1.0 → 1.06
  const scale = interpolate(frame, [0, PER_SCREEN], [1, 1.06]);
  const labelIn = interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', opacity }}>
      <div style={{ width: 1640, height: 1025, overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(255,255,255,0.12)' }}>
        <Img src={src} style={{ width: '100%', transform: `scale(${scale})`, transformOrigin: 'top center' }} />
      </div>
      <div
        style={{
          position: 'absolute', bottom: 44, padding: '14px 34px', borderRadius: 999,
          backgroundColor: 'rgba(3,3,3,0.85)', border: `1px solid ${ACCENT}55`,
          color: '#fcfcfc', fontSize: 30, fontWeight: 600, fontFamily: 'sans-serif',
          opacity: labelIn, transform: `translateY(${(1 - labelIn) * 18}px)`,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inAnim = spring({ frame, fps, config: { damping: 12, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#fcfcfc', fontSize: 58, fontWeight: 800, opacity: inAnim, transform: `scale(${0.92 + inAnim * 0.08})` }}>
        Créez votre compte gratuit
      </div>
      <div
        style={{
          marginTop: 34, padding: '18px 52px', borderRadius: 999, fontSize: 34, fontWeight: 800,
          color: '#03222b', background: `linear-gradient(180deg,#8fe6ff,${ACCENT})`,
          opacity: inAnim,
        }}
      >
        brvm-analyst.pro
      </div>
      <div style={{ color: '#8b93a7', fontSize: 22, marginTop: 26, opacity: inAnim }}>
        Aucune carte bancaire · 1 minute
      </div>
    </AbsoluteFill>
  );
}

export default function Main() {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Sequence from={0} durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {SCREENS.map((s, i) => (
        <Sequence key={s.src} from={INTRO + i * PER_SCREEN} durationInFrames={PER_SCREEN}>
          <Screen src={s.src} label={s.label} />
        </Sequence>
      ))}
      <Sequence from={INTRO + SCREENS.length * PER_SCREEN} durationInFrames={OUTRO}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
}
