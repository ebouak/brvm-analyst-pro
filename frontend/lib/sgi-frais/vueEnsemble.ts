/**
 * Synthèse de la vue d'ensemble du comparateur — logique pure, testée.
 *
 * Tout chiffre affiché sur la page d'accueil du comparateur vient d'ici, donc
 * du moteur : recommandation, décomposition du coût, seuil de rentabilité,
 * classement. Une SGI au barème incomplet n'est jamais recommandée, et passe
 * après les barèmes complets dans le classement.
 */
import type { Sgi } from './directory';
import type { SgiFrais } from './types';
import { baremeComplet, calculerCoutSGI, calculerSeuilRentabilite, classerResultats, montantParOrdreParDefaut, type CoutSGIResult } from './calculateur';
import { courtagePublieMax } from './annuaire';
import { economieVsMoyenne } from './comparaison';
import type { Scenario } from './scenario';

export interface LigneClassement {
  sgi: Sgi;
  frais: SgiFrais;
  cout: CoutSGIResult;
  complet: boolean;
  courtageMax: number | null;
}

export interface PosteCout {
  cle: 'courtage' | 'reglementaire' | 'garde' | 'tenue' | 'virement';
  libelle: string;
  montant: number;
}

export interface SyntheseVueEnsemble {
  classement: LigneClassement[];
  recommandee: LigneClassement | null;
  postes: PosteCout[];
  /** % de hausse nécessaire pour couvrir un aller-retour (achat + vente). */
  seuilPct: number | null;
  economie: ReturnType<typeof economieVsMoyenne>;
  nbComplets: number;
}

export function syntheseVueEnsemble(directory: Sgi[], frais: SgiFrais[], s: Scenario): SyntheseVueEnsemble {
  const parNom = new Map(directory.map((d) => [d.nom, d]));
  const ordre = s.montantParOrdre ?? montantParOrdreParDefaut(s.montant, s.nbAchats);
  const lignes: LigneClassement[] = [];
  for (const f of frais) {
    const sgi = parNom.get(f.sgiNom);
    if (!sgi) continue; // barème orphelin : rien à afficher sans fiche
    const cout = calculerCoutSGI(f, { montant: s.montant, montantParOrdre: ordre, nbOrdres: s.nbAchats + s.nbVentes, dureeAns: s.dureeAns });
    lignes.push({ sgi, frais: f, cout, complet: baremeComplet(cout), courtageMax: courtagePublieMax(f) });
  }
  const classement = classerResultats(lignes.map((l) => ({ total: l.cout.total, champsManquants: l.cout.champsManquants, l }))).map((x) => x.l);
  const recommandee = classement.find((l) => l.complet) ?? null;

  const postes: PosteCout[] = recommandee
    ? ([
        { cle: 'courtage', libelle: 'Courtage', montant: recommandee.cout.coutCourtage },
        { cle: 'reglementaire', libelle: 'Commissions BRVM + DC/BR', montant: recommandee.cout.coutReglementaire },
        { cle: 'garde', libelle: 'Droits de garde', montant: recommandee.cout.coutGarde },
        { cle: 'tenue', libelle: 'Tenue de compte', montant: recommandee.cout.coutTenue },
        { cle: 'virement', libelle: 'Virements', montant: recommandee.cout.coutVirement },
      ] satisfies PosteCout[]).filter((p) => p.cle !== 'virement' || p.montant > 0)
    : [];

  return {
    classement,
    recommandee,
    postes,
    seuilPct: recommandee ? calculerSeuilRentabilite(recommandee.frais, ordre).seuilPct : null,
    economie: economieVsMoyenne(lignes.map((l) => ({ total: l.cout.total, complet: l.complet }))),
    nbComplets: lignes.filter((l) => l.complet).length,
  };
}

/** Arcs d'un anneau (fraction de tour, décalage) pour des montants positifs. */
export function arcsAnneau(montants: number[]): { part: number; debut: number }[] {
  const total = montants.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return montants.map(() => ({ part: 0, debut: 0 }));
  let cumul = 0;
  return montants.map((m) => {
    const part = Math.max(0, m) / total;
    const arc = { part, debut: cumul };
    cumul += part;
    return arc;
  });
}
