import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  autoriseIngestion, corpsFin, lireCorps, traiterConfirmation, traiterDebut, traiterFin, CORPS_MAX, type DepsIngestion,
} from '@/lib/qa/ingestion';
import { traiterLectureArtefact, type ArtefactLu } from '@/lib/qa/artefacts';
import { verdictRun, DELAI_INCOMPLET_MS } from '@/lib/qa/verdict';

const SECRET = 's'.repeat(40);
const SHA = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
const meta = {
  ci_run_id: '42', ci_tentative: 1, ci_url: 'https://github.com/ebouak/brvm-analyst-pro/actions/runs/42',
  workflow: 'e2e', branche: 'main', commit_sha: SHA, environnement: 'ci' as const, base_url: 'http://localhost:3000',
};

const res = (status: string, retry = 0, extra: Record<string, unknown> = {}) =>
  ({ status, retry, duration: 500, startTime: '2026-11-03T03:00:00.000Z', errors: [], attachments: [], ...extra });
const rapport = (tests: Array<[string, string, unknown[]]>) => ({
  config: { version: '1.61.0' },
  stats: { startTime: '2026-11-03T03:00:00.000Z', duration: 60_000 },
  errors: [],
  suites: [{
    title: 'screener.spec.ts', file: 'screener.spec.ts', suites: [],
    specs: tests.map(([titre, status, results]) => ({ title: titre, file: 'screener.spec.ts', tests: [{ projectName: 'chromium', status, results }] })),
  }],
});

/**
 * Doublure en mémoire de la base. `importer` reproduit qa_importer_run :
 * une exécution close n'est jamais réimportée.
 */
function monde() {
  const runs = new Map<string, { id: string; statut: string; resultats: Array<{ statut_final: string }> }>();
  const artefacts = new Map<string, { run: string; statut: 'attendu' | 'televerse' }>();
  const stockage = new Set<string>();
  const appelsImporter: unknown[] = [];
  let enPanne = false;

  const cle = (m: { ci_run_id: string; ci_tentative: number }) => `${m.ci_run_id}-${m.ci_tentative}`;
  const deps: DepsIngestion = {
    async creerRunSiAbsent(m) {
      if (!runs.has(cle(m))) runs.set(cle(m), { id: `run-${cle(m)}`, statut: 'en_cours', resultats: [] });
    },
    async importer(charge) {
      if (enPanne) throw new Error('base indisponible');
      appelsImporter.push(charge);
      const k = cle(charge);
      if (!runs.has(k)) runs.set(k, { id: `run-${k}`, statut: 'en_cours', resultats: [] });
      const run = runs.get(k)!;
      if (run.statut !== 'en_cours') return { run_id: run.id, deja_importe: true };
      for (const r of charge.resultats as Array<{ statut_final: string; tentatives: Array<{ artefacts: Array<{ chemin: string }> }> }>) {
        run.resultats.push({ statut_final: r.statut_final });
        for (const t of r.tentatives) for (const a of t.artefacts) if (!artefacts.has(a.chemin)) artefacts.set(a.chemin, { run: run.id, statut: 'attendu' });
      }
      for (const a of charge.artefacts_run as Array<{ chemin: string }>) if (!artefacts.has(a.chemin)) artefacts.set(a.chemin, { run: run.id, statut: 'attendu' });
      run.statut = charge.statut;
      return { run_id: run.id, deja_importe: false };
    },
    async attendus(runId) {
      return [...artefacts].filter(([, a]) => a.run === runId && a.statut === 'attendu').map(([c]) => c);
    },
    async signerDepot(chemin) { return `https://stockage.test/upload/${chemin}?token=x`; },
    async purger() { return { artefacts: 0, runs: 0 }; },
    async presents(dossier) {
      return new Set([...stockage].filter((c) => c.startsWith(`${dossier}/`)).map((c) => c.slice(dossier.length + 1)));
    },
    async marquerTeleverses(chemins) {
      let n = 0;
      for (const c of chemins) { const a = artefacts.get(c); if (a?.statut === 'attendu') { a.statut = 'televerse'; n++; } }
      return n;
    },
  };
  return { deps, runs, artefacts, stockage, appelsImporter, panne: () => { enPanne = true; } };
}

const fin = (r: unknown, extra: Partial<{ issues: { build: 'success' | 'failure'; tests: 'success' | 'failure' | 'skipped' }; rapportHtml: { taille: number } | null }> = {}) =>
  ({ meta, issues: { build: 'success' as const, tests: 'success' as const }, rapport: r, rapportHtml: null, ...extra });

