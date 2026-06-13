import { Composition } from 'remotion';
import Main from './landing-video';

// 16 s × 30 fps = 480 frames (intro 75 + 4 écrans × 83 + outro 72 = 479 ≤ 480)
export function RemotionRoot() {
  return (
    <Composition
      id="landing"
      component={Main}
      durationInFrames={480}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
