import { describe, expect, it } from 'vitest';
import { commenterSeance, ecartJours, fourchettePct, type CarnetSeance } from './commentaire';

const C = (o: Partial<CarnetSeance> = {}): CarnetSeance => ({
  date_marche: '2026-09-22', qte_achat: 5, cours_achat: 5905, qte_vente: 3, cours_vente: 5910,
  achat_au_marche: false, vente_au_marche: false, cours_reference: 5910, ...o,
});

/** Les espaces fines insécables de toLocaleString('fr-FR') sont normalisées :
 *  le test porte sur le CONTENU, pas sur la typographie du séparateur. */
const tout = (c: ReturnType<typeof commenterSeance>) =>
  [...c.constats.map((x) => x.texte), ...c.limites].join(' ').replace(/[  ]/g, ' ');

describe('fourchettePct', () => {
  it('mesure l’écart en % du milieu', () => {
    expect(fourchettePct(C({ cours_achat: 11300, cours_vente: 11400 }))).toBeCloseTo(0.881, 3);
  });
  it('rend null sur un ordre « au marché » et sur une fourchette croisée', () => {
    expect(fourchettePct(C({ vente_au_marche: true }))).toBeNull();
    expect(fourchettePct(C({ cours_achat: 4000, cours_vente: 3900 }))).toBeNull();
  });
});

describe('ecartJours', () => {
  it('compte les jours entre deux séances', () => expect(ecartJours('2026-09-23', '2026-09-22')).toBe(1));
  it('rend null sur une date illisible', () => expect(ecartJours('pas-une-date', '2026-09-22')).toBeNull());
});

describe('commenterSeance', () => {
  it('énonce les deux côtés du carnet avec leurs quantités', () => {
    const t = tout(commenterSeance({ carnet: C(), signal: null }));
    expect(t).toContain('5 titres restaient demandés');
    expect(t).toContain('3 offerts');
  });

  it('dit « sans aucun acheteur » plutôt que « 0 » quand un côté est vide', () => {
    const t = tout(commenterSeance({ carnet: C({ qte_achat: null, cours_achat: null, qte_vente: 12790, vente_au_marche: true, cours_vente: null }), signal: null }));
    expect(t).toContain('sans aucun acheteur');
    expect(t).toContain('12 790');
    expect(t).toContain('au marché');
  });

  it('explique que HOLD est une abstention, pas un avis neutre', () => {
    const t = tout(commenterSeance({ carnet: null, signal: { date_marche: '2026-09-22', signal: 'HOLD', confiance: 0.82 } }));
    expect(t).toContain("s'abstient");
    expect(t).toContain('82 %');
    expect(t).toContain("n'est pas un avis neutre"); // l'abstention est dite, pas suggérée
  });

  it('SIGNALE le décalage de séance entre signal et carnet', () => {
    const c = commenterSeance({ carnet: C({ date_marche: '2026-09-22' }), signal: { date_marche: '2026-09-23', signal: 'BUY', confiance: null } });
    expect(c.limites.join(' ')).toContain('1 jour');
  });

  it('rapproche l’actualité par la DATE, en refusant d’en faire une cause', () => {
    const c = commenterSeance({
      carnet: C(), signal: null,
      actualites: [{ titre: 'Résultats semestriels', date_publication: '2026-09-20' }],
    });
    const t = tout(c);
    expect(t).toContain('Résultats semestriels');
    expect(t).toContain('2 jours avant cette séance');
    expect(c.limites.join(' ')).toContain("Rien ici n'établit qu'elle explique");
  });

  it("n'emploie JAMAIS de verbe de causalité entre les sources", () => {
    const t = tout(commenterSeance({
      carnet: C({ qte_achat: null, cours_achat: null, qte_vente: 12790, vente_au_marche: true, cours_vente: null }),
      signal: { date_marche: '2026-09-22', signal: 'SELL', confiance: 0.9 },
      actualites: [{ titre: 'Avertissement sur résultats', date_publication: '2026-09-21' }],
    }));
    for (const interdit of ['parce que', 'en raison de', 'à cause de', 'explique la baisse', 'provoqué', 'entraîne']) {
      expect(t.toLowerCase()).not.toContain(interdit);
    }
  });

  it('ne recommande RIEN, même sur un carnet très déséquilibré', () => {
    const t = tout(commenterSeance({
      carnet: C({ qte_achat: 20000, qte_vente: 1 }),
      signal: { date_marche: '2026-09-22', signal: 'BUY', confiance: 0.95 },
    })).toLowerCase();
    for (const interdit of ['opportunité', 'à acheter', 'à vendre', 'à surveiller', 'conseill', 'profiter', 'bon moment']) {
      expect(t).not.toContain(interdit);
    }
  });

  it('porte toujours au moins une limite, et le rappel qu’il ne s’agit pas d’un conseil', () => {
    const c = commenterSeance({ carnet: C(), signal: null });
    expect(c.limites.length).toBeGreaterThan(0);
    expect(c.limites.join(' ')).toContain('ne constituent pas un conseil en investissement');
  });

  it('le dit franchement quand il n’y a rien à commenter', () => {
    const c = commenterSeance({ carnet: null, signal: null });
    expect(c.constats).toHaveLength(1);
    expect(c.constats[0]!.texte).toContain('Aucune donnée');
    expect(c.limites.length).toBeGreaterThan(0);
  });
});
