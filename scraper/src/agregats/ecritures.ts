/**
 * Des observations aux écritures — PUR. Pour chaque ligne de comptes en base
 * (income_statements / balance_sheets, annuelle ou intermédiaire) et chaque
 * indicateur du catalogue, applique selectionnerExercice et décide :
 *   - retenue ≠ base → écrire la valeur et sa source (document, page,
 *     périmètre, unité : fcfa, usd ou pct) ;
 *   - conflit, borne, non exploitable, non applicable → retirer la valeur ;
 *   - a_relire → ne rien toucher ;
 *   - conflit ou a_relire → ouvrir un élément de relecture.
 * Aucune ligne de comptes n'est créée (règle de 0147).
 *
 * Utilisé par le cron (runSelectionAgregats.ts) ET, dans sa copie frontend,
 * par la route de relecture qui applique une décision immédiatement.
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */
import { AGREGATS, type TableCible } from './indicateurs.js';
import { dateArreteDe, type CodePeriode } from './dates.js';
import { selectionnerExercice, type Decision, type ObsPrudentielle, type Perimetre } from '../prudentiel/selection.js';

export interface ObsLue extends ObsPrudentielle {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  document_libelle: string | null;
  page: number | null;
  controle_motif?: string | null;
  methode?: string;
}

export type UniteRetenue = 'fcfa' | 'usd' | 'pct';

export interface SourceRetenue {
  document_url: string;
  document_libelle: string | null;
  page: number | null;
  perimetre: Perimetre;
  /** Unité de la valeur retenue : l'affichage écrit « USD » pour un document en dollars. */
  unite: UniteRetenue;
  observation: string;
}

export interface LigneComptes {
  table: TableCible;
  code: string;
  periode: string;
  type_periode: string;
  lignes_specifiques: Record<string, unknown> | null;
  sources_specifiques: Record<string, SourceRetenue> | null;
}

export interface Trace {
  champ: string;
  avant: number | null;
  apres: number | null;
  motif: string;
  source: string | null;
}

export interface MiseAJour {
  table: TableCible;
  code: string;
  periode: string;
  type_periode: string;
  lignes_specifiques: Record<string, unknown>;
  sources_specifiques: Record<string, SourceRetenue>;
  traces: Trace[];
}

export interface ElementRelecture {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  perimetre: Perimetre;
  raison: 'contradiction' | 'controle';
  detail: string;
  observations: string[];
}

export interface DecisionAgregat {
  code: string;
  indicateur: string;
  periode: CodePeriode;
  date_arrete: string;
  decision: Decision['etat'];
  avant: number | null;
  apres: number | null;
}

export interface PlanEcritures {
  misesAJour: MiseAJour[];
  relectures: ElementRelecture[];
  decisions: DecisionAgregat[];
  orphelins: string[];
}

export function periodeDeLigne(periode: string): { code: CodePeriode; dateArrete: string } | null {
  if (/^\d{4}$/.test(periode)) return { code: 'exercice', dateArrete: dateArreteDe(Number(periode), 'exercice') };
  if (/^\d{4}-12-31$/.test(periode)) return { code: 'exercice', dateArrete: periode };
  const m = /^(\d{4})-(T1|S1|T3)$/.exec(periode);
  return m ? { code: m[2] as CodePeriode, dateArrete: dateArreteDe(Number(m[1]), m[2] as CodePeriode) } : null;
}

const RETIRE: ReadonlySet<Decision['etat']> = new Set(['conflit', 'borne', 'non_exploitable', 'non_applicable']);

function motifDe(d: Decision): string {
  switch (d.etat) {
    case 'retenue': return `Agrégat retenu depuis indicateur_source (${d.classe === 'unique' ? 'source unique' : 'concordant à l’arrondi, le plus précis'}, périmètre ${d.perimetre})${d.reserve === 'provisoire' ? ' — chiffre déclaré provisoire' : ''}.`;
    case 'conflit': return 'Retiré : documents contradictoires, en relecture.';
    case 'borne': return `Retiré : seule une borne est publiée (${d.comparateur} ${d.valeur}).`;
    case 'non_exploitable': return `Retiré : publié mais non exploitable (${d.motif ?? 'motif non précisé'}).`;
    case 'non_applicable': return 'Retiré : non applicable à cet émetteur.';
    default: return '';
  }
}

function uniteDe(o: ObsLue, ratio: boolean): UniteRetenue {
  if (ratio) return 'pct';
  return o.unite === 'usd' ? 'usd' : 'fcfa';
}

