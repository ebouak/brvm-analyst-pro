import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/pwaIcon';

// apple-touch-icon (iOS « Ajouter à l'écran d'accueil ») — 180×180 PNG.
// Next l'expose automatiquement en <link rel="apple-touch-icon">.
export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={180} />, { ...size });
}
