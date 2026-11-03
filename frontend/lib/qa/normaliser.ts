import { createHash } from 'node:crypto';
import { z } from 'zod';
import { nettoyerErreur } from './nettoyer';

/**
 * Rapport JSON de Playwright (+ métadonnées CI) → charge d'import pour la
 * fonction SQL qa_importer_run. Pur, testé.
 *
 * Le rapport vient de la CI : on n'en garde que ce qu'on sait lire, on nettoie
 * les erreurs, et on ne transforme JAMAIS une panne en succès :
 *   - build en échec               → erreur_infra, aucun résultat ;
 *   - rapport absent ou illisible  → erreur_infra (le runner a pu s'arrêter) ;
 *   - erreur hors scénario         → erreur_infra, résultats conservés ;
 *   - tentative interrompue        → interrompu.
 * stdout, stderr et corps des pièces jointes ne sont jamais repris.
 */

const ISSUE = z.enum(['success', 'failure', 'cancelled', 'skipped']);

export const schemaMeta = z.object({
  ci_run_id: z.string().regex(/^[0-9]{1,20}$/),
  ci_tentative: z.number().int().min(1).max(100),
  ci_url: z.string().startsWith('https://github.com/').max(300),
  workflow: z.string().max(200).nullable().optional(),
  branche: z.string().max(200).nullable().optional(),
  commit_sha: z.string().regex(/^[0-9a-f]{40}$/),
  environnement: z.enum(['ci', 'preview', 'production']),
  base_url: z.string().max(300).nullable().optional(),
});
export type MetaCi = z.infer<typeof schemaMeta>;

export const schemaIssues = z.object({ build: ISSUE, tests: ISSUE });

export interface EntreeImport {
  meta: MetaCi;
  issues: z.infer<typeof schemaIssues>;
  rapport: unknown;
  /** Rapport HTML zippé par la CI, s'il existe. */
  rapportHtml: { taille: number } | null;
}

export type StatutFinal = 'reussi' | 'echoue' | 'intermittent' | 'ignore';
export type TypeArtefact = 'capture' | 'trace' | 'video' | 'rapport_html';

export interface ArtefactImport {
  type: TypeArtefact;
  chemin: string;
  content_type: string;
  /** Chemin du fichier sur le runner : sert à la CI pour savoir quoi envoyer, jamais stocké. */
  source: string;
}

export interface TentativeImport {
  numero: number;
  statut: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  debut_at: string | null;
  duree_ms: number | null;
  erreur: string | null;
  artefacts: ArtefactImport[];
}

export interface ResultatImport {
  test_cle: string;
  module: string;
  fichier: string;
  titre: string;
  projet: string | null;
  statut_final: StatutFinal;
  duree_ms: number;
  tentatives: TentativeImport[];
}

export interface ImportRun extends MetaCi {
  statut: 'termine' | 'interrompu' | 'erreur_infra';
  motif: string | null;
  debut_at: string;
  fin_at: string;
  duree_ms: number | null;
  playwright_version: string | null;
  resultats: ResultatImport[];
  artefacts_run: ArtefactImport[];
}

/** Plafond de pièces jointes par exécution : une suite qui s'emballe ne remplit pas le stockage. */
export const MAX_ARTEFACTS = 60;
const NAVIGATEUR_ABSENT = /browserType\.launch: Executable doesn't exist/;

