import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Fond, Logo } from './elements';
import type { Theme } from './theme';

/**
 * Signature de fin de la vidéo de séance : 2,2 s, après la dernière phrase et
 * après les 1,5 s de la carte finale, qui porte l'avertissement légal et doit
 * rester lisible.
 *
 * Une seule idée, la même que le splash du site : le W se trace comme une courbe
 * de cours, la flèche prolonge son dernier jambage, la pointe conclut. Le logo
 * n'est animé qu'ICI (la carte finale le montre fixe) : tracé deux fois en
 * trois secondes, il perdrait son effet. Aucune donnée : une signature ne porte
 * pas de chiffre, elle ne peut donc contredire la séance.
 *
 * Pas de son : le jour où un logo sonore existe, caler le léger rebond d'échelle
 * (images 34-44) sur son pic.
 */
export const DUREE_SIGNATURE = 66;

const SORTIE = Easing.bezier(0.22, 1, 0.36, 1);
const TRACE = Easing.bezier(0.65, 0, 0.35, 1);

export function Signature({ th }: { th: Theme }) {
  const f = useCurrentFrame();
  if (th.modele === 'verre') return <SignatureVerre th={th} f={f} />;
  const p = (a: number, b: number, easing = SORTIE) =>
    interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

  const echelle = interpolate(f, [33, 37, 45], [1, 1.04, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SORTIE });
  const papier = th.modele === 'papier';

  return (
    <AbsoluteFill style={{ opacity: p(0, 8), background: th.fond }}>
      <Fond th={th} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${echelle})` }}>
          <Logo th={th} taille={420} prog={p(4, 34, TRACE)} />
        </div>
        <div
          style={{
            marginTop: 72,
            fontFamily: papier ? th.titre : th.chiffre,
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: papier ? '.04em' : '.3em',
            paddingLeft: papier ? 0 : '.3em',
            color: th.encre,
            clipPath: `inset(0 ${(1 - p(27, 41)) * 100}% 0 0)`,
          }}
        >
          WESTBOURSE
        </div>
        <div style={{ marginTop: 26, fontFamily: th.chiffre, fontSize: 44, fontWeight: 600, color: th.accent, opacity: p(38, 50) }}>
          westbourse.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ── Modèle verre : le logo officiel se construit ────────────────────────
   Même idée, mêmes 66 images : une tuile de verre se pose sur le sol du
   studio, le W se trace, la flèche jaillit et sa pointe s'ouvre dans une
   gerbe d'étincelles, le bleu nuit monte dans la tuile comme un liquide, un
   reflet la balaie. Le logo se reflète sur le sol. Toujours aucune donnée. */
const ETINCELLES = Array.from({ length: 26 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180; // angle d'or : répartition régulière, sans hasard
  const v = 70 + ((i * 53) % 110);
  return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + (i % 4), c: i % 3 === 0 ? '#ffffff' : '#3FE0CB' };
});

function SignatureVerre({ th, f }: { th: Theme; f: number }) {
  const p = (a: number, b: number, easing = SORTIE) =>
    interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
  const pose = interpolate(f, [0, 8, 14], [0.6, 1.06, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SORTIE });
  const w = p(6, 28, TRACE), fl = p(26, 34, TRACE), tete = p(32, 40);
  const niveau = 112 - 124 * p(30, 48);
  const vague = Array.from({ length: 30 }, (_, i) => {
    const x = -4 + i * 5;
    return `L${x} ${niveau + (niveau > -10 && niveau < 110 ? 3 * Math.sin(x * 0.12 + f * 0.5) : 0)}`;
  }).join(' ');
  const gerbe = p(33, 58, Easing.out(Easing.quad));
  const reflet = p(44, 62);
  const marque = (
    <svg width={460} height={372} viewBox="-4 -10 142 118" style={{ overflow: 'visible' }}>
      <defs><clipPath id="sv-tuile"><rect x={-2} y={-10} width={138} height={112} rx={26} /></clipPath></defs>
      <g clipPath="url(#sv-tuile)">
        <path d={`M-4 ${niveau} ${vague} L150 120 L-4 120 Z`} fill="#0D1E2F" />
        {reflet > 0 && reflet < 1 && <rect x={-60 + reflet * 240} y={-30} width={22} height={170} fill="rgba(255,255,255,.28)" transform="skewX(-18)" />}
      </g>
      <rect x={-2} y={-10} width={138} height={112} rx={26} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth={1.6} />
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#FCFCFC" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - w} opacity={w > 0 ? 1 : 0} />
      <path d="M76 82 L100 33" fill="none" stroke="#18B6A4" strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - fl} opacity={fl > 0 ? 1 : 0} />
      <polygon points="110,12 117,40 86,28" fill="#18B6A4" transform={`translate(104 27) scale(${tete}) translate(-104 -27)`} />
      {gerbe > 0 && gerbe < 1 && ETINCELLES.map((e, i) => (
        <circle key={i} cx={112 + e.vx * gerbe * 0.5} cy={16 + e.vy * gerbe * 0.5 + 30 * gerbe * gerbe} r={e.r * 0.6} fill={e.c} opacity={1 - gerbe} />
      ))}
    </svg>
  );
  return (
    <AbsoluteFill style={{ opacity: p(0, 6), background: th.fond }}>
      <Fond th={th} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `scale(${pose})`, borderRadius: 96,
          backdropFilter: 'blur(10px) brightness(1.3)', WebkitBackdropFilter: 'blur(10px) brightness(1.3)',
          boxShadow: `0 0 ${60 * p(30, 50)}px rgba(63,224,203,.25)`,
          WebkitBoxReflect: 'below 26px linear-gradient(transparent 52%, rgba(255,255,255,.3))',
        } as React.CSSProperties}>{marque}</div>
        <div style={{
          marginTop: 220, fontFamily: th.titre, fontSize: 92, fontWeight: 700, letterSpacing: '.05em', color: th.encre,
          clipPath: `inset(-20% ${(1 - p(28, 42)) * 100}% -20% 0)`,
        }}>WESTBOURSE</div>
        <div style={{ marginTop: 18, fontFamily: th.chiffre, fontSize: 44, fontWeight: 600, color: th.accent, opacity: p(40, 52) }}>
          westbourse.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
