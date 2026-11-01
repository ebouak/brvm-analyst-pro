import { describe, it, expect } from 'vitest';
import { estPageOffre, estPageFormation, typeDePage } from './signal';

describe('estPageFormation', () => {
  it('accepte le hub, un niveau, une leçon', () => {
    for (const p of ['/formations/academy', '/formations/academy/lecon-0', '/formations/academy/integrale', '/formations/academy/debutant/lecon-2']) expect(estPageFormation(p)).toBe(true);
  });
  it('refuse majuscules, profondeur excessive, autres préfixes, requête, non-chaîne', () => {
    for (const p of ['/formations/academy/A', '/formations/academy/a/b/c', '/formations', '/formations/academyx', '/formations/academy/', '/formations/academy?x=1', '/formations/academy/a b', '', null, 3]) expect(estPageFormation(p)).toBe(false);
  });
  it('refuse un segment de plus de 80 caractères', () => {
    expect(estPageFormation(`/formations/academy/${'a'.repeat(81)}`)).toBe(false);
    expect(estPageFormation(`/formations/academy/${'a'.repeat(80)}`)).toBe(true);
  });
});

describe('typeDePage', () => {
  it('dérive le type de la page', () => {
    expect(typeDePage('/pricing')).toBe('offre_vue');
    expect(typeDePage('/formations/academy/lecon-0')).toBe('formation_vue');
    expect(typeDePage('/dashboard')).toBeNull();
    expect(estPageOffre('/formations/academy')).toBe(false);
  });
});
