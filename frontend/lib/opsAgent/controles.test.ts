import { describe, it, expect } from 'vitest';
import {
  echapperHtmlPur,
  formaterBocHtml,
  formaterCoherenceHtml,
  formaterTourHtml,
} from './formatters';
import type { Signal } from '@/lib/controle/types';

describe('opsAgent formatters', () => {
  it('échappe correctement les chevrons HTML et esperluettes', () => {
    expect(echapperHtmlPur('<script> & "test"')).toBe('&lt;script&gt; &amp; "test"');
  });

  it('formate la Tour de contrôle avec alertes et cas sain', () => {
    const okSignals: Signal[] = [
      { id: 't1', domaine: 'donnees', titre: 'Cours', niveau: 'ok', detail: 'À jour' },
    ];
    expect(formaterTourHtml(okSignals, '2026-11-26T18:00:00Z')).toContain('TOUT EST À JOUR');

    const alertSignals: Signal[] = [
      { id: 't2', domaine: 'envois', titre: 'Alertes <email>', niveau: 'alerte', detail: '0 envoyé' },
    ];
    const html = formaterTourHtml(alertSignals, '2026-11-26T18:00:00Z');
    expect(html).toContain('ALERTE');
    expect(html).toContain('Alertes &lt;email&gt;');
  });

  it('formate le contrôle BOC vide et avec écart', () => {
    expect(formaterBocHtml([])).toContain('Aucune cote officielle');
    const html = formaterBocHtml([
      {
        code: 'SNTS',
        date_marche: '2026-11-25',
        statut: 'cote',
        cours_cloture: 24000,
        cours_reference: 24000,
        per: { site: 12.5, boc: 10.0, ecart: 0.25, etat: 'ecart' },
        rendement: { site: 6.1, boc: 6.1, ecart: 0, etat: 'concordant' },
      } as never,
    ]);
    expect(html).toContain('SNTS');
    expect(html).toContain('Écarts PER');
  });

  it('formate la cohérence des fiches', () => {
    const html = formaterCoherenceHtml({
      etat: 'balaye',
      anomalies: [
        {
          id: 1,
          code: 'SGBC',
          regle: 'notation_perimee',
          gravite: 'trompeuse',
          message: 'Notation antérieure',
          preuve: null,
          detectee_le: '2026-11-25',
        },
      ],
      dernierBalayage: '2026-11-25',
      dernierPassage: null,
      kpis: { trompeuses: 1, aSurveiller: 0, valeursConcernees: 1 },
      erreurMessage: null,
    });
    expect(html).toContain('SGBC');
    expect(html).toContain('Trompeuses ouvertes : <b>1</b>');
  });
});
