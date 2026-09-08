// frontend/lib/agent/outils.ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastMarketDate } from '@/lib/marketDate';

/**
 * Boîte à outils de l'agent conversationnel.
 *
 * POURQUOI DES OUTILS PLUTÔT QU'UN PROMPT GAVÉ. Jusqu'ici le contexte était
 * empilé dans le prompt AVANT de connaître la question : plafonné à 20 valeurs
 * de la watchlist, aveugle au reste de la cote, et coûteux à chaque message.
 * L'agent demande désormais ce dont il a besoin.
 *
 * Et cela RENFORCE la garantie d'honnêteté au lieu de l'affaiblir : chaque
 * chiffre provient d'un retour de fonction, jamais d'un bloc de texte que le
 * modèle pourrait mal relire. Une donnée absente devient un « erreur » ou un
 * `null` explicite — impossible à inventer.
 *
 * LECTURE SEULE, SANS EXCEPTION. Aucun outil n'écrit. Élargir ce que l'agent
 * voit ne doit jamais élargir ce qu'il peut faire : c'est ce qui rend sûr de
 * le brancher sur un compte.
 */

export interface DefinitionOutil {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

/** Ce que le modèle voit : la liste des capacités et leurs paramètres. */
export const OUTILS: DefinitionOutil[] = [
  {
    type: 'function',
    function: {
      name: 'mon_portefeuille',
      description:
        "Positions réelles de l'utilisateur : quantité, prix de revient, cours actuel, plus ou moins-value latente. À utiliser pour toute question du type « combien j'ai gagné », « mon portefeuille », « ma performance ».",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mes_alertes',
      description:
        "Alertes configurées par l'utilisateur : valeur, type, seuil, active ou non, date du dernier déclenchement. À utiliser pour « quelles alertes j'ai », « est-ce que mon alerte s'est déclenchée ».",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cours_valeur',
      description:
        "Cours de clôture, variation, volume et signal de la dernière séance pour N'IMPORTE QUELLE valeur cotée à la BRVM — pas seulement celles suivies par l'utilisateur. Accepte un code (SNTS) ou un nom de société.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM (ex. SNTS) ou nom de la société' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'historique_valeur',
      description:
        "Évolution d'une valeur sur une période : cours de début et de fin, variation, plus haut, plus bas, nombre de séances. À utiliser dès qu'une question porte sur le passé — « depuis quand elle baisse », « sur trois mois », « cette semaine », « sa tendance ».",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM ou nom de la société' },
          jours: {
            type: 'string',
            description: 'Profondeur en jours calendaires (7, 30, 90, 365). Défaut 30.',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'palmares_seance',
      description:
        "Classement de la dernière séance : plus fortes hausses, plus fortes baisses, ou plus gros volumes échangés. À utiliser pour « qui monte », « quelles sont les meilleures performances », « où sont passés les échanges ».",
      parameters: {
        type: 'object',
        properties: {
          critere: {
            type: 'string',
            description: "L'un de : hausses, baisses, volumes",
          },
        },
        required: ['critere'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualites_valeur',
      description:
        "Dernières actualités publiées concernant une société (titre, date, lien). À utiliser pour « quoi de neuf sur », « des nouvelles de », « pourquoi elle bouge ».",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM ou nom de la société' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'liquidite_valeur',
      description:
        "Facilité d'achat et de revente d'une valeur : score de liquidité, classe, spread estimé, impact prix. Question vitale sur la BRVM, marché étroit où l'on peut rester bloqué sur une position. À utiliser pour « est-ce liquide », « puis-je revendre facilement », « y a-t-il des acheteurs ».",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM ou nom de la société' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dividendes_valeur',
      description:
        'Dividendes versés par une société : montant, exercice, date de détachement, date de paiement, et rendement calculé sur le cours actuel. À utiliser pour « quel dividende », « quel rendement », « quand est le détachement ».',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM (ex. SNTS) ou nom de la société' },
        },
        required: ['code'],
      },
    },
  },
];

/* --------------------------------------------------------- résolution code */

/**
 * Un utilisateur écrit « Sonatel », pas « SNTS ». Sans cette résolution,
 * l'agent répondrait « valeur inconnue » sur une société parfaitement cotée —
 * la frustration exacte qu'on cherche à supprimer.
 */
async function resoudreCode(db: SupabaseClient, saisie: string): Promise<string | null> {
  const brut = saisie.trim().toUpperCase();
  const { data: exact } = await db
    .from('brvm_instruments')
    .select('code')
    .eq('code', brut)
    .maybeSingle();
  if (exact) return exact.code as string;

  const { data: parNom } = await db
    .from('brvm_instruments')
    .select('code, designation')
    .ilike('designation', `%${saisie.trim()}%`)
    .limit(2);
  // Deux correspondances = ambigu : mieux vaut dire qu'on n'a pas tranché que
  // répondre sur la mauvaise société.
  if (parNom && parNom.length === 1) return parNom[0].code as string;
  return null;
}

/* ------------------------------------------------------------- exécuteurs */

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

async function monPortefeuille(db: SupabaseClient, userId: string) {
  const [{ data: positions }, asOf] = await Promise.all([
    db
      .from('portfolios_positions')
      .select('code, quantite, prix_entree, date_entree')
      .eq('user_id', userId),
    getLastMarketDate(db),
  ]);

  if (!positions || positions.length === 0) {
    return { positions: [], message: "L'utilisateur n'a aucune position enregistrée." };
  }

  const codes = [...new Set(positions.map((p) => p.code as string))];
  const { data: cours } = asOf
    ? await db
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', asOf)
        .in('code', codes)
    : { data: [] as { code: string; cours_jour: number | null }[] };
  const parCode = new Map(
    (cours ?? []).map((c) => [c.code as string, c.cours_jour as number | null]),
  );

  let investi = 0;
  let valorise = 0;
  const lignes = positions.map((p) => {
    const q = Number(p.quantite);
    const pru = Number(p.prix_entree);
    const actuel = parCode.get(p.code as string) ?? null;
    investi += q * pru;
    if (actuel != null) valorise += q * actuel;
    return {
      code: p.code,
      quantite: q,
      prix_revient: pru,
      // null explicite plutôt qu'une estimation : la règle « aucun chiffre
      // inventé » vaut aussi pour les valeurs dérivées.
      cours_actuel: actuel,
      plus_value: actuel != null ? q * (actuel - pru) : null,
      plus_value_pct: actuel != null && pru > 0 ? ((actuel - pru) / pru) * 100 : null,
      depuis: p.date_entree,
    };
  });

  const complet = lignes.every((l) => l.cours_actuel != null);
  return {
    seance: asOf,
    positions: lignes,
    total_investi: investi,
    // Le total n'est donné que si TOUTES les lignes sont valorisées : un total
    // partiel présenté comme complet serait un chiffre faux.
    total_valorise: complet ? valorise : null,
    plus_value_totale: complet ? valorise - investi : null,
    note: complet ? undefined : 'Certaines lignes sans cours du jour : total non calculable.',
  };
}

async function mesAlertes(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from('alerts')
    .select('code, type, seuil, actif, declenchee_le, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    return { alertes: [], message: "L'utilisateur n'a configuré aucune alerte." };
  }
  return {
    alertes: data.map((a) => ({
      valeur: a.code,
      type: a.type,
      seuil: a.seuil,
      active: a.actif,
      dernier_declenchement: a.declenchee_le ?? 'jamais',
    })),
    rappel: "L'agent est en lecture seule : il ne peut ni créer ni modifier une alerte.",
  };
}

async function coursValeur(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };

  const asOf = await getLastMarketDate(db);
  if (!asOf) return { erreur: 'Aucune séance disponible en base.' };

  const [{ data: a }, { data: s }, { data: i }] = await Promise.all([
    db
      .from('brvm_actions_daily')
      .select('cours_jour, variation_pct, volume, valeur_echangee, cours_precedent')
      .eq('date_marche', asOf)
      .eq('code', code)
      .maybeSingle(),
    db
      .from('signals_daily')
      .select('signal, confiance')
      .eq('date_marche', asOf)
      .eq('code', code)
      .maybeSingle(),
    db.from('brvm_instruments').select('designation, secteur, pays').eq('code', code).maybeSingle(),
  ]);

  if (!a) return { code, erreur: `Pas de cotation pour ${code} à la séance du ${asOf}.` };
  return {
    code,
    societe: i?.designation ?? null,
    secteur: i?.secteur ?? null,
    seance: asOf,
    cours: a.cours_jour,
    variation_pct: a.variation_pct,
    cours_precedent: a.cours_precedent,
    volume: a.volume,
    valeur_echangee: a.valeur_echangee,
    signal: s?.signal ?? null,
    confiance: s?.confiance ?? null,
  };
}

async function dividendesValeur(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };

