import { describe, it, expect } from 'vitest';
import {
  crons,
  resumerRuns,
  etatWorkflow,
  fichierWorkflow,
  ligneOpsWorkflow,
  type RunGitHub,
  type WorkflowGitHub,
} from '../src/ops/workflows.js';

const run = (p: Partial<RunGitHub> & { id: number }): RunGitHub => ({
  id: p.id,
  event: p.event ?? 'schedule',
  status: p.status ?? 'completed',
  conclusion: p.conclusion === undefined ? 'success' : p.conclusion,
  run_started_at: 'run_started_at' in p ? p.run_started_at : `2026-11-0${Math.min(9, p.id)}T10:00:00Z`,
  created_at: p.created_at ?? `2026-11-0${Math.min(9, p.id)}T10:00:00Z`,
  updated_at: p.updated_at ?? `2026-11-0${Math.min(9, p.id)}T10:05:00Z`,
  html_url: p.html_url ?? `https://github.com/ebouak/brvm-analyst-pro/actions/runs/${p.id}`,
});

describe('crons() — lecture du bloc schedule', () => {
  it('extrait plusieurs crons, dans l’ordre', () => {
    const yaml = `name: Carnet
on:
  schedule:
    - cron: '0 19 * * 1-5'
    - cron: '30 7 * * 2-6'
  workflow_dispatch:
    inputs:
      date:
        description: 'x'
jobs:
  a:
    runs-on: ubuntu-latest
`;
    expect(crons(yaml)).toEqual(['0 19 * * 1-5', '30 7 * * 2-6']);
  });

  it('workflow sans schedule → liste vide', () => {
    const yaml = `name: CI
on:
  push:
    branches: [main]
  pull_request: {}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "cron: '0 0 * * *'"
`;
    expect(crons(yaml)).toEqual([]);
  });

  it('accepte guillemets simples, doubles ou absents', () => {
    const yaml = `on:
  schedule:
    - cron: '0 6 * * 6'
    - cron: "30 16 * * 5"
    - cron: 0 8 * * *
`;
    expect(crons(yaml)).toEqual(['0 6 * * 6', '30 16 * * 5', '0 8 * * *']);
  });

  it('ignore les commentaires : en fin de ligne, entre les entrées, et les crons commentés', () => {
    const yaml = `on:
  schedule:
    # Séance BRVM ~09:00–15:00 GMT. Exemple : - cron: '1 1 * * *'
    - cron: '10,25,40,55 9-15 * * 1-5'   # ouverture
    # - cron: '0 0 * * *'
    - cron: "0 16 * * 1-5" # fermeture ~16:00 UTC

  workflow_dispatch: {}
env:
  SCRAPER_TRIGGER: \${{ github.event_name == 'schedule' && 'cron' || 'manual' }}
`;
    expect(crons(yaml)).toEqual(['10,25,40,55 9-15 * * 1-5', '0 16 * * 1-5']);
  });

  it('ne lit pas un « cron: » hors du bloc schedule', () => {
    const yaml = `on:
  schedule:
    - cron: '17 * * * *'
  workflow_dispatch: {}
jobs:
  x:
    steps:
      - cron: '9 9 9 9 9'
`;
    expect(crons(yaml)).toEqual(['17 * * * *']);
  });

  it('tolère les fins de ligne Windows', () => {
    expect(crons("on:\r\n  schedule:\r\n    - cron: '0 7 1 * *'\r\n")).toEqual(['0 7 1 * *']);
  });
});

