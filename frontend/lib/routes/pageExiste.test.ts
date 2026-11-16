import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { pageExiste } from './pageExiste';

const APP = fileURLToPath(new URL('../../app/', import.meta.url));

describe('pageExiste', () => {
  it('trouve une page ordinaire', () => expect(pageExiste(APP, '/pricing')).toBe(true));
  it('trouve une page rangée dans un groupe de routes', () => expect(pageExiste(APP, '/actions')).toBe(true));
  it('ignore la requête et le fragment', () => expect(pageExiste(APP, '/actions?tri=volume#haut')).toBe(true));
  it('refuse une page absente', () => expect(pageExiste(APP, '/nexiste-pas-du-tout')).toBe(false));
  it("refuse un dossier sans page", () => expect(pageExiste(APP, '/api')).toBe(false));
});
