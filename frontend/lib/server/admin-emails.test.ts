import { describe, it, expect } from 'vitest';
import { lireAdminEmails } from './admin-emails';

describe('lireAdminEmails', () => {
  it('lit la variable, normalise la casse et les espaces', () => {
    expect(lireAdminEmails(' A@x.com, b@y.org ')).toEqual(['a@x.com', 'b@y.org']);
  });
  it('retombe sur la valeur historique si la variable est absente ou vide', () => {
    expect(lireAdminEmails(undefined)).toEqual(['ebouak@gmail.com']);
    expect(lireAdminEmails('  ')).toEqual(['ebouak@gmail.com']);
  });
});
