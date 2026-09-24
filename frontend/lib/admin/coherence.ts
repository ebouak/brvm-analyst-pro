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
 * État du balayage hebdomadaire, tel qu'on peut le DÉDUIRE de la seule table
 * `coherence_anomalies` — il n'existe pas de journal de run séparé pour ce
 * job (contrairement à `scraper_runs` pour les workers de collecte) :
 *
 *  - `table_absente`  la migration 0141 n'est pas encore appliquée ;
 *  - `erreur`         la lecture a échoué pour une autre raison (réseau,
 *                      droits…) — CE N'EST PAS une preuve d'absence
 *                      d'anomalie, à ne surtout pas confondre avec `balaye` ;
 *  - `jamais_balaye`  la table existe mais ne contient AUCUNE ligne, ouverte
 *                      ou résolue : rien ne prouve qu'un balayage ait déjà
 *                      tourné ;
 *  - `balaye`         au moins une ligne a déjà été vue (ouverte ou
 *                      résolue) — la preuve qu'un balayage a tourné existe,
 *                      qu'il reste ou non des anomalies ouvertes aujourd'hui.
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
   * résolues) — preuve du dernier passage connu, indépendante de ce qu'il
   * reste ouvert aujourd'hui.
   */
  dernierBalayage: string | null;
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
    kpis: { trompeuses: 0, aSurveiller: 0, valeursConcernees: 0 },
    erreurMessage,
  };
}

export async function loadCoherenceDashboard(): Promise<TableauCoherence> {
  const db = getServiceClient();

  const [ouvertesRes, dernierRes] = await Promise.all([
    db
      .from(TABLE)
      .select('id, code, regle, gravite, message, preuve, detectee_le')
      .is('resolue_le', null)
      .order('detectee_le', { ascending: false }),
    // N'importe quelle ligne, résolue ou non, prouve qu'un balayage a tourné :
    // une anomalie corrigée reste en base (`resolue_le` posé) plutôt que
    // supprimée — voir le commentaire de la migration 0141.
    db.from(TABLE).select('detectee_le').order('detectee_le', { ascending: false }).limit(1),
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

  const etat: EtatBalayage = dernierBalayage === null && anomalies.length === 0 ? 'jamais_balaye' : 'balaye';

  return {
    etat,
    anomalies,
    dernierBalayage,
    kpis: {
      trompeuses: anomalies.filter((a) => a.gravite === 'trompeuse').length,
      aSurveiller: anomalies.filter((a) => a.gravite === 'a_surveiller').length,
      valeursConcernees: new Set(anomalies.map((a) => a.code)).size,
    },
    erreurMessage: null,
  };
}
