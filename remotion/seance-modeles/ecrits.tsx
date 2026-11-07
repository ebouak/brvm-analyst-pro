import React from 'react';
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE } from './theme';

/**
 * Effets d'écriture et bruitages du modèle verre (verticale et version 16:9).
 *
 * RÈGLE INCHANGÉE : AUCUN CHIFFRE NE DÉFILE. `Chiffre` dévoile les caractères
 * de la valeur FINALE, un à un, par un masque : jamais une valeur
 * intermédiaire que la séance n'a pas eue. Les effets ne touchent qu'à la
 * forme ; le texte affiché est toujours celui qu'on leur passe.
 *
 * Les bruitages (public/sfx, synthétisés par sfx-genere.py) passent SOUS la
 * voix : volumes bas, aucun pendant une phrase importante qui le masquerait.
 */

const p = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

export type NomSfx = 'souffle' | 'fleche' | 'verre' | 'tic' | 'impact' | 'scintille' | 'montee' | 'carillon';
const DUREES: Record<NomSfx, number> = { souffle: 27, fleche: 17, verre: 15, tic: 3, impact: 18, scintille: 21, montee: 42, carillon: 54 };

/** Un bruitage, posé à l'image `a` de la séquence courante. */
export function Sfx({ nom, a, volume = 0.25 }: { nom: NomSfx; a: number; volume?: number }) {
  return (
    <Sequence from={Math.max(0, Math.round(a))} durationInFrames={DUREES[nom] + 2} layout="none">
      <Audio src={staticFile(`sfx/${nom}.wav`)} volume={volume} />
    </Sequence>
  );
}

/** Machine à écrire, pour les étiquettes : lettres une à une, curseur qui clignote. */
export function Frappe({ texte, debut, vitesse = 1.6, style }: { texte: string; debut: number; vitesse?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min(texte.length, Math.floor((f - debut) * vitesse)));
  const fini = n >= texte.length;
  const curseur = f >= debut && (!fini || (f - debut - texte.length / vitesse) < 24) && Math.floor(f / 8) % 2 === 0;
  return (
    <span style={{ ...style, whiteSpace: 'pre' }}>
      {texte.slice(0, n)}
      <span style={{ opacity: curseur ? 1 : 0, marginLeft: 2 }}>▍</span>
    </span>
  );
}

/** Mots qui montent un à un depuis un flou, pour les titres et phrases. */
export function Mots({ texte, debut, ecart = 3, style }: { texte: string; debut: number; ecart?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const mots = texte.split(' ');
  return (
    <span style={style}>
      {mots.map((m, i) => {
        const q = p(f, debut + i * ecart, debut + i * ecart + 16);
        return (
          <React.Fragment key={i}>
            <span style={{ display: 'inline-block', opacity: q, transform: `translateY(${(1 - q) * 0.45}em)`, filter: q < 1 ? `blur(${(1 - q) * 10}px)` : undefined }}>{m}</span>
            {i < mots.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </span>
  );
}

/**
 * Grand nombre : chaque caractère de la valeur finale sort de sous une ligne
 * de masque, puis un reflet balaie le nombre. Le reflet est une couche
 * superposée sans transformation (un texte découpé par son fond ne supporte
 * pas les caractères déplacés).
 */
export function Chiffre({ texte, debut, couleur, style, reflet = true }: { texte: string; debut: number; couleur: string; style?: React.CSSProperties; reflet?: boolean }) {
  const f = useCurrentFrame();
  const car = [...texte];
  const balaye = p(f, debut + car.length * 1.5 + 12, debut + car.length * 1.5 + 36);
  return (
    <span style={{ position: 'relative', display: 'inline-block', color: couleur, whiteSpace: 'nowrap', ...style }}>
      {car.map((c, i) => {
        const q = p(f, debut + i * 1.5, debut + i * 1.5 + 14);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', lineHeight: 'inherit' }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - q) * 105}%)`, whiteSpace: 'pre' }}>{c}</span>
          </span>
        );
      })}
      {reflet && balaye > 0 && balaye < 1 && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0, whiteSpace: 'nowrap', color: 'transparent', pointerEvents: 'none',
          backgroundImage: 'linear-gradient(100deg, transparent 35%, rgba(255,255,255,.95) 50%, transparent 65%)',
          backgroundSize: '300% 100%', backgroundPosition: `${100 - balaye * 100}% 0`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
        }}>{texte}</span>
      )}
    </span>
  );
}
