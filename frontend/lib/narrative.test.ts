import { describe, expect, it } from 'vitest';
import { eventHeadline } from './narrative';

describe('eventHeadline', () => {
  it('élision « d’une » et nombre à la française', () => {
    expect(eventHeadline({ eventDate: '2026-10-30', code: 'SNTS', abnormalReturnPost: -15, reaction: 'negative', window: 5 }))
      .toBe('L’événement du 30/10/2026 a été suivi d’une sous-performance de −15,0 % par rapport au BRVM Composite sur 5 séances (SNTS).');
  });
  it('une seule séance : singulier', () => {
    expect(eventHeadline({ eventDate: '2026-11-10', code: 'BICB', abnormalReturnPost: 0.4, reaction: 'neutral', window: 1 }))
      .toContain('suivi d’un écart de +0,4 % par rapport au BRVM Composite sur 1 séance');
  });
});
