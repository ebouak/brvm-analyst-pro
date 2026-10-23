import { describe, it, expect } from 'vitest';
import { estDemandeHumain, lireCommande, rendreCommande, statsWhatsapp } from './commandes';

describe('lireCommande — reconnaissance', () => {
  it.each([
    ['COURS SNTS', { type: 'cours', valeur: 'SNTS' }],
    ['cours snts', { type: 'cours', valeur: 'snts' }],
    ['  Prix Sonatel ', { type: 'cours', valeur: 'Sonatel' }],
    ['/cours ORAC', { type: 'cours', valeur: 'ORAC' }],
    ['DIV ORAC', { type: 'dividendes', valeur: 'ORAC' }],
    ['Dividendes société générale', { type: 'dividendes', valeur: 'société générale' }],
    ['PALMARES', { type: 'palmares', critere: 'hausses' }],
    ['palmarès baisses', { type: 'palmares', critere: 'baisses' }],
    ['TOP volumes', { type: 'palmares', critere: 'volumes' }],
    ['AIDE', { type: 'aide' }],
    ['menu', { type: 'aide' }],
    ['?', { type: 'aide' }],
    ['COURS', { type: 'aide' }],
    ['div', { type: 'aide' }],
  ])('« %s »', (texte, attendu) => {
    expect(lireCommande(texte)).toEqual(attendu);
  });

  it.each([
    'Bonjour, je voudrais le cours de SNTS',
    'cours de bourse comment ça marche pour débuter ?',
    'COURS SNTS%',
    'COURS a,b',
    'DIV ORAC; drop',
    `COURS ${'x'.repeat(41)}`,
    'PALMARES demain matin svp',
    'Merci pour votre aide',
    '',
  ])('pas une commande : « %s »', (texte) => {
    expect(lireCommande(texte)).toBeNull();
  });
});

const cours = {
  code: 'SNTS',
  societe: 'SONATEL',
  seance: '2026-10-22',
  cours: 26500,
  variation_pct: 1.15,
  volume: 1234,
  valeur_echangee: 32701000,
  signal: 'BUY',
  confiance: 0.8,
};

