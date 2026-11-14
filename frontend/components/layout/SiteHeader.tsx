import BarreDeCote from '@/components/layout/barre/BarreDeCote';

/**
 * En-tête des pages publiques : la « barre de cote » (lot 7, étape 1).
 * Nom conservé pour les appelants (PublicShell, landing, /pricing) ; la
 * navigation est dérivée du registre, rien n'est écrit en dur ici.
 * `marchesHref` est ignoré : l'ancien lien « Marchés » n'existe plus.
 */
export function SiteHeader(_props: { marchesHref?: string } = {}) {
  return <BarreDeCote />;
}
export default SiteHeader;
