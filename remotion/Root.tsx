import { Composition } from 'remotion';
import Main from './landing-video';
import FilConducteurVideo, { TOTAL as FIL_TOTAL } from './fil-conducteur';

// 16 s × 30 fps = 480 frames (intro 75 + 4 écrans × 83 + outro 72 = 479 ≤ 480)
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="landing"
        component={Main}
        durationInFrames={480}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* Carré 1080 : le seul format qui passe sur Telegram, LinkedIn et
          Instagram sans recadrage. La durée est DÉRIVÉE du découpage
          (intro + 7 scènes + sortie) et non saisie ici — une constante en
          double finirait par mentir d'une scène. */}
      <Composition
        id="fil-conducteur"
        component={FilConducteurVideo}
        durationInFrames={FIL_TOTAL}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
}
