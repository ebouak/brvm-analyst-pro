import { describe, expect, it } from 'vitest';
import { prixApplicable, placeDisponible, transitionAutorisee, type SessionTarif } from './regles';

const S = (o: Partial<SessionTarif> = {}): SessionTarif => ({ prix: 25000, prix_abonne: 15000, places: 20, places_prises: 0, statut: 'ouverte', ...o });

describe('prixApplicable', () => {
  it('applique le tarif abonné quand il existe et que la personne est abonnée', () => {
    expect(prixApplicable(S(), true)).toBe(15000);
  });
  it('applique le tarif plein à un non-abonné', () => {
    expect(prixApplicable(S(), false)).toBe(25000);
  });
  it('applique le tarif plein à un abonné quand aucune remise n’est définie', () => {
    expect(prixApplicable(S({ prix_abonne: null }), true)).toBe(25000);
  });
  it('rend null quand la séance n’a pas de prix — on n’encaisse jamais un montant deviné', () => {
    expect(prixApplicable(S({ prix: null as unknown as number }), false)).toBeNull();
  });
});

describe('placeDisponible', () => {
  it('vrai tant qu’il reste une place', () => expect(placeDisponible(S({ places_prises: 19 }))).toBe(true));
  it('faux à la dernière place prise', () => expect(placeDisponible(S({ places_prises: 20 }))).toBe(false));
  it('faux si la séance n’est pas ouverte, même avec des places', () => {
    expect(placeDisponible(S({ statut: 'annulee' }))).toBe(false);
    expect(placeDisponible(S({ statut: 'brouillon' }))).toBe(false);
    expect(placeDisponible(S({ statut: 'terminee' }))).toBe(false);
  });
});

describe('transitionAutorisee', () => {
  it('autorise réservée → payée et réservée → annulée', () => {
    expect(transitionAutorisee('reservee', 'payee')).toBe(true);
    expect(transitionAutorisee('reservee', 'annulee')).toBe(true);
  });
  it('autorise payée → présente et payée → absente', () => {
    expect(transitionAutorisee('payee', 'presente')).toBe(true);
    expect(transitionAutorisee('payee', 'absente')).toBe(true);
  });
  it('REFUSE annulée → payée : une place annulée ne se paie pas après coup', () => {
    expect(transitionAutorisee('annulee', 'payee')).toBe(false);
  });
  it('refuse réservée → présente : on ne marque présent que ce qui est payé', () => {
    expect(transitionAutorisee('reservee', 'presente')).toBe(false);
  });
});
