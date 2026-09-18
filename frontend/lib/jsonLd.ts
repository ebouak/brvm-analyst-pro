/**
 * Sérialisation sûre d'un objet JSON-LD destiné à un `<script>` inline.
 *
 * POURQUOI CE HELPER EXISTE. `JSON.stringify` produit du JSON valide, mais le
 * JSON n'est PAS du HTML : la séquence `</script>` y survit intacte. Une chaîne
 * contenant `</script><script>…` fermerait donc la balise et exécuterait du
 * code, quel que soit le reste de la page.
 *
 * Ce n'est pas théorique ici : les objets JSON-LD du site portent des textes
 * venus de la BASE — `instrument.designation`, les titres d'analyses hebdo
 * (reformulés par un LLM). Aucun de ces champs n'est saisi par un visiteur, et
 * l'exploitation supposerait déjà un accès en écriture à la base ; c'est donc
 * de la défense en profondeur, pas un colmatage d'urgence. Elle coûte une
 * ligne et retire complètement la classe de bug.
 *
 * On échappe aussi `U+2028`/`U+2029` : valides en JSON, ils sont des sauts de
 * ligne en JavaScript et cassent le script.
 */
export function jsonLdScript(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replace(/</g, '\u003c')
    .replace(/\u2028/g, '\u2028')
    .replace(/\u2029/g, '\u2029');
}