describe('authentification de l’ingestion', () => {
  it('refuse sans secret configuré, avec un secret trop court, ou un mauvais jeton', () => {
    expect(autoriseIngestion(undefined, `Bearer ${SECRET}`)).toBe(false);
    expect(autoriseIngestion('court', 'Bearer court')).toBe(false);
    expect(autoriseIngestion(SECRET, `Bearer ${'x'.repeat(40)}`)).toBe(false);
    expect(autoriseIngestion(SECRET, null)).toBe(false);
  });
  it('accepte le bon jeton', () => {
    expect(autoriseIngestion(SECRET, `Bearer ${SECRET}`)).toBe(true);
  });
});

describe('routes d’ingestion (vraies routes, sans base)', () => {
  beforeEach(() => { process.env.QA_INGEST_SECRET = SECRET; });

  for (const chemin of ['debut', 'fin', 'artefacts/confirmer']) {
    it(`/api/qa/ingest/${chemin} : import non authentifié refusé (401)`, async () => {
      const route = await import(`@/app/api/qa/ingest/${chemin}/route`);
      const sans = await route.POST(new Request('http://x.test', { method: 'POST', body: JSON.stringify({ meta }) }));
      expect(sans.status).toBe(401);
      const faux = await route.POST(new Request('http://x.test', { method: 'POST', headers: { authorization: `Bearer ${'y'.repeat(40)}` }, body: '{}' }));
      expect(faux.status).toBe(401);
    });
  }
});

describe('lecture du corps', () => {
  it('refuse un corps trop volumineux, illisible ou invalide', () => {
    expect(lireCorps('x'.repeat(CORPS_MAX + 1), corpsFin)).toMatchObject({ ok: false, reponse: { status: 413 } });
    expect(lireCorps('{pas du json', corpsFin)).toMatchObject({ ok: false, reponse: { status: 400 } });
    expect(lireCorps(JSON.stringify({ meta: { ...meta, commit_sha: 'zz' } }), corpsFin)).toMatchObject({ ok: false, reponse: { status: 400 } });
  });
});

describe('import', () => {
  it('import valide : résultats enregistrés, échec et intermittent distingués', async () => {
    const m = monde();
    const r = await traiterFin(fin(rapport([
      ['ok', 'expected', [res('passed')]],
      ['ko', 'unexpected', [res('failed'), res('failed', 1)]],
      ['instable', 'flaky', [res('failed'), res('passed', 1)]],
    ])), m.deps);
    expect(r.status).toBe(200);
    expect(r.corps).toMatchObject({ deja_importe: false, statut: 'termine', nb_resultats: 3 });
    expect(m.runs.get('42-1')!.resultats.map((x) => x.statut_final)).toEqual(['reussi', 'echoue', 'intermittent']);
  });

  it('import dupliqué : aucun doublon', async () => {
    const m = monde();
    const corps = fin(rapport([['ok', 'expected', [res('passed')]]]));
    await traiterFin(corps, m.deps);
    const second = await traiterFin(corps, m.deps);
    expect(second.corps).toMatchObject({ deja_importe: true });
    expect(m.runs.get('42-1')!.resultats).toHaveLength(1);
  });

  it('le chemin local des fichiers ne part jamais en base, mais revient à la CI avec une URL de dépôt', async () => {
    const m = monde();
    const r = await traiterFin(fin(rapport([
      ['ko', 'unexpected', [res('failed', 0, { attachments: [{ name: 'screenshot', contentType: 'image/png', path: '/runner/test-results/a.png' }] })]],
    ]), { rapportHtml: { taille: 10 } }), m.deps);
    expect(JSON.stringify(m.appelsImporter)).not.toContain('/runner/');
    const depots = r.corps.depots as Array<{ chemin: string; source: string; url: string }>;
    expect(depots).toHaveLength(2);
    expect(depots.map((d) => d.source).sort()).toEqual(['/runner/test-results/a.png', 'playwright-report.zip']);
  });

  it('une reprise après réponse perdue redonne les dépôts encore attendus, sans réimport', async () => {
    const m = monde();
    const corps = fin(rapport([['ko', 'unexpected', [res('failed', 0, { attachments: [{ name: 'screenshot', contentType: 'image/png', path: '/runner/a.png' }] })]]]));
    await traiterFin(corps, m.deps);
    const reprise = await traiterFin(corps, m.deps);
    expect(reprise.corps).toMatchObject({ deja_importe: true });
    expect((reprise.corps.depots as unknown[]).length).toBe(1);
  });

  it('erreur d’infrastructure : enregistrée comme telle, jamais en succès', async () => {
    const m = monde();
    const r = await traiterFin(fin(null, { issues: { build: 'failure', tests: 'skipped' } }), m.deps);
    expect(r.corps).toMatchObject({ statut: 'erreur_infra', nb_resultats: 0 });
    expect(m.runs.get('42-1')!.statut).toBe('erreur_infra');
  });

  it('absence de résultats : terminé sans scénario, que le verdict refuse d’appeler succès', async () => {
    const m = monde();
    await traiterFin(fin(rapport([])), m.deps);
    const run = { statut: 'termine' as const, debut_at: '2026-11-03T03:00:00Z', fin_at: '2026-11-03T03:01:00Z', nb_reussis: 0, nb_echoues: 0, nb_intermittents: 0, nb_ignores: 0 };
    expect(m.runs.get('42-1')!.resultats).toHaveLength(0);
    expect(verdictRun(run, new Date('2026-11-03T04:00:00Z'))).toBe('aucun_test');
  });

  it('exécution incomplète : début reçu, fin jamais reçue → « incomplet » après le délai', async () => {
    const m = monde();
    await traiterDebut({ meta }, m.deps);
    expect(m.runs.get('42-1')!.statut).toBe('en_cours');
    const debut = '2026-11-03T03:00:00Z';
    const plusTard = new Date(new Date(debut).getTime() + DELAI_INCOMPLET_MS + 1);
    expect(verdictRun({ statut: 'en_cours', debut_at: debut, fin_at: null, nb_reussis: 0, nb_echoues: 0, nb_intermittents: 0, nb_ignores: 0 }, plusTard)).toBe('incomplet');
  });

  it('base indisponible : l’import lève (la route répond 500, la CI échoue)', async () => {
    const m = monde();
    m.panne();
    await expect(traiterFin(fin(rapport([])), m.deps)).rejects.toThrow();
  });
});

