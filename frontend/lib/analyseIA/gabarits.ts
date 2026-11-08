/**
 * Réponses Jev (module PUR) : gabarits de phrases remplis UNIQUEMENT avec des
 * chiffres lus en base. Aucun LLM, aucun calcul hors des variations entre deux
 * valeurs lues. Une donnée absente se dit ; elle ne se remplace pas.
 * Des constats, jamais un conseil.
 */
import type { ResumeHistorique } from './historique';
import type { LectureTechniqueIA } from './technique';
import type {
  Actualite,
  CarnetSeance,
  ComptesExercice,
  CoursJour,
  LigneDividende,
  MesureLiquidite,
  Publication,
} from './types';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function dateLongue(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j === 1 ? '1er' : j} ${MOIS[(m ?? 1) - 1]} ${a}`;
}

export function nombre(n: number, decimales = 0): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Montant en FCFA, en milliards ou millions au-delà d'un million. */
export function montant(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${nombre(n / 1e9, 2)} Md FCFA`;
  if (a >= 1e6) return `${nombre(n / 1e6, 1)} M FCFA`;
  return `${nombre(n)} FCFA`;
}

const cours = (n: number) => `${nombre(n, Number.isInteger(n) ? 0 : 2)} FCFA`;
const pct = (n: number) => `${nombre(Math.abs(n), 2)} %`;
const sens = (v: number) => (Math.round(v * 100) === 0 ? 'stable' : v > 0 ? `en hausse de ${pct(v)}` : `en baisse de ${pct(v)}`);
const ecart = (a: number, b: number) => (a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null);

export interface Valeur {
  code: string;
  nom: string | null;
}
const libelle = (v: Valeur) => (v.nom ? `${v.code} (${v.nom})` : v.code);
const societe = (v: Valeur) => v.nom ?? v.code;

export function gabaritCoursJour(v: Valeur, c: CoursJour | null): string {
  if (!c || c.cours == null) return `Aucune cotation de ${libelle(v)} n’est enregistrée pour la dernière séance sur WESTBOURSE.`;
  const lignes = [
    `À la séance du ${dateLongue(c.seance)}, ${libelle(v)} a clôturé à ${cours(c.cours)}${
      c.variation_pct != null
        ? `, ${sens(c.variation_pct)}${c.cours_precedent != null ? ` par rapport à la séance précédente (${cours(c.cours_precedent)})` : ''}`
        : ''
    }.`,
  ];
  if (c.volume != null && c.volume > 0) {
    lignes.push(
      `${nombre(c.volume)} titre${c.volume > 1 ? 's ont' : ' a'} été échangé${c.volume > 1 ? 's' : ''}${
        c.valeur_echangee != null ? `, pour ${montant(c.valeur_echangee)}` : ''
      }.`,
    );
  } else if (c.volume === 0) {
    lignes.push('Aucun titre n’a été échangé lors de cette séance.');
  }
  return lignes.join(' ');
}

export function gabaritHistorique(v: Valeur, r: ResumeHistorique | null, joursDemandes: number | null): string {
  if (!r) return `L’historique de cours de ${libelle(v)} enregistré sur WESTBOURSE ne compte pas assez de séances pour cette période.`;
  const lignes: string[] = [];
  const entete = joursDemandes == null ? 'Sur toute la période disponible sur WESTBOURSE' : 'Sur la période demandée';
  lignes.push(
    `${entete}, du ${dateLongue(r.du)} au ${dateLongue(r.au)} (${nombre(r.seances_cotees)} séances cotées), le cours de ${v.code} est passé de ${cours(r.cours_debut)} à ${cours(r.cours_fin)}${
      r.variation_pct != null ? `, soit une variation de ${r.variation_pct >= 0 ? '+' : '−'}${pct(r.variation_pct)}` : ''
    }.`,
  );
  lignes.push(
    `Plus haut : ${cours(r.plus_haut.cours)} le ${dateLongue(r.plus_haut.date)}. Plus bas : ${cours(r.plus_bas.cours)} le ${dateLongue(r.plus_bas.date)}.`,
  );
  if (r.volume_moyen != null) lignes.push(`Volume moyen : ${nombre(r.volume_moyen)} titres par séance cotée.`);
  if (joursDemandes != null && r.historique_commence_le === r.du) {
    lignes.push(`L’historique enregistré sur WESTBOURSE commence le ${dateLongue(r.historique_commence_le)}.`);
  }
  if (r.par_annee.length > 1) {
    lignes.push(
      'Par année civile :\n' +
        r.par_annee
          .map(
            (a) =>
              `· ${a.annee} : de ${cours(a.cours_debut)} à ${cours(a.cours_fin)}${
                a.variation_pct != null ? ` (${a.variation_pct >= 0 ? '+' : '−'}${pct(a.variation_pct)})` : ''
              }, ${nombre(a.seances)} séances`,
          )
          .join('\n'),
    );
  }
  return lignes.join('\n');
}