  const asOf = await getLastMarketDate(db);
  const [{ data: divs }, { data: a }] = await Promise.all([
    db
      .from('dividends')
      .select('exercice, montant, devise, ex_date, payment_date')
      .eq('code', code)
      .order('exercice', { ascending: false })
      .limit(6),
    asOf
      ? db
          .from('brvm_actions_daily')
          .select('cours_jour')
          .eq('date_marche', asOf)
          .eq('code', code)
          .maybeSingle()
      : Promise.resolve({ data: null as { cours_jour: number | null } | null }),
  ]);

  /* FILTRE DE FIABILITE — audit du 2026-09-08 contre Sika Finance : sur 353
     lignes de la table, 179 sont inexploitables.
       · 90 portent un montant EGAL a l'annee (extraction bdfin ratee) ;
       · 68 portent un montant a zero (pages societe sikafinance) ;
       · 21 n'ont pas d'exercice.
     Servir ces lignes telles quelles donnait « rendement 0 % » ou « dividende
     de 2013 FCFA » avec l'aplomb d'un chiffre verifie. Mieux vaut dire qu'on
     ne sait pas : la regle « aucun chiffre invente » couvre aussi les chiffres
     que la base contient a tort. */
  const fiables = (divs ?? []).filter(
    (d) =>
      d.exercice != null &&
      d.montant != null &&
      Number(d.montant) > 0 &&
      Number(d.montant) !== Number(d.exercice),
  );