describe('rendreCommande', () => {
  it('cours : code, société, date de séance, cours, variation — jamais le signal', () => {
    const t = rendreCommande({ type: 'cours', valeur: 'SNTS' }, cours, {});
    expect(t).toContain('*SNTS — SONATEL*');
    expect(t).toContain('22/10/2026');
    expect(t).toMatch(/26\s500 FCFA/);
    expect(t).toContain('▲ +1,15 %');
    expect(t).toContain('https://www.westbourse.com/actions/SNTS');
    expect(t).not.toMatch(/BUY|HOLD|SELL|achat|vente/i);
    expect(t).toContain('pas un conseil en investissement');
  });

  it('cours en baisse : flèche descendante', () => {
    const t = rendreCommande({ type: 'cours', valeur: 'SNTS' }, { ...cours, variation_pct: -2.5 }, {});
    expect(t).toContain('▼ -2,5 %');
  });

  it('valeur introuvable : le dit, propose des exemples, ne devine pas', () => {
    const t = rendreCommande({ type: 'cours', valeur: 'XYZ' }, { erreur: 'Aucune valeur cotée ne correspond à « XYZ ».' }, {});
    expect(t).toContain('Valeur introuvable');
    expect(t).toContain('COURS SNTS');
    expect(t).not.toMatch(/FCFA/);
  });

  it('dividendes : 3 derniers exercices au plus, dates présentes seulement si connues, pas de rendement', () => {
    const t = rendreCommande(
      { type: 'dividendes', valeur: 'ORAC' },
      {
        code: 'ORAC',
        rendement_pct: 7.1,
        dividendes: [
          { exercice: 2025, montant: '1 000 FCFA', detachement: '2026-06-10', paiement: '2026-06-15' },
          { exercice: 2024, montant: '900 FCFA', detachement: 'inconnu' },
          { exercice: 2023, montant: '800 FCFA', detachement: '2024-06-01' },
          { exercice: 2022, montant: '700 FCFA', detachement: '2023-06-01' },
        ],
      },
      {},
    );
    expect(t).toContain('Exercice 2025 : *1 000 FCFA*');
    expect(t).toContain('détachement 10/06/2026');
    expect(t).toContain('paiement 15/06/2026');
    expect(t).not.toContain('inconnu');
    expect(t).not.toContain('2022');
    expect(t).not.toMatch(/rendement|7,1/i);
  });

  it('dividendes : aucun fiable → le dit sans chiffre', () => {
    const t = rendreCommande({ type: 'dividendes', valeur: 'SVOC' }, { code: 'SVOC', dividendes: [] }, {});
    expect(t).toContain('Aucun dividende vérifié');
  });

  it('palmarès : critère, date, 5 lignes, rappel des variantes', () => {
    const classement = Array.from({ length: 5 }, (_, i) => ({ code: `C${i}`, cours: 1000 + i, variation_pct: 5 - i }));
    const t = rendreCommande(
      { type: 'palmares', critere: 'hausses' },
      { seance: '2026-10-22', critere: 'plus fortes hausses', valeurs_cotees: 47, classement },
      {},
    );
    expect(t).toContain('22/10/2026');
    expect(t).toContain('plus fortes hausses');
    expect(t).toContain('1. *C0*');
    expect(t).toContain('5. *C4*');
    expect(t).toContain('47 valeurs cotées');
    expect(t).toContain('PALMARES BAISSES');
  });

  it('aide : liste les commandes', () => {
    const t = rendreCommande({ type: 'aide' }, null, {});
    for (const c of ['COURS SNTS', 'DIV ORAC', 'PALMARES']) expect(t).toContain(c);
  });

  it('incitation : inscription du numéro toujours ; Chaîne seulement si configurée', () => {
    const sans = rendreCommande({ type: 'aide' }, null, {});
    expect(sans).toContain('https://www.westbourse.com/signup?next=%2Fparametres%2Falertes');
    expect(sans).not.toContain('Chaîne');
    const avec = rendreCommande({ type: 'aide' }, null, { chaineUrl: 'https://whatsapp.com/channel/ABC' });
    expect(avec).toContain('📣');
    expect(avec).toContain('https://whatsapp.com/channel/ABC');
  });

  it('toujours sous la limite WhatsApp', () => {
    expect(rendreCommande({ type: 'aide' }, null, {}).length).toBeLessThanOrEqual(4096);
  });
});

describe('statsWhatsapp', () => {
  const maintenant = new Date('2026-10-23T12:00:00Z');
  const j = (n: number) => new Date(maintenant.getTime() - n * 86400000).toISOString();

  it('compte les messages WhatsApp 7 j / 30 j et la médiane du délai de réponse', () => {
    const s = statsWhatsapp(
      [
        { canal: 'whatsapp', created_at: j(1), repondu_at: j(0.5) }, // 12 h
        { canal: 'whatsapp', created_at: j(10), repondu_at: j(9) }, // 24 h
        { canal: 'whatsapp', created_at: j(20), repondu_at: j(18) }, // 48 h
        { canal: 'whatsapp', created_at: j(40), repondu_at: j(39) }, // hors 30 j
        { canal: 'email', created_at: j(1), repondu_at: j(0.9) }, // autre canal
      ],
      maintenant,
    );
    expect(s).toEqual({ recus7: 1, recus30: 3, delaiMedianHeures: 24 });
  });

  it('sans réponse : délai null', () => {
    const s = statsWhatsapp([{ canal: 'whatsapp', created_at: j(1), repondu_at: null }], maintenant);
    expect(s.delaiMedianHeures).toBeNull();
  });
});

describe('estDemandeHumain', () => {
  it.each(['HUMAIN', 'humain', ' Conseiller ', '/equipe', 'Équipe', 'support'])('« %s » → équipe', (t) => {
    expect(estDemandeHumain(t)).toBe(true);
  });
  it.each(['humain svp', 'je veux un conseiller', 'AIDE', ''])('« %s » → non', (t) => {
    expect(estDemandeHumain(t)).toBe(false);
  });
});
