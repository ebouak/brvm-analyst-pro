import { describe, it, expect } from 'vitest';
import { repliRichbourseActif } from '../src/dividends/richbourse.js';

describe('repliRichbourseActif', () => {
  it('reste coupé par défaut : RichBourse refuse les robots', () => {
    expect(repliRichbourseActif({})).toBe(false);
    expect(repliRichbourseActif({ RICHBOURSE_REPLI: '0' })).toBe(false);
    expect(repliRichbourseActif({ RICHBOURSE_REPLI: '' })).toBe(false);
  });

  it("ne s'active que si le workflow signale le calendrier officiel KO", () => {
    expect(repliRichbourseActif({ RICHBOURSE_REPLI: '1' })).toBe(true);
  });
});