  if (fiables.length === 0) {
    return {
      code,
      dividendes: [],
      message: `Aucun dividende fiable en base pour ${code}. Ne rien affirmer sur son dividende.`,
    };
  }

  const cours = (a?.cours_jour as number | null) ?? null;
  const dernier = fiables[0];
  const divs2 = fiables;
  return {
    code,
    cours_actuel: cours,
    // Rendement calculé seulement si les deux termes existent : jamais estimé.
    rendement_pct:
      cours && cours > 0 && dernier.montant != null ? (Number(dernier.montant) / cours) * 100 : null,
    dividendes: divs2.map((d) => ({
      exercice: d.exercice,
      montant: `${fr(Number(d.montant))} ${d.devise ?? 'FCFA'}`,
      detachement: d.ex_date ?? 'inconnu',
      /* Le champ n'est mentionne QUE s'il existe. La date de paiement etait
         absente de toute la table jusqu'a l'import richbourse (2026-09-08) ;
         elle ne couvre aujourd'hui que la campagne en cours. L'annoncer
         « inconnu » partout donnerait l'illusion d'une donnee generalement
         disponible. */
      ...(d.payment_date ? { paiement: d.payment_date } : {}),
    })),
    avertissement:
      'Un dividende passé ne préjuge pas des suivants. Ce rendement est historique, pas une promesse.',
  };
}

async function historiqueValeur(db: SupabaseClient, saisie: string, joursTexte?: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };

  /* Bornes explicites : une profondeur libre laisserait le modèle demander
     dix ans de séances, soit des milliers de lignes dans le contexte. */
  const jours = Math.min(Math.max(Number(joursTexte) || 30, 5), 400);
  const depuis = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);

  const { data } = await db
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour, volume')
    .eq('code', code)
    .gte('date_marche', depuis)
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: true });

  const pts = (data ?? []).filter((p) => p.cours_jour != null);
  if (pts.length < 2) {
    return { code, erreur: `Moins de deux séances cotées pour ${code} sur ${jours} jours.` };
  }

  const debut = pts[0];
  const fin = pts[pts.length - 1];
  const cours = pts.map((p) => Number(p.cours_jour));
  const haut = Math.max(...cours);
  const bas = Math.min(...cours);
  const c0 = Number(debut.cours_jour);
  const c1 = Number(fin.cours_jour);

  return {
    code,
    /* La période RÉELLE, pas celle demandée : sur un marché où toutes les
       valeurs ne cotent pas chaque jour, annoncer « sur 90 jours » quand on
       n'a que 4 séances serait trompeur. */
    du: debut.date_marche,
    au: fin.date_marche,
    seances_cotees: pts.length,
    cours_debut: c0,
    cours_fin: c1,
    variation_pct: c0 > 0 ? ((c1 - c0) / c0) * 100 : null,
    plus_haut: haut,
    plus_bas: bas,
    volume_moyen: Math.round(
      pts.reduce((s, p) => s + (Number(p.volume) || 0), 0) / pts.length,
    ),
  };
}

