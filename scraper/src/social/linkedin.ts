/**
 * Publication LinkedIn sur le profil de l'exploitant (Posts API versionnée,
 * portée `w_member_social`). Image facultative : téléversée par l'Images API,
 * puis citée par son URN dans le post.
 *
 * `Linkedin-Version` est figée : LinkedIn retire chaque version après environ
 * un an et répond alors 426. Ce code d'erreur est signalé tel quel pour que
 * l'alerte dise quoi faire (monter LINKEDIN_VERSION), pas seulement « échec ».
 */
const VERSION = process.env.LINKEDIN_VERSION?.trim() || '202609';
const API = 'https://api.linkedin.com/rest';

const entetes = (token: string, json = true): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'Linkedin-Version': VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

async function erreur(etape: string, r: Response): Promise<Error> {
  const j = (await r.json().catch(() => ({}))) as { message?: string };
  if (r.status === 426) return new Error(`${etape} : version d'API ${VERSION} retirée par LinkedIn (426), monter LINKEDIN_VERSION`);
  if (r.status === 401) return new Error(`${etape} : jeton refusé (401), reconnectez LinkedIn`);
  return new Error(`${etape} : HTTP ${r.status}${j.message ? ` — ${j.message.slice(0, 160)}` : ''}`);
}

async function televerserImage(token: string, auteur: string, image: Buffer): Promise<string> {
  const init = await fetch(`${API}/images?action=initializeUpload`, {
    method: 'POST',
    headers: entetes(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: auteur } }),
  });
  if (!init.ok) throw await erreur('initialisation image', init);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const put = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: new Uint8Array(image) });
  if (!put.ok) throw await erreur('téléversement image', put);
  return value.image;
}

/** Publie et renvoie l'URN du post (en-tête `x-restli-id`). */
export async function publierLinkedIn(o: { token: string; auteur: string; texte: string; image?: Buffer | null; titreImage?: string }): Promise<string> {
  const media = o.image ? await televerserImage(o.token, o.auteur, o.image) : null;
  const r = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: entetes(o.token),
    body: JSON.stringify({
      author: o.auteur,
      commentary: o.texte,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(media ? { content: { media: { id: media, ...(o.titreImage ? { altText: o.titreImage.slice(0, 120) } : {}) } } } : {}),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!r.ok) throw await erreur('création du post', r);
  return r.headers.get('x-restli-id') ?? 'publie';
}
