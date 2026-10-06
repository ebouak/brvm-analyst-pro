import { describe, expect, it } from 'vitest';
import { lectureIntermediaire, libellePeriode, lireCodePeriode } from '@/lib/financials/interim';
import { commenterSeance } from '@/lib/carnet/commentaire';

const M = 1e6;
// SGBC, chiffres réels (rapports publiés) : annuels 2024-2025, S1 2025, S1 2026, en FCFA.
const sgbc = [
  { periode: '2024', revenu_total: 263_207 * M, resultat_net: 101_228 * M },
  { periode: '2025', revenu_total: 276_048 * M, resultat_net: 101_352 * M },
  { periode: '2025-S1', revenu_total: 132_010 * M, resultat_net: 53_077 * M },
  { periode: '2026-S1', revenu_total: 134_059 * M, resultat_net: 53_350 * M },
];

describe('lectureIntermediaire', () => {
  it('retient le semestre de l’année en cours et calcule les 12 mois glissants', () => {
    const l = lectureIntermediaire(sgbc)!;
    expect(l.periode).toBe('2026-S1');
    expect(l.libelle).toBe('1er semestre 2026');
    expect(l.resultatNetPrecedent).toBe(53_077 * M);
    // 101 352 − 53 077 + 53 350 = 101 625
    expect(l.glissant?.resultatNet).toBe(101_625 * M);
    expect(l.glissant?.libelle).toBe('douze mois glissants à fin juin 2026');
  });

  it('REMPLACEMENT : dès que l’annuel 2026 est publié, le semestre 2026 sort de l’analyse', () => {
    expect(lectureIntermediaire([...sgbc, { periode: '2026', revenu_total: 280_000 * M, resultat_net: 104_000 * M }])).toBeNull();
  });

  it('la période la plus avancée de l’année l’emporte (T3 > S1 > T1)', () => {
    const l = lectureIntermediaire([
      ...sgbc,
      { periode: '2026-T1', revenu_total: 66_000 * M, resultat_net: 26_000 * M },
      { periode: '2026-T3', revenu_total: 200_000 * M, resultat_net: 79_000 * M },
    ])!;
    expect(l.periode).toBe('2026-T3');
    expect(l.libelle).toBe('9 premiers mois de 2026');
  });

  it('pas de 12 mois glissants sans le comparatif N−1 (jamais d’annualisation)', () => {
    const l = lectureIntermediaire(sgbc.filter((x) => x.periode !== '2025-S1'))!;
    expect(l.glissant).toBeNull();
    expect(l.resultatNet).toBe(53_350 * M);
  });

  it('pas de 12 mois glissants sans l’annuel N−1', () => {
    expect(lectureIntermediaire(sgbc.filter((x) => x.periode !== '2025'))!.glissant).toBeNull();
  });

  it('ignore un intermédiaire vide ou antérieur au dernier annuel', () => {
    expect(lectureIntermediaire([sgbc[1], { periode: '2025-S1', revenu_total: 1, resultat_net: 1 }])).toBeNull();
    expect(lectureIntermediaire([sgbc[1], { periode: '2026-S1', revenu_total: null, resultat_net: null }])).toBeNull();
  });

  it('libellés et codes', () => {
    expect(libellePeriode('2026-T1')).toBe('1er trimestre 2026');
    expect(libellePeriode('2025')).toBe('exercice 2025');
    expect(lireCodePeriode('2026-S2')).toBeNull();
  });
});

describe('commentaire de séance avec comptes intermédiaires', () => {
  const economie = {
    exercice: 2025,
    resultatNet: 101_352 * M,
    resultatNetPrecedent: 101_228 * M,
    chiffreAffaires: 276_048 * M,
    chiffreAffairesPrecedent: 263_207 * M,
    capitauxPropres: 500_000 * M,
    actions: 31_111_110,
    coursJour: 30_000,
    intermediaire: lectureIntermediaire(sgbc),
  };
  const c = commenterSeance({ carnet: null, signal: null, economie });
  const eco = c.constats.filter((x) => x.origine === 'economie');

  it('ajoute un constat intermédiaire après celui de l’exercice', () => {
    expect(eco).toHaveLength(2);
    expect(eco[1].fait).toMatch(/^Sur le 1er semestre 2026, la société affiche .* \(comptes intermédiaires\)\.$/);
  });

  it('compare au même semestre de l’année précédente et valorise sur 12 mois glissants', () => {
    expect(eco[1].portee).toMatch(/Par rapport au 1er semestre 2025, le chiffre d'affaires/);
    expect(eco[1].portee).toMatch(/Sur les douze mois glissants à fin juin 2026, le résultat net atteint/);
    expect(eco[1].portee).toMatch(/fois ce résultat/);
  });

  it('déclare la limite : non audités, remplacés par l’exercice', () => {
    expect(c.limites.join(' ')).toMatch(/non audités .* remplacés par les comptes annuels/);
  });

  it('sans intermédiaire, le commentaire est inchangé', () => {
    const sans = commenterSeance({ carnet: null, signal: null, economie: { ...economie, intermediaire: null } });
    expect(sans.constats.filter((x) => x.origine === 'economie')).toHaveLength(1);
    expect(sans.limites.join(' ')).not.toMatch(/intermédiaires/);
  });
});
