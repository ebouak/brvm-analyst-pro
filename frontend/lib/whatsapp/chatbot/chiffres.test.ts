import { describe, it, expect } from 'vitest';
import { chiffresEtrangers, extraireNombres, masquerDonneesPersonnelles } from './chiffres';

const source = JSON.stringify({
  code: 'SNTS',
  seance: '2026-11-04',
  cours: 39200,
  variation_pct: -1.53,
  valeur_echangee: 2_550_000_000,
  resultat_net_fcfa: 413_588_000_000,
  montant: '1 740 FCFA',
});

describe('extraction des nombres', () => {
  it('formats français : espaces (y compris insécables), virgule décimale, échelle', () => {
    const n = extraireNombres('39 200 FCFA, 1,5 %, 2,55 Md FCFA, 413,6 milliards');
    expect(n.map((x) => x.cible)).toEqual([39200, 1.5, 2.55e9, 413.6e9]);
  });
  it('ignore les liens et les noms d’indices', () => {
    expect(extraireNombres('voir https://www.westbourse.com/societes/SNTS2 et le BRVM-30')).toEqual([]);
  });
});

describe('verrou des chiffres', () => {
  it('accepte un chiffre présent dans les données, arrondi compris', () => {
    expect(chiffresEtrangers('Sonatel cote 39 200 FCFA (-1,5 %), 2,55 Md échangés.', [source])).toEqual([]);
    expect(chiffresEtrangers('Résultat net : 413,6 milliards de FCFA.', [source])).toEqual([]);
    expect(chiffresEtrangers('Dividende : 1 740 FCFA.', [source])).toEqual([]);
  });
  it('accepte dates, années et petits entiers', () => {
    expect(chiffresEtrangers('Séance du 04/11/2026, exercice 2024, 3 valeurs.', [source])).toEqual([]);
  });
  it('refuse un chiffre inventé ou calculé', () => {
    expect(chiffresEtrangers('Le PER est de 9,5 et le cours 41 000 FCFA.', [source])).toEqual(['9,5', '41 000']);
  });
  it('accepte un chiffre venu de la question de l’utilisateur', () => {
    expect(chiffresEtrangers('Pour 250 000 FCFA, voici les données.', ['j’ai 250 000 FCFA'])).toEqual([]);
  });
});

describe('masquage des données personnelles', () => {
  it('masque e-mail et téléphone, garde les montants', () => {
    expect(masquerDonneesPersonnelles('écrivez à a.b@c.com ou au +221 77 123 45 67, budget 1 000 000 FCFA')).toBe(
      'écrivez à [adresse masquée] ou au [numéro masqué], budget 1 000 000 FCFA',
    );
  });
});
