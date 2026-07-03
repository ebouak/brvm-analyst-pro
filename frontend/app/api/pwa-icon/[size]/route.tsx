import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/pwaIcon';

// Icônes PNG du manifest PWA (192 / 512), pour l'installation Android/Chrome
// et l'écran de démarrage (splash). GET /api/pwa-icon/192 ou /512.
export const runtime = 'edge';

const ALLOWED = new Set([192, 512]);

export function GET(_req: Request, { params }: { params: { size: string } }) {
  const n = Number(params.size);
  const size = ALLOWED.has(n) ? n : 512;
  return new ImageResponse(<BrandIcon size={size} />, { width: size, height: size });
}
