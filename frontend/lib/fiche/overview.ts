/**
 * VUE D'ENSEMBLE de la fiche action — logique pure.
 *
 * Tableau de statistiques clés, phrase de performance financière et série
 * annuelle CA / résultat net. Chaque chiffre vient d'un module source unique
 * (`ratiosBilan`, `exerciceRetenu`, `plages`, `affichage`, `capitalisation`) :
 * ici on ne fait que le mettre en forme. Une donnée absente retire sa ligne,
 * jamais remplacée par une estimation. Ni analystes, ni objectif de cours, ni
 * PER prévisionnel : la BRVM n'en publie pas.
 */
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { evolutionResultat, evolutionResultatDetail, insecable, nombreFr, rendementDividendeParts, type Affichable } from './affichage';

const nf = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const moins = (s: string) => s.replace('-', '−');
/** Montant FCFA lisible (« 3,88 Md FCFA », « −96,6 M FCFA »), insécable. */
export const montantFcfa = (n: number) => insecable(`${moins(fmtFcfa(n))} FCFA`);

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2026-11-02 » → « 2 novembre 2026 » ; « 1er » le premier du mois. Lu en UTC. */
export function dateEnLettres(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const j = Number(m[3]), mois = MOIS[Number(m[2]) - 1];
  if (!mois || j < 1 || j > 31) return null;
  return `${j === 1 ? '1er' : j} ${mois} ${m[1]}`;
}

export function libelleFamille(f: string | null | undefined): string | null {
  if (f === 'banque') return 'Banque';
  if (f === 'assurance') return 'Assurance';
  if (f === 'general') return 'Plan comptable général';
  return null;
}

export interface LigneStat { cle: string; libelle: string; valeur: string; complement: string | null }

export interface EntreeStats {
  /** Faux quand l'analyse fondamentale est verrouillée : CA, résultat, BPA et PER ne sont pas rendus. */
  fondamentauxVisibles: boolean;
  /** FCFA (`capitalisationFcfa`). */
  capitalisation: number | null;
  exercice: number | null;
  chiffreAffaires: number | null;
  chiffreAffairesPrecedent: number | null;
  resultatNet: number | null;
  resultatNetPrecedent: number | null;
  bpa: Affichable | null;
  per: Affichable | null;
  titres: number | null;
  /** `ancien` : exercice du dividende antérieur de plus d'un an au dernier exercice publié (`dividendeCourant`). */
  rendementDividende: { pct: number | null; exercice: number | null; net: boolean; ancien?: boolean } | null;
  rendementNetIrvm: number | null;
  dernierDividende: { montant: number; exercice: number | null; exDate: string | null } | null;
  volume: number | null;
  volumeMoyen20: number | null;
  valeurEchangee: number | null;
  transactions: number | null;
  ouverture: number | null;
  cloturePrecedente: number | null;
  plusBas: number | null;
  plusHaut: number | null;
  plage52: { bas: number; haut: number } | null;
  beta: number | null;
  noteTechnique: string | null;
  combinedAlpha: number | null;
  prochainEvenement: { titre: string; date: string } | null;
}

const croissance = (n: number | null, n1: number | null): number | null =>
  n != null && n1 != null && n1 !== 0 ? ((n - n1) / Math.abs(n1)) * 100 : null;

