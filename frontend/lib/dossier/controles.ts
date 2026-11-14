/**
 * Contrôles de cohérence d'un dossier valeur — module PUR et testé.
 *
 * Le worker d'impression (video/dossiers.mjs) REFUSE de ranger un dossier
 * dont cette liste n'est pas vide, comme il refuse déjà un dossier qui
 * déborde. Motif : le dossier SNTS du 10/10/2026 a été envoyé aux porteurs
 * avec « exercice 2026-T1 » au-dessus de montants annuels et un chiffre
 * d'affaires « en recul de 52 % » faux. Chacune de ces trois contradictions
 * aurait été attrapée ici.
 *
 * Une donnée ABSENTE n'est pas une incohérence : elle est déclarée dans le
 * dossier (panneau 12). Ne sont contrôlées que des valeurs présentes qui se
 * contredisent.
 */
import type { DossierValeur } from './build';

const annuel = (p: string | null | undefined) => p != null && /^\d{4}$/.test(p);
const suffixe = (p: string) => p.replace(/^\d{4}-?/, '');

type Entree = Pick<DossierValeur, 'chiffres_cles' | 'identite' | 'trajectoire' | 'qualite_resultat'> & {
  suivi: Pick<DossierValeur['suivi'], 'intermediaire'>;
} & Partial<Pick<DossierValeur, 'placement' | 'bande_per' | 'reactions' | 'per_glissant'>>;

export function controlerDossier(d: Entree): string[] {
  const a: string[] = [];
  const c = d.chiffres_cles;

  if (c.exercice != null && !annuel(c.exercice)) {
    a.push(`Exercice de référence « ${c.exercice} » : ce n’est pas un exercice annuel, alors que les montants affichés le sont.`);
  }
  const mixtes = d.trajectoire.filter((t) => !annuel(t.exercice)).map((t) => t.exercice);
  if (mixtes.length) {
    a.push(`La trajectoire mêle des périodes non annuelles (${mixtes.join(', ')}) à des exercices annuels.`);
  }
  // Lue sur une période non annuelle, ou sur un autre exercice que la référence.
  const q = d.qualite_resultat;
  if (q && (!annuel(q.periode) || (c.exercice != null && q.periode !== c.exercice))) {
    a.push(`La qualité du résultat est lue sur « ${q.periode} », qui n’est pas l’exercice annuel de référence.`);
  }
  const i = d.suivi.intermediaire;
  if (i && suffixe(i.periode) !== suffixe(i.periodePrecedente)) {
    a.push(`Comparaison intermédiaire de deux durées différentes : « ${i.periode} » contre « ${i.periodePrecedente} ».`);
  }
  for (const [libelle, v] of [['un an', c.croissance_ca_1an], ['deux ans', c.croissance_ca_2ans]] as const) {
    if (v != null && Math.abs(v) > 2) {
      a.push(`Croissance du chiffre d’affaires sur ${libelle} de ${(v * 100).toFixed(0)} % : à vérifier (unité ou période).`);
    }
  }
  const actions = d.identite.actions;
  if (c.capitalisation != null && c.cours != null && actions != null && actions > 0) {
    const attendue = c.cours * actions;
    if (Math.abs(c.capitalisation - attendue) / attendue > 0.01) {
      a.push('La capitalisation affichée ne correspond pas au cours multiplié par le nombre d’actions.');
    }
  }

  /* Panneaux ajoutés au lot 4a. Chacun est contrôlé sur ce qui le rendrait faux
     sans que rien ne l'affiche : une valeur non finie, une médiane sans assez de
     mesures, un placement dont le cours et la valeur ne se recoupent pas. */
  const p = d.placement;
  if (p) {
    const attendue = p.investi * (p.cours_fin / p.cours_depart);
    if (![p.valeur_cours, p.valeur_totale, p.dividendes_nets, p.titres].every(Number.isFinite)) {
      a.push('Le placement d’un million de FCFA contient une valeur non finie.');
    } else if (Math.abs(p.valeur_cours - attendue) / attendue > 1e-6) {
      a.push('Le placement : la valeur du titre ne correspond pas à la variation du cours entre les deux dates.');
    }
    if (p.date_depart >= p.date_fin) a.push('Le placement : la date de départ n’est pas antérieure à la date de fin.');
    if (p.dividendes_nets < 0) a.push('Le placement : des dividendes nets négatifs.');
  }
  const b = d.bande_per;
  if (b) {
    if (b.points.some((x) => !(x.per > 0) || !Number.isFinite(x.per))) a.push('La bande de PER contient un PER nul, négatif ou non fini.');
    if (b.points.length < 3) a.push('La bande de PER repose sur moins de trois exercices.');
  }
  const r = d.reactions;
  if (r) {
    if (r.lignes.length > 8) a.push('La réaction aux publications dépasse huit publications.');
    if (r.resume.mediane != null && r.resume.nMesurees < 3) a.push('Une médiane de réactions est affichée avec moins de trois mesures.');
    if (r.lignes.some((l) => l.ecartIndicePct != null && !Number.isFinite(l.ecartIndicePct))) a.push('Une réaction à une publication n’est pas un nombre fini.');
  }
  if (d.per_glissant?.valeur != null && !(d.per_glissant.valeur > 0 && Number.isFinite(d.per_glissant.valeur))) {
    a.push('Le PER sur douze mois glissants n’est pas un nombre positif.');
  }
  return a;
}
