/**
 * Règles de publication directe TikTok — fonctions PURES, partagées par
 * l'écran /admin/reseaux/tiktok et l'action serveur qui publie.
 *
 * Source : TikTok « Content Sharing Guidelines » (exigences d'audit de la
 * publication directe), vérifiée le 2026-10-31 :
 *  1. afficher le compte (creator_info) ; vérifier la durée maximale vidéo ;
 *  2. titre modifiable ; visibilité choisie dans privacy_level_options SANS
 *     valeur par défaut ; commentaires / duo / collage DÉCOCHÉS par défaut,
 *     grisés si le compte les a désactivés ; photo = commentaires seulement ;
 *  3. déclaration commerciale désactivée par défaut, « Your brand » /
 *     « Branded content », libellés imposés, contenu de marque jamais privé ;
 *  4. déclaration de consentement avant le bouton ;
 *  5. prévenir que le traitement prend quelques minutes, suivre le statut.
 * Les libellés imposés par TikTok sont gardés en anglais, à l'identique :
 * c'est ce que l'audit contrôle.
 */
export type TypeContenu = 'video' | 'photo';

export interface CreatorInfo {
  creator_nickname: string | null;
  creator_username: string | null;
  creator_avatar_url: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number | null;
}

export interface ChoixPublication {
  titre: string;
  description: string;
  visibilite: string | null;
  commentaires: boolean;
  duo: boolean;
  collage: boolean;
  commercial: boolean;
  votreMarque: boolean;
  contenuDeMarque: boolean;
}

export const LIBELLE_VISIBILITE: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Tout le monde',
  MUTUAL_FOLLOW_FRIENDS: 'Amis',
  FOLLOWER_OF_CREATOR: 'Abonnés',
  SELF_ONLY: 'Moi uniquement',
};

export const URL_MUSIC_USAGE = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
export const URL_BRANDED_CONTENT = 'https://www.tiktok.com/legal/page/global/bc-policy/en';

export const MESSAGE_SANS_OPTION = 'You need to indicate if your content promotes yourself, a third party, or both.';
export const MESSAGE_MARQUE_PRIVEE = 'Branded content visibility cannot be set to private.';

/** Le choix initial imposé : rien de coché, aucune visibilité. */
export function choixInitial(titre: string, description = ''): ChoixPublication {
  return { titre, description, visibilite: null, commentaires: false, duo: false, collage: false, commercial: false, votreMarque: false, contenuDeMarque: false };
}

/** Libellé affiché selon la déclaration commerciale (règle 3), ou null. */
export function etiquetteCommerciale(c: ChoixPublication, type: TypeContenu): string | null {
  if (!c.commercial) return null;
  const quoi = type === 'video' ? 'video' : 'photo';
  if (c.contenuDeMarque) return `Your ${quoi} will be labeled as 'Paid partnership'`;
  if (c.votreMarque) return `Your ${quoi} will be labeled as 'Promotional content'`;
  return null;
}

/** Déclaration de consentement placée avant le bouton (règle 4). */
export function declaration(c: ChoixPublication): { texte: string; liens: { libelle: string; url: string }[] } {
  if (c.commercial && c.contenuDeMarque) {
    return {
      texte: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.",
      liens: [
        { libelle: 'Branded Content Policy', url: URL_BRANDED_CONTENT },
        { libelle: 'Music Usage Confirmation', url: URL_MUSIC_USAGE },
      ],
    };
  }
  return { texte: "By posting, you agree to TikTok's Music Usage Confirmation.", liens: [{ libelle: 'Music Usage Confirmation', url: URL_MUSIC_USAGE }] };
}

/** Le choix peut-il partir ? La raison est affichée telle quelle sous le bouton. */
export function validerChoix(c: ChoixPublication, info: CreatorInfo, type: TypeContenu, dureeS: number | null): { ok: true } | { ok: false; raison: string } {
  if (!c.visibilite) return { ok: false, raison: 'Choisissez qui peut voir la publication.' };
  if (!info.privacy_level_options.includes(c.visibilite)) return { ok: false, raison: 'Cette visibilité n’est pas proposée par TikTok pour ce compte.' };
  if (c.commercial && !c.votreMarque && !c.contenuDeMarque) return { ok: false, raison: MESSAGE_SANS_OPTION };
  if (c.commercial && c.contenuDeMarque && c.visibilite === 'SELF_ONLY') return { ok: false, raison: MESSAGE_MARQUE_PRIVEE };
  if (c.commentaires && info.comment_disabled) return { ok: false, raison: 'Les commentaires sont désactivés dans les réglages du compte TikTok.' };
  if (type === 'video' && c.duo && info.duet_disabled) return { ok: false, raison: 'Les duos sont désactivés dans les réglages du compte TikTok.' };
  if (type === 'video' && c.collage && info.stitch_disabled) return { ok: false, raison: 'Les collages sont désactivés dans les réglages du compte TikTok.' };
  if (type === 'video' && dureeS != null && info.max_video_post_duration_sec != null && dureeS > info.max_video_post_duration_sec) {
    return { ok: false, raison: `La vidéo dure ${Math.round(dureeS)} s, au-delà des ${info.max_video_post_duration_sec} s autorisées pour ce compte.` };
  }
  if (type === 'video' && c.titre.length > 2200) return { ok: false, raison: 'Le titre dépasse 2 200 caractères.' };
  if (type === 'photo' && c.titre.length > 90) return { ok: false, raison: 'Le titre d’une photo est limité à 90 caractères.' };
  if (type === 'photo' && c.description.length > 4000) return { ok: false, raison: 'La description dépasse 4 000 caractères.' };
  return { ok: true };
}

/** Corps `post_info` de l'API Direct Post, construit UNIQUEMENT à partir du choix validé. */
export function postInfo(c: ChoixPublication, type: TypeContenu): Record<string, unknown> {
  const commun = {
    title: c.titre,
    privacy_level: c.visibilite,
    disable_comment: !c.commentaires,
    brand_content_toggle: c.commercial && c.contenuDeMarque,
    brand_organic_toggle: c.commercial && c.votreMarque,
  };
  return type === 'video'
    ? { ...commun, disable_duet: !c.duo, disable_stitch: !c.collage }
    : { ...commun, description: c.description, auto_add_music: true };
}