describe('confirmation des pièces jointes', () => {
  it('ne confirme que les fichiers réellement présents, et du dossier de CETTE exécution', async () => {
    const m = monde();
    const r = await traiterFin(fin(rapport([
      ['ko', 'unexpected', [res('failed', 0, { attachments: [
        { name: 'screenshot', contentType: 'image/png', path: '/r/a.png' },
        { name: 'trace', contentType: 'application/zip', path: '/r/t.zip' },
      ] })]],
    ])), m.deps);
    const [capture, trace] = (r.corps.depots as Array<{ chemin: string }>).map((d) => d.chemin);
    m.stockage.add(capture); // la trace n'a jamais été envoyée
    const c = await traiterConfirmation({ meta: { ci_run_id: '42', ci_tentative: 1 }, chemins: [capture, trace, '99-1/autre.png'] }, m.deps);
    expect(c.corps).toEqual({ confirmes: 1, manquants: [trace] });
    expect(m.artefacts.get(capture)!.statut).toBe('televerse');
    expect(m.artefacts.get(trace)!.statut).toBe('attendu');
  });
});

describe('lecture admin d’une pièce jointe', () => {
  const ID = '0b6c7c1e-2a8f-4c39-9d0e-6f1a2b3c4d5e';
  const deps = (a: ArtefactLu | null) => {
    const signer = vi.fn(async (chemin: string, duree: number, nom: string | null) => `https://signe.test/${chemin}?d=${duree}&n=${nom}`);
    return { signer, deps: { lire: async () => a, signerLecture: signer } };
  };

  it('identifiant invalide ou inconnu : 404, rien n’est signé', async () => {
    const d = deps(null);
    expect(await traiterLectureArtefact('../../etc', d.deps)).toMatchObject({ status: 404 });
    expect(await traiterLectureArtefact(ID, d.deps)).toMatchObject({ status: 404 });
    expect(d.signer).not.toHaveBeenCalled();
  });

  it('rapport non reçu : indisponible (404), purgé : 410', async () => {
    expect(await traiterLectureArtefact(ID, deps({ chemin: '42-1/rapport-html.zip', type: 'rapport_html', statut: 'attendu' }).deps)).toMatchObject({ status: 404 });
    expect(await traiterLectureArtefact(ID, deps({ chemin: '42-1/a.png', type: 'capture', statut: 'purge' }).deps)).toMatchObject({ status: 410 });
  });

  it('pièce reçue : URL signée de 5 minutes ; la trace se télécharge, la capture s’affiche', async () => {
    const t = deps({ chemin: '42-1/abc-0-1.zip', type: 'trace', statut: 'televerse' });
    expect(await traiterLectureArtefact(ID, t.deps)).toMatchObject({ status: 302 });
    expect(t.signer).toHaveBeenCalledWith('42-1/abc-0-1.zip', 300, 'abc-0-1.zip');
    const c = deps({ chemin: '42-1/abc-0-0.png', type: 'capture', statut: 'televerse' });
    await traiterLectureArtefact(ID, c.deps);
    expect(c.signer).toHaveBeenCalledWith('42-1/abc-0-0.png', 300, null);
  });
});
