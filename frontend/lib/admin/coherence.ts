import { getServiceClient } from '@/lib/billing/serviceClient';
import type { RegleCode } from '@/lib/coherence/regles';

/**
 * Couche de données de `/admin/coherence` — lit `coherence_anomalies`
 * (migration 0141_coherence_et_flag_lecture_seance.sql) via le client
 * service-role. La table n'a AUCUNE policy de lecture pour `anon` ni
 * `authenticated` (voir l'en-tête de la migration) : tout accès passe donc
 * forcément par ici, côté serveur, jamais depuis le navigateur.
 */

export type GraviteAnomalie = 'trompeuse' | 'a_surveiller';

export interface AnomalieOuverte {
  id: number;
  code: string;
  regle: RegleCode;
  gravite: GraviteAnomalie;
  message: string;
  /**
   * `unknown`, et non le `Record<string, string | number | null>` que
   * `lib/coherence/regles.ts` donne à l'écriture : la colonne jsonb n'a
   * aucune contrainte de forme en base (`preuve jsonb`, sans `check`), donc
   * rien ne garantit qu'une ligne plus ancienne ou écrite autrement la
   * respecte encore. La typer plus précisément qu'elle ne l'est réellement
   * serait affirmer une garantie que le schéma ne tient pas.
   */
  preuve: unknown;
  detectee_le: string;
}

/**
 * État du balayage hebdomadaire.
 *
 * La preuve d'un passage vient de `scraper_runs` : la commande `coherence` est
 * enveloppée dans `withMonitoring` (scraper/src/index.ts), qui journalise
 * CHAQUE exécution, propre ou non. `coherence_anomalies` sert de preuve de
 * repli — une anomalie n'a pas pu s'écrire toute seule — mais elle ne suffit
 * pas : un passage sans anomalie n'y laisse rien.
 *
 *  - `table_absente`  la migration 0141 n'est pas encore appliquée ;
 *  - `erreur`         la lecture a échoué pour une autre raison (réseau,
 *                      droits…) — CE N'EST PAS une preuve d'absence
 *                      d'anomalie, à ne surtout pas confondre avec `balaye` ;
 *  - `jamais_balaye`  ni passage journalisé dans `scraper_runs`, ni aucune
 *                      ligne d'anomalie : rien ne prouve que le balayage ait
 *                      jamais tourné. La page le DIT, au lieu d'afficher un
 *                      satisfecit — une absence de mesure n'est pas une
 *                      absence de problème ;
 *  - `balaye`         un passage est attesté — par `scraper_runs` (date
 *                      exacte, y compris pour un passage propre) ou, à
 *                      défaut, par l'existence d'une anomalie.
 *
 * C'est cette distinction `jamais_balaye` / `balaye` (avec zéro anomalie
 * ouverte) qui évite de faire passer une absence de mesure pour un
 * satisfecit — voir la page.
 */
export type EtatBalayage = 'table_absente' | 'erreur' | 'jamais_balaye' | 'balaye';

export interface TableauCoherence {
  etat: EtatBalayage;
  /** Anomalies actuellement ouvertes (`resolue_le is null`), triées par date de détection décroissante. */
  anomalies: AnomalieOuverte[];
  /**
   * `detectee_le` la plus récente toutes lignes confondues (ouvertes +
   * résolues) — date de la DERNIÈRE ANOMALIE DÉTECTÉE, pas nécessairement du
   * dernier passage du balayage : un passage qui ne trouve rien n'écrit rien
   * (voir `EtatBalayage`), donc un passage récent et propre est invisible
   * ici. Cette date prouve qu'un balayage a eu lieu CE jour-là ; elle ne dit
   * rien sur d'éventuels passages plus récents restés silencieux.
   */
  dernierBalayage: string | null;
  /** Le dernier passage journalisé du balayage. `null` = aucune preuve de passage. */
  dernierPassage: PassageBalayage | null;
  kpis: { trompeuses: number; aSurveiller: number; valeursConcernees: number };
  /** Message technique de l'échec — seulement quand `etat === 'erreur'` ; jamais présenté comme un fait métier. */
  erreurMessage: string | null;
}

const TABLE = 'coherence_anomalies';

function tableauVide(etat: EtatBalayage, erreurMessage: string | null = null): TableauCoherence {
  return {
    etat,
    anomalies: [],
    dernierBalayage: null,
    dernierPassage: null,
    kpis: { trompeuses: 0, aSurveiller: 0, valeursConcernees: 0 },
    erreurMessage,
  };
}