export function gabaritActualites(v: Valeur, actus: Actualite[], pubs: Publication[]): string {
  if (actus.length === 0 && pubs.length === 0) {
    return `Aucune actualité ni publication de ${societe(v)} n’est enregistrée sur WESTBOURSE.`;
  }
  const blocs: string[] = [];
  if (actus.length > 0) {
    blocs.push(
      `Dernières actualités sur ${societe(v)} :\n` +
        actus.slice(0, 6).map((a) => `· ${dateLongue(a.date)} : ${a.titre}${a.source ? ` (${a.source})` : ''}`).join('\n'),
    );
  } else {
    blocs.push(`Aucune actualité sur ${societe(v)} n’est enregistrée sur WESTBOURSE.`);
  }
  if (pubs.length > 0) {
    blocs.push(
      'Dernières publications de la société :\n' + pubs.slice(0, 6).map((p) => `· ${dateLongue(p.date)} : ${p.libelle}`).join('\n'),
    );
  }
  return blocs.join('\n\n');
}

const base = (b: string | null) => (b === 'net' ? 'net d’impôt' : b === 'brut' ? 'brut' : 'base fiscale non précisée');

export function gabaritDividendes(v: Valeur, lignes: LigneDividende[], coursActuel: number | null): string {
  const fiables = [...lignes].sort((a, b) => b.exercice - a.exercice);
  if (fiables.length === 0) return `Aucun dividende vérifié de ${societe(v)} n’est enregistré sur WESTBOURSE.`;
  const sortie: string[] = [
    `Dividendes de ${societe(v)} enregistrés sur WESTBOURSE :\n` +
      fiables
        .slice(0, 8)
        .map(
          (d) =>
            `· Exercice ${d.exercice} : ${nombre(d.montant, Number.isInteger(d.montant) ? 0 : 2)} ${!d.devise || d.devise === 'XOF' ? 'FCFA' : d.devise} par action, ${base(d.base_fiscale)}${
              d.ex_date ? `, détaché le ${dateLongue(d.ex_date)}` : ''
            }${d.payment_date ? `, payé le ${dateLongue(d.payment_date)}` : ''}`,
        )
        .join('\n'),
  ];
  const [dernier, avant] = fiables;
  if (dernier && avant && avant.exercice === dernier.exercice - 1 && avant.base_fiscale === dernier.base_fiscale) {
    const e = ecart(avant.montant, dernier.montant);
    if (e != null) {
      sortie.push(
        `Par rapport à l’exercice ${avant.exercice}, le dividende de l’exercice ${dernier.exercice} est ${Math.round(e * 100) === 0 ? 'inchangé' : `${e > 0 ? 'en hausse' : 'en baisse'} de ${pct(e)}`}.`,
      );
    }
  }
  if (dernier && coursActuel != null && coursActuel > 0) {
    sortie.push(
      `Rapporté au cours de la dernière séance (${cours(coursActuel)}), le dernier dividende (${base(dernier.base_fiscale)}) représente ${pct((dernier.montant / coursActuel) * 100)}.`,
    );
  }
  sortie.push('Un dividende passé ne préjuge pas des suivants.');
  return sortie.join('\n');
}

