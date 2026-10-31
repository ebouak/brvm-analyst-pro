import { describe, expect, it } from 'vitest';
import { echapperLinkedIn, repartir, texteLinkedIn, texteTikTok, PLAFOND_SOCIAL_JOUR } from '../src/social/texte.js';
import { evaluerReseaux } from '../src/social/sante.js';

const article = {
  id: '58adfff7-49fd-41c9-8e55-a58961b85969',
  slug: 'decryptage-snts-2026-10-29',
  type: 'decryptage',
  titre: 'Sonatel : 6 piliers tenus sur 6',
  chapo: 'Au cours de 4 140 F, le PER (part du groupe) est de 12,1x #BRVM.',
};

describe('textes des posts', () => {
  it('échappe les caractères réservés du « little text format » LinkedIn', () => {
    expect(echapperLinkedIn('PER (groupe) #1 *gras* _x_ [a] {b} <c> @d | ~e \\f')).toBe(
      'PER \\(groupe\\) \\#1 \\*gras\\* \\_x\\_ \\[a\\] \\{b\\} \\<c\\> \\@d \\| \\~e \\\\f',
    );
  });

  it('LinkedIn : titre, chapô échappé, lien, avertissement, vrais hashtags', () => {
    const t = texteLinkedIn(article, 'https://www.westbourse.com');
    expect(t).toContain('Sonatel : 6 piliers tenus sur 6');
    expect(t).toContain('PER \\(part du groupe\\)');
    expect(t).toContain('https://www.westbourse.com/actualites/decryptage-snts-2026-10-29');
    expect(t).toContain('pas un conseil en investissement');
    expect(t).toContain('{hashtag|\\#|BRVM}');
    expect(t.length).toBeLessThanOrEqual(3000);
  });

  it('TikTok : titre borné à 90 caractères, description sans lien cliquable attendu', () => {
    const long = { ...article, titre: 'x'.repeat(120) };
    const t = texteTikTok(long);
    expect(t.titre.length).toBe(90);
    expect(t.description).toContain('westbourse.com');
    expect(t.description).toContain('#BRVM');
  });
});

describe('plafond quotidien', () => {
  it('ne publie que ce qui reste sous le plafond, le reste est mis de côté', () => {
    expect(repartir([1, 2, 3, 4, 5], 0)).toEqual({ aPublier: [1, 2, 3], auDela: [4, 5] });
    expect(repartir([1, 2], 2)).toEqual({ aPublier: [1], auDela: [2] });
    expect(repartir([1], PLAFOND_SOCIAL_JOUR)).toEqual({ aPublier: [], auDela: [1] });
  });
});

describe('santé des connexions', () => {
  const maintenant = new Date('2026-10-29T06:30:00Z');
  const jour = (n: number) => new Date(maintenant.getTime() + n * 86_400_000).toISOString();

  it('alerte LinkedIn chaque jour à partir de J-10, et une fois expiré', () => {
    expect(evaluerReseaux([{ reseau: 'linkedin', actif: true, expire_le: jour(30), refresh_expire_le: null }], 0, maintenant)).toEqual([]);
    expect(evaluerReseaux([{ reseau: 'linkedin', actif: true, expire_le: jour(9.5), refresh_expire_le: null }], 0, maintenant)[0]).toContain('dans 9 jour');
    expect(evaluerReseaux([{ reseau: 'linkedin', actif: true, expire_le: jour(-1), refresh_expire_le: null }], 0, maintenant)[0]).toContain('EXPIRÉE');
  });

  it('TikTok : surveille le jeton de rafraîchissement, pas le jeton de 24 h', () => {
    expect(evaluerReseaux([{ reseau: 'tiktok', actif: true, expire_le: jour(-1), refresh_expire_le: jour(200) }], 0, maintenant)).toEqual([]);
    expect(evaluerReseaux([{ reseau: 'tiktok', actif: true, expire_le: jour(1), refresh_expire_le: jour(5) }], 0, maintenant)).toHaveLength(1);
  });

  it('se tait sur un réseau coupé, signale les publications restées en plan', () => {
    expect(evaluerReseaux([{ reseau: 'linkedin', actif: false, expire_le: jour(-5), refresh_expire_le: null }], 0, maintenant)).toEqual([]);
    expect(evaluerReseaux([], 2, maintenant)[0]).toContain('2 publication');
  });
});