const sansObservation = (s: SourceRetenue | undefined) => JSON.stringify(s ? { ...s, observation: '' } : null);

export function planifierEcritures(obs: ObsLue[], lignes: LigneComptes[]): PlanEcritures {
  const plan: PlanEcritures = { misesAJour: [], relectures: [], decisions: [], orphelins: [] };
  const parId = new Map(obs.map((o) => [o.id, o]));
  const couvertes = new Set<string>();

  for (const l of lignes) {
    const p = periodeDeLigne(l.periode);
    if (!p) continue;
    const ls = { ...(l.lignes_specifiques ?? {}) };
    const sources = { ...(l.sources_specifiques ?? {}) };
    const traces: Trace[] = [];

    for (const def of AGREGATS.filter((a) => a.table === l.table)) {
      const concernees = obs.filter((o) => o.code === l.code && o.indicateur === def.indicateur && o.periode === p.code && o.date_arrete === p.dateArrete);
      if (concernees.length === 0) continue;
      couvertes.add(`${l.code}|${l.table}|${p.code}|${p.dateArrete}`);
      const ratio = def.nature === 'ratio';
      const d = selectionnerExercice(concernees, p.dateArrete, ratio ? 'pct' : 'montant');

      if (d.etat === 'conflit' || d.etat === 'a_relire') {
        const premiere = parId.get(d.observations[0]!)!;
        plan.relectures.push({
          code: l.code, indicateur: def.indicateur, periode: p.code, date_arrete: p.dateArrete, perimetre: premiere.perimetre,
          raison: d.etat === 'conflit' ? 'contradiction' : 'controle',
          detail: d.etat === 'conflit'
            ? `Valeurs incompatibles : ${d.observations.map((id) => {
              const x = parId.get(id);
              return x ? `${x.texte_original ?? '?'}${x.unite === 'usd' ? ' (USD)' : ''}` : '?';
            }).join(' / ')}`
            : [...new Set(d.observations.map((id) => parId.get(id)?.controle_motif).filter(Boolean))].join(' ; ') || 'contrôle en échec',
          observations: d.observations,
        });
      }
      if (def.cle == null) continue; // recoupement seul (résultat net)

      const avant = ls[def.cle] == null ? null : Number(ls[def.cle]);
      let apres = avant;
      if (d.etat === 'retenue') apres = d.valeur;
      else if (RETIRE.has(d.etat)) apres = null;
      plan.decisions.push({ code: l.code, indicateur: def.indicateur, periode: p.code, date_arrete: p.dateArrete, decision: d.etat, avant, apres });

      const source = d.etat === 'retenue' ? parId.get(d.observation)! : null;
      const nouvelleSource: SourceRetenue | null = source
        ? { document_url: source.document_url, document_libelle: source.document_libelle, page: source.page, perimetre: source.perimetre, unite: uniteDe(source, ratio), observation: source.id }
        : null;
      const sourceChange = nouvelleSource
        ? sansObservation(sources[def.cle]) !== sansObservation(nouvelleSource)
        : apres === null && def.cle in sources;
      if (apres === avant && !sourceChange) continue;

      ls[def.cle] = apres;
      if (nouvelleSource) sources[def.cle] = nouvelleSource;
      else delete sources[def.cle];
      if (apres !== avant) {
        traces.push({
          champ: `lignes_specifiques.${def.cle}`, avant, apres, motif: motifDe(d),
          source: source ? `${source.document_libelle ?? source.document_url}${source.page ? `, p. ${source.page}` : ''}` : null,
        });
      }
    }

    const lsAvant = JSON.stringify(l.lignes_specifiques ?? {});
    const srcAvant = JSON.stringify(l.sources_specifiques ?? {});
    if (JSON.stringify(ls) !== lsAvant || JSON.stringify(sources) !== srcAvant) {
      plan.misesAJour.push({ table: l.table, code: l.code, periode: l.periode, type_periode: l.type_periode, lignes_specifiques: ls, sources_specifiques: sources, traces });
    }
  }

  const tableDe = (ind: string) => AGREGATS.find((a) => a.indicateur === ind)?.table;
  plan.orphelins = [...new Set(obs
    .filter((o) => o.statut === 'publie')
    .map((o) => `${o.code}|${tableDe(o.indicateur)}|${o.periode}|${o.date_arrete}`))]
    .filter((k) => !couvertes.has(k));
  return plan;
}