export function gabaritComptes(v: Valeur, exercices: ComptesExercice[], demande: number | null): string {
  const tries = [...exercices].sort((a, b) => b.exercice - a.exercice);
  if (tries.length === 0) return `Aucun compte annuel de ${societe(v)} n’est enregistré sur WESTBOURSE.`;
  const cible = demande != null ? tries.find((e) => e.exercice === demande) : tries[0];
  const prefixe: string[] = [];
  const ex = cible ?? tries[0]!;
  if (demande != null && !cible) {
    prefixe.push(`Les comptes ${demande} de ${societe(v)} ne sont pas disponibles sur WESTBOURSE. Le dernier exercice enregistré est ${ex.exercice}.`);
  }
  const lignes: string[] = [];
  const ajoute = (l: string, n: number | null) => {
    if (n != null) lignes.push(`· ${l} : ${montant(n)}`);
  };
  ajoute('Chiffre d’affaires ou produit total', ex.revenu_total);
  ajoute('Résultat d’exploitation', ex.resultat_exploitation);
  if (ex.resultat_net != null) lignes.push(`· Résultat net : ${montant(ex.resultat_net)} (${ex.resultat_net >= 0 ? 'bénéfice' : 'perte'})`);
  ajoute('Total du bilan', ex.total_actifs);
  ajoute('Capitaux propres', ex.capitaux_propres);
  ajoute('Dette financière', ex.dette_financiere);
  ajoute('Trésorerie', ex.tresorerie);
  if (lignes.length === 0) return [...prefixe, `Les comptes ${ex.exercice} de ${societe(v)} sont enregistrés sans montant exploitable.`].join(' ');
  const sortie = [...prefixe, `Comptes annuels ${ex.exercice} de ${societe(v)} :\n${lignes.join('\n')}`];
  const prec = tries.find((e) => e.exercice === ex.exercice - 1);
  if (prec) {
    const comp: string[] = [];
    const compare = (l: string, a: number | null, b: number | null) => {
      if (a == null || b == null || a === 0) return;
      if (Math.sign(a) !== Math.sign(b)) {
        comp.push(`${l} : passé ${b >= 0 ? 'd’une perte à un bénéfice' : 'd’un bénéfice à une perte'}`);
        return;
      }
      const e = ecart(a, b)!;
      if (Math.round(e * 100) === 0) comp.push(`${l} stable`);
      // Deux pertes : « en hausse » serait ambigu ; on dit si la perte se réduit ou se creuse.
      else if (a < 0) comp.push(`${l} : perte ${e > 0 ? 'réduite' : 'creusée'} de ${pct(e)}`);
      else comp.push(`${l} ${e > 0 ? 'en hausse' : 'en baisse'} de ${pct(e)}`);
    };
    compare('chiffre d’affaires', prec.revenu_total, ex.revenu_total);
    compare('résultat net', prec.resultat_net, ex.resultat_net);
    if (comp.length > 0) sortie.push(`Par rapport à ${prec.exercice} : ${comp.join(' ; ')}.`);
  }
  if (tries.length > 1) sortie.push(`Exercices enregistrés : ${tries.map((e) => e.exercice).join(', ')}.`);
  return sortie.join('\n');
}

