import { describe, expect, it } from 'vitest';
import {
  commenterSeance, ecartJours, ecartTypeVariations, extraireFacteurs, facteursDivergents, fourchettePct, valeurCarnet,
  type CarnetSeance,
} from './commentaire';

const C = (o: Partial<CarnetSeance> = {}): CarnetSeance => ({
  date_marche: '2026-09-22', qte_achat: 5, cours_achat: 5905, qte_vente: 3, cours_vente: 5910,
  achat_au_marche: false, vente_au_marche: false, cours_reference: 5910, ...o,
});

/** Les espaces fines insécables de toLocaleString('fr-FR') sont normalisées :
 *  le test porte sur le CONTENU, pas sur la typographie du séparateur. */
const tout = (c: ReturnType<typeof commenterSeance>) =>
  [...c.constats.flatMap((x) => [x.fait, x.portee ?? '']), c.synthese ?? '', ...c.limites]
    .join(' ').replace(/[    ]/g, ' ');

describe('fourchettePct', () => {
  it('mesure l’écart en % du milieu', () => {
    expect(fourchettePct(C({ cours_achat: 11300, cours_vente: 11400 }))).toBeCloseTo(0.881, 3);
  });
  it('rend null sur un ordre « au marché » et sur une fourchette croisée', () => {
    expect(fourchettePct(C({ vente_au_marche: true }))).toBeNull();
    expect(fourchettePct(C({ cours_achat: 4000, cours_vente: 3900 }))).toBeNull();
  });
});

describe('valeurCarnet', () => {
  it('additionne les deux côtés en FCFA', () => {
    expect(valeurCarnet(C({ qte_achat: 93, cours_achat: 8200, qte_vente: 10, cours_vente: 8345 }))).toBe(93 * 8200 + 10 * 8345);
  });
  it('rend null quand aucun ordre n’est chiffrable', () => {
    expect(valeurCarnet(C({ qte_achat: null, cours_achat: null, qte_vente: null, cours_vente: null }))).toBeNull();
  });
});

describe('extraireFacteurs', () => {
  it('lit la liste produite par le moteur', () => {
    expect(extraireFacteurs('Pas de signal franc (HOLD). Facteurs : RSI 30 (survente) ; MACD négatif ; tendance baissière.'))
      .toBe('RSI 30 (survente) ; MACD négatif ; et tendance baissière');
  });
  it('ne devine rien quand la phrase ne suit pas la forme attendue', () => {
    expect(extraireFacteurs('Texte libre sans liste.')).toBeNull();
    expect(extraireFacteurs(null)).toBeNull();
  });
});

describe('ecartJours', () => {
  it('compte les jours entre deux séances', () => expect(ecartJours('2026-09-23', '2026-09-22')).toBe(1));
  it('rend null sur une date illisible', () => expect(ecartJours('pas-une-date', '2026-09-22')).toBeNull());
});

describe('commenterSeance — mise à l’échelle', () => {
  /** Le cas réel qui a motivé la refonte : PALC, 93 contre 10, séance à 22,5 M. */
  const palc = () => commenterSeance({
    carnet: C({ date_marche: '2026-09-22', qte_achat: 93, cours_achat: 8200, qte_vente: 10, cours_vente: 8345 }),
    signal: { date_marche: '2026-09-23', signal: 'HOLD', confiance: 0.915, score_total: -0.255,
      explication: 'Pas de signal franc (HOLD). Facteurs : RSI 30 (survente, signal acheteur) ; MACD négatif ; tendance de fond baissière.' },
    contexte: { valeurEchangee: 22_533_095, spreadMedianMarche: 0.91, valeursPlusSerrees: 39, valeursComparees: 47 },
  });

  it('REFUSE de laisser lire « 93 contre 10 » comme un rapport de force', () => {
    const t = tout(palc());
    expect(t).toContain('reliquat');
    expect(t).toContain('ne mesure pas un rapport de force');
    expect(t).toContain('22,5 millions de FCFA'); // l'étalon est nommé, pas sous-entendu
  });

  it('chiffre la fourchette en francs et la situe parmi les autres valeurs', () => {
    const t = tout(palc());
    expect(t).toContain('145 FCFA');            // 8 345 - 8 200
    expect(t).toContain('17 528 FCFA par million');
    expect(t).toContain('39 valeurs sur 47');
    expect(t).toContain('médiane du marché étant à 0,91 %');
    expect(t).toContain('large pour la BRVM');
  });

  it('situe le score face aux seuils, au lieu d’annoncer un sigle', () => {
    const t = tout(palc());
    expect(t).toContain('-0,26');
    expect(t).toContain('+0,6');
    expect(t).toContain('−0,6');
  });

  it('DIT que la confiance mesure la donnée, pas la justesse d’une prévision', () => {
    const t = tout(palc());
    expect(t).toContain('92 %');
    expect(t).toContain("non sur la justesse d'une prévision");
  });

  it('reprend les facteurs du moteur plutôt que de les taire', () => {
    const t = tout(palc());
    expect(t).toContain('RSI 30');
    expect(t).toContain('MACD négatif');
    expect(t).toContain("aucun facteur ne l'emporte assez nettement");
  });

  it('n’invente AUCUNE échelle quand les capitaux de la séance sont inconnus', () => {
    const t = tout(commenterSeance({
      carnet: C({ qte_achat: 93, cours_achat: 8200, qte_vente: 10, cours_vente: 8345 }), signal: null,
    }));
    expect(t).toContain('846 050'); // la valeur brute, elle, est calculable
    expect(t).not.toContain('reliquat');
    expect(t).not.toContain('de la séance');
  });

  it('n’invente AUCUN classement quand le marché n’est pas fourni', () => {
    const t = tout(commenterSeance({ carnet: C(), signal: null }));
    expect(t).not.toContain('médiane');
    expect(t).not.toContain('sur 47');
    expect(t).toContain('par million'); // le coût, lui, se calcule sans comparaison
  });
});

