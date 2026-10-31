/**
 * LinkedIn et TikTok pour la vidéo de séance : jetons, verrou, envoi LinkedIn.
 *
 * DUPLICATION ASSUMÉE de scraper/src/social/ (jetons.ts, verrou.ts,
 * texte.ts) : deux paquets distincts, comme scraper/src/hebdo/pure/. Toute
 * correction est à reporter des deux côtés.
 *
 * Les jetons vivent dans `social_tokens` (migration 0170), connectés depuis
 * /admin/reseaux — source UNIQUE, parce que TikTok fait tourner son jeton de
 * rafraîchissement : un secret GitHub et la table divergeraient. Le verrou
 * `publications_sociales` (cible 'video', id = date de séance) empêche une
 * relance manuelle du workflow de publier deux fois la même séance.
 */
import { entetesSupabase } from './supabaseEntetes.mjs';

const MARGE_MS = 5 * 60_000;
const valide = (expire) => !expire || new Date(expire).getTime() > Date.now() + MARGE_MS;

export function creerReseaux({ urlSupabase, service }) {
  const rest = `${urlSupabase}/rest/v1`;
  const h = (extra = {}) => ({ ...entetesSupabase(service), 'Content-Type': 'application/json', ...extra });

  const lire = async (reseau) => {
    const r = await fetch(`${rest}/social_tokens?reseau=eq.${reseau}&select=reseau,access_token,refresh_token,expire_le,compte_id,actif,scopes`, { headers: h() });
    if (r.status === 404) return 'table_absente';
    if (!r.ok) {
      const t = await r.text();
      return /PGRST205|42P01/.test(t) ? 'table_absente' : null;
    }
    const lignes = await r.json();
    return lignes[0] ?? null;
  };

  const rafraichirTikTok = async (l) => {
    const cle = process.env.TIKTOK_CLIENT_KEY?.trim();
    const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
    if (!cle || !secret) return { ok: false, raison: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET absents du job', alerter: true };
    if (!l.refresh_token) return { ok: false, raison: 'aucun jeton de rafraîchissement, reconnectez TikTok', alerter: true };
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: cle, client_secret: secret, grant_type: 'refresh_token', refresh_token: l.refresh_token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || typeof j.access_token !== 'string') {
      return { ok: false, raison: `rafraîchissement TikTok refusé (HTTP ${r.status} ${String(j.error_description ?? j.error ?? '').slice(0, 160)})`, alerter: true };
    }
    const dans = (s) => (typeof s === 'number' ? new Date(Date.now() + s * 1000).toISOString() : null);
    // Verrou optimiste : n'écrit que si personne n'a tourné le jeton entre-temps.
    const maj = await fetch(`${rest}/social_tokens?reseau=eq.tiktok&refresh_token=eq.${encodeURIComponent(l.refresh_token)}`, {
      method: 'PATCH',
      headers: h({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        access_token: j.access_token,
        refresh_token: typeof j.refresh_token === 'string' ? j.refresh_token : l.refresh_token,
        expire_le: dans(j.expires_in),
        refresh_expire_le: dans(j.refresh_expires_in),
        maj_le: new Date().toISOString(),
      }),
    });
    const lignes = maj.ok ? await maj.json() : [];
    if (lignes.length > 0) return { ok: true, token: j.access_token, compteId: l.compte_id, scopes: l.scopes };
    const relue = await lire('tiktok');
    if (relue && relue !== 'table_absente' && valide(relue.expire_le)) return { ok: true, token: relue.access_token, compteId: relue.compte_id, scopes: relue.scopes };
    return { ok: false, raison: 'jeton TikTok tourné par un autre worker et illisible', alerter: true };
  };

  /** { ok, token, compteId } | { ok:false, raison, alerter } | { ok:false, table:false } */
  const jeton = async (reseau) => {
    const l = await lire(reseau);
    if (l === 'table_absente') return { ok: false, table: false, raison: 'migration 0170 non appliquée', alerter: false };
    if (!l) return { ok: false, raison: 'compte non connecté', alerter: false };
    if (!l.actif) return { ok: false, raison: 'publication coupée par l’exploitant', alerter: false };
    if (valide(l.expire_le)) return { ok: true, token: l.access_token, compteId: l.compte_id, scopes: l.scopes };
    if (reseau === 'linkedin') return { ok: false, raison: 'jeton LinkedIn expiré, reconnectez LinkedIn depuis /admin/reseaux', alerter: true };
    return rafraichirTikTok(l);
  };

  const prendreVerrou = async (seance, reseau) => {
    const maintenant = new Date().toISOString();
    const r = await fetch(`${rest}/publications_sociales`, {
      method: 'POST',
      headers: h({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ cible: 'video', cible_id: seance, reseau, statut: 'en_cours', lance_le: maintenant }),
    });
    if (r.ok) return true;
    if (r.status !== 409) throw new Error(`verrou ${reseau} : HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    // Déjà une ligne : seul un échec se reprend.
    const rel = await fetch(`${rest}/publications_sociales?cible=eq.video&cible_id=eq.${seance}&reseau=eq.${reseau}&statut=eq.echec`, {
      method: 'PATCH',
      headers: h({ Prefer: 'return=representation' }),
      body: JSON.stringify({ statut: 'en_cours', erreur: null, post_id: null, lance_le: maintenant, termine_le: null }),
    });
    return rel.ok && (await rel.json()).length > 0;
  };

  const terminer = async (seance, reseau, { statut, postId = null, erreur = null }) => {
    await fetch(`${rest}/publications_sociales?cible=eq.video&cible_id=eq.${seance}&reseau=eq.${reseau}`, {
      method: 'PATCH',
      headers: h({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ statut, post_id: postId, erreur: erreur ? String(erreur).slice(0, 300) : null, termine_le: new Date().toISOString() }),
    });
  };

  return { jeton, prendreVerrou, terminer };
}

/* -------------------------------------------------------------- TikTok */

/** Le compte a-t-il accordé la publication directe ? */
export const peutPublierDirect = (scopes) => String(scopes ?? '').split(/[,\s]+/).includes('video.publish');

/**
 * Visibilité à demander : la plus ouverte que TikTok propose pour ce compte
 * (`creator_info`). Une application NON AUDITÉE ne peut publier qu'en privé ;
 * TikTok le dit par une erreur `unaudited_client…`, d'où le repli SELF_ONLY.
 */
export function choisirVisibilite(options) {
  const o = Array.isArray(options) ? options : [];
  if (o.includes('PUBLIC_TO_EVERYONE')) return 'PUBLIC_TO_EVERYONE';
  if (o.includes('SELF_ONLY')) return 'SELF_ONLY';
  return o[0] ?? 'SELF_ONLY';
}

/**
 * Publie la vidéo : directement si `direct` (portée video.publish), sinon en
 * brouillon dans la boîte de réception. Renvoie { publishId, mode } où mode
 * vaut 'public' | 'prive' | 'brouillon'.
 */
export async function publierVideoTikTok({ token, octets, legende, direct }) {
  const tt = async (chemin, corps) => {
    const r = await fetch(`https://open.tiktokapis.com/v2${chemin}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(corps ?? {}),
    });
    const rep = await r.json().catch(() => ({}));
    if (!r.ok || (rep.error?.code && rep.error.code !== 'ok')) {
      throw new Error(`${chemin} → ${r.status} ${rep.error?.code ?? ''} ${rep.error?.message ?? ''}`.trim());
    }
    return rep.data ?? {};
  };
  const taille = octets.length;
  const source_info = { source: 'FILE_UPLOAD', video_size: taille, chunk_size: taille, total_chunk_count: 1 };

  let init;
  let mode = 'brouillon';
  if (direct) {
    const info = await tt('/post/publish/creator_info/query/');
    let vis = choisirVisibilite(info.privacy_level_options);
    const essayer = (v) =>
      tt('/post/publish/video/init/', {
        post_info: { title: legende.slice(0, 2200), privacy_level: v, disable_comment: false, disable_duet: false, disable_stitch: false },
        source_info,
      });
    try {
      init = await essayer(vis);
    } catch (e) {
      if (vis === 'SELF_ONLY' || !/unaudited/i.test(e.message)) throw e;
      vis = 'SELF_ONLY';
      init = await essayer(vis);
    }
    mode = vis === 'SELF_ONLY' ? 'prive' : 'public';
  } else {
    init = await tt('/post/publish/inbox/video/init/', { source_info });
  }

  const up = await fetch(init.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${taille - 1}/${taille}` },
    body: octets,
  });
  if (!up.ok) throw new Error(`téléversement → ${up.status} ${(await up.text()).slice(0, 200)}`);
  return { publishId: init.publish_id, mode };
}

/* ------------------------------------------------------------ LinkedIn */

const VERSION = process.env.LINKEDIN_VERSION?.trim() || '202609';
const API = 'https://api.linkedin.com/rest';
const li = (token) => ({ Authorization: `Bearer ${token}`, 'Linkedin-Version': VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' });

/** « little text format » : caractères réservés à échapper (cf. scraper/src/social/texte.ts). */
export const echapperLinkedIn = (s) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);

/** Légende de la vidéo → commentaire LinkedIn : texte échappé, `#Mot` en vrais hashtags. */
export function commentaireLinkedIn(legende) {
  const lignes = legende.split('\n');
  const tags = lignes.filter((l) => /^#\w/.test(l.trim())).join(' ').match(/#\w+/g) ?? [];
  const corps = lignes.filter((l) => !/^#\w/.test(l.trim())).join('\n');
  return `${echapperLinkedIn(corps)}\n\n${tags.map((t) => `{hashtag|\\#|${t.slice(1)}}`).join(' ')}`.slice(0, 3000);
}

const erreurLi = async (etape, r) => {
  const j = await r.json().catch(() => ({}));
  if (r.status === 426) return new Error(`${etape} : version d'API ${VERSION} retirée par LinkedIn (426), monter LINKEDIN_VERSION`);
  if (r.status === 401) return new Error(`${etape} : jeton refusé (401), reconnectez LinkedIn`);
  return new Error(`${etape} : HTTP ${r.status}${j.message ? ` — ${String(j.message).slice(0, 160)}` : ''}`);
};

/** Téléverse la vidéo (Videos API, par morceaux) puis publie ; renvoie l'URN du post. */
export async function publierVideoLinkedIn({ token, auteur, octets, commentaire, titre }) {
  const init = await fetch(`${API}/videos?action=initializeUpload`, {
    method: 'POST',
    headers: li(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: auteur, fileSizeBytes: octets.length, uploadCaptions: false, uploadThumbnail: false } }),
  });
  if (!init.ok) throw await erreurLi('initialisation vidéo', init);
  const { value } = await init.json();
  const parts = [];
  for (const ins of value.uploadInstructions) {
    const put = await fetch(ins.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: octets.subarray(ins.firstByte, ins.lastByte + 1),
    });
    if (!put.ok) throw await erreurLi('téléversement vidéo', put);
    const etag = put.headers.get('etag');
    if (!etag) throw new Error('téléversement vidéo : ETag absent de la réponse');
    parts.push(etag);
  }
  const fin = await fetch(`${API}/videos?action=finalizeUpload`, {
    method: 'POST',
    headers: li(token),
    body: JSON.stringify({ finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken ?? '', uploadedPartIds: parts } }),
  });
  if (!fin.ok) throw await erreurLi('finalisation vidéo', fin);
  const post = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: li(token),
    body: JSON.stringify({
      author: auteur,
      commentary: commentaire,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: value.video, title: titre } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!post.ok) throw await erreurLi('création du post', post);
  return post.headers.get('x-restli-id') ?? 'publie';
}
