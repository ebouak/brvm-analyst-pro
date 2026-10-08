import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig, type CalculateMetadataFunction } from 'remotion';
import './polices';
import { FPS, THEMES } from './seance-modeles/theme';
import { EnTete, Fond, Progression, type Fiche } from './seance-modeles/elements';
import { SCENES } from './seance-modeles/scenes';

/**
 * Vidéo de séance, version animée — 1080×1920, 30 i/s.
 *
 * UNE SEULE LECTURE. Aucune donnée n'est lue ici : tout vient de
 * public/seance/seance.json, écrit par video/genere.mjs en même temps que la
 * voix (voix.mp3) et à partir des mêmes variables. Un chiffre change partout
 * à la fois, ou nulle part (voir video/README.md).
 *
 * TROIS MODÈLES, choisis par video/recit.mjs (jamais le même deux séances de
 * suite) : nuit, papier, mosaïque — voir seance-modeles/theme.ts.
 *
 * LE PLAN DICTE LE MONTAGE. Chaque temps du récit porte son début et sa durée,
 * MESURÉS sur sa propre piste de voix : une scène reste à l'écran exactement
 * le temps qu'on en parle. Pas de sous-titres (décision de 2026-09-03), mais
 * l'accroche du jour est écrite en grand à l'ouverture — la plupart des vues
 * démarrent sans le son.
 */

const QUEUE = 45; // la carte finale reste 1,5 s après la dernière phrase

export const calculerSeance: CalculateMetadataFunction<{ fiche: Fiche | null }> = async () => {
  const r = await fetch(staticFile('seance/seance.json'));
  const fiche = (await r.json()) as Fiche;
  return { durationInFrames: Math.ceil(fiche.duree_s * FPS) + QUEUE, props: { fiche } };
};

export default function Seance({ fiche }: { fiche: Fiche | null }) {
  const { durationInFrames } = useVideoConfig();
  if (!fiche) return <AbsoluteFill style={{ background: '#030303' }} />;
  const th = THEMES[fiche.video.modele] ?? THEMES.nuit;
  const plan = fiche.video.plan.map((p, i, tous) => {
    const d0 = Math.round(p.debut_s * FPS);
    const fin = i === tous.length - 1 ? durationInFrames : Math.round(tous[i + 1].debut_s * FPS);
    return { type: p.type, d0, duree: fin - d0 };
  });
  return (
    <AbsoluteFill style={{ background: th.fond }}>
      <Fond th={th} />
      <Audio src={staticFile('seance/voix.mp3')} />
      {plan.map(({ type, d0, duree }, i) => {
        const Comp = SCENES[type];
        if (!Comp) return null;
        return (
          <Sequence key={i} from={d0} durationInFrames={duree}>
            <Comp th={th} fiche={fiche} duree={duree} />
          </Sequence>
        );
      })}
      <EnTete th={th} fiche={fiche} />
      <Progression th={th} plan={plan} total={durationInFrames} />
    </AbsoluteFill>
  );
}
