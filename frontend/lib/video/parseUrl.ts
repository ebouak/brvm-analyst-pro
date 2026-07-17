/**
 * Déduit (provider, identifiant) à partir d'un lien vidéo collé par l'admin.
 * Accepte les URL YouTube/Vimeo courantes, une URL MP4 directe, ou un ID brut.
 * Pur et testable — aucune I/O.
 */

export interface ParsedVideo {
  provider: 'youtube' | 'vimeo' | 'mp4';
  /** ID (youtube/vimeo) ou URL complète (mp4). */
  video_url: string;
}

export function parseVideoUrl(input: string): ParsedVideo | null {
  const s = (input ?? '').trim();
  if (!s) return null;

  // YouTube : watch?v=, youtu.be/, embed/, shorts/
  const yt = s.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (yt) return { provider: 'youtube', video_url: yt[1]! };

  // Vimeo : vimeo.com/123456789 ou player.vimeo.com/video/123456789
  const vi = s.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vi) return { provider: 'vimeo', video_url: vi[1]! };

  // URL MP4 directe (Supabase Storage, Mux, etc.)
  if (/^https?:\/\/.+\.mp4(\?.*)?$/i.test(s)) return { provider: 'mp4', video_url: s };

  // ID YouTube brut (11 caractères base64url)
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { provider: 'youtube', video_url: s };

  // ID Vimeo brut
  if (/^\d{6,}$/.test(s)) return { provider: 'vimeo', video_url: s };

  // Autre URL http → on suppose un flux lisible en <video> (mp4).
  if (/^https?:\/\//i.test(s)) return { provider: 'mp4', video_url: s };

  return null;
}
