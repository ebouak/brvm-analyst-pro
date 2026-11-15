/**
 * Rapport de la reprise À BLANC — PUR. Il est présenté à l'exploitant AVANT
 * toute écriture (spec §7, PR 3) et porte les observations elles-mêmes :
 * l'écriture réelle insère ces observations-là, sans relire les PDF.
 */
import type { ObservationNouvelle } from './normaliser.js';
import type { PlanEcritures } from './ecritures.js';

export interface DocumentRapport {
  code: string;
  libelle: string;
  url: string;
  periode: string;
  etat: 'lu' | 'illisible' | 'echec' | 'ecarte';
  erreur: string | null;
}

export interface LigneSynthese {
  code: string;
  periode: string;
  trouvees: number;
  non_trouvees: number;
  bloquees: number;
  contradictions: number;
  retenues: number;
}

export interface RapportReprise {
  version: 1;
  genere_le: string;
  /** Réserves sur la portée du rapport (ex. base sans les colonnes de 0245). */
  avertissements: string[];
  documents: DocumentRapport[];
  observations: ObservationNouvelle[];
  plan: PlanEcritures;
  synthese: LigneSynthese[];
  totaux: {
    documents: number; lus: number; echecs: number; trouvees: number; non_trouvees: number;
    bloquees: number; contradictions: number; retenues: number; orphelins: number;
  };
}

export function construireRapport(
  genereLe: string,
  documents: DocumentRapport[],
  observations: ObservationNouvelle[],
  plan: PlanEcritures,
  avertissements: string[] = [],
): RapportReprise {
  const cles = new Map<string, LigneSynthese>();
  const ligne = (code: string, periode: string, date: string) => {
    const k = `${code}|${periode} ${date}`;
    if (!cles.has(k)) cles.set(k, { code, periode: `${periode} ${date}`, trouvees: 0, non_trouvees: 0, bloquees: 0, contradictions: 0, retenues: 0 });
    return cles.get(k)!;
  };
  for (const o of observations) {
    const l = ligne(o.code, o.periode, o.date_arrete);
    if (o.statut === 'non_trouve') l.non_trouvees++;
    else l.trouvees++;
    if (o.controle === 'a_relire') l.bloquees++;
  }
  for (const r of plan.relectures.filter((x) => x.raison === 'contradiction')) ligne(r.code, r.periode, r.date_arrete).contradictions++;
  for (const d of plan.decisions.filter((x) => x.decision === 'retenue')) ligne(d.code, d.periode, d.date_arrete).retenues++;
  const synthese = [...cles.values()].sort((a, b) => a.code.localeCompare(b.code) || b.periode.localeCompare(a.periode));
  const somme = (k: keyof Omit<LigneSynthese, 'code' | 'periode'>) => synthese.reduce((s, l) => s + l[k], 0);
  return {
    version: 1, genere_le: genereLe, avertissements, documents, observations, plan, synthese,
    totaux: {
      documents: documents.length,
      lus: documents.filter((d) => d.etat === 'lu').length,
      echecs: documents.filter((d) => d.etat === 'echec').length,
      trouvees: somme('trouvees'), non_trouvees: somme('non_trouvees'), bloquees: somme('bloquees'),
      contradictions: somme('contradictions'), retenues: somme('retenues'), orphelins: plan.orphelins.length,
    },
  };
}

export function rapportTexte(r: RapportReprise): string {
  const t = r.totaux;
  const lignes = [
    `# Reprise à blanc des agrégats bancaires — ${r.genere_le}`,
    '',
    'Rien n’a été écrit en base. Ce rapport attend l’accord de l’exploitant.',
    ...(r.avertissements.length ? ['', '## Avertissements', ...r.avertissements.map((a) => `- ${a}`)] : []),
    '',
    `Documents : ${t.documents} (lus ${t.lus}, échecs ${t.echecs}).`,
    `Valeurs : trouvées ${t.trouvees}, non trouvées ${t.non_trouvees}, bloquées par un contrôle ${t.bloquees}, contradictions ${t.contradictions}, retenues ${t.retenues}.`,
    `Périodes sans ligne de comptes en base (non écrites) : ${t.orphelins}.`,
    '',
    '| Valeur | Période | Trouvées | Non trouvées | Bloquées | Contradictions | Retenues |',
    '|---|---|---|---|---|---|---|',
    ...r.synthese.map((l) => `| ${l.code} | ${l.periode} | ${l.trouvees} | ${l.non_trouvees} | ${l.bloquees} | ${l.contradictions} | ${l.retenues} |`),
  ];
  const echecs = r.documents.filter((d) => d.etat !== 'lu');
  if (echecs.length) {
    lignes.push('', '## Documents non lus', ...echecs.map((d) => `- ${d.code} ${d.periode} — ${d.libelle} : ${d.etat}${d.erreur ? ` (${d.erreur})` : ''}`));
  }
  if (r.plan.relectures.length) {
    lignes.push('', '## À relire', ...r.plan.relectures.map((x) => `- ${x.code} ${x.indicateur} ${x.periode} ${x.date_arrete} (${x.perimetre}) : ${x.raison} — ${x.detail}`));
  }
  if (r.plan.orphelins.length) lignes.push('', '## Sans ligne de comptes', ...r.plan.orphelins.map((k) => `- ${k}`));
  if (r.plan.ecartesUsd?.length) lignes.push('', '## Montants USD non écrits (verrou ECRITURE_USD_AUTORISEE)', ...r.plan.ecartesUsd.map((k) => `- ${k}`));
  return lignes.join('\n');
}