describe('commenterSeance — synthèse', () => {
  it('constate le DÉSACCORD entre carnet et moteur sans le trancher', () => {
    const c = commenterSeance({
      carnet: C({ qte_achat: 40_000, cours_achat: 8200, qte_vente: 100, cours_vente: 8300 }),
      signal: { date_marche: '2026-09-22', signal: 'HOLD', confiance: 0.8, score_total: -0.4 },
      contexte: { valeurEchangee: 1_000_000 },
    });
    expect(c.synthese).toContain('ne disent pas la même chose');
    expect(c.synthese).toContain('rien ici ne permet de les départager');
  });

  it('refuse de bâtir une convergence sur un carnet négligeable', () => {
    const c = commenterSeance({
      carnet: C({ qte_achat: 93, cours_achat: 8200, qte_vente: 10, cours_vente: 8345 }),
      signal: { date_marche: '2026-09-22', signal: 'HOLD', confiance: 0.9, score_total: -0.255 },
      contexte: { valeurEchangee: 22_533_095 },
    });
    expect(c.synthese).toContain('trop petit');
    expect(c.synthese).not.toContain('concordent');
  });

  it('dit franchement qu’une séance ne porte aucun fait marquant', () => {
    const c = commenterSeance({
      carnet: C({ qte_achat: 5, cours_achat: 8200, qte_vente: 3, cours_vente: 8250 }),
      signal: { date_marche: '2026-09-22', signal: 'HOLD', confiance: 0.9, score_total: 0.01 },
      contexte: { valeurEchangee: 22_533_095 },
    });
    expect(c.synthese).toContain('aucun fait marquant');
  });
});

describe('commenterSeance — les trois interdits tiennent', () => {
  it("n'emploie JAMAIS de verbe de causalité entre les sources", () => {
    const t = tout(commenterSeance({
      carnet: C({ qte_achat: null, cours_achat: null, qte_vente: 12790, vente_au_marche: true, cours_vente: null }),
      signal: { date_marche: '2026-09-22', signal: 'SELL', confiance: 0.9, score_total: -0.82,
        explication: 'Signal de vente. Facteurs : RSI 78 ; MACD négatif.' },
      actualites: [{ titre: 'Avertissement sur résultats', date_publication: '2026-09-21' }],
      contexte: { valeurEchangee: 500_000, spreadMedianMarche: 0.91 },
    })).toLowerCase();
    for (const interdit of ['parce que la', 'en raison de', 'à cause de', 'explique la baisse', 'provoqué', 'entraîne', 'sous l’effet']) {
      expect(t).not.toContain(interdit);
    }
  });

  it('ne recommande RIEN, même sur un carnet très déséquilibré et un signal net', () => {
    const t = tout(commenterSeance({
      carnet: C({ qte_achat: 20000, cours_achat: 8200, qte_vente: 1, cours_vente: 8210 }),
      signal: { date_marche: '2026-09-22', signal: 'BUY', confiance: 0.95, score_total: 0.78 },
      contexte: { valeurEchangee: 1_000_000, spreadMedianMarche: 0.91, valeursPlusSerrees: 2, valeursComparees: 47 },
    })).toLowerCase();
    for (const interdit of ['opportunité', 'à acheter', 'à vendre', 'à surveiller', 'conseill', 'profiter', 'bon moment', 'devrait']) {
      expect(t).not.toContain(interdit);
    }
  });

  it('porte toujours au moins une limite, et le rappel qu’il ne s’agit pas d’un conseil', () => {
    const c = commenterSeance({ carnet: C(), signal: null });
    expect(c.limites.length).toBeGreaterThan(0);
    expect(c.limites.join(' ')).toContain('ne constituent pas un conseil en investissement');
  });

  it('SIGNALE le décalage de séance entre signal et carnet', () => {
    const c = commenterSeance({ carnet: C({ date_marche: '2026-09-22' }), signal: { date_marche: '2026-09-23', signal: 'BUY', confiance: null } });
    expect(c.limites.join(' ')).toContain('1 jour');
    expect(c.limites.join(' ')).toContain('toujours une séance de retard');
  });

  it('rapproche l’actualité par la DATE, en refusant d’en faire une cause', () => {
    const c = commenterSeance({
      carnet: C(), signal: null,
      actualites: [{ titre: 'Résultats semestriels', date_publication: '2026-09-20' }],
    });
    const t = tout(c);
    expect(t).toContain('Résultats semestriels');
    expect(t).toContain('2 jours avant cette séance');
    expect(t).toContain('chronologique, pas explicatif');
    expect(c.limites.join(' ')).toContain("Rien ici n'établit");
  });

  it('le dit franchement quand il n’y a rien à commenter', () => {
    const c = commenterSeance({ carnet: null, signal: null });
    expect(c.constats).toHaveLength(1);
    expect(c.constats[0]!.fait).toContain('Aucune donnée');
    expect(c.synthese).toBeNull();
    expect(c.limites.length).toBeGreaterThan(0);
  });
});

