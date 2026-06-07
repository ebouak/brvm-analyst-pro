import { describe, it, expect } from 'vitest';
import { parseNotationPage } from '../src/notations/parser.js';

const HTML_WITH_NOTATION = `
<html><body>
<table>
  <tr><td>Agence de notation</td><td>Bloomfield Investment</td></tr>
  <tr><td>Note</td><td>A+</td></tr>
  <tr><td>Perspective</td><td>Stable</td></tr>
  <tr><td>Date de notation</td><td>15/11/2024</td></tr>
</table>
</body></html>
`;

const HTML_WITHOUT_NOTATION = `
<html><body>
<p>Aucune notation disponible pour cette société.</p>
</body></html>
`;

describe('parseNotationPage', () => {
  it('extrait la notation depuis un tableau HTML', () => {
    const result = parseNotationPage(HTML_WITH_NOTATION, 'https://richbourse.com/notation/SNTS');
    expect(result).not.toBeNull();
    expect(result!.agence).toBe('Bloomfield Investment');
    expect(result!.note).toBe('A+');
    expect(result!.perspective).toBe('Stable');
    expect(result!.date_notation).toBe('2024-11-15');
    expect(result!.source_url).toBe('https://richbourse.com/notation/SNTS');
  });

  it('retourne null si aucune notation présente', () => {
    const result = parseNotationPage(HTML_WITHOUT_NOTATION, 'https://richbourse.com/notation/XXXX');
    expect(result).toBeNull();
  });
});
