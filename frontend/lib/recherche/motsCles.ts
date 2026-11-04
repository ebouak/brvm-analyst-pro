import { DICTIONNAIRE, MOTS_VIDES, NEGATIONS } from './dictionnaire';
import { MAX_RESULTATS, statutParNombre } from './decision';
import { normaliser } from './normaliser';
import type { CleFait, FicheSociete, ResultatRecherche, StatutRecherche } from './types';

/**
 * Recherche simple, modeste et PRÉVISIBLE : elle ne cherche pas à imiter Jev.
 * Pondération : code > nom > secteur / activité / pays > autres faits.
 */
const POIDS = { code: 5, nom: 3, secteur: 2, activite: 2, pays: 2, autre: 1 } as const;
type Champ = keyof typeof POIDS;

export interface Terme {
  mot: string;
  nie: boolean;
}

export function termes(q: string): Terme[] {
  const out: Terme[] = [];
  let nier = false;
  for (const mot of normaliser(q).split(' ')) {
    if (!mot) continue;
    if (NEGATIONS.has(mot)) {
      nier = true;
      continue;
    }
    if (MOTS_VIDES.has(mot) || mot.length < 2) continue;
    out.push({ mot, nie: nier });
    nier = false;
  }
  return out;
}

interface FicheIndexee {
  fiche: FicheSociete;
  champs: Record<Champ, string>;
  faits: Set<CleFait>;
}

function indexer(fiche: FicheSociete): FicheIndexee {
  const valeur = (cle: CleFait) => normaliser(fiche.faits.find((f) => f.cle === cle)?.valeur ?? '');
  return {
    fiche,
    champs: {
      code: normaliser(fiche.code),
      nom: normaliser(fiche.nom),
      secteur: valeur('secteur'),
      activite: valeur('activite'),
      pays: valeur('pays'),
      autre: fiche.faits
        .filter((f) => !['secteur', 'activite', 'pays'].includes(f.cle))
        .map((f) => normaliser(f.valeur))
        .join(' '),
    },
    faits: new Set(fiche.faits.map((f) => f.cle)),
  };
}

const contient = (champ: string, jeton: string) => champ !== '' && ` ${champ} `.includes(` ${jeton} `);

function poids(mot: string, f: FicheIndexee): number {
  const cibles = DICTIONNAIRE[mot];
  if (cibles) {
    let meilleur = 0;
    for (const c of cibles) {
      if ('fait' in c) {
        if (f.faits.has(c.fait)) meilleur = Math.max(meilleur, POIDS.autre);
      } else if (c.jetons.some((j) => contient(f.champs[c.champ], j))) {
        meilleur = Math.max(meilleur, POIDS[c.champ]);
      }
    }
    return meilleur;
  }
  for (const champ of ['code', 'nom', 'secteur', 'activite', 'pays', 'autre'] as const) {
    if (contient(f.champs[champ], mot)) return POIDS[champ];
  }
  return 0;
}

export function rechercheMotsCles(q: string, fiches: FicheSociete[]): { statut: StatutRecherche; resultats: ResultatRecherche[] } {
  const ts = termes(q);
  const positifs = ts.filter((t) => !t.nie);
  const negatifs = ts.filter((t) => t.nie);
  const notes = fiches
    .map(indexer)
    .filter((f) => !negatifs.some((t) => poids(t.mot, f) > 0))
    .map((f) => ({ f, s: positifs.reduce((acc, t) => acc + poids(t.mot, f), 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.fiche.code.localeCompare(b.f.fiche.code));
  const max = notes[0]?.s ?? 1;
  const resultats = notes.slice(0, MAX_RESULTATS).map(({ f, s }) => ({
    code: f.fiche.code,
    nom: f.fiche.nom,
    score: Math.round((s / max) * 100) / 100,
    faits: f.fiche.faits,
  }));
  return { statut: statutParNombre(resultats.length), resultats };
}
