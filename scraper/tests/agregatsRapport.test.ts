import { describe, expect, it } from 'vitest';
import { construireRapport, rapportTexte, type DocumentRapport } from '../src/agregats/rapport.js';
import { messageFile } from '../src/agregats/alerte.js';
import type { PlanEcritures } from '../src/agregats/ecritures.js';
import type { ObservationNouvelle } from '../src/agregats/normaliser.js';

const obs = (p: Partial<ObservationNouvelle>) => ({ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', statut: 'publie', controle: 'ok', ...p }) as ObservationNouvelle;
const docs: DocumentRapport[] = [
  { code: 'SGBC', libelle: 'S1 2026', url: 'u1', periode: '2026-S1', etat: 'lu', erreur: null },
  { code: 'SGBC', libelle: 'S1 2025', url: 'u2', periode: '2025-S1', etat: 'echec', erreur: 'Gemini HTTP 500' },
];
const plan: PlanEcritures = {
  misesAJour: [], orphelins: ['SGBC|income_statements|T1|2026-03-31'],
  decisions: [{ code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', decision: 'retenue', avant: null, apres: 1 }],
  relectures: [{ code: 'SGBC', indicateur: 'cout_du_risque', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel', raison: 'contradiction', detail: 'x', observations: ['a', 'b'] }],
};

describe('rapport de reprise', () => {
  const r = construireRapport('2026-11-15T10:00:00Z', docs, [obs({}), obs({ indicateur: 'cout_du_risque', statut: 'non_trouve' }), obs({ indicateur: 'charges_exploitation', controle: 'a_relire' })], plan);
  it('compte trouvées, non trouvées, bloquées, contradictions et échecs', () => {
    expect(r.totaux).toEqual({ documents: 2, lus: 1, echecs: 1, trouvees: 2, non_trouvees: 1, bloquees: 1, contradictions: 1, retenues: 1, orphelins: 1 });
    expect(r.synthese).toEqual([{ code: 'SGBC', periode: 'S1 2026-06-30', trouvees: 2, non_trouvees: 1, bloquees: 1, contradictions: 1, retenues: 1 }]);
  });
  it('garde les observations pour l’écriture depuis le rapport', () => {
    expect(r.observations).toHaveLength(3);
  });
  it('le texte nomme les échecs et dit qu’il n’a rien écrit', () => {
    const t = rapportTexte(r);
    expect(t).toContain('Gemini HTTP 500');
    expect(t).toMatch(/rien n’a été écrit/i);
  });
  it('les avertissements (base sans 0245, par exemple) figurent en tête', () => {
    const avec = construireRapport('2026-11-15T10:00:00Z', docs, [], plan, ['migration 0245 non appliquée']);
    expect(avec.avertissements).toEqual(['migration 0245 non appliquée']);
    expect(rapportTexte(avec)).toContain('migration 0245 non appliquée');
    expect(r.avertissements).toEqual([]);
  });
});

describe('messageFile', () => {
  it('rien à relire → aucun message', () => {
    expect(messageFile([])).toBeNull();
  });
  it('compte par valeur, sans donnée personnelle', () => {
    const m = messageFile([{ code: 'SGBC' }, { code: 'SGBC' }, { code: 'SIBC' }])!;
    expect(m.subject).toContain('3');
    expect(m.body).toContain('SGBC (2)');
    expect(m.body).toContain('/admin/agregats');
  });
});
