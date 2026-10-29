/**
 * Textes des posts LinkedIn et TikTok d'un article — fonctions PURES.
 *
 * Le texte reprend le titre et le chapô de l'article PUBLIÉ, rien d'autre :
 * aucun chiffre n'est recalculé ni reformulé ici (un LLM qui réécrirait le
 * post rouvrirait le problème des chiffres non vérifiés, cf. hebdo/polish).
 */
export interface ArticleSocial {
  id: string;
  slug: string;
  type: string;
  titre: string;
  chapo: string;
}

/** Au plus 3 articles par jour ET par réseau (choix de l'exploitant, 2026-10-29). */
export const PLAFOND_SOCIAL_JOUR = 3;

const HASHTAGS = ['BRVM', 'Bourse', 'UEMOA', 'Investissement'];
const AVERTISSEMENT = 'Information de marché, pas un conseil en investissement.';

/**
 * Le champ `commentary` de LinkedIn est en « little text format » : ces
 * caractères y sont RÉSERVÉS. Non échappés, une parenthèse ou un dièse du
 * chapô fait rejeter le post (400) ou tronque le texte en silence.
 */
const RESERVES = /[\\|{}@[\]()<>#*_~]/g;
export function echapperLinkedIn(s: string): string {
  return s.replace(RESERVES, (c) => `\\${c}`);
}

export function urlArticle(a: Pick<ArticleSocial, 'slug'>, site: string): string {
  return `${site}/actualites/${a.slug}`;
}

export function texteLinkedIn(a: ArticleSocial, site: string): string {
  const corps = [a.titre, '', a.chapo, '', `Lire l'article : ${urlArticle(a, site)}`, '', AVERTISSEMENT].join('\n');
  const tags = HASHTAGS.map((h) => `{hashtag|\\#|${h}}`).join(' ');
  return `${echapperLinkedIn(corps)}\n\n${tags}`.slice(0, 3000);
}

/** TikTok : titre ≤ 90 caractères, description ≤ 4 000 ; les liens n'y sont pas cliquables. */
export function texteTikTok(a: ArticleSocial): { titre: string; description: string } {
  const titre = a.titre.length > 90 ? `${a.titre.slice(0, 89)}…` : a.titre;
  const description = [a.chapo, '', 'Article complet sur westbourse.com', AVERTISSEMENT, '', HASHTAGS.map((h) => `#${h}`).join(' ')].join('\n');
  return { titre, description: description.slice(0, 4000) };
}

/**
 * Partage les candidats du jour entre ce qui part et ce qui dépasse le
 * plafond. `dejaAujourdhui` compte les posts déjà partis (ou en cours) sur ce
 * réseau aujourd'hui : relancer le cron ne fait jamais dépasser le plafond.
 */
export function repartir<T>(candidats: T[], dejaAujourdhui: number, plafond = PLAFOND_SOCIAL_JOUR): { aPublier: T[]; auDela: T[] } {
  const reste = Math.max(0, plafond - dejaAujourdhui);
  return { aPublier: candidats.slice(0, reste), auDela: candidats.slice(reste) };
}
