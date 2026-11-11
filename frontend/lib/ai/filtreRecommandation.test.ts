import { describe, expect, it } from 'vitest';
import { REPONSE_PRUDENTE, consigneReecriture, detecterRecommandation } from './filtreRecommandation';

const detecte = (t: string) => detecterRecommandation(t).recommandation;
const codes = (t: string) => detecterRecommandation(t).motifs.map((m) => m.code);

describe('detecterRecommandation — recommandations détectées', () => {
  it.each([
    ['Je vous recommande d’acheter SNTS à ce niveau.', 'je-recommande'],
    ['Nous conseillons une position prudente.', 'je-recommande'],
    ['Je recommande de ne pas vendre maintenant.', 'je-recommande'],
    ['Achetez sous 15 000 FCFA.', 'imperatif'],
    ['Le titre a reculé. Vendez avant la publication.', 'imperatif'],
    ['Conclusion : renforcez la ligne.', 'imperatif'],
    ['- Allégez la position après la hausse.', 'imperatif'],
    ['1. Prenez vos bénéfices sur ORAC.', 'imperatif'],
    ['Vous devriez vendre une partie de vos titres.', 'vous-devriez'],
    ['Il serait judicieux d’acheter avant le détachement.', 'vous-devriez'],
    ['Mieux vaut conserver le titre.', 'vous-devriez'],
    ['| Signal | ACHAT |', 'recommandation-directionnelle'],
    ['**Verdict : VENDRE**', 'recommandation-directionnelle'],
    ['Recommandation : conserver.', 'recommandation-directionnelle'],
    ['Score 8/10 : achat fort.', 'achat-fort'],
    ['C’est un bon point d’entrée.', 'bon-point-entree'],
    ['Objectif de cours : 18 500 FCFA.', 'objectif-de-cours'],
    ['Objectif 12 mois : 9 000 FCFA (+12 %).', 'objectif-de-cours'],
    ['| Objectif | 18 500 FCFA |', 'objectif-tableau'],
    ['Stop-loss à 14 200 FCFA.', 'stop-loss'],
    ['Placez un stop loss sous le support.', 'stop-loss'],
    ['Entrée cible : 15 000 FCFA.', 'prix-entree'],
    ['Le prix d’entrée idéal se situe vers 15 000 FCFA.', 'prix-entree'],
    ['Taille de position : 5 % du portefeuille.', 'taille-position'],
  ])('%s', (texte, code) => {
    expect(detecte(texte)).toBe(true);
    expect(codes(texte)).toContain(code);
  });
});

describe('detecterRecommandation — faux positifs écartés', () => {
  it.each([
    'Le cours a vendu ses gains de la veille en fin de séance.',
    'La société achète une filiale au Sénégal pour 12 Md FCFA.',
    'Les vendeurs ont dominé la séance : 31 baisses pour 9 hausses.',
    'La pression acheteuse reste faible sur le titre.',
    'Si vous achetez des titres, la SGI prélève des frais de courtage.',
    'Les investisseurs ont vendu massivement les valeurs bancaires.',
    'WESTBOURSE ne fixe ni objectif de cours ni stop-loss.',
    'Je ne peux pas vous donner de prix d’entrée.',
    'Votre prix d’entrée moyen (PRU) est de 12 000 FCFA.',
    'Le PER de 9,2x est inférieur à la médiane du secteur (11,4x).',
    'La tendance est haussière : le cours est au-dessus de sa moyenne mobile 50 séances.',
    'Le signal du moteur est haussier (score 0,62), complétude des données 80 %.',
    'L’objectif de la société est de doubler sa capacité de production.',
    'Les critères à examiner : la valorisation, la régularité du dividende, la liquidité.',
    'Ces informations ne constituent pas une incitation à acheter ou vendre.',
  ])('%s', (texte) => {
    expect(detecterRecommandation(texte)).toEqual({ recommandation: false, motifs: [] });
  });
});

describe('repli et consigne', () => {
  it('la réponse prudente passe elle-même le filtre et ne contient aucun chiffre', () => {
    expect(detecte(REPONSE_PRUDENTE)).toBe(false);
    expect(REPONSE_PRUDENTE).not.toMatch(/\d/);
    expect(REPONSE_PRUDENTE).toMatch(/AMF-UMOA/);
  });

  it('la consigne de réécriture cite les extraits détectés', () => {
    const { motifs } = detecterRecommandation('Achetez sous 15 000 FCFA.');
    expect(consigneReecriture(motifs)).toContain('Achetez');
  });
});
