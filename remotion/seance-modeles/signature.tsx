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
