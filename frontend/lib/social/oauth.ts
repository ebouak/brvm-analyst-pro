/**
 * Connexion OAuth des comptes de publication (LinkedIn, TikTok) — partie PURE.
 *
 * LinkedIn : profil personnel de l'exploitant, produit self-serve « Share on
 * LinkedIn ». Jeton de 60 jours, SANS jeton de rafraîchissement (réservé aux
 * partenaires) : il faut se reconnecter tous les deux mois, d'où l'alerte
 * quotidienne de `sante:reseaux` à partir de J-10.
 * TikTok : Content Posting API en mode brouillon (`video.upload`). Le jeton
 * d'accès dure 24 h, le jeton de rafraîchissement ~1 an et TOURNE à chaque
 * échange — il vit donc dans `social_tokens`, pas dans un secret figé.
 */
export type Reseau = 'linkedin' | 'tiktok';

export const RESEAUX: Reseau[] = ['linkedin', 'tiktok'];
export const LIBELLE_RESEAU: Record<Reseau, string> = { linkedin: 'LinkedIn', tiktok: 'TikTok' };

export const SCOPES: Record<Reseau, string> = {
  linkedin: 'openid profile w_member_social',
  // video.publish : publication directe. Tant que l'application n'est pas
  // auditée par TikTok, elle est forcée en privé (SELF_ONLY) — cf. creator_info.
  tiktok: 'user.info.basic,video.upload,video.publish',
};

/** Variables d'environnement (Vercel) des applications développeur. */
export const ENV_CLIENT: Record<Reseau, { id: string; secret: string }> = {
  linkedin: { id: 'LINKEDIN_CLIENT_ID', secret: 'LINKEDIN_CLIENT_SECRET' },
  tiktok: { id: 'TIKTOK_CLIENT_KEY', secret: 'TIKTOK_CLIENT_SECRET' },
};

export function estReseau(x: string): x is Reseau {
  return (RESEAUX as string[]).includes(x);
}

/** À déclarer À L'IDENTIQUE dans chaque application développeur. */
export function cheminRetour(r: Reseau): string {
  return `/api/admin/reseaux/${r}/retour`;
}

export function urlAutorisation(r: Reseau, o: { clientId: string; redirectUri: string; state: string }): string {
  if (r === 'linkedin') {
    const q = new URLSearchParams({ response_type: 'code', client_id: o.clientId, redirect_uri: o.redirectUri, state: o.state, scope: SCOPES.linkedin });
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  }
  const q = new URLSearchParams({ client_key: o.clientId, response_type: 'code', redirect_uri: o.redirectUri, state: o.state, scope: SCOPES.tiktok });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

/** Jours entiers restant avant `expire`, négatifs une fois passé. */
export function joursRestants(expire: string | null, maintenant: Date): number | null {
  if (!expire) return null;
  const t = new Date(expire).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - maintenant.getTime()) / 86_400_000);
}