const piece = z.object({ name: z.string(), contentType: z.string(), path: z.string().optional() }).passthrough();
const resultatPw = z.object({
  status: z.enum(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']),
  retry: z.number().int().min(0),
  duration: z.number().min(0).optional(),
  startTime: z.string().optional(),
  errors: z.array(z.object({ message: z.string().optional(), value: z.string().optional() }).passthrough()).optional(),
  attachments: z.array(piece).optional(),
}).passthrough();
const testPw = z.object({
  projectName: z.string().optional(),
  expectedStatus: z.string().optional(),
  status: z.enum(['expected', 'unexpected', 'flaky', 'skipped']),
  results: z.array(resultatPw),
}).passthrough();
const specPw = z.object({ title: z.string(), file: z.string().optional(), tests: z.array(testPw) }).passthrough();
type SuitePw = { title: string; file?: string; specs?: z.infer<typeof specPw>[]; suites?: SuitePw[] };
const suitePw: z.ZodType<SuitePw> = z.lazy(() =>
  z.object({ title: z.string(), file: z.string().optional(), specs: z.array(specPw).optional(), suites: z.array(suitePw).optional() }).passthrough(),
);
const rapportPw = z.object({
  config: z.object({ version: z.string().optional() }).passthrough().optional(),
  stats: z.object({ startTime: z.string().optional(), duration: z.number().optional() }).passthrough().optional(),
  errors: z.array(z.object({ message: z.string().optional(), value: z.string().optional() }).passthrough()).optional(),
  suites: z.array(suitePw),
}).passthrough();

function texteErreurs(erreurs: Array<{ message?: string; value?: string }> | undefined): string | null {
  const brut = (erreurs ?? []).map((e) => e.message ?? e.value ?? '').filter(Boolean).join('\n\n');
  return nettoyerErreur(brut);
}

export function moduleDe(fichier: string): string {
  const normalise = fichier.replace(/\\/g, '/').replace(/^\.?\/?(e2e\/)?/, '');
  const tete = normalise.includes('/') ? normalise.split('/')[0] : normalise.replace(/\.(spec|test)\.[cm]?[jt]sx?$/, '');
  const m = tete.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return m || 'autre';
}

function statutFinal(t: z.infer<typeof testPw>): StatutFinal {
  if (t.status === 'unexpected') return 'echoue';
  if (t.status === 'flaky') return 'intermittent';
  if (t.status === 'skipped') return 'ignore';
  // « expected » couvre aussi un test.skip() attendu : sans essai réel, ce n'est pas une réussite.
  if (t.expectedStatus === 'skipped' || t.results.every((r) => r.status === 'skipped')) return 'ignore';
  return 'reussi';
}

function typeDe(p: z.infer<typeof piece>): { type: TypeArtefact; ext: string } | null {
  if (!p.path) return null;
  if (p.contentType === 'image/png') return { type: 'capture', ext: 'png' };
  if (p.name === 'trace' && p.contentType === 'application/zip') return { type: 'trace', ext: 'zip' };
  if (p.contentType === 'video/webm') return { type: 'video', ext: 'webm' };
  return null;
}

export function normaliserImport(entree: EntreeImport): ImportRun {
  const meta = schemaMeta.parse(entree.meta);
  const issues = schemaIssues.parse(entree.issues);
  const maintenant = new Date().toISOString();
  const dossier = `${meta.ci_run_id}-${meta.ci_tentative}`;

  const vide = (motif: string): ImportRun => ({
    ...meta, statut: 'erreur_infra', motif, debut_at: maintenant, fin_at: maintenant,
    duree_ms: null, playwright_version: null, resultats: [], artefacts_run: [],
  });

  if (issues.build !== 'success') return vide("Build en échec : aucun test n'a pu être lancé.");
  const lu = rapportPw.safeParse(entree.rapport);
  if (!lu.success) return vide("Rapport Playwright absent ou illisible : le runner a pu s'arrêter avant de l'écrire.");
  const rapport = lu.data;

  const resultats: ResultatImport[] = [];
  const clesVues = new Map<string, number>();
  let nbArtefacts = 0;
  let interrompu = false;

  const parcourir = (suite: SuitePw, chemin: string[], racine: boolean) => {
    const titres = racine ? chemin : [...chemin, suite.title];
    for (const spec of suite.specs ?? []) {
      const fichier = spec.file ?? suite.file ?? suite.title;
      const titre = [...titres, spec.title].join(' › ').slice(0, 500);
      for (const t of spec.tests) {
        const projet = t.projectName ?? null;
        const base = `${fichier}\u0000${titre}\u0000${projet ?? ''}`;
        const n = clesVues.get(base) ?? 0;
        clesVues.set(base, n + 1);
        const test_cle = createHash('sha256').update(n === 0 ? base : `${base}\u0000${n}`).digest('hex');

        const tentatives: TentativeImport[] = t.results.map((r) => {
          if (r.status === 'interrupted') interrompu = true;
          const artefacts: ArtefactImport[] = [];
          (r.attachments ?? []).forEach((p, i) => {
            const genre = typeDe(p);
            if (!genre || nbArtefacts >= MAX_ARTEFACTS) return;
            nbArtefacts++;
            artefacts.push({
              type: genre.type,
              chemin: `${dossier}/${test_cle.slice(0, 16)}-${r.retry}-${i}.${genre.ext}`,
              content_type: p.contentType,
              source: p.path!,
            });
          });
          return {
            numero: r.retry,
            statut: r.status,
            debut_at: r.startTime ?? null,
            duree_ms: r.duration != null ? Math.round(r.duration) : null,
            erreur: texteErreurs(r.errors),
            artefacts,
          };
        });

        resultats.push({
          test_cle,
          module: moduleDe(fichier),
          fichier,
          titre,
          projet,
          statut_final: statutFinal(t),
          duree_ms: tentatives.reduce((s, x) => s + (x.duree_ms ?? 0), 0),
          tentatives,
        });
      }
    }
    for (const sous of suite.suites ?? []) parcourir(sous, titres, false);
  };
  for (const suite of rapport.suites) parcourir(suite, [], true);

  // Un navigateur absent fait échouer chaque scénario un par un : c'est une
  // panne de l'environnement, pas une régression du produit (constaté le
  // 2026-11-03 : 3 « échecs » qui n'avaient rien à voir avec le code testé).
  const navigateurAbsent = resultats.some((r) =>
    r.tentatives.some((t) => t.erreur != null && NAVIGATEUR_ABSENT.test(t.erreur)),
  );
  const horsScenario =
    texteErreurs(rapport.errors) ??
    (navigateurAbsent ? 'Navigateur Playwright introuvable sur le runner (playwright install non exécuté ?).' : null);
  const debut = rapport.stats?.startTime ?? maintenant;
  const duree = rapport.stats?.duration != null ? Math.round(rapport.stats.duration) : null;
  const fin = duree != null ? new Date(new Date(debut).getTime() + duree).toISOString() : maintenant;

  return {
    ...meta,
    statut: horsScenario ? 'erreur_infra' : interrompu ? 'interrompu' : 'termine',
    motif: horsScenario ? `Erreur hors scénario : ${horsScenario}`.slice(0, 500) : null,
    debut_at: debut,
    fin_at: fin,
    duree_ms: duree,
    playwright_version: rapport.config?.version ?? null,
    resultats,
    artefacts_run: entree.rapportHtml
      ? [{ type: 'rapport_html', chemin: `${dossier}/rapport-html.zip`, content_type: 'application/zip', source: 'playwright-report.zip' }]
      : [],
  };
}