describe('resumerRuns() — dernier run, dernier succès, échecs consécutifs', () => {
  it('aucun run', () => {
    expect(resumerRuns([])).toEqual({ dernier: null, dernierSuccesAt: null, echecsConsecutifs: 0 });
  });

  it('compte les échecs depuis le dernier succès', () => {
    const r = resumerRuns([
      run({ id: 5, conclusion: 'failure' }),
      run({ id: 4, conclusion: 'timed_out' }),
      run({ id: 3, conclusion: 'failure' }),
      run({ id: 2, conclusion: 'success', updated_at: '2026-11-02T10:05:00Z' }),
      run({ id: 1, conclusion: 'failure' }),
    ]);
    expect(r.echecsConsecutifs).toBe(3);
    expect(r.dernierSuccesAt).toBe('2026-11-02T10:05:00Z');
    expect(r.dernier?.id).toBe(5);
    expect(r.dernier?.conclusion).toBe('failure');
  });

  it('dernier run réussi → zéro échec', () => {
    const r = resumerRuns([run({ id: 2 }), run({ id: 1, conclusion: 'failure' })]);
    expect(r.echecsConsecutifs).toBe(0);
    expect(r.dernierSuccesAt).toBe('2026-11-02T10:05:00Z');
  });

  it('aucun succès dans la fenêtre : tous les échecs comptent, dernier succès inconnu', () => {
    const r = resumerRuns([run({ id: 2, conclusion: 'failure' }), run({ id: 1, conclusion: 'startup_failure' })]);
    expect(r.echecsConsecutifs).toBe(2);
    expect(r.dernierSuccesAt).toBeNull();
  });

  it('un run en cours est le dernier run, mais ne compte ni comme échec ni comme succès', () => {
    const r = resumerRuns([
      run({ id: 3, status: 'in_progress', conclusion: null, updated_at: '2026-11-03T10:01:00Z' }),
      run({ id: 2, conclusion: 'failure' }),
      run({ id: 1 }),
    ]);
    expect(r.dernier?.id).toBe(3);
    expect(r.dernier?.status).toBe('in_progress');
    expect(r.dernier?.fin).toBeNull();
    expect(r.echecsConsecutifs).toBe(1);
    expect(r.dernierSuccesAt).toBe('2026-11-01T10:05:00Z');
  });

  it('annulés et ignorés sont neutres : ils ne comptent ni ne remettent à zéro', () => {
    const r = resumerRuns([
      run({ id: 4, conclusion: 'cancelled' }),
      run({ id: 3, conclusion: 'failure' }),
      run({ id: 2, conclusion: 'skipped' }),
      run({ id: 1, conclusion: 'failure' }),
    ]);
    expect(r.echecsConsecutifs).toBe(2);
  });

  it('trie par date de création même si la réponse arrive dans le désordre', () => {
    const r = resumerRuns([
      run({ id: 1, conclusion: 'failure', created_at: '2026-11-01T10:00:00Z' }),
      run({ id: 2, conclusion: 'success', created_at: '2026-11-02T10:00:00Z' }),
    ]);
    expect(r.dernier?.id).toBe(2);
    expect(r.echecsConsecutifs).toBe(0);
  });

  it('début = run_started_at (repli created_at), fin = updated_at si terminé', () => {
    const r = resumerRuns([
      run({ id: 7, run_started_at: null, created_at: '2026-11-03T08:00:00Z', updated_at: '2026-11-03T08:02:00Z' }),
    ]);
    expect(r.dernier?.debut).toBe('2026-11-03T08:00:00Z');
    expect(r.dernier?.fin).toBe('2026-11-03T08:02:00Z');
  });
});

describe('état et identifiant du workflow', () => {
  it('états GitHub conservés, inconnus → autre', () => {
    expect(etatWorkflow('active')).toBe('active');
    expect(etatWorkflow('disabled_inactivity')).toBe('disabled_inactivity');
    expect(etatWorkflow('disabled_manually')).toBe('disabled_manually');
    expect(etatWorkflow('deleted')).toBe('deleted');
    expect(etatWorkflow('disabled_fork')).toBe('autre');
  });

  it('fichier = nom sous .github/workflows/, sinon le chemin tel quel', () => {
    expect(fichierWorkflow('.github/workflows/alerts.yml')).toBe('alerts.yml');
    expect(fichierWorkflow('dynamic/dependabot/dependabot-updates')).toBe('dynamic/dependabot/dependabot-updates');
  });

  it('ligne d’un workflow désactivé pour inactivité, sans run', () => {
    const wf: WorkflowGitHub = { id: 1, name: 'Hebdo', path: '.github/workflows/hebdo.yml', state: 'disabled_inactivity' };
    const l = ligneOpsWorkflow(wf, ['0 6 * * 6'], resumerRuns([]), '2026-11-03T12:17:00Z');
    expect(l).toEqual({
      fichier: 'hebdo.yml',
      nom: 'Hebdo',
      etat: 'disabled_inactivity',
      crons: ['0 6 * * 6'],
      dernier_run_id: null,
      dernier_evenement: null,
      dernier_statut: null,
      derniere_conclusion: null,
      dernier_debut: null,
      derniere_fin: null,
      dernier_url: null,
      dernier_succes_at: null,
      echecs_consecutifs: 0,
      collecte_at: '2026-11-03T12:17:00Z',
    });
  });

  it('une URL hors github.com n’est pas recopiée (contrainte de la table)', () => {
    const wf: WorkflowGitHub = { id: 1, name: 'A', path: '.github/workflows/a.yml', state: 'active' };
    const l = ligneOpsWorkflow(wf, [], resumerRuns([run({ id: 1, html_url: 'https://evil.example/x' })]), '2026-11-03T12:17:00Z');
    expect(l.dernier_url).toBeNull();
    expect(l.dernier_run_id).toBe(1);
  });
});
