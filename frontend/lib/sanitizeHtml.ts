import sanitizeHtml from 'sanitize-html';

/**
 * Sanitise le HTML des rapports weekly (content_html) avant rendu via
 * dangerouslySetInnerHTML. Défense en profondeur : content_html n'est
 * aujourd'hui écrit que par un admin (RBAC content.write, service_role,
 * aucun accès en écriture public sur brvm_news — vérifié RLS) mais un
 * compte admin compromis ou une régression future d'accès ne doit pas se
 * traduire par du XSS stocké.
 *
 * `sanitize-html` plutôt que DOMPurify/isomorphic-dompurify : ce dernier
 * embarque jsdom, qui lit un asset CSS via fs au runtime — incompatible avec
 * le bundling webpack de Next.js (ENOENT en build). `sanitize-html` est du
 * JS pur, sans dépendance filesystem, compatible SSR.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'table', 'thead', 'tbody',
  'tr', 'td', 'th', 'img', 'figure', 'figcaption', 'span', 'div',
  'svg', 'path', 'g', 'line', 'circle', 'rect', 'text', 'polyline',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'target', 'rel',
  'width', 'height', 'style', 'viewBox', 'd', 'fill', 'stroke',
  'stroke-width', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'points',
];

export function sanitizeReportHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTR },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowVulnerableTags: true, // on gère nous-mêmes le sous-ensemble SVG autorisé
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
  });
}