async function palmaresSeance(db: SupabaseClient, critere: string) {
  const asOf = await getLastMarketDate(db);
  if (!asOf) return { erreur: 'Aucune séance disponible en base.' };

  const c = critere.toLowerCase();
  const parVolume = /volume|echange|échange|capitau/.test(c);
  const baisses = /baiss|recul|perd|pire/.test(c);

  const { data } = await db
    .from('brvm_actions_daily')
    .select('code, cours_jour, variation_pct, volume, valeur_echangee')
    .eq('date_marche', asOf)
    .not(parVolume ? 'volume' : 'variation_pct', 'is', null);

  const lignes = (data ?? []).sort((a, b) =>
    parVolume
      ? Number(b.volume) - Number(a.volume)
      : baisses
        ? Number(a.variation_pct) - Number(b.variation_pct)
        : Number(b.variation_pct) - Number(a.variation_pct),
  );

  return {
    seance: asOf,
    critere: parVolume ? 'volumes échangés' : baisses ? 'plus fortes baisses' : 'plus fortes hausses',
    valeurs_cotees: lignes.length,
    classement: lignes.slice(0, 5).map((l) => ({
      code: l.code,
      cours: l.cours_jour,
      variation_pct: l.variation_pct,
      volume: l.volume,
    })),
  };
}

async function actualitesValeur(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };

  /* `ticker_codes` et NON `instrument_code`.
     Sonde du 2026-09-08 : sur les 400 actualités les plus récentes,
     instrument_code est renseigné 0 fois, ticker_codes 144 fois. La première
     version de cet outil filtrait sur instrument_code — elle ne pouvait donc
     RIEN renvoyer, en silence et sans jamais échouer : l'agent répondait
     « aucune actualité » sur des sociétés qui en avaient. */
  const { data } = await db
    .from('brvm_news')
    .select('titre, date_publication, source_url, source_label')
    .contains('ticker_codes', [code])
    /* hidden : des actualités sont masquées côté rédaction. Les servir ici
       contournerait cette décision éditoriale. */
    .not('hidden', 'is', true)
    .order('date_publication', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) {
    return { code, actualites: [], message: `Aucune actualité en base pour ${code}.` };
  }
  return {
    code,
    actualites: data.map((n) => ({
      titre: n.titre,
      date: n.date_publication,
      source: n.source_label ?? null,
      lien: n.source_url ?? null,
    })),
  };
}

async function liquiditeValeur(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };

  const { data } = await db
    .from('liquidity_daily')
    .select(
      'date_marche, score, classe, presence_pct, amihud, spread_roll_pct, valeur_moyenne_30j, seances_traitees, flux_net_pct',
    )
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { code, erreur: `Pas de mesure de liquidité pour ${code}.` };
  return {
    code,
    seance: data.date_marche,
    // score null sous 10 séances : le moteur refuse de noter sur trop peu.
    score_sur_100: data.score,
    classe: data.classe,
    presence_pct: data.presence_pct,
    valeur_moyenne_30j_fcfa: data.valeur_moyenne_30j,
    spread_estime_pct: data.spread_roll_pct,
    flux_net_pct: data.flux_net_pct,
    seances_observees: data.seances_traitees,
    avertissement:
      "Le carnet d'ordres n'étant pas publié par la BRVM, la profondeur et le coût d'exécution sont ESTIMÉS à partir des échanges observés, jamais mesurés directement.",
  };
}

/* ------------------------------------------------------------ répartition */

/**
 * Exécute l'outil demandé par le modèle. Ne lève jamais : une erreur devient
 * un objet `erreur` que le modèle sait restituer honnêtement, là où une
 * exception ferait échouer tout le message.
 */
export async function executerOutil(
  db: SupabaseClient,
  userId: string,
  nom: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (nom) {
      case 'mon_portefeuille':
        return await monPortefeuille(db, userId);
      case 'mes_alertes':
        return await mesAlertes(db, userId);
      case 'cours_valeur':
        return await coursValeur(db, String(args.code ?? ''));
      case 'dividendes_valeur':
        return await dividendesValeur(db, String(args.code ?? ''));
      case 'historique_valeur':
        return await historiqueValeur(
          db,
          String(args.code ?? ''),
          args.jours == null ? undefined : String(args.jours),
        );
      case 'palmares_seance':
        return await palmaresSeance(db, String(args.critere ?? 'hausses'));
      case 'actualites_valeur':
        return await actualitesValeur(db, String(args.code ?? ''));
      case 'liquidite_valeur':
        return await liquiditeValeur(db, String(args.code ?? ''));
      default:
        return { erreur: `Outil inconnu : ${nom}` };
    }
  } catch (err) {
    console.error('agent/outils: echec', {
      nom,
      message: err instanceof Error ? err.message : String(err),
    });
    return { erreur: 'Donnée temporairement indisponible.' };
  }
}