export function lignesStatistiques(e: EntreeStats): LigneStat[] {
  const l: LigneStat[] = [];
  const add = (cle: string, libelle: string, valeur: string | null, complement: string | null = null) => {
    if (valeur != null) l.push({ cle, libelle, valeur, complement });
  };
  const ex = e.exercice != null ? ` (${e.exercice})` : '';

  add('capitalisation', 'Capitalisation', e.capitalisation != null ? montantFcfa(e.capitalisation) : null);
  if (e.fondamentauxVisibles) {
    const c = croissance(e.chiffreAffaires, e.chiffreAffairesPrecedent);
    add('ca', `Chiffre d'affaires${ex}`, e.chiffreAffaires != null ? montantFcfa(e.chiffreAffaires) : null,
      c != null ? insecable(`${c > 0 ? '+' : ''}${moins(nf(c, 1))} % sur un an`) : null);
    add('resultat', `Résultat net${ex}`, e.resultatNet != null ? montantFcfa(e.resultatNet) : null,
      evolutionResultat(e.resultatNet, e.resultatNetPrecedent));
    add('bpa', `BPA${ex}`, e.bpa?.valeur != null ? insecable(`${nombreFr(e.bpa.valeur, 2)} FCFA`) : null);
  }
  add('titres', 'Titres en circulation', e.titres != null ? fmtNumber(e.titres) : null);
  if (e.fondamentauxVisibles && e.per) {
    // Un PER « non disponible » se tait ; « non calculable, perte » est un constat.
    if (e.per.valeur != null) add('per', 'PER', `${nombreFr(e.per.valeur, 2)}x`);
    else if (e.per.motif && e.per.motif !== 'non disponible') add('per', 'PER', e.per.motif.charAt(0).toUpperCase() + e.per.motif.slice(1));
  }
  const exDiv = e.rendementDividende?.exercice ?? null;
  const ancien = e.rendementDividende?.ancien ? ", antérieur de plus d'un an au dernier exercice publié" : '';
  if (e.rendementDividende) {
    const r = rendementDividendeParts(e.rendementDividende.pct, exDiv);
    add('rendement', e.rendementDividende.net ? 'Rendement du dividende net' : 'Rendement du dividende',
      r?.valeur ?? null, r?.exercice ? `${r.exercice}${ancien}` : null);
  }
  const rn = e.rendementNetIrvm != null ? rendementDividendeParts(e.rendementNetIrvm, exDiv) : null;
  add('rendementNet', "Rendement net d'IRVM", rn?.valeur ?? null, rn?.exercice ?? null);
  if (e.dernierDividende) {
    const d = e.dernierDividende;
    const morceaux = [d.exercice != null ? `ex. ${d.exercice}` : null, d.exDate ? `détaché le ${dateEnLettres(d.exDate)}` : null].filter(Boolean);
    add('dividende', 'Dernier dividende', insecable(`${fmtNumber(d.montant)} FCFA`), morceaux.length ? morceaux.join(', ') : null);
  }
  add('volume', 'Volume', e.volume != null ? `${fmtNumber(e.volume)} titres` : null,
    e.volumeMoyen20 != null ? `moyenne 20 séances : ${fmtNumber(e.volumeMoyen20)}` : null);
  add('valeur', 'Valeur échangée', e.valeurEchangee != null ? montantFcfa(e.valeurEchangee) : null);
  add('transactions', 'Transactions', e.transactions != null ? fmtNumber(e.transactions) : null);
  add('ouverture', 'Ouverture', e.ouverture != null ? fmtNumber(e.ouverture) : null);
  add('cloture', 'Clôture précédente', e.cloturePrecedente != null ? fmtNumber(e.cloturePrecedente) : null);
  add('fourchette', 'Fourchette du jour', e.plusBas != null && e.plusHaut != null && e.plusBas > 0 && e.plusHaut > 0 ? `${fmtNumber(e.plusBas)} – ${fmtNumber(e.plusHaut)}` : null);
  add('plage52', 'Plage 52 semaines', e.plage52 ? `${fmtNumber(e.plage52.bas)} – ${fmtNumber(e.plage52.haut)}` : null);
  add('beta', 'Bêta (1 an)', e.beta != null ? nombreFr(e.beta, 2) : null);
  add('note', 'Note technique', e.noteTechnique);
  add('alpha', 'Combined Alpha', e.combinedAlpha != null ? `${Math.round(e.combinedAlpha)}/100` : null);
  if (e.prochainEvenement) add('evenement', 'Prochain événement', dateEnLettres(e.prochainEvenement.date), e.prochainEvenement.titre);
  return l;
}

export interface EntreePerformance {
  nom: string;
  exercice: number | null;
  chiffreAffaires: number | null;
  chiffreAffairesPrecedent: number | null;
  resultatNet: number | null;
  resultatNetPrecedent: number | null;
}

