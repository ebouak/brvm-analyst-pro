import { z } from 'zod';
import { autorise } from '@/lib/crm/passageSequences';
import { normaliserImport, schemaIssues, schemaMeta, type ImportRun } from './normaliser';

/**
 * Ingestion des résultats Playwright envoyés par la CI.
 *
 * La CI n'a PAS la clé service_role : le job compile toute l'application et
 * exécute du code npm tiers. Elle présente un secret dédié, QA_INGEST_SECRET,
 * qui ne permet que d'écrire des résultats de test. Les pièces jointes partent
 * directement vers le bucket privé par des URL de dépôt signées, une par
 * fichier, délivrées ici.
 *
 * Logique isolée des I/O (dépendances injectées) : les routes ne font que
 * brancher Supabase.
 */

/** Taille maximale d'un corps d'ingestion (le rapport JSON d'une suite e2e pèse quelques centaines de ko). */
export const CORPS_MAX = 3_500_000;
const CHEMIN = /^[0-9]{1,20}-[0-9]{1,3}\/[A-Za-z0-9._-]{1,120}$/;

/** Secret absent ou trop court : on refuse tout, plutôt qu'un mur gardé par « test ». */
export function autoriseIngestion(secret: string | undefined, enTete: string | null): boolean {
  if (!secret || secret.length < 32) return false;
  return autorise(secret, enTete);
}

export const corpsDebut = z.object({ meta: schemaMeta });
export const corpsFin = z.object({
  meta: schemaMeta,
  issues: schemaIssues,
  rapport: z.unknown(),
  rapportHtml: z.object({ taille: z.number().int().min(1).max(52_428_800) }).nullable(),
});
export const corpsConfirmer = z.object({
  meta: schemaMeta.pick({ ci_run_id: true, ci_tentative: true }),
  chemins: z.array(z.string().regex(CHEMIN)).max(100),
});

export interface DepsIngestion {
  creerRunSiAbsent(meta: z.infer<typeof schemaMeta>): Promise<void>;
  /** Appelle qa_importer_run (atomique, idempotente). */
  importer(charge: Omit<ImportRun, 'resultats' | 'artefacts_run'> & { resultats: unknown[]; artefacts_run: unknown[] }): Promise<{ run_id: string; deja_importe: boolean }>;
  /** Pièces jointes déclarées mais pas encore reçues pour cette exécution. */
  attendus(runId: string): Promise<string[]>;
  signerDepot(chemin: string): Promise<string>;
  /** Purge des pièces jointes > 30 j et des exécutions > 180 j. */
  purger(): Promise<{ artefacts: number; runs: number }>;
  /** Noms des objets présents dans le dossier de l'exécution. */
  presents(dossier: string): Promise<Set<string>>;
  marquerTeleverses(chemins: string[]): Promise<number>;
}

export interface Reponse {
  status: number;
  corps: Record<string, unknown>;
}

const refus = (status: number, error: string): Reponse => ({ status, corps: { error } });

/** Lit et valide un corps JSON borné. */
export function lireCorps<T>(texte: string, schema: z.ZodType<T>): { ok: true; valeur: T } | { ok: false; reponse: Reponse } {
  if (texte.length > CORPS_MAX) return { ok: false, reponse: refus(413, 'Corps trop volumineux') };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, reponse: refus(400, 'JSON illisible') };
  }
  const lu = schema.safeParse(brut);
  if (!lu.success) return { ok: false, reponse: refus(400, 'Corps invalide') };
  return { ok: true, valeur: lu.data };
}

export async function traiterDebut(corps: z.infer<typeof corpsDebut>, deps: DepsIngestion): Promise<Reponse> {
  await deps.creerRunSiAbsent(corps.meta);
  return { status: 200, corps: { ok: true } };
}

export async function traiterFin(corps: z.infer<typeof corpsFin>, deps: DepsIngestion): Promise<Reponse> {
  let charge: ImportRun;
  try {
    charge = normaliserImport({ ...corps, rapport: corps.rapport ?? null });
  } catch {
    return refus(400, 'Métadonnées CI invalides');
  }

  // Le chemin local d'un fichier sur le runner ne va jamais en base : il ne
  // sert qu'à dire à la CI quel fichier envoyer vers quelle URL.
  const sources = new Map<string, string>();
  const sansSource = <T extends { source: string; chemin: string }>(a: T) => {
    sources.set(a.chemin, a.source);
    const { source: _s, ...reste } = a;
    return reste;
  };
  const resultats = charge.resultats.map((r) => ({
    ...r,
    tentatives: r.tentatives.map((t) => ({ ...t, artefacts: t.artefacts.map(sansSource) })),
  }));
  const artefacts_run = charge.artefacts_run.map(sansSource);

  const { run_id, deja_importe } = await deps.importer({ ...charge, resultats, artefacts_run });

  // Reprise : si la réponse précédente s'est perdue, la CI redemande et reçoit
  // les dépôts encore attendus, sans réimport.
  const depots: Array<{ chemin: string; source: string; url: string }> = [];
  let depotsEnEchec = 0;
  for (const chemin of await deps.attendus(run_id)) {
    const source = sources.get(chemin);
    if (!source) continue;
    try {
      depots.push({ chemin, source, url: await deps.signerDepot(chemin) });
    } catch {
      depotsEnEchec++;
    }
  }

  let purge: { artefacts: number; runs: number } | 'echec';
  try {
    purge = await deps.purger();
  } catch {
    purge = 'echec';
  }

  return {
    status: 200,
    corps: { run_id, deja_importe, statut: charge.statut, nb_resultats: charge.resultats.length, depots, depots_en_echec: depotsEnEchec, purge },
  };
}

export async function traiterConfirmation(corps: z.infer<typeof corpsConfirmer>, deps: DepsIngestion): Promise<Reponse> {
  const dossier = `${corps.meta.ci_run_id}-${corps.meta.ci_tentative}`;
  // Un chemin hors du dossier de CETTE exécution n'est pas confirmable par elle.
  const demandes = corps.chemins.filter((c) => c.startsWith(`${dossier}/`));
  if (demandes.length === 0) return { status: 200, corps: { confirmes: 0, manquants: [] } };
  const presents = await deps.presents(dossier);
  const recus = demandes.filter((c) => presents.has(c.slice(dossier.length + 1)));
  const manquants = demandes.filter((c) => !recus.includes(c));
  const confirmes = recus.length ? await deps.marquerTeleverses(recus) : 0;
  return { status: 200, corps: { confirmes, manquants } };
}
