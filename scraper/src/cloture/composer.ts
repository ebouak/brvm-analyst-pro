/**
 * Composition du point de clôture Telegram. PUR : aucune I/O, aucune lecture
 * de base — tout arrive en paramètre.
 *
 * POURQUOI CETTE SÉPARATION. Les règles de composition sont ce qui peut
 * silencieusement mal tourner : un bloc vide affiché « Portefeuille : néant »,
 * une mention premium montrée à un abonné, un total partiel présenté comme
 * complet. Aucun de ces défauts ne fait échouer un envoi — ils passent en
 * production et s'affichent chez l'utilisateur. Ils doivent donc être
 * éprouvables sans séance réelle ni réseau.
 *
 * Voir docs/superpowers/specs/2026-09-08-cloture-telegram-design.md §4.
 */

export interface MarcheJour {
  dateFr: string;
  compositeVariationPct: number | null;
  compositeValeur: number | null;
  hausses: number;
  baisses: number;
  stables: number;
  capitauxFcfa: number;
  capitauxEstimes: boolean;
}

export interface AlerteDeclenchee {
  code: string;
  texte: string;
}

export interface LignePortefeuille {
  code: string;
  quantite: number;
  prixRevient: number;
  coursActuel: number | null;
}

export interface LigneWatchlist {
  code: string;
  variationPct: number | null;
}

export interface ContexteCloture {
  marche: MarcheJour;
  /** Vrai = les blocs personnels sont composés. Source : profiles.is_premium. */
  premium: boolean;
  alertes: AlerteDeclenchee[];
  portefeuille: LignePortefeuille[];
  watchlist: LigneWatchlist[];
  /** Première phrase du brief du jour. Null = le bloc n'apparaît pas. */
  brief: string | null;
  briefUrl: string;
}

const nb = (x: number, d = 2): string =>
  x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

const signe = (x: number, d = 2): string => `${x >= 0 ? '+' : '−'}${nb(Math.abs(x), d)}`;

/**
 * Plus-value latente du portefeuille.
 *
 * Le total n'est calculé QUE si toutes les lignes ont un cours du jour. Un
 * total partiel présenté comme complet serait un chiffre faux — même règle que
 * dans l'outil `mon_portefeuille` de l'agent conversationnel.
 */
export function plusValueTotale(
  lignes: LignePortefeuille[],
): { investi: number; valorise: number; gain: number; gainPct: number } | null {
  if (lignes.length === 0) return null;
  if (lignes.some((l) => l.coursActuel == null)) return null;

  let investi = 0;
  let valorise = 0;
  for (const l of lignes) {
    investi += l.quantite * l.prixRevient;
    valorise += l.quantite * (l.coursActuel as number);
  }
  if (investi <= 0) return null;
  return {
    investi,
    valorise,
    gain: valorise - investi,
    gainPct: ((valorise - investi) / investi) * 100,
  };
}

/**
 * Assemble le message. Sans mise en forme Markdown : Telegram est appelé SANS
 * parse_mode — volontairement, une entité mal fermée y ferait rejeter le
 * message entier — donc tout symbole s'afficherait tel quel.
 */
export function composerCloture(ctx: ContexteCloture): string {
  const { marche: m } = ctx;
  const lignes: string[] = [];

  lignes.push(`WESTBOURSE · Clôture du ${m.dateFr}`);
  lignes.push('');

  if (m.compositeVariationPct != null && m.compositeValeur != null) {
    lignes.push(
      `BRVM Composite  ${signe(m.compositeVariationPct)} %  ·  ${nb(m.compositeValeur)} pts`,
    );
  }
  lignes.push(`${m.hausses} hausses · ${m.baisses} baisses · ${m.stables} stables`);
  lignes.push(`${m.capitauxEstimes ? 'Environ ' : ''}${nb(m.capitauxFcfa / 1e9)} Md FCFA échangés`);

  if (ctx.premium) {
    /* Un bloc vide n'apparaît pas : l'absence se traite par le silence, jamais
       par une ligne « néant ». */
    if (ctx.alertes.length > 0) {
      lignes.push('');
      lignes.push(`▸ VOS ALERTES (${ctx.alertes.length})`);
      for (const a of ctx.alertes) lignes.push(`  ${a.texte}`);
    }

    const pv = plusValueTotale(ctx.portefeuille);
    if (pv) {
      lignes.push('');
      lignes.push('▸ VOTRE PORTEFEUILLE');
      lignes.push(`  ${signe(pv.gain, 0)} FCFA  ·  ${signe(pv.gainPct)} %`);
    } else if (ctx.portefeuille.length > 0) {
      /* Positions présentes mais au moins un cours manquant : on le DIT plutôt
         que d'afficher un total partiel ou de taire le portefeuille. */
      lignes.push('');
      lignes.push('▸ VOTRE PORTEFEUILLE');
      lignes.push('  Total non calculable : cours du jour manquant sur une ligne.');
    }

    const suivies = ctx.watchlist.filter((w) => w.variationPct != null);
    if (suivies.length > 0) {
      lignes.push('');
      lignes.push('▸ VOTRE WATCHLIST');
      lignes.push(
        '  ' +
          suivies
            .slice(0, 8)
            .map((w) =>
              w.variationPct === 0
                ? `${w.code} =`
                : `${w.code} ${signe(w.variationPct as number, 1)} %`,
            )
            .join('   '),
      );
    }
  }

  if (ctx.brief) {
    lignes.push('');
    lignes.push('▸ LE BRIEF');
    lignes.push(`  « ${ctx.brief} »`);
    lignes.push(`  ${ctx.briefUrl}`);
  }

  /* Le gratuit voit ce qu'il rate UNE fois, en pied — pas un bloc masqué par
     section. Frustrer trois fois dans un même message ferait fuir. */
  if (!ctx.premium) {
    const manques: string[] = [];
    if (ctx.alertes.length > 0)
      manques.push(`${ctx.alertes.length} alerte${ctx.alertes.length > 1 ? 's' : ''}`);
    if (ctx.portefeuille.length > 0) manques.push('votre portefeuille');
    if (ctx.watchlist.length > 0) manques.push('votre watchlist');
    if (manques.length > 0) {
      lignes.push('');
      lignes.push(`Réservé aux abonnés : ${manques.join(', ')}.`);
    }
  }

  lignes.push('');
  lignes.push('Information de marché, pas un conseil en investissement.');

  return lignes.join('\n');
}
