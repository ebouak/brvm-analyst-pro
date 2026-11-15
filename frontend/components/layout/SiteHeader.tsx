/**
 * Ancien en-tête des pages publiques. Depuis le lot 7, étape 2, la barre de
 * cote est posée UNE SEULE FOIS pour tout le site par `ConditionalShell` : ce
 * composant ne rend plus rien (sinon deux barres sur les pages publiques
 * servies dans l'application, comme /formations/sessions). Nom et signature
 * conservés pour les appelants (PublicShell, accueil, /pricing) ; le retrait
 * de ce code mort est l'objet de l'étape 3.
 */
export function SiteHeader(_props: { marchesHref?: string } = {}) {
  return null;
}
export default SiteHeader;
