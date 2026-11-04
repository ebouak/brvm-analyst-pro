import { createHash } from 'node:crypto';
import type { CleFait, FaitSociete, FicheSociete, Instantane } from './types';

/** Faits d'une société tels que lus en base ; null = inconnu (jamais supposé). */
export interface DonneesSociete {
  code: string;
  nom: string;
  secteur: string | null;
  /** `brvm_instruments.famille_comptable` quand elle distingue banque et assurance. */
  activite: 'banque' | 'assurance' | null;
  /** Code pays BRVM (CI, SN…). */
  pays: string | null;
  rendement: { valeur: number; base: 'net' | 'non_precisee' } | null;
  liquidite: 'A' | 'B' | 'C' | 'D' | null;
  perf12m: number | null;
}

const NOMS_PAYS: Record<string, string> = {
  CI: "Côte d'Ivoire",
  SN: 'Sénégal',
  BF: 'Burkina Faso',
  ML: 'Mali',
  BJ: 'Bénin',
  TG: 'Togo',
  NE: 'Niger',
  GW: 'Guinée-Bissau',
};

const decimal = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function construireFiche(d: DonneesSociete): FicheSociete {
  const faits: FaitSociete[] = [];
  const ajouter = (cle: CleFait, libelle: string, valeur: string | null) => {
    if (valeur) faits.push({ cle, libelle, valeur });
  };
  ajouter('activite', 'Activité', d.activite);
  ajouter('secteur', 'Secteur', d.secteur?.trim() || null);
  ajouter('pays', 'Pays', d.pays ? NOMS_PAYS[d.pays] ?? d.pays : null);
  ajouter(
    'rendement',
    'Rendement du dividende',
    d.rendement && Number.isFinite(d.rendement.valeur) && d.rendement.valeur >= 0
      ? `${decimal(d.rendement.valeur)} % (${d.rendement.base === 'net' ? 'net' : 'base fiscale non précisée'})`
      : null,
  );
  ajouter('liquidite', 'Liquidité', d.liquidite ? `classe ${d.liquidite}` : null);
  ajouter(
    'perf12m',
    'Performance sur 12 mois',
    d.perf12m != null && Number.isFinite(d.perf12m) ? `${d.perf12m >= 0 ? '+' : '−'}${decimal(Math.abs(d.perf12m))} %` : null,
  );
  const texte = [`${d.code} — ${d.nom}.`, ...faits.map((f) => `${f.libelle} : ${f.valeur}.`)].join(' ');
  return { code: d.code, nom: d.nom, faits, texte };
}

export function construireInstantane(donnees: DonneesSociete[], dateSeance: string): Instantane {
  const fiches = [...donnees].sort((a, b) => a.code.localeCompare(b.code)).map(construireFiche);
  const h = createHash('sha256')
    .update(`${dateSeance}\n${fiches.map((f) => f.texte).join('\n')}`)
    .digest('hex')
    .slice(0, 12);
  return { snapshotId: `${dateSeance}.${h}`, actualiseLe: dateSeance, fiches };
}
