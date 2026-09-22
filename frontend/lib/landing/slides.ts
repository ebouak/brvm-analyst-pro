/**
 * Diapositives du hero « À la une » — types et composition PURE, testée.
 *
 * Deux origines :
 *  · PERMANENTES — vues produit, définies ici, jamais en base ;
 *  · ADMIN — table `landing_slides` (migration 0134) : publicités d'annonceurs
 *    (`ad`) et annonces maison (`house`), programmées depuis /admin/landing.
 *
 * Garanties de `composeSlides` :
 *  · au plus MAX_SLIDES vues ;
 *  · au moins MIN_PERMANENT vues permanentes, quoi qu'un admin programme —
 *    la landing ne devient pas un panneau publicitaire ;
 *  · une vue admin sans image ou hors fenêtre est écartée, jamais rendue vide ;
 *  · une vue `ad` porte toujours la mention « Publicité » (dérivée du kind,
 *    pas d'un drapeau désactivable).
 */

/**
 * Plafond du carrousel. Volontairement BAS : Nielsen Norman Group recommande
 * cinq vues au plus, et la mesure de référence (Erik Runyon, Notre Dame) donne
 * 1,07 % de clics sur un carrousel, dont 84 % sur la PREMIÈRE vue. Au-delà,
 * une diapositive n'est vue par presque personne — la vendre à un annonceur
 * serait vendre du vide. Les annonces vivent dans les bandeaux (placement
 * 'billboard'), où toutes les créations actives tournent à poids égal.
 */
export const MAX_SLIDES = 5;
export const MIN_PERMANENT = 3;

export type SlideKind = 'permanent' | 'house' | 'ad';
export type Placement = 'hero' | 'billboard';

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  subtitle?: string | null;
  ctaLabel?: string | null;
  linkUrl?: string | null;
  /** URL absolue ou chemin /public de l'image de fond ; null = vue produit dessinée (permanente). */
  imageUrl: string | null;
  sponsorName?: string | null;
  /** Vue permanente : identifiant du rendu dessiné (voir HeroCarousel). */
  render?: 'photo' | 'sgi' | 'note' | 'brief' | 'dossiers';
}

/** Ligne de `landing_slides` telle que lue par la clé anon (policy : actives dans leur fenêtre). */
export interface LandingSlideRow {
  id: string;
  kind: 'ad' | 'house';
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  link_url: string | null;
  image_path: string;
  sponsor_name: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  position: number;
  /** 'hero' = diapositive du carrousel ; 'billboard' = bandeau (migration 0135). */
  placement?: Placement | null;
}

/** Vues permanentes. `imageUrl` de la photo : fichier /public, provisoire (image générée). */
export const PERMANENT_SLIDES: readonly Slide[] = [
  { id: 'p-photo', kind: 'permanent', title: 'Mieux informé, plus serein.', imageUrl: '/landing/portrait-provisoire.jpg', render: 'photo' },
  { id: 'p-sgi', kind: 'permanent', title: 'Trouvez la SGI faite pour votre profil', imageUrl: null, render: 'sgi' },
  { id: 'p-note', kind: 'permanent', title: 'Une note de A à F par action', imageUrl: null, render: 'note' },
  { id: 'p-brief', kind: 'permanent', title: 'Le brief du soir', imageUrl: null, render: 'brief' },
  { id: 'p-dossiers', kind: 'permanent', title: 'Dossiers PDF hebdomadaires', imageUrl: null, render: 'dossiers' },
];

export function publicImageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/landing-slides/${path.replace(/^\//, '')}`;
}

/** Vrai si la ligne est affichable maintenant (défense en profondeur : la RLS filtre déjà). */
export function estAffichable(r: LandingSlideRow, now: Date): boolean {
  if (!r.is_active || !r.image_path) return false;
  if (new Date(r.starts_at) > now) return false;
  if (r.ends_at && new Date(r.ends_at) <= now) return false;
  return true;
}

export function rowToSlide(r: LandingSlideRow, supabaseUrl: string): Slide {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle,
    ctaLabel: r.cta_label,
    linkUrl: r.link_url,
    imageUrl: publicImageUrl(supabaseUrl, r.image_path),
    sponsorName: r.kind === 'ad' ? (r.sponsor_name ?? 'Annonceur') : null,
  };
}

/**
 * Compose l'ordre final : permanentes d'abord (au moins MIN_PERMANENT), puis
 * vues admin par `position`, dans la limite de MAX_SLIDES au total.
 */
export function composeSlides(
  permanent: readonly Slide[],
  adminRows: readonly LandingSlideRow[],
  supabaseUrl: string,
  now: Date = new Date(),
): Slide[] {
  const perm = permanent.slice(0, MAX_SLIDES);
  const gardees = Math.max(Math.min(MIN_PERMANENT, perm.length), 0);
  const admin = adminRows
    .filter((r) => estAffichable(r, now) && (r.placement ?? 'hero') === 'hero')
    .sort((a, b) => a.position - b.position || a.starts_at.localeCompare(b.starts_at))
    .map((r) => rowToSlide(r, supabaseUrl));
  const placesAdmin = Math.max(MAX_SLIDES - gardees, 0);
  const adminRetenues = admin.slice(0, placesAdmin);
  const placesPerm = MAX_SLIDES - adminRetenues.length;
  return [...perm.slice(0, placesPerm), ...adminRetenues];
}

/**
 * Créations affichables dans les bandeaux, dans l'ordre de `position`.
 * Le choix de CELLE qui s'affiche est fait côté client, à poids égal et par
 * chargement de page (voir Billboard.tsx) : sous ISR, un tirage au rendu
 * serveur serait figé pendant toute la durée du cache, donc toujours la même.
 */
export function bandeaux(
  adminRows: readonly LandingSlideRow[],
  supabaseUrl: string,
  now: Date = new Date(),
): Slide[] {
  return adminRows
    .filter((r) => estAffichable(r, now) && r.placement === 'billboard')
    .sort((a, b) => a.position - b.position || a.starts_at.localeCompare(b.starts_at))
    .map((r) => rowToSlide(r, supabaseUrl));
}
