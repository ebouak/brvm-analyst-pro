import { describe, it, expect } from 'vitest';
import { normaliserImport, type EntreeImport } from './normaliser';

const SHA = '0123456789abcdef0123456789abcdef01234567';

const meta = {
  ci_run_id: '19000000001',
  ci_tentative: 1,
  ci_url: 'https://github.com/ebouak/brvm-analyst-pro/actions/runs/19000000001',
  workflow: 'Tests e2e (Playwright)',
  branche: 'main',
  commit_sha: SHA,
  environnement: 'ci' as const,
  base_url: 'http://localhost:3000',
};

/** Résultat Playwright minimal (format du rapporteur JSON 1.61). */
function resultat(status: string, retry = 0, extra: Record<string, unknown> = {}) {
  return { status, retry, duration: 1200, startTime: '2026-11-03T03:01:00.000Z', errors: [], attachments: [], ...extra };
}

function rapport(tests: Array<{ file: string; titre: string; status: string; results: unknown[]; describe?: string }>, extra: Record<string, unknown> = {}) {
  return {
    config: { version: '1.61.0' },
    stats: { startTime: '2026-11-03T03:00:00.000Z', duration: 90_000, expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
    errors: [],
    suites: tests.map((t) => {
      const spec = { title: t.titre, file: t.file, tests: [{ projectName: 'chromium', expectedStatus: 'passed', status: t.status, results: t.results }] };
      return t.describe
        ? { title: t.file, file: t.file, specs: [], suites: [{ title: t.describe, file: t.file, specs: [spec], suites: [] }] }
        : { title: t.file, file: t.file, specs: [spec], suites: [] };
    }),
    ...extra,
  };
}

const ok = (r: unknown): EntreeImport => ({ meta, issues: { build: 'success', tests: 'success' }, rapport: r, rapportHtml: null });

describe('normaliserImport', () => {
  it('importe un passage valide avec statut final et tentatives', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'screener.spec.ts', titre: 'redirige un visiteur', status: 'expected', results: [resultat('passed')] },
    ])));
    expect(sortie.statut).toBe('termine');
    expect(sortie.playwright_version).toBe('1.61.0');
    expect(sortie.debut_at).toBe('2026-11-03T03:00:00.000Z');
    expect(sortie.duree_ms).toBe(90_000);
    expect(sortie.resultats).toHaveLength(1);
    const [r] = sortie.resultats;
    expect(r.module).toBe('screener');
    expect(r.statut_final).toBe('reussi');
    expect(r.test_cle).toMatch(/^[0-9a-f]{64}$/);
    expect(r.tentatives).toEqual([
      expect.objectContaining({ numero: 0, statut: 'passed', duree_ms: 1200, erreur: null }),
    ]);
  });

  it('distingue échec, intermittent et ignoré', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'a.spec.ts', titre: 'échoue', status: 'unexpected', results: [resultat('failed'), resultat('failed', 1)] },
      { file: 'a.spec.ts', titre: 'flanche', status: 'flaky', results: [resultat('failed'), resultat('passed', 1)] },
      { file: 'a.spec.ts', titre: 'sauté', status: 'skipped', results: [resultat('skipped')] },
    ])));
    expect(sortie.resultats.map((r) => r.statut_final)).toEqual(['echoue', 'intermittent', 'ignore']);
    expect(sortie.resultats[1].tentatives.map((t) => t.statut)).toEqual(['failed', 'passed']);
  });

  it('nettoie l’erreur d’une tentative', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'a.spec.ts', titre: 't', status: 'unexpected', results: [resultat('failed', 0, { errors: [{ message: '\u001b[31mBearer abc123\u001b[39m introuvable' }] })] },
    ])));
    expect(sortie.resultats[0].tentatives[0].erreur).toBe('Bearer [masqué] introuvable');
  });

  it('inclut le describe dans le titre', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'screener.spec.ts', describe: 'Premium', titre: 'filtre', status: 'expected', results: [resultat('passed')] },
    ])));
    expect(sortie.resultats[0].titre).toBe('Premium › filtre');
  });

  it('ne produit jamais deux fois la même clé', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'a.spec.ts', titre: 'même', status: 'expected', results: [resultat('passed')] },
      { file: 'a.spec.ts', titre: 'même', status: 'expected', results: [resultat('passed')] },
    ])));
    const cles = sortie.resultats.map((r) => r.test_cle);
    expect(new Set(cles).size).toBe(2);
  });

  it('une tentative interrompue rend l’exécution interrompue', () => {
    const sortie = normaliserImport(ok(rapport([
      { file: 'a.spec.ts', titre: 't', status: 'unexpected', results: [resultat('interrupted')] },
    ])));
    expect(sortie.statut).toBe('interrompu');
  });

  it('build en échec : erreur d’infrastructure, même avec un rapport', () => {
    const sortie = normaliserImport({ ...ok(rapport([])), issues: { build: 'failure', tests: 'skipped' } });
    expect(sortie.statut).toBe('erreur_infra');
    expect(sortie.motif).toMatch(/build/i);
    expect(sortie.resultats).toEqual([]);
  });

  it('rapport absent : erreur d’infrastructure, jamais un succès', () => {
    const sortie = normaliserImport({ ...ok(null), issues: { build: 'success', tests: 'failure' } });
    expect(sortie.statut).toBe('erreur_infra');
    expect(sortie.motif).toMatch(/rapport/i);
  });

  it('rapport illisible : erreur d’infrastructure', () => {
    const sortie = normaliserImport(ok({ pas: 'un rapport' }));
    expect(sortie.statut).toBe('erreur_infra');
  });

  it('erreur hors scénario (serveur web, global setup) : erreur d’infrastructure, résultats conservés', () => {
    const sortie = normaliserImport(ok(rapport(
      [{ file: 'a.spec.ts', titre: 't', status: 'expected', results: [resultat('passed')] }],
      { errors: [{ message: 'Timed out waiting 120000ms from config.webServer. token=abc' }] },
    )));
    expect(sortie.statut).toBe('erreur_infra');
    expect(sortie.motif).toContain('token=[masqué]');
    expect(sortie.resultats).toHaveLength(1);
  });

  it('navigateur introuvable : erreur d’infrastructure, pas une régression du produit', () => {
    // Message réel de Playwright 1.61 quand le navigateur n'est pas installé (constaté le 2026-11-03).
    const message = "Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1228/chrome";
    const sortie = normaliserImport(ok(rapport([
      { file: 'a.spec.ts', titre: 't', status: 'unexpected', results: [resultat('failed', 0, { errors: [{ message }] })] },
    ])));
    expect(sortie.statut).toBe('erreur_infra');
    expect(sortie.motif).toMatch(/navigateur/i);
    expect(sortie.resultats).toHaveLength(1);
  });

  it('aucun test : terminé, sans résultat (le verdict dira « aucun test »)', () => {
    const sortie = normaliserImport(ok(rapport([])));
    expect(sortie.statut).toBe('termine');
    expect(sortie.resultats).toEqual([]);
  });

  it('référence les pièces jointes connues, sous le dossier de l’exécution', () => {
    const sortie = normaliserImport({
      ...ok(rapport([
        { file: 'a.spec.ts', titre: 't', status: 'unexpected', results: [resultat('failed', 0, { attachments: [
          { name: 'screenshot', contentType: 'image/png', path: '/home/runner/work/x/frontend/test-results/a/test-failed-1.png' },
          { name: 'trace', contentType: 'application/zip', path: '/home/runner/work/x/frontend/test-results/a/trace.zip' },
          { name: 'stdout', contentType: 'text/plain', body: 'secret' },
        ] })] },
      ])),
      rapportHtml: { taille: 2048 },
    });
    const pieces = sortie.resultats[0].tentatives[0].artefacts;
    expect(pieces.map((p) => p.type)).toEqual(['capture', 'trace']);
    for (const p of pieces) expect(p.chemin).toMatch(/^19000000001-1\/[A-Za-z0-9._-]+$/);
    expect(pieces[0].source).toContain('test-failed-1.png');
    expect(sortie.artefacts_run).toEqual([
      expect.objectContaining({ type: 'rapport_html', chemin: '19000000001-1/rapport-html.zip', content_type: 'application/zip' }),
    ]);
  });

  it('refuse des métadonnées CI invalides', () => {
    expect(() => normaliserImport({ ...ok(null), meta: { ...meta, commit_sha: 'pas-un-sha' } })).toThrow();
    expect(() => normaliserImport({ ...ok(null), meta: { ...meta, ci_url: 'https://evil.test/x' } })).toThrow();
  });
});