describe('commenterSeance — bruit de marché', () => {
  /** PALC réel : −1,22 % pour un écart-type de 1,72 % sur 30 séances. */
  it('DIT qu’un mouvement sous un écart-type ne se distingue pas du bruit', () => {
    const t = tout(commenterSeance({
      carnet: null, signal: null,
      bruit: { variationPct: -1.22, ecartTypePct: 1.72, seancesObservees: 30 },
    }));
    expect(t).toContain('reculé de 1,22 %');
    expect(t).toContain("agitation ordinaire");
    expect(t).toContain('bruit de marché');
  });

  it('qualifie d’inhabituel un mouvement au-delà de deux écarts-types', () => {
    const t = tout(commenterSeance({
      carnet: null, signal: null,
      bruit: { variationPct: 6.5, ecartTypePct: 1.72, seancesObservees: 30 },
    }));
    expect(t).toContain('séance inhabituelle');
    expect(t).not.toContain('bruit de marché');
  });

  it('REFUSE de qualifier le mouvement sur un historique trop court', () => {
    const c = commenterSeance({ carnet: null, signal: null, bruit: { variationPct: -4, ecartTypePct: 1.2, seancesObservees: 6 } });
    const t = tout(c);
    expect(t).toContain('reculé de 4,00 %');       // le fait est cité
    expect(t).not.toContain('agitation ordinaire'); // il n'est pas qualifié
    expect(c.limites.join(' ')).toContain('trop court');
  });
});

describe('commenterSeance — cohérence économique', () => {
  /** PALC réel : 15,46 M titres à 8 100 F, RN 15,51 Md, CP 142,6 Md. */
  const palmci = {
    exercice: 2025, resultatNet: 15_508_655_000, resultatNetPrecedent: 15_861_643_000,
    chiffreAffaires: 197_629_996_000, chiffreAffairesPrecedent: 172_182_502_000,
    capitauxPropres: 142_638_984_000, actions: 15_459_316, coursJour: 8100, source: 'pdf-verified',
  };

  it('rapporte le cours aux comptes : capitalisation, PER, PBR', () => {
    const t = tout(commenterSeance({ carnet: null, signal: null, economie: palmci }));
    expect(t).toContain('exercice publié (2025)');
    expect(t).toContain('8,1 fois son résultat annuel');
    expect(t).toContain('0,88 fois ses fonds propres');
  });

  it('DIT qu’une décote sur fonds propres peut durer et ne prédit rien', () => {
    const t = tout(commenterSeance({ carnet: null, signal: null, economie: palmci }));
    expect(t).toContain('en dessous de la valeur comptable');
    expect(t).toContain('peut durer des années');
    expect(t).toContain('ne dit rien du sens du prochain mouvement');
  });

  it('DIT « contrastée » quand le CA monte et le résultat baisse — le cas PALC réel', () => {
    const c = commenterSeance({
      carnet: null, economie: palmci,
      signal: { date_marche: '2026-09-23', signal: 'HOLD', confiance: 0.915, score_total: -0.255 },
    });
    // CA +14,8 % mais résultat −2,2 % : ni favorable, ni dégradé. On ne tranche pas.
    expect(c.synthese).toContain('image contrastée');
    expect(c.synthese).toContain('ne recoupe ni ne contredit');
  });

  it('CONFRONTE technique et comptes quand ils divergent franchement', () => {
    const c = commenterSeance({
      carnet: null,
      economie: { ...palmci, resultatNetPrecedent: 11_000_000_000 }, // RN +41 %, CA +14,8 %
      signal: { date_marche: '2026-09-23', signal: 'SELL', confiance: 0.9, score_total: -0.7 },
    });
    expect(c.synthese).toContain('ne décrivent pas la même chose');
    expect(c.synthese).toContain('une activité en progression');
    expect(c.synthese).toContain('un cours orienté à la baisse');
    expect(c.synthese).toContain('peut durer des années');
  });

  it('refuse un PER absurde né d’une extraction fautive', () => {
    const t = tout(commenterSeance({
      carnet: null, signal: null,
      economie: { ...palmci, resultatNet: 1_000_000 }, // PER ≈ 125 000
    }));
    expect(t).not.toContain('fois son résultat annuel');
    expect(t).toContain('fois ses fonds propres'); // le PBR, lui, reste sain
  });

  it('n’écrit aucun ratio sans nombre de titres', () => {
    const t = tout(commenterSeance({ carnet: null, signal: null, economie: { ...palmci, actions: null } }));
    expect(t).toContain('exercice publié (2025)');
    expect(t).not.toContain('en Bourse');
    expect(t).not.toContain('fois ses fonds propres');
  });

  it('rappelle que les comptes sont clos et ne décrivent pas le présent', () => {
    const c = commenterSeance({ carnet: null, signal: null, economie: palmci });
    expect(c.limites.join(' ')).toContain('clos depuis');
    expect(c.limites.join(' ')).toContain('états financiers publiés');
  });
});

