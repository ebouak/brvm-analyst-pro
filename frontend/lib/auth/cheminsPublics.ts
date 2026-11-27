/**
 * Pages ouvertes sans compte. Source unique : le middleware (mur) et le pied de page
 * (cadenas sur les liens qui exigent un compte) la lisent tous deux.
 * PUR : aucune dépendance, utilisable côté serveur, client et Edge.
 */
/**
 * Vitrine SEO ouverte / app fermée.
 *
 * Un visiteur NON connecté ne voit que les pages « vitrine » (contenu indexable
 * par Google et les IA + acquisition). Tout le reste — l'application interactive
 * — exige un compte. La liste publique = exactement la surface du sitemap, plus
 * les nécessités techniques (auth, api, sitemap, robots, widgets embarqués).
 *
 * Pour ouvrir/fermer une page : éditer PUBLIC_EXACT / PUBLIC_PREFIXES ci-dessous.
 */
export const PUBLIC_EXACT = new Set<string>([
  '/', '/login', '/signup', '/pricing',
  '/mentions-legales', '/cgu', '/confidentialite',
  '/methodologie', '/debutant', '/developers', '/contact',
  '/rendement-vrai', '/fiscalite', '/simulateur-budget',
  '/comparateur-sgi', '/actualites', '/formations', '/secteurs',
  '/apercu',
  // Transparence : contrôle quotidien contre le Bulletin officiel, opérations sur titres.
  '/qualite-donnees', '/operations-titres',
  // Indice de nervosité WESTBOURSE : donnée de marché dérivée des clôtures (SEO).
  '/nervosite',
  // Stress Monitor : Vue d'ensemble, Crises historiques et Méthodologie publiques ; sous-sections avancées derrière connexion.
  '/stress-monitor', '/stress-monitor/crises', '/stress-monitor/methodologie',
  '/crm/opposition',
  // Lien d'arrêt des rappels de progression Academy (0272) : ouvert sans compte.
  '/academy/rappels/arret',
  // Liens de suivi de la Chaîne WhatsApp / du canal Telegram (affiches, délégués) :
  // ils comptent puis redirigent, un visiteur sans compte doit pouvoir les suivre.
  '/chaine', '/telegram',
  '/offre/dossier',
  // /manifest.json est le manifeste déclaré par app/layout.tsx : sans lui ici,
  // il répondait 307 vers /login et aucun navigateur ne pouvait le lire
  // (constaté le 2026-09-28). /manifest.webmanifest reste pour compatibilité.
  '/robots.txt', '/sitemap.xml', '/news-sitemap.xml', '/rss.xml',
  '/manifest.webmanifest', '/manifest.json',
  // Contact de signalement de failles (RFC 9116), à renouveler avant son
  // champ Expires. Sans cette entrée, il répondrait 307 vers /login.
  '/.well-known/security.txt',
]);
export const PUBLIC_PREFIXES = [
  '/formations', // hub, Academy publique et sessions en direct (SEO)
  '/societes',   // fiches sociétés (SEO)
  '/analyses',   // pages citables (GEO)
  '/analyse',    // Westbourse Combined Alpha & co (quant vitrine, publique)
  '/actions',    // fiches action + onglet /quant (publiques)
  '/brief',      // briefs de séance datés (SEO)
  '/actualites', // articles de presse générés depuis la donnée (SEO)
  '/comparateur-sgi', // modules du comparateur + fiches SGI (SEO, données publiques seules)
  '/simulateur', // simulateur d'investissement public (/simulateur/[code])
  '/embed',      // widgets embarqués sur des sites tiers
  '/certificat', // vérification publique d'un certificat Academy
  '/auth',       // callback Supabase
  '/api',        // routes API (gèrent leur propre auth)
  '/apercu',     // previews isolées hybrides A+B (noindex, bare) — tout /apercu/* public sans auth
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

