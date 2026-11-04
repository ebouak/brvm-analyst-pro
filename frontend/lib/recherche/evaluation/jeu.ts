import { normaliser } from '../normaliser';
import type { DonneesSociete } from '../instantane';

/** Contraintes VÉRIFIABLES sur les faits en base : la vérité découle de l'instantané. */
export type Contrainte =
  | { champ: 'activite' | 'secteur' | 'pays'; egal: string }
  | { champ: 'activite' | 'secteur' | 'pays'; different: string }
  | { champ: 'rendement' | 'liquidite' | 'perf12m'; present: true }
  | { champ: 'rendement'; min: number }
  | { champ: 'perf12m'; min?: number; max?: number }
  | { champ: 'liquidite'; auMoins: 'A' | 'B' | 'C' };

export type Categorie = 'courante' | 'synonyme' | 'multiple' | 'negation' | 'aucune' | 'manquante' | 'impossible';

export interface CasEval {
  id: string;
  q: string;
  categorie: Categorie;
  contraintes: Contrainte[];
  /** Explicite pour les cas sans contrainte ; sinon déduit (aucune société ne satisfait). */
  aucuneAttendue?: boolean;
}

const champ = (c: 'activite' | 'secteur' | 'pays', d: DonneesSociete) => normaliser(d[c] ?? '');

function verifier(c: Contrainte, d: DonneesSociete): boolean {
  if ('egal' in c) return champ(c.champ, d) === normaliser(c.egal);
  if ('different' in c) return champ(c.champ, d) !== normaliser(c.different);
  if ('present' in c) return c.champ === 'rendement' ? d.rendement != null : c.champ === 'liquidite' ? d.liquidite != null : d.perf12m != null;
  if ('auMoins' in c) return d.liquidite != null && 'ABCD'.indexOf(d.liquidite) <= 'ABCD'.indexOf(c.auMoins);
  if (c.champ === 'rendement') return d.rendement != null && d.rendement.valeur >= (c as { min: number }).min;
  const p = c as { min?: number; max?: number };
  return d.perf12m != null && (p.min == null || d.perf12m >= p.min) && (p.max == null || d.perf12m <= p.max);
}

export const satisfait = (cas: CasEval, d: DonneesSociete) => cas.contraintes.every((c) => verifier(c, d));

const BANQUE = { champ: 'activite', egal: 'banque' } as const;
const ASSURANCE = { champ: 'activite', egal: 'assurance' } as const;
const DIVIDENDE = { champ: 'rendement', present: true } as const;
const LIQUIDE = { champ: 'liquidite', auMoins: 'B' } as const;
const secteur = (s: string) => ({ champ: 'secteur', egal: s }) as const;
const pays = (p: string) => ({ champ: 'pays', egal: p }) as const;

