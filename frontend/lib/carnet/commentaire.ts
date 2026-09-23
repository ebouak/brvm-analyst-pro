/**
 * Lecture commentée d'une séance : carnet d'ordres, signal du jour, actualité.
 *
 * ── La règle qui gouverne ce module ──
 * Il JUXTAPOSE des constats, il n'en tire jamais de cause. « 12 790 titres
 * offerts sans acheteur » et « un communiqué a paru hier » sont deux faits ;
 * écrire que le second explique le premier serait une affirmation que rien ne
 * soutient. Le carnet ne dit pas POURQUOI les ordres sont là.
 *
 * Trois interdits, qui sont la raison d'être d'un module plutôt que d'un texte
 * libre confié à un modèle :
 *  1. aucun chiffre qui ne vienne d'un champ reçu ;
 *  2. aucun verbe de causalité entre les trois sources ;
 *  3. aucune recommandation — ni « à acheter », ni « à surveiller », ni
 *     « opportunité ». HOLD veut dire que le moteur s'abstient, et le
 *     déséquilibre d'un carnet n'est pas un conseil.
 *
 * Ce que le lecteur doit pouvoir faire : relire chaque phrase et retrouver le
 * chiffre dans l'écran juste au-dessus.
 */

export interface CarnetSeance {
  date_marche: string;
  qte_achat: number | null;
  cours_achat: number | null;
  qte_vente: number | null;
  cours_vente: number | null;
  achat_au_marche: boolean;
  vente_au_marche: boolean;
  cours_reference: number | null;
}

export interface SignalSeance {
  date_marche: string;
  signal: string;
  confiance: number | null;
}

export interface ActualiteRecente {
  titre: string;
  date_publication: string;
}

/** Un constat : une phrase, et l'origine du fait dont elle sort. */
export interface Constat {
  origine: 'carnet' | 'signal' | 'actualite';
  texte: string;
}

export interface Commentaire {
  constats: Constat[];
  /** Ce que ces constats ne permettent PAS de dire. Jamais vide. */
  limites: string[];
}

const nb = (v: number) => v.toLocaleString('fr-FR');
const pc = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

const jour = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Écart en jours entre deux dates ISO. `null` si l'une est illisible. */
export function ecartJours(a: string, b: string): number | null {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((x - y) / 86_400_000);
}

/** Fourchette en % du milieu. `null` si un côté manque ou est « au marché ». */
export function fourchettePct(c: CarnetSeance): number | null {
  if (c.achat_au_marche || c.vente_au_marche) return null;
  const a = c.cours_achat;
  const v = c.cours_vente;
  if (a == null || v == null || a <= 0 || v <= 0 || v < a) return null;
  return ((v - a) / ((v + a) / 2)) * 100;
}

export function commenterSeance(entree: {
  carnet: CarnetSeance | null;
  signal: SignalSeance | null;
  actualites?: ActualiteRecente[];
}): Commentaire {
  const { carnet, signal } = entree;
  const actualites = entree.actualites ?? [];
  const constats: Constat[] = [];
  const limites: string[] = [];

  if (carnet) {
    const a = carnet.qte_achat ?? 0;
    const v = carnet.qte_vente ?? 0;
    const q = jour(carnet.date_marche);

    if (a === 0 && v === 0) {
      constats.push({ origine: 'carnet', texte: `Aucun ordre n'est resté en carnet à la clôture du ${q}.` });
    } else if (a === 0) {
      constats.push({ origine: 'carnet', texte: `À la clôture du ${q}, ${nb(v)} titres restaient offerts à la vente, sans aucun acheteur en face.` });
    } else if (v === 0) {
      constats.push({ origine: 'carnet', texte: `À la clôture du ${q}, ${nb(a)} titres restaient demandés à l'achat, sans aucun vendeur en face.` });
    } else {
      const cote = a >= v ? 'achat' : 'vente';
      const rapport = Math.max(a, v) / Math.min(a, v);
      constats.push({
        origine: 'carnet',
        texte: rapport >= 3
          ? `À la clôture du ${q}, les ordres non servis penchaient du côté ${cote} : ${nb(a)} titres demandés contre ${nb(v)} offerts.`
          : `À la clôture du ${q}, ${nb(a)} titres restaient demandés et ${nb(v)} offerts.`,
      });
    }

    const f = fourchettePct(carnet);
    if (f != null) {
      constats.push({ origine: 'carnet', texte: `L'écart entre le meilleur acheteur et le meilleur vendeur était de ${pc(f)} — le coût d'un aller-retour immédiat.` });
    } else if (carnet.achat_au_marche || carnet.vente_au_marche) {
      constats.push({
        origine: 'carnet',
        texte: `Un ordre « au marché » était en attente du côté ${carnet.vente_au_marche ? 'vente' : 'achat'} : sans limite de cours, aucun écart ne peut en être tiré.`,
      });
    }
    limites.push("Le carnet ne dit ni qui a passé ces ordres, ni pourquoi. Seule la meilleure limite de chaque côté est publiée : ce n'est pas la profondeur complète du marché.");
  }

  if (signal) {
    const c = signal.confiance == null ? null : Math.round(signal.confiance * (signal.confiance <= 1 ? 100 : 1));
    const suffixe = c == null ? '' : `, avec une confiance de ${c} %`;
    constats.push({
      origine: 'signal',
      texte: signal.signal === 'HOLD'
        ? `Le moteur quantitatif s'abstient sur la séance du ${jour(signal.date_marche)} — signal HOLD${suffixe}. Ce n'est pas un avis neutre, mais l'absence de signal net.`
        : `Le moteur quantitatif affiche ${signal.signal} sur la séance du ${jour(signal.date_marche)}${suffixe}.`,
    });
    if (carnet && signal.date_marche !== carnet.date_marche) {
      const j = ecartJours(signal.date_marche, carnet.date_marche);
      limites.push(
        j == null
          ? 'Le signal et le carnet ne portent pas sur la même séance.'
          : `Le signal porte sur une séance ${j > 0 ? 'postérieure' : 'antérieure'} de ${Math.abs(j)} jour${Math.abs(j) > 1 ? 's' : ''} à celle du carnet : le bulletin de la cote paraît après la clôture.`,
      );
    }
  }

  if (actualites.length > 0) {
    const ref = carnet?.date_marche ?? signal?.date_marche ?? null;
    const a0 = actualites[0]!;
    const j = ref ? ecartJours(ref, a0.date_publication) : null;
    const quand = j == null || j < 0 ? `le ${jour(a0.date_publication)}`
      : j === 0 ? 'le jour même'
      : `${j} jour${j > 1 ? 's' : ''} avant cette séance`;
    constats.push({
      origine: 'actualite',
      texte: `${actualites.length === 1 ? 'Une publication concerne' : `${actualites.length} publications concernent`} cette société, la plus récente parue ${quand} : « ${a0.titre} ».`,
    });
    limites.push("Cette actualité est rapprochée de la séance par sa seule date. Rien ici n'établit qu'elle explique les ordres en carnet ou le signal.");
  }

  if (constats.length === 0) {
    return {
      constats: [{ origine: 'carnet', texte: 'Aucune donnée de séance exploitable pour commenter cette valeur.' }],
      limites: ["Ni carnet d'ordres, ni signal, ni publication récente ne sont disponibles."],
    };
  }

  limites.push('Ces constats décrivent une séance passée. Ils ne constituent pas un conseil en investissement.');
  return { constats, limites };
}
