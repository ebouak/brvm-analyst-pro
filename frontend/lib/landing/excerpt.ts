/**
 * Extrait un aperçu texte-brut d'un contenu markdown (rapports LLM,
 * notamment `diagnostic_reports.markdown_content`). Retire uniquement la
 * SYNTAXE markdown (puces de liste en début de ligne, titres `#`, emphase
 * `*`/`_`, code `` ` ``, citations `>`) — ne touche jamais un tiret ASCII
 * ailleurs dans le texte, pour ne pas effacer un signe négatif dans un
 * pourcentage ou un chiffre financier (ex. "-3,2 %" ne doit jamais devenir
 * "3,2 %").
 */
export function excerpt(markdown: string, maxLen = 280): string {
  const plain = markdown
    .replace(/^\s*[-*]\s+/gm, '') // puces de liste en début de ligne uniquement
    .replace(/^#{1,6}\s*/gm, '') // titres markdown
    .replace(/[*_`]/g, '') // emphase / code inline
    .replace(/^>\s?/gm, '') // citations
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}
