import { describe, it, expect } from 'vitest';
import { urlSure } from './urlSure';

describe('urlSure', () => {
  it('accepte http et https', () => {
    expect(urlSure('https://brvm.org/x')).toBe('https://brvm.org/x');
    expect(urlSure(' HTTP://a.fr ')).toBe('HTTP://a.fr');
  });
  it('refuse les autres schémas et les valeurs vides', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'ftp://x', '', null, undefined, 42]) {
      expect(urlSure(v)).toBeNull();
    }
  });
});