/** Ce qu'un passage journalisé nous apprend. */
export interface PassageBalayage {
  /** Fin du passage, ou son début s'il n'a pas de fin enregistrée. */
  quand: string;
  status: string;
  valeursExaminees: number | null;
}

/**
 * Le dernier passage du balayage, lu dans `scraper_runs`.
 *
 * `null` couvre trois cas volontairement confondus — jamais exécuté, source
 * pas encore enregistrée, table de monitoring illisible — parce qu'ils
 * disent tous la même chose à l'écran : rien ne prouve qu'un passage ait eu
 * lieu. Ce qu'il ne faut PAS faire, c'est les traduire par « tout va bien ».
 */
async function dernierPassage(db: ReturnType<typeof getServiceClient>): Promise<PassageBalayage | null> {
  try {
    const { data: src } = await db.from('scraper_sources').select('id').eq('code', 'coherence').maybeSingle();
    const sourceId = (src as { id: string } | null)?.id;
    if (!sourceId) return null;

    const { data } = await db
      .from('scraper_runs')
      .select('started_at, finished_at, status, rows_extracted')
      .eq('source_id', sourceId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data as { started_at: string; finished_at: string | null; status: string; rows_extracted: number | null } | null;
    if (!r) return null;
    return { quand: r.finished_at ?? r.started_at, status: r.status, valeursExaminees: r.rows_extracted ?? null };
  } catch {
    return null;
  }
}

export async function loadCoherenceDashboard(): Promise<TableauCoherence> {
  const db = getServiceClient();

  const [ouvertesRes, dernierRes, passageRes] = await Promise.all([
    db
      .from(TABLE)
      .select('id, code, regle, gravite, message, preuve, detectee_le')
      .is('resolue_le', null)
      .order('detectee_le', { ascending: false }),
    // N'importe quelle ligne, résolue ou non, prouve qu'un balayage a tourné :
    // une anomalie corrigée reste en base (`resolue_le` posé) plutôt que
    // supprimée — voir le commentaire de la migration 0141.
    db.from(TABLE).select('detectee_le').order('detectee_le', { ascending: false }).limit(1),
    // LA preuve du passage, et la seule qui vaille. Le balayage n'écrit rien
    // dans `coherence_anomalies` quand il ne trouve rien — ce qui est sain,
    // mais rendait « jamais exécuté » et « exécuté dix fois, toujours propre »
    // indiscernables. La commande étant enveloppée dans `withMonitoring`
    // (scraper/src/index.ts), `scraper_runs` porte une ligne à CHAQUE passage,
    // propre ou non. On la lit ici plutôt que de deviner.
    dernierPassage(db),
  ]);

  if (ouvertesRes.error) {
    // 42P01 = relation absente (Postgres) : la migration n'est pas
    // appliquée. Toute autre erreur (réseau, droits…) est distincte — ni
    // l'une ni l'autre ne doit se lire comme « aucune anomalie ».
    const tableAbsente = ouvertesRes.error.code === '42P01';
    return tableauVide(tableAbsente ? 'table_absente' : 'erreur', tableAbsente ? null : ouvertesRes.error.message);
  }

  const anomalies = (ouvertesRes.data ?? []) as AnomalieOuverte[];
  const dernierBalayage = ((dernierRes.data as { detectee_le: string }[] | null) ?? [])[0]?.detectee_le ?? null;
  const passage = passageRes;

  // Un passage journalisé tranche ; à défaut, une anomalie en base prouve
  // aussi qu'un balayage a eu lieu (elle n'a pas pu s'écrire toute seule).
  // Les deux absentes : rien ne prouve un passage, et on le DIT plutôt que
  // d'afficher un satisfecit.
  const etat: EtatBalayage =
    passage === null && dernierBalayage === null && anomalies.length === 0 ? 'jamais_balaye' : 'balaye';

  return {
    etat,
    anomalies,
    dernierBalayage,
    dernierPassage: passage,
    kpis: {
      trompeuses: anomalies.filter((a) => a.gravite === 'trompeuse').length,
      aSurveiller: anomalies.filter((a) => a.gravite === 'a_surveiller').length,
      valeursConcernees: new Set(anomalies.map((a) => a.code)).size,
    },
    erreurMessage: null,
  };
}
