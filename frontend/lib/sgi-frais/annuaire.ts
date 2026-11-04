/**
 * Filtres et tris de l'annuaire des SGI — logique pure, testée.
 *
 * Règle d'honnêteté : une SGI dont le coût n'est pas connu (pas de barème, ou
 * barème incomplet) n'est jamais classée devant une SGI au barème complet ;
 * un filtre ne « devine » jamais une donnée absente, il l'exclut.
 */
import type { Sgi } from './directory';
import type { SgiFrais } from './types';
import { baremeComplet, calculerCoutSGI, montantParOrdreParDefaut } from './calculateur';
import type { Scenario } from './scenario';

export interface EntreeAnnuaire {
  sgi: Sgi;
  frais: SgiFrais | null;
  /** Coût total du scénario ; null sans barème. */
  cout: number | null;
  /** Courtage, garde et tenue de compte tous connus. */
  complet: boolean;
  bourseEnLigne: boolean;
}

export type StatutBareme = 'tous' | 'homologue' | 'agrege' | 'aucun';
export type TypeSgi = 'tous' | 'Banque' | 'Indépendante';
export type TriAnnuaire = 'pays' | 'nom' | 'cout' | 'courtage';

export interface FiltresAnnuaire {
  pays: string; // 'ALL' ou code pays
  recherche: string;
  bareme: StatutBareme;
  type: TypeSgi;
  /** Courtage maximal publié ≤ ce taux (%) ; null = pas de filtre. */
  courtageMax: number | null;
  bourseEnLigne: boolean;
}

export const FILTRES_DEFAUT: FiltresAnnuaire = {
  pays: 'ALL',
  recherche: '',
  bareme: 'tous',
  type: 'tous',
  courtageMax: null,
  bourseEnLigne: false,
};

export function filtresActifs(f: FiltresAnnuaire): number {
  return (
    Number(f.pays !== 'ALL') +
    Number(f.recherche.trim() !== '') +
    Number(f.bareme !== 'tous') +
    Number(f.type !== 'tous') +
    Number(f.courtageMax != null) +
    Number(f.bourseEnLigne)
  );
}

/** Taux de courtage publié le plus élevé (paliers compris) ; null si inconnu. */
export function courtagePublieMax(f: SgiFrais | null): number | null {
  if (!f) return null;
  const paliers = f.courtagePaliers?.map((p) => p.pct) ?? [];
  const bornes = [...paliers, f.courtagePctMax, f.courtagePctMin].filter((x): x is number => x != null);
  return bornes.length ? Math.max(...bornes) : null;
}

/**
 * Seuils de courtage proposés au filtre, tirés des taux réellement publiés :
 * chaque taux sous le maximum observé. Un seuil fixe pourrait ne retenir
 * personne, ou tout le monde — deux filtres trompeurs.
 */
export function seuilsCourtage(entrees: EntreeAnnuaire[]): number[] {
  const taux = [...new Set(entrees.map((e) => courtagePublieMax(e.frais)).filter((x): x is number => x != null))].sort((a, b) => a - b);
  return taux.slice(0, -1);
}

export function entreesAnnuaire(directory: Sgi[], frais: SgiFrais[], s: Scenario): EntreeAnnuaire[] {
  const parNomFrais = new Map(frais.map((f) => [f.sgiNom, f]));
  const ordre = s.montantParOrdre ?? montantParOrdreParDefaut(s.montant, s.nbAchats);
  return directory.map((sgi) => {
    const f = parNomFrais.get(sgi.nom) ?? null;
    if (!f) return { sgi, frais: null, cout: null, complet: false, bourseEnLigne: false };
    const r = calculerCoutSGI(f, { montant: s.montant, montantParOrdre: ordre, nbOrdres: s.nbAchats + s.nbVentes, dureeAns: s.dureeAns });
    return {
      sgi,
      frais: f,
      cout: r.total,
      complet: baremeComplet(r),
      bourseEnLigne: f.notes?.toLowerCase().includes('bourse en ligne') ?? false,
    };
  });
}

export function filtrerAnnuaire(entrees: EntreeAnnuaire[], f: FiltresAnnuaire): EntreeAnnuaire[] {
  const q = f.recherche.trim().toLowerCase();
  return entrees.filter((e) => {
    if (f.pays !== 'ALL' && e.sgi.pays !== f.pays) return false;
    if (q && !e.sgi.nom.toLowerCase().includes(q) && !e.sgi.groupe.toLowerCase().includes(q)) return false;
    if (f.bareme === 'homologue' && e.frais?.confiance !== 'homologue_crepmf') return false;
    if (f.bareme === 'agrege' && (!e.frais || e.frais.confiance === 'homologue_crepmf')) return false;
    if (f.bareme === 'aucun' && e.frais) return false;
    if (f.type !== 'tous' && e.sgi.type !== f.type) return false;
    if (f.courtageMax != null) {
      const c = courtagePublieMax(e.frais);
      if (c == null || c > f.courtageMax) return false;
    }
    if (f.bourseEnLigne && !e.bourseEnLigne) return false;
    return true;
  });
}

const parNom = (a: EntreeAnnuaire, b: EntreeAnnuaire) => a.sgi.nom.localeCompare(b.sgi.nom, 'fr');

/** Rang de fiabilité du coût : complet, puis incomplet, puis inconnu. */
const rangCout = (e: EntreeAnnuaire) => (e.cout == null ? 2 : e.complet ? 0 : 1);

export function trierAnnuaire(entrees: EntreeAnnuaire[], tri: TriAnnuaire): EntreeAnnuaire[] {
  const t = [...entrees];
  switch (tri) {
    case 'nom':
      return t.sort(parNom);
    case 'cout':
      return t.sort((a, b) => rangCout(a) - rangCout(b) || (a.cout ?? 0) - (b.cout ?? 0) || parNom(a, b));
    case 'courtage':
      return t.sort((a, b) => {
        const ca = courtagePublieMax(a.frais);
        const cb = courtagePublieMax(b.frais);
        if (ca == null || cb == null) return ca == null && cb == null ? parNom(a, b) : ca == null ? 1 : -1;
        return ca - cb || parNom(a, b);
      });
    default:
      return t.sort((a, b) => a.sgi.pays.localeCompare(b.sgi.pays) || parNom(a, b));
  }
}
