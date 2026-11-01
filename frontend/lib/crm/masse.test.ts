import { describe, it, expect } from 'vitest';
import { classerPourMasse } from './masse';
import { REGLAGES_PAR_DEFAUT } from './reglages';
import type { Dossier } from './types';

const MAINT = new Date('2026-11-01T12:00:00Z');
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: 'Awa', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [], formationVues: [], pays: null,
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const avec = (p: Partial<Dossier>): Dossier => ({ ...d0, ...p });

describe('classerPourMasse', () => {
  it('sépare éligibles et écartés, avec raison, sans doublon et sans oublier les inconnus', () => {
    const ds = [avec({ cle: 'a' }), avec({ cle: 'b', oppose: true, nom: null, emailNorm: 'b@x.y' }), avec({ cle: 'c', premium: true }), avec({ cle: 'p', userId: null })];
    const t = classerPourMasse(['a', 'b', 'c', 'a', 'zzz', 'p'], ds, REGLAGES_PAR_DEFAUT, MAINT);
    expect(t.eligibles.map((e) => e.cle)).toEqual(['a', 'p']);
    expect(t.eligibles[1].gabarit).toBe('prospect_sans_compte');
    expect(t.ecartes.map((e) => e.cle)).toEqual(['b', 'c', 'zzz']);
    expect(t.ecartes[0]).toMatchObject({ nom: 'b@x.y' });
    expect(t.ecartes[0].raison).toMatch(/opposée/);
  });
  it('aucune limite de cadence : relancée hier, 5 fois, reste éligible', () => {
    const j = (n: number) => ({ type: 'relance' as const, statut: 'envoye' as const, canal: 'email' as const, sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, livraison: null, date: new Date(MAINT.getTime() - n * 86_400_000).toISOString() });
    const t = classerPourMasse(['a'], [avec({ cle: 'a', actions: [j(1), j(2), j(3), j(4), j(5)] })], REGLAGES_PAR_DEFAUT, MAINT);
    expect(t.eligibles).toHaveLength(1);
  });
  it('spam e-mail : écarté', () => {
    const a = { type: 'relance' as const, statut: 'envoye' as const, canal: 'email' as const, sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, livraison: 'spam' as const, date: '2026-09-01T00:00:00Z' };
    expect(classerPourMasse(['a'], [avec({ cle: 'a', actions: [a] })], REGLAGES_PAR_DEFAUT, MAINT).ecartes).toHaveLength(1);
  });
});