export function gabaritTechnique(v: Valeur, t: LectureTechniqueIA | null): string {
  if (!t) return `L’historique de ${v.code} enregistré sur WESTBOURSE est trop court pour calculer le RSI et le MACD.`;
  const lignes = [`Indicateurs calculés sur les clôtures de ${v.code} jusqu’à la séance du ${dateLongue(t.seance)} (${nombre(t.seances_utilisees)} séances) :`];
  if (t.rsi14 != null) {
    const zone = t.zone_rsi === 'haute' ? 'zone haute (70 ou plus)' : t.zone_rsi === 'basse' ? 'zone basse (30 ou moins)' : 'zone intermédiaire, entre 30 et 70';
    lignes.push(`· RSI 14 séances : ${nombre(t.rsi14, 1)}, ${zone}.`);
  }
  if (t.macd != null && t.signal_macd != null) {
    lignes.push(`· MACD (12, 26, 9) : ${nombre(t.macd, 2)}, ${t.position_macd} de sa ligne de signal (${nombre(t.signal_macd, 2)}).`);
  } else {
    lignes.push('· MACD : pas assez de séances pour le calculer.');
  }
  const mm: string[] = [];
  if (t.mm20 != null) mm.push(`${t.cours >= t.mm20 ? 'au-dessus' : 'en dessous'} de sa moyenne mobile 20 séances (${cours(Math.round(t.mm20))})`);
  if (t.mm50 != null) mm.push(`${t.cours >= t.mm50 ? 'au-dessus' : 'en dessous'} de sa moyenne mobile 50 séances (${cours(Math.round(t.mm50))})`);
  if (mm.length > 0) lignes.push(`· Le cours (${cours(t.cours)}) est ${mm.join(' et ')}.`);
  lignes.push('Ces indicateurs décrivent le passé du cours ; ils ne prévoient pas son évolution.');
  return lignes.join('\n');
}

const cote = (c: CarnetSeance['achat']) =>
  !c ? null : c.au_marche ? `au marché${c.quantite != null ? ` pour ${nombre(c.quantite)} titres` : ''}` : c.cours != null ? `${cours(c.cours)}${c.quantite != null ? ` pour ${nombre(c.quantite)} titres` : ''}` : null;

export function gabaritLiquidite(v: Valeur, l: MesureLiquidite | null, carnet: CarnetSeance | null): string {
  if (!l && !carnet) return `Aucune mesure de liquidité ni carnet d’ordres de ${v.code} n’est enregistré sur WESTBOURSE.`;
  const sortie: string[] = [];
  if (l) {
    const parts: string[] = [];
    if (l.classe && l.score != null) parts.push(`classe ${l.classe}, score ${nombre(l.score)} sur 100`);
    else parts.push('score non calculé (moins de 10 séances observées)');
    sortie.push(`Liquidité de ${v.code}, mesure du ${dateLongue(l.date)} : ${parts.join(', ')}.`);
    const d: string[] = [];
    if (l.presence_pct != null) d.push(`échangé lors de ${nombre(l.presence_pct)} % des séances`);
    if (l.valeur_moyenne_30j != null) d.push(`${montant(l.valeur_moyenne_30j)} échangés par séance en moyenne sur 30 jours`);
    if (d.length > 0) sortie.push(`Le titre a été ${d.join(', ')}.`);
    if (l.spread_pct != null) {
      sortie.push(
        `Écart entre meilleur prix d’achat et de vente : ${pct(l.spread_pct)}, ${l.spread_source === 'carnet' ? 'mesuré sur le carnet d’ordres publié par la BRVM' : 'estimé à partir des échanges'}.`,
      );
    }
  }
  if (carnet) {
    const a = cote(carnet.achat);
    const ve = cote(carnet.vente);
    sortie.push(
      `Carnet d’ordres publié par la BRVM après la séance du ${dateLongue(carnet.date)} : meilleure demande ${a ?? 'aucune'} ; meilleure offre ${ve ?? 'aucune'}. Seule la meilleure limite de chaque côté est publiée.`,
    );
  }
  return sortie.join('\n');
}

export function gabaritConseil(v: Valeur): string {
  return `WESTBOURSE ne donne pas de recommandation d’achat, de vente ou de conservation, ni d’objectif de cours. Je peux en revanche décrire ce que montrent les données de ${v.code} : son cours et son historique, ses comptes publiés, ses dividendes, sa liquidité ou ses indicateurs techniques.`;
}
