/**
 * Durcissement de la diffusion des vidéos de la WestBourse Academy :
 *  - durée courte des URL signées Supabase Storage ;
 *  - vérification des en-têtes Fetch Metadata / Referer pour bloquer le téléchargement
 *    direct par URL et le hotlinking externe, sans bloquer Safari/iOS natif ;
 *  - libellé de filigrane traçable sans exposer l'email de l'apprenant.
 */

export const DUREE_URL_VIDEO_SECONDES = 15 * 60;
export const DUREE_URL_AFFICHE_SECONDES = 5 * 60;

export function dureeUrlSignee(fichier: string): number {
  return fichier.endsWith('.jpg') ? DUREE_URL_AFFICHE_SECONDES : DUREE_URL_VIDEO_SECONDES;
}

export type VerificationRequeteVideo = { ok: true } | { ok: false; raison: string };

/**
 * Vérifie qu'une requête vers `/api/academy/video/...` provient bien d'un lecteur
 * embarqué (`<video>` / `<img>`) sur le même site, et non d'un accès direct dans
 * un onglet (`Sec-Fetch-Dest: document`), d'un script (`fetch`), d'un `iframe`
 * ou d'un site tiers.
 */
export function verifierRequeteVideo(headers: Headers, fichier: string): VerificationRequeteVideo {
  const fetchSite = headers.get('sec-fetch-site')?.trim().toLowerCase() ?? '';
  if (fetchSite === 'cross-site') {
    return { ok: false, raison: 'cross-site' };
  }

  const fetchDest = headers.get('sec-fetch-dest')?.trim().toLowerCase() ?? '';
  if (fetchDest) {
    if (fichier.endsWith('.mp4')) {
      if (fetchDest !== 'video' && fetchDest !== 'audio') {
        return { ok: false, raison: 'dest' };
      }
    } else if (fichier.endsWith('.jpg')) {
      if (fetchDest !== 'image') {
        return { ok: false, raison: 'dest' };
      }
    }
  }

  const referer = headers.get('referer')?.trim() ?? '';
  if (referer) {
    let refererHost = '';
    try {
      refererHost = new URL(referer).host.toLowerCase();
    } catch {
      return { ok: false, raison: 'referer' };
    }
    const rawHost = headers.get('x-forwarded-host') ?? headers.get('host') ?? '';
    const expectedHost = rawHost.split(',')[0]?.trim().toLowerCase() ?? '';
    if (expectedHost && refererHost !== expectedHost) {
      return { ok: false, raison: 'referer' };
    }
  }

  return { ok: true };
}

/** Filigrane discret anti-redistribution sans fuite d'email en cas de capture d'écran. */
export function filigraneUtilisateur(userId: string | null | undefined): string {
  const id = userId?.trim();
  if (!id) return 'WESTBOURSE Academy';
  return `WESTBOURSE · ${id.slice(0, 8)}`;
}