/** Une phrase déterministe sur le dernier exercice, construite sur ses seuls chiffres. */
export function phrasePerformance(p: EntreePerformance): string | null {
  if (p.exercice == null || (p.chiffreAffaires == null && p.resultatNet == null)) return null;
  const debut = `Sur l'exercice ${p.exercice}, `;
  const rn = p.resultatNet;
  const evo = rn != null ? evolutionResultatDetail(rn, p.resultatNetPrecedent) : null;
  const pct = (x: number | null) => (x != null ? `${nf(x, 1)} %` : '');

  // Partie résultat, selon qu'elle suit le chiffre d'affaires (sujet déjà posé) ou ouvre la phrase.
  const partieResultat = (sujet: boolean): string | null => {
    if (rn == null) return null;
    const de = sujet ? '' : ` de ${p.nom}`;
    if (!evo) {
      if (!sujet) return rn < 0 ? `${p.nom} enregistre une perte nette de ${montantFcfa(Math.abs(rn))}` : `${p.nom} enregistre un résultat net de ${montantFcfa(rn)}`;
      return rn < 0 ? `la perte nette s'établit à ${montantFcfa(Math.abs(rn))}` : `le résultat net s'établit à ${montantFcfa(rn)}`;
    }
    switch (evo.type) {
      case 'perte_reduite': return `la perte nette${de} se réduit de ${pct(evo.pct)}`;
      case 'perte_aggravee': return `la perte nette${de} se creuse de ${pct(evo.pct)}, à ${montantFcfa(Math.abs(rn))}`;
      case 'retour_benefice': return `${sujet ? 'la société' : p.nom} revient au bénéfice, avec un résultat net de ${montantFcfa(rn)}`;
      case 'passage_perte': return `${sujet ? 'la société' : p.nom} passe en perte, avec un résultat net de ${montantFcfa(rn)}`;
      case 'hausse': return `le résultat net${de} progresse de ${pct(evo.pct)}, à ${montantFcfa(rn)}`;
      case 'baisse': return `le résultat net${de} recule de ${pct(evo.pct)}, à ${montantFcfa(rn)}`;
      case 'stable': return `le résultat net${de} est stable, à ${montantFcfa(rn)}`;
    }
  };

  if (p.chiffreAffaires == null) return insecable(`${debut}${partieResultat(false)}.`);
  const c = croissance(p.chiffreAffaires, p.chiffreAffairesPrecedent);
  let ca = `le chiffre d'affaires de ${p.nom} s'élève à ${montantFcfa(p.chiffreAffaires)}`;
  if (c != null) ca += Math.round(c * 10) === 0 ? ', stable sur un an' : `, en ${c > 0 ? 'hausse' : 'baisse'} de ${pct(Math.abs(c))}`;
  const r = partieResultat(true);
  return insecable(`${debut}${ca}${r ? ` ; ${r}` : ''}.`);
}

export interface PointAnnuel { exercice: number; chiffreAffaires: number | null; resultatNet: number | null }

/**
 * CA et résultat net par exercice, 5 derniers, ordre croissant. Même préséance
 * que `exerciceRetenu` : le compte de résultat (SYSCOHADA) l'emporte ; à défaut
 * `fundamentals`, la ligne corrigée à la main en priorité.
 */
export function serieAnnuelle(
  income: { periode: string | number; revenu_total: number | null; resultat_net: number | null }[],
  fundamentals: { year: number | null; revenue: number | null; net_income: number | null; is_manual?: boolean | null }[],
  n = 5,
): PointAnnuel[] {
  const parAn = new Map<number, PointAnnuel>();
  for (const f of [...fundamentals].sort((a, b) => (a.is_manual ? 1 : 0) - (b.is_manual ? 1 : 0))) {
    if (f.year != null) parAn.set(f.year, { exercice: f.year, chiffreAffaires: f.revenue, resultatNet: f.net_income });
  }
  for (const i of income) {
    const an = Number(String(i.periode).slice(0, 4));
    if (Number.isFinite(an)) parAn.set(an, { exercice: an, chiffreAffaires: i.revenu_total, resultatNet: i.resultat_net });
  }
  return [...parAn.values()]
    .filter((p) => p.chiffreAffaires != null || p.resultatNet != null)
    .sort((a, b) => a.exercice - b.exercice)
    .slice(-n);
}