describe('ecartTypeVariations', () => {
  const serie = (n: number, v: number) => Array.from({ length: n }, (_, i) => (i % 2 ? v : -v));

  it('mesure la dispersion des variations quotidiennes', () => {
    const { ecartTypePct, seances } = ecartTypeVariations(serie(30, 2));
    expect(seances).toBe(30);
    expect(ecartTypePct).toBeCloseTo(2, 6);
  });

  it('REFUSE de rendre un écart-type sous 20 séances cotées', () => {
    expect(ecartTypeVariations(serie(19, 2)).ecartTypePct).toBeNull();
  });

  it('écarte les trous sans écarter les séances immobiles', () => {
    const avec = ecartTypeVariations([...serie(30, 2), null, undefined]);
    expect(avec.seances).toBe(30);
    const plates = ecartTypeVariations(Array.from({ length: 25 }, () => 0));
    expect(plates.ecartTypePct).toBe(0); // un marché immobile a bien un écart-type nul
  });
});

describe('facteursDivergents — on n’affirme une contradiction que si on la constate', () => {
  it('la constate sur des sous-scores de signes opposés (PALC : RSI +0,67, MACD −0,99)', () => {
    expect(facteursDivergents({ variation: -1, volume: -0.62, rsi: 0.6706, macd: -0.993 })?.divergent).toBe(true);
  });

  it('ne la voit PAS quand tous les facteurs pointent du même côté (SNTS)', () => {
    expect(facteursDivergents({ variation: 0.4, volume: 0.3, rsi: 0.55, macd: 0.61 })?.divergent).toBe(false);
  });

  it('ignore les sous-scores trop faibles pour peser', () => {
    expect(facteursDivergents({ rsi: 0.8, volume: -0.05, macd: 0.4 })?.divergent).toBe(false);
  });

  it('rend null — et non false — quand les sous-scores ne sont pas fournis', () => {
    expect(facteursDivergents(null)).toBeNull();
    expect(facteursDivergents(undefined)).toBeNull();
  });

  it('n’écrit « se contredisent » QUE sur des sous-scores contradictoires', () => {
    const avec = commenterSeance({
      carnet: null,
      signal: { date_marche: '2026-09-23', signal: 'HOLD', confiance: 0.9, score_total: -0.255,
        explication: 'Pas de signal franc (HOLD). Facteurs : RSI 30 ; MACD négatif.', sousScores: { rsi: 0.6706, macd: -0.993 } },
    });
    expect(tout(avec)).toContain("ses facteurs s'opposent : le RSI tire à la hausse, le MACD à la baisse");

    const sans = commenterSeance({
      carnet: null,
      signal: { date_marche: '2026-09-23', signal: 'HOLD', confiance: 1, score_total: 0.01,
        explication: 'Pas de signal franc (HOLD). Facteurs : RSI 70 ; MACD positif.', sousScores: { rsi: 0.4, macd: 0.55 } },
    });
    expect(tout(sans)).not.toContain("s'opposent");
    expect(tout(sans)).toContain("aucun facteur ne l'emporte assez nettement");
  });
});
