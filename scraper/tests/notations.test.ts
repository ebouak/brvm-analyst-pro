import { describe, it, expect } from 'vitest';
import { parseNotationPage } from '../src/notations/parser.js';

// Format réel Rich Bourse : table à colonnes
// Agence de notation | Date | Court terme | Long terme | Fichier
const HTML_WITH_NOTATION = `
<html><body>
<table>
  <thead>
    <tr><th>Agence de notation</th><th>Date</th><th>Court terme</th><th>Long terme</th><th>Fichier</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Bloomfield Investment</td><td>Juin 2025</td>
      <td>A1- perspective Stable</td><td>A+ perspective Stable</td><td>pdf</td>
    </tr>
    <tr>
      <td>Bloomfield Investment</td><td>Août 2024</td>
      <td>A1-</td><td>A perspective Positive</td><td>pdf</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

const HTML_WITHOUT_NOTATION = `
<html><body>
<p>Aucune notation disponible pour cette société.</p>
</body></html>
`;

describe('parseNotationPage', () => {
  it('extrait la notation depuis un tableau HTML (format Rich Bourse)', () => {
    const result = parseNotationPage(HTML_WITH_NOTATION, 'https://richbourse.com/notation/SNTS');
    expect(result).not.toBeNull();
    expect(result!.agence).toBe('Bloomfield Investment');
    // Note primaire = long terme de la ligne la plus récente
    expect(result!.note).toBe('A+');
    expect(result!.perspective).toBe('Stable');
    expect(result!.court_terme).toBe('A1- perspective Stable');
    expect(result!.long_terme).toBe('A+ perspective Stable');
    expect(result!.date_notation).toBe('2025-06-01');
    expect(result!.source_url).toBe('https://richbourse.com/notation/SNTS');
    // Historique : 2 entrées, la plus récente d'abord
    expect(result!.history).toHaveLength(2);
    expect(result!.history[1]!.note).toBe('A');
    expect(result!.history[1]!.perspective).toBe('Positive');
    expect(result!.history[1]!.date_notation).toBe('2024-08-01');
  });

  it('retourne null si aucune notation présente', () => {
    const result = parseNotationPage(HTML_WITHOUT_NOTATION, 'https://richbourse.com/notation/XXXX');
    expect(result).toBeNull();
  });
});
