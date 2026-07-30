import { describe, it, expect } from 'vitest';
import { shouldNotify } from '../src/theses/runThesisAlerts.js';

describe('shouldNotify — front montant uniquement', () => {
  it('notifie sur la transition vers a-revoir depuis intacte', () => {
    expect(shouldNotify('a-revoir', 'intacte')).toBe(true);
  });
  it('ne répète pas si déjà a-revoir', () => {
    expect(shouldNotify('a-revoir', 'a-revoir')).toBe(false);
  });
  it('notifie si jamais évalué auparavant', () => {
    expect(shouldNotify('a-revoir', null)).toBe(true);
  });
  it('ne notifie pas un retour au vert (intacte après a-revoir)', () => {
    expect(shouldNotify('intacte', 'a-revoir')).toBe(false);
  });
  it('notifie une nouvelle transition après un objectif atteint', () => {
    expect(shouldNotify('a-revoir', 'objectif-atteint')).toBe(true);
  });
  it('ne notifie jamais sur objectif-atteint ou intacte en soi', () => {
    expect(shouldNotify('objectif-atteint', 'intacte')).toBe(false);
    expect(shouldNotify('intacte', null)).toBe(false);
  });
});