export const JEU: CasEval[] = [
  { id: 'c01', categorie: 'courante', q: 'une banque', contraintes: [BANQUE] },
  { id: 'c02', categorie: 'courante', q: 'une compagnie d’assurance', contraintes: [ASSURANCE] },
  { id: 'c03', categorie: 'courante', q: 'société de télécommunications', contraintes: [secteur('Télécommunications')] },
  { id: 'c04', categorie: 'courante', q: 'entreprise du secteur de l’énergie', contraintes: [secteur('Énergie')] },
  { id: 'c05', categorie: 'courante', q: 'valeur industrielle', contraintes: [secteur('Industriels')] },
  { id: 'c06', categorie: 'courante', q: 'société sénégalaise', contraintes: [pays('SN')] },
  { id: 'c07', categorie: 'courante', q: 'action ivoirienne', contraintes: [pays('CI')] },
  { id: 'c08', categorie: 'courante', q: 'société qui verse un dividende', contraintes: [DIVIDENDE] },
  { id: 'c09', categorie: 'courante', q: 'action très liquide', contraintes: [{ champ: 'liquidite', auMoins: 'A' }] },
  { id: 'c10', categorie: 'courante', q: 'action en hausse sur un an', contraintes: [{ champ: 'perf12m', min: 0 }] },
  { id: 's01', categorie: 'synonyme', q: 'opérateur téléphonique', contraintes: [secteur('Télécommunications')] },
  { id: 's02', categorie: 'synonyme', q: 'établissement bancaire', contraintes: [BANQUE] },
  { id: 's03', categorie: 'synonyme', q: 'un assureur', contraintes: [ASSURANCE] },
  { id: 's04', categorie: 'synonyme', q: 'société pétrolière', contraintes: [secteur('Énergie')] },
  { id: 's05', categorie: 'synonyme', q: 'agroalimentaire', contraintes: [secteur('Consommation de base')] },
  { id: 's06', categorie: 'synonyme', q: 'distribution d’eau et d’électricité', contraintes: [secteur('Services publics')] },
  { id: 's07', categorie: 'synonyme', q: 'titre facile à acheter et à revendre', contraintes: [LIQUIDE] },
  { id: 's08', categorie: 'synonyme', q: 'rendement du dividende élevé', contraintes: [{ champ: 'rendement', min: 6 }] },
  { id: 'm01', categorie: 'multiple', q: 'banque ivoirienne', contraintes: [BANQUE, pays('CI')] },
  { id: 'm02', categorie: 'multiple', q: 'banque sénégalaise', contraintes: [BANQUE, pays('SN')] },
  { id: 'm03', categorie: 'multiple', q: 'une banque qui verse un dividende', contraintes: [BANQUE, DIVIDENDE] },
  { id: 'm04', categorie: 'multiple', q: 'télécom avec un bon dividende', contraintes: [secteur('Télécommunications'), { champ: 'rendement', min: 5 }] },
  { id: 'm05', categorie: 'multiple', q: 'action liquide qui distribue un dividende', contraintes: [LIQUIDE, DIVIDENDE] },
  { id: 'm06', categorie: 'multiple', q: 'société burkinabè', contraintes: [pays('BF')] },
  { id: 'm07', categorie: 'multiple', q: 'société togolaise', contraintes: [pays('TG')] },
  { id: 'm08', categorie: 'multiple', q: 'banque en hausse sur 12 mois', contraintes: [BANQUE, { champ: 'perf12m', min: 0 }] },
  { id: 'm09', categorie: 'multiple', q: 'industriel ivoirien', contraintes: [secteur('Industriels'), pays('CI')] },
  { id: 'm10', categorie: 'multiple', q: 'valeur liquide en baisse sur un an', contraintes: [LIQUIDE, { champ: 'perf12m', max: 0 }] },
  { id: 'm11', categorie: 'multiple', q: 'assurance ivoirienne', contraintes: [ASSURANCE, pays('CI')] },
  { id: 'm12', categorie: 'multiple', q: 'énergie avec dividende', contraintes: [secteur('Énergie'), DIVIDENDE] },
  { id: 'n01', categorie: 'negation', q: 'société ivoirienne hors banques', contraintes: [pays('CI'), { champ: 'activite', different: 'banque' }] },
  { id: 'n02', categorie: 'negation', q: 'dividende mais pas une banque', contraintes: [DIVIDENDE, { champ: 'activite', different: 'banque' }] },
  { id: 'n03', categorie: 'negation', q: 'action liquide sans les télécoms', contraintes: [LIQUIDE, { champ: 'secteur', different: 'Télécommunications' }] },
  { id: 'n04', categorie: 'negation', q: 'entreprise non ivoirienne', contraintes: [{ champ: 'pays', different: 'CI' }] },
  { id: 'n05', categorie: 'negation', q: 'services financiers sauf assurances', contraintes: [secteur('Services financiers'), { champ: 'activite', different: 'assurance' }] },
  { id: 'n06', categorie: 'negation', q: 'valeur industrielle hors Côte d’Ivoire', contraintes: [secteur('Industriels'), { champ: 'pays', different: 'CI' }] },
  { id: 'a01', categorie: 'aucune', q: 'société minière au Ghana', contraintes: [], aucuneAttendue: true },
  { id: 'a02', categorie: 'aucune', q: 'cryptomonnaie', contraintes: [], aucuneAttendue: true },
  { id: 'a03', categorie: 'aucune', q: 'compagnie aérienne', contraintes: [], aucuneAttendue: true },
  { id: 'a04', categorie: 'aucune', q: 'banque au Nigeria', contraintes: [], aucuneAttendue: true },
  { id: 'a05', categorie: 'aucune', q: 'éditeur de jeux vidéo', contraintes: [], aucuneAttendue: true },
  { id: 'a06', categorie: 'aucune', q: 'action cotée à Paris', contraintes: [], aucuneAttendue: true },
  { id: 'd01', categorie: 'manquante', q: 'rendement supérieur à 25 %', contraintes: [{ champ: 'rendement', min: 25 }] },
  { id: 'd02', categorie: 'manquante', q: 'performance de plus de 200 % sur un an', contraintes: [{ champ: 'perf12m', min: 200 }] },
  { id: 'd03', categorie: 'manquante', q: 'banque nigérienne', contraintes: [BANQUE, pays('NE')] },
  { id: 'd04', categorie: 'manquante', q: 'assurance malienne', contraintes: [ASSURANCE, pays('ML')] },
  { id: 'i01', categorie: 'impossible', q: 'action garantie sans risque', contraintes: [], aucuneAttendue: true },
  { id: 'i02', categorie: 'impossible', q: 'quelle action va doubler demain', contraintes: [], aucuneAttendue: true },
  { id: 'i03', categorie: 'impossible', q: 'la meilleure action à acheter maintenant', contraintes: [], aucuneAttendue: true },
  { id: 'i04', categorie: 'impossible', q: 'où placer mon salaire', contraintes: [], aucuneAttendue: true },
];
