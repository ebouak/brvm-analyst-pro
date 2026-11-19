import { describe, expect, it } from 'vitest';
import type { DossierValeur } from './build';
import { construireApercu } from './apercu';

const dossier = {
  genere_le: '2026-11-17T08:00:00Z',
  identite: { code: 'SNTS', designation: 'SONATEL', secteur: 'Télécommunications', pays: 'Sénégal' },
  chiffres_cles: {
    exercice: '2025',
    cours: 25000,
    date_cours: '2026-11-17',
    capitalisation: 250_000_000_000,
    chiffre_affaires: 1_400_000_000_000,
    resultat_net: 350_000_000_000,
    capitaux_propres: 900_000_000_000,
  },
  dividende: { montant: 2500, base_fiscale: 'net', rendement: 0.1, exercice: 2025 },
  ratios: { per: 7.2 },
  technique: { serie: [] },
  lacunes: ['Profondeur complète du carnet indisponible.'],
  conclusion_complete: 'NE DOIT JAMAIS SORTIR',
} as unknown as DossierValeur;

describe('construireApercu', () => {
  it('expose exactement deux pages sans données des pages verrouillées', () => {
    const apercu = construireApercu(dossier);
    expect(apercu.pages).toHaveLength(2);
    expect(apercu.pages.map((page) => page.numero)).toEqual([1, 2]);
    expect(JSON.stringify(apercu)).not.toContain('conclusion_complete');
    expect(JSON.stringify(apercu)).not.toContain('Profondeur complète');
  });

  it('reprend les données réelles et déclare les absences', () => {
    const apercu = construireApercu(dossier);
    expect(apercu.pages[0]).toMatchObject({ code: 'SNTS', designation: 'SONATEL', exercice: '2025' });
    expect(apercu.pages[1].mesures).toContainEqual({ libelle: 'Cours', valeur: 25000, nature: 'fcfa' });
    expect(apercu.titre).toContain('SONATEL');
  });
});
