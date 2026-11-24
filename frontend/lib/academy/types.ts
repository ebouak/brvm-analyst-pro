import { z } from 'zod';
import { illustrationSchema } from './illustrations';

/**
 * Schéma du contenu d'un cours Academy généré par LLM.
 * Le LLM renvoie ce JSON ; il est validé (zod) avant rendu HTML + stockage.
 */

export const SECTION_TYPES = ['definition', 'importance', 'cas', 'piege', 'lexique', 'retenir'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const CATEGORIES = ['general', 'income', 'fundamental', 'technical', 'regulatory', 'evaluation'] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const NIVEAUX = ['debutant', 'intermediaire', 'avance', 'expert'] as const;
export type Niveau = (typeof NIVEAUX)[number];

/** Bloc « chiffres clés » — rangée de cartes KPI sous le texte de la section. */
// ── PLAFONDS (relevés le 2026-11-23, demande de l'exploitant) ──
// Les anciens plafonds (12 sections, 12 lignes de tableau, 3 formules par
// section, une seule série par graphique, aucune année sans donnée) empêchaient
// d'intégrer un cours complet. Ils sont relevés largement, pas supprimés : ils
// bornent aussi la sortie des LLM de génération (lib/academy/generate.ts).
export const statSchema = z.object({
  label: z.string().min(1).max(120),
  valeur: z.string().min(1).max(80),
  /** Précision optionnelle sous la valeur (ex. « contre 836 Md en 1998 »). */
  detail: z.string().max(300).optional().default(''),
});

/** Bloc tableau — colonnes + lignes de texte (rendu stylé, scroll horizontal). */
export const tableauSchema = z
  .object({
    colonnes: z.array(z.string().min(1).max(120)).min(2).max(12),
    lignes: z.array(z.array(z.string().max(600))).min(1).max(60),
    note: z.string().max(1200).optional().default(''),
  })
  .refine((t) => t.lignes.every((l) => l.length === t.colonnes.length), {
    message: 'chaque ligne doit avoir autant de cellules que de colonnes',
  });

/** Bloc étapes — frise numérotée verticale (phases de séance, parcours, dates). */
export const etapeSchema = z.object({
  titre: z.string().min(1).max(200),
  detail: z.string().max(1500).optional().default(''),
  /** Étape mise en avant (ex. la date de détachement). */
  cle: z.boolean().optional().default(false),
});

// ── Blocs éditoriaux (2026-10-20, spec 2026-10-20-academy-lecon-editoriale) ──
// Tous OPTIONNELS : les leçons existantes restent valides telles quelles.

/** Formule clé, avec son exemple chiffré. */
export const formuleSchema = z.object({
  nom: z.string().min(1).max(160),
  expression: z.string().min(1).max(400),
  exemple: z.string().max(800).optional().default(''),
});

/** Pictogrammes disponibles pour le schéma de mécanisme (components/academy/lecon/Pictogramme). */
export const ICONES_FLUX = [
  'entreprise', 'benefices', 'decision', 'actionnaires', 'paiement', 'calendrier', 'graphique', 'piece',
] as const;
export type IconeFlux = (typeof ICONES_FLUX)[number];

/** Étape d'un schéma de mécanisme (A → B → C), dessiné en chaîne. */
export const fluxEtapeSchema = z.object({
  titre: z.string().min(1).max(80),
  detail: z.string().max(300).optional().default(''),
  icone: z.enum(ICONES_FLUX),
});

/** Point d'une liste éditoriale numérotée (critère, piège, idée essentielle). */
export const pointSchema = z.object({
  titre: z.string().min(1).max(200),
  detail: z.string().max(1500).optional().default(''),
  /** « À vérifier » — ce que le lecteur doit contrôler (facultatif). */
  verifier: z.string().max(400).optional().default(''),
});

/**
 * Encadré éditorial (2026-11-23) : règle d'or, lecture clé, avertissement de
 * comparabilité. `ton` ne règle que l'apparence ; il ne porte aucun verdict.
 */
export const TONS_ENCADRE = ['info', 'cle', 'attention', 'alerte'] as const;
export const encadreSchema = z.object({
  ton: z.enum(TONS_ENCADRE).optional().default('info'),
  titre: z.string().min(1).max(200),
  texte: z.string().min(1).max(4000),
});

/**
 * Simulation CALCULÉE au rendu (lib/academy/simulations.ts, simulateurs.ts,
 * simTechnique.ts) à partir de ces hypothèses — jamais des données de marché.
 * Seuls `technique` (clôtures) et le mode réel de `per`/`pb_roe` lisent la base,
 * par des routes en lecture seule, et affichent date et source.
 */
/** Phrase d'introduction au simulateur (facultative), affichée au-dessus des champs. */
const consigneSchema = z.string().min(1).max(300).optional();
/** Valeurs proposées pour le mode « données réelles » (lues en base, jamais saisies). */
const codesSchema = z.array(z.string().regex(/^[A-Z0-9]{3,10}$/)).max(6).optional().default([]);

const secteurAllocSchema = z.object({ nom: z.string().min(1).max(40), pct: z.number().min(0).max(100) });

export const simulationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reinvestissement'),
    actions: z.number().int().positive().max(1_000_000),
    dpa: z.number().positive(),
    cours: z.number().positive(),
    croissance_pct: z.number().min(-50).max(50),
    annees: z.number().int().min(2).max(10),
  }),
  z.object({
    type: z.literal('objectif'),
    revenu_cible: z.number().positive(),
    rendements_pct: z.array(z.number().positive().max(50)).min(2).max(5),
  }),
  /** Atelier d'ordre (lib/academy/carnet.ts) : carnet FICTIF côté vente + carnet réel optionnel. */
  z.object({
    type: z.literal('carnet'),
    niveaux: z.array(z.object({ prix: z.number().positive(), quantite: z.number().int().positive() })).min(2).max(8),
    quantite_defaut: z.number().int().positive().max(1_000_000),
    /** Valeurs proposées pour le « carnet réel » (Bulletin officiel de la cote). */
    codes: z.array(z.string().regex(/^[A-Z0-9]{3,10}$/)).max(6).optional().default([]),
  }),
  /** Répartition par secteur (lib/academy/allocation.ts). */
  z.object({
    type: z.literal('allocation'),
    capital: z.number().positive().max(1_000_000_000),
    secteurs: z.array(secteurAllocSchema).min(2).max(8),
    seuil_secteur_pct: z.number().min(10).max(100).optional().default(35),
  }),
  /** Scénarios de baisse (lib/academy/allocation.ts) : paramètres par défaut. */
  z.object({
    type: z.literal('scenario_baisse'),
    capital: z.number().positive().max(1_000_000_000),
    rendement_pct: z.number().min(0).max(30),
    secteurs: z.array(secteurAllocSchema).min(2).max(8),
  }),
  // ── Simulateurs des leçons (lib/academy/simulateurs.ts, simTechnique.ts) ──
  // Valeurs par défaut = hypothèses écrites dans la leçon ; le lecteur les modifie.
  /** Frais d'un ordre et seuil de rentabilité d'un aller-retour. */
  z.object({
    type: z.literal('frais_ordre'),
    consigne: consigneSchema,
    cours: z.number().positive().max(10_000_000),
    quantite: z.number().int().positive().max(1_000_000),
    taux_frais_pct: z.number().min(0).max(10),
    minimum_fcfa: z.number().min(0).max(1_000_000).optional().default(0),
  }),
  /** Rendement total : dividendes + variation du cours. */
  z.object({
    type: z.literal('rendement_total'),
    consigne: consigneSchema,
    prix_achat: z.number().positive().max(10_000_000),
    prix_vente: z.number().positive().max(10_000_000),
    actions: z.number().int().positive().max(1_000_000),
    dividendes_par_action: z.number().min(0).max(10_000_000),
    annees: z.number().int().min(1).max(30),
  }),
  /** Valeur future d'une épargne (capital de départ + versements mensuels). */
  z.object({
    type: z.literal('valeur_future'),
    consigne: consigneSchema,
    capital_initial: z.number().min(0).max(1_000_000_000),
    versement_mensuel: z.number().min(0).max(100_000_000).optional().default(0),
    taux_pct: z.number().min(0).max(30),
    annees: z.number().int().min(1).max(40),
    objectif: z.number().min(0).max(10_000_000_000).optional().default(0),
  }),
  /** PER et rendement bénéficiaire ; `codes` ouvre le mode « données réelles ». */
  z.object({
    type: z.literal('per'),
    consigne: consigneSchema,
    cours: z.number().positive().max(10_000_000),
    bpa: z.number().positive().max(10_000_000),
    croissance_pct: z.number().min(-49).max(50).optional().default(0),
    annees: z.number().int().min(1).max(10).optional().default(3),
    codes: codesSchema,
  }),
  /** P/B = PER × ROE, sur une à trois sociétés fictives ; `codes` pour le réel. */
  z.object({
    type: z.literal('pb_roe'),
    consigne: consigneSchema,
    societes: z.array(z.object({
      nom: z.string().min(1).max(40),
      per: z.number().positive().max(200),
      roe_pct: z.number().min(-99).max(100),
    })).min(1).max(3),
    codes: codesSchema,
  }),
  /** Banque : coefficient d'exploitation, coût du risque. */
  z.object({
    type: z.literal('banque'),
    consigne: consigneSchema,
    pnb: z.number().positive().max(1e13),
    frais_generaux: z.number().min(0).max(1e13),
    cout_risque: z.number().min(0).max(1e13),
    unite: z.string().min(1).max(20).optional().default('FCFA'),
  }),
  /** Droit préférentiel de souscription. */
  z.object({
    type: z.literal('dps'),
    consigne: consigneSchema,
    cours: z.number().positive().max(10_000_000),
    prix_emission: z.number().positive().max(10_000_000),
    parite: z.number().int().min(1).max(100),
    actions: z.number().int().positive().max(1_000_000),
  }),
  /** Rendement net d'IRVM, par pays (barème lib/tax, jamais recodé). */
  z.object({
    type: z.literal('rendement_net'),
    consigne: consigneSchema,
    dividende_brut: z.number().positive().max(10_000_000),
    cours: z.number().positive().max(10_000_000),
    pays: z.enum(['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG']).optional().default('CI'),
    /** Affiche aussi le net en euros (parité fixe), pour la diaspora. */
    euros: z.boolean().optional().default(false),
  }),
  /** Obligation : rendement courant, actuariel (lib/bonds), coupon couru. */
  z.object({
    type: z.literal('obligation'),
    consigne: consigneSchema,
    nominal: z.number().positive().max(10_000_000),
    taux_nominal_pct: z.number().min(0).max(30),
    prix: z.number().positive().max(10_000_000),
    annees_restantes: z.number().int().min(1).max(30),
    jours_ecoules: z.number().int().min(0).max(364).optional().default(0),
    taux_marche_pct: z.number().positive().max(30),
  }),
  /** Frais d'un OPCVM sur la durée de placement. */
  z.object({
    type: z.literal('opcvm_frais'),
    consigne: consigneSchema,
    montant: z.number().positive().max(1_000_000_000),
    annees: z.number().int().min(1).max(30),
    frais_entree_pct: z.number().min(0).max(10),
    frais_gestion_pct: z.number().min(0).max(10),
    frais_sortie_pct: z.number().min(0).max(10).optional().default(0),
    performance_pct: z.number().min(-20).max(20).optional().default(0),
  }),
  /** Taille de position selon le risque accepté et le stop. */
  z.object({
    type: z.literal('position'),
    consigne: consigneSchema,
    portefeuille: z.number().positive().max(10_000_000_000),
    risque_pct: z.number().positive().max(20),
    prix_achat: z.number().positive().max(10_000_000),
    stop: z.number().positive().max(10_000_000),
    objectif: z.number().min(0).max(10_000_000).optional().default(0),
  }),
  /** Souscription à une introduction : réduction proportionnelle des ordres. */
  z.object({
    type: z.literal('souscription_ipo'),
    consigne: consigneSchema,
    titres_offerts: z.number().int().positive().max(10_000_000_000),
    prix: z.number().positive().max(10_000_000),
    taux_souscription_pct: z.number().positive().max(2000),
    demande: z.number().int().positive().max(10_000_000),
  }),
  /** Affectation du résultat : bénéfice par action, dividende, réserves. */
  z.object({
    type: z.literal('distribution'),
    consigne: consigneSchema,
    resultat_net: z.number().positive().max(1e13),
    actions: z.number().int().positive().max(10_000_000_000),
    taux_distribution_pct: z.number().min(0).max(150),
  }),
  /** Change euro – franc CFA (parité fixe) et frais de transfert. */
  z.object({
    type: z.literal('change'),
    consigne: consigneSchema,
    montant_eur: z.number().positive().max(10_000_000),
    frais_pct: z.number().min(0).max(20).optional().default(0),
    frais_fixes_eur: z.number().min(0).max(10_000).optional().default(0),
    cours_action: z.number().min(0).max(10_000_000).optional().default(0),
  }),
  // ── Simulateurs du module zéro (2026-11-23) ──
  /** Croissance d'une année sur l'autre et taux de croissance annuel moyen (TCAM). */
  z.object({
    type: z.literal('croissance'),
    consigne: consigneSchema,
    valeur_initiale: z.number().positive().max(1e15),
    valeur_finale: z.number().positive().max(1e15),
    annees: z.number().int().min(1).max(50),
    unite: z.string().min(1).max(20).optional().default('Md FCFA'),
  }),
  /** Entreprise non financière : dette nette, gearing, couverture des intérêts. */
  z.object({
    type: z.literal('endettement'),
    consigne: consigneSchema,
    dettes_financieres: z.number().min(0).max(1e15),
    tresorerie: z.number().min(0).max(1e15),
    capitaux_propres: z.number().positive().max(1e15),
    resultat_operationnel: z.number().min(-1e15).max(1e15),
    charges_interets: z.number().min(0).max(1e15),
    unite: z.string().min(1).max(20).optional().default('Md FCFA'),
  }),
  /** ROE sur capitaux propres moyens contre ROE de clôture, et ROA. */
  z.object({
    type: z.literal('roe_moyen'),
    consigne: consigneSchema,
    resultat_net: z.number().min(-1e15).max(1e15),
    capitaux_debut: z.number().positive().max(1e15),
    capitaux_fin: z.number().positive().max(1e15),
    actif_debut: z.number().positive().max(1e16).optional(),
    actif_fin: z.number().positive().max(1e16).optional(),
    unite: z.string().min(1).max(20).optional().default('Md FCFA'),
  }),
  /** Indicateur technique sur une SÉRIE RÉELLE (/api/academy/serie). */
  z.object({
    type: z.literal('technique'),
    consigne: consigneSchema,
    indicateur: z.enum(['variation', 'moyennes', 'rsi', 'macd']),
    codes: z.array(z.string().regex(/^[A-Z0-9]{3,10}$/)).min(1).max(6),
    courte: z.number().int().min(2).max(100).optional().default(20),
    longue: z.number().int().min(3).max(200).optional().default(50),
    periode: z.number().int().min(2).max(50).optional().default(14),
    seuil_haut: z.number().min(50).max(95).optional().default(70),
    seuil_bas: z.number().min(5).max(50).optional().default(30),
    /** Moyennes : simple (défaut) ou exponentielle — l'apprenant peut basculer (2026-11-24). */
    methode: z.enum(['simple', 'exponentielle']).optional().default('simple'),
  }),
  /**
   * Atelier (2026-11-24) : la moyenne qui glisse, séance par séance, sur des
   * clôtures FICTIVES modifiables ; moyenne simple et exponentielle côte à côte.
   */
  z.object({
    type: z.literal('moyenne_glissante'),
    consigne: consigneSchema,
    clotures: z.array(z.number().positive().max(10_000_000)).min(4).max(15),
    periode: z.number().int().min(2).max(10).optional().default(5),
  }),
  /**
   * Atelier (2026-11-24) : le RSI calculé séance par séance (lissage de Wilder,
   * celui de rsiSeries) sur des clôtures FICTIVES modifiables.
   */
  z.object({
    type: z.literal('rsi_pas_a_pas'),
    consigne: consigneSchema,
    clotures: z.array(z.number().positive().max(10_000_000)).min(5).max(25),
    periode: z.number().int().min(2).max(14).optional().default(14),
  }),
  /** Chandelier japonais construit à partir de quatre prix saisis. */
  z.object({
    type: z.literal('chandelier'),
    consigne: consigneSchema,
    ouverture: z.number().positive().max(10_000_000),
    haut: z.number().positive().max(10_000_000),
    bas: z.number().positive().max(10_000_000),
    cloture: z.number().positive().max(10_000_000),
  }),
  // ── Bougies sur plusieurs séances (2026-11-24, lib/academy/figuresBougies.ts) ──
  /** Les vraies bougies des dernières séances d’une valeur, figures repérées (/api/academy/serie). */
  z.object({
    type: z.literal('bougies'),
    consigne: consigneSchema,
    codes: z.array(z.string().regex(/^[A-Z0-9]{3,10}$/)).min(1).max(6),
    seances: z.number().int().min(10).max(60).optional().default(30),
  }),
  /** Atelier : figure formée par deux à cinq bougies FICTIVES, modifiables. */
  z.object({
    type: z.literal('figure_bougies'),
    consigne: consigneSchema,
    bougies: z.array(z.object({
      ouverture: z.number().positive().max(10_000_000),
      haut: z.number().positive().max(10_000_000),
      bas: z.number().positive().max(10_000_000),
      cloture: z.number().positive().max(10_000_000),
    })).min(2).max(5),
  }),
]).superRefine((s, ctx) => {
  if (s.type === 'figure_bougies' && s.bougies.some((x) => x.haut < Math.max(x.ouverture, x.cloture) || x.bas > Math.min(x.ouverture, x.cloture))) {
    ctx.addIssue({ code: 'custom', message: 'bougie impossible : plus haut / plus bas incohérents' });
  }
  if (s.type === 'position' && !(s.stop < s.prix_achat)) {
    ctx.addIssue({ code: 'custom', message: 'le stop doit être sous le prix d’achat' });
  }
  if (s.type === 'chandelier' && (s.haut < Math.max(s.ouverture, s.cloture) || s.bas > Math.min(s.ouverture, s.cloture))) {
    ctx.addIssue({ code: 'custom', message: 'bougie impossible : plus haut / plus bas incohérents' });
  }
  if (s.type === 'technique' && !(s.longue > s.courte)) {
    ctx.addIssue({ code: 'custom', message: 'la moyenne longue doit compter plus de séances que la courte' });
  }
  if (s.type === 'moyenne_glissante' && !(s.periode < s.clotures.length)) {
    ctx.addIssue({ code: 'custom', message: 'la période doit compter moins de séances que les clôtures saisies' });
  }
  if (s.type === 'rsi_pas_a_pas' && !(s.periode < s.clotures.length)) {
    ctx.addIssue({ code: 'custom', message: 'un RSI sur N séances demande au moins N + 1 clôtures' });
  }
  if (s.type === 'scenario_baisse' || s.type === 'allocation') {
    const total = s.secteurs.reduce((t, x) => t + x.pct, 0);
    if (s.type === 'scenario_baisse' && Math.abs(total - 100) > 0.01) {
      ctx.addIssue({ code: 'custom', message: 'la répartition par défaut du scénario doit totaliser 100 %' });
    }
    if (new Set(s.secteurs.map((x) => x.nom)).size !== s.secteurs.length) {
      ctx.addIssue({ code: 'custom', message: 'les noms de secteurs doivent être distincts' });
    }
  }
});
export type Simulation = z.infer<typeof simulationSchema>;

/**
 * Exemples RÉELS tirés de la base au chargement de la leçon
 * (lib/academy/donneesServer.ts) : le contenu ne porte que des codes, jamais
 * de chiffres — ils seraient périmés dès la séance suivante.
 *  - `rendement` : dernier dividende, dernier cours, rendement, revenu pour `actions` ;
 *  - `historique` : dividendes des cinq derniers exercices (régularité) ;
 *  - `cours` : dernier cours, et coût de `actions` titres (ticket d'entrée) ;
 *  - `indices` : dernière valeur et variation d'indices (codes BRVMC, BRVM30…).
 *  - `ratios` : BPA, PER, P/B et ROE calculés au rendu (dernier exercice publié
 *    avec résultat ET fonds propres, dernier cours, nombre de titres).
 *  - `technique` : dernier cours, moyennes mobiles 20 et 50 séances, RSI 14,
 *    calculés au rendu sur les clôtures réelles (aucune recommandation).
 */
export const donneesReellesSchema = z.object({
  vue: z.enum(['rendement', 'historique', 'cours', 'indices', 'ratios', 'technique']),
  codes: z.array(z.string().regex(/^[A-Z0-9]{3,10}$/)).min(1).max(6),
  actions: z.number().int().positive().max(1_000_000).optional(),
});
export type DonneesReellesSpec = z.infer<typeof donneesReellesSchema>;

export const qcmSchema = z.object({
  question: z.string().min(1).max(800),
  options: z.array(z.string().min(1).max(500)).min(2).max(6),
  correct: z.number().int().min(0),
  explication: z.string().min(1).max(2000),
});

/**
 * Série d'un graphique à plusieurs séries (2026-11-23). `null` = année sans
 * donnée : le point est laissé vide, jamais remplacé par zéro ni interpolé.
 */
export const serieChartSchema = z.object({
  nom: z.string().min(1).max(80),
  valeurs: z.array(z.number().nullable()).min(1).max(40),
  /** Rendu de la série dans un graphique mixte ; par défaut, celui du graphique. */
  type: z.enum(['bar', 'line']).optional(),
  /** Axe de la série : gauche par défaut, droite pour une seconde unité (ex. PER face au cours). */
  axe: z.enum(['gauche', 'droite']).optional().default('gauche'),
});

/**
 * Graphique pédagogique. Les valeurs sont des EXEMPLES, sauf `reel: true`
 * (données publiées, source et année dans la note) — la note porte l'interprétation.
 * Une seule série : `valeurs`. Plusieurs séries : `series` (et `valeurs` vide).
 */
export const chartSchema = z
  .object({
    type: z.enum(['bar', 'line', 'pie']),
    titre: z.string().min(1).max(300),
    labels: z.array(z.string().min(1).max(80)).min(2).max(40),
    valeurs: z.array(z.number().nullable()).max(40).optional().default([]),
    series: z.array(serieChartSchema).max(8).optional().default([]),
    unite: z.string().max(20).optional().default(''),
    /** Unité de l'axe de droite, quand une série y est rangée. */
    unite_droite: z.string().max(20).optional().default(''),
    note: z.string().min(1).max(2000), // interprétation pédagogique
    // true = données RÉELLES sourcées (études de cas) ; false = valeurs d'exemple.
    reel: z.boolean().optional().default(false),
  })
  .refine(
    (c) => (c.series.length > 0
      ? c.series.every((s) => s.valeurs.length === c.labels.length)
      : c.valeurs.length === c.labels.length),
    { message: 'labels et valeurs (ou chaque série) doivent avoir la même longueur' },
  )
  .refine((c) => c.type !== 'pie' || c.series.length === 0, { message: 'un camembert n’a qu’une série' });

export const sectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  titre: z.string().min(1).max(200),
  contenu: z.string().min(1).max(30000),
  // ── Blocs structurés optionnels (mise en page riche type slide) ──
  stats: z.array(statSchema).max(16).optional().default([]),
  tableau: tableauSchema.nullable().optional(),
  /** Tableaux supplémentaires, rendus après `tableau` (2026-11-23). */
  tableaux: z.array(tableauSchema).max(8).optional().default([]),
  etapes: z.array(etapeSchema).max(20).optional().default([]),
  // ── Blocs éditoriaux ──
  /** Une section `cas` ne s'intitule « Cas réel BRVM » que si elle l'est. */
  reel: z.boolean().optional().default(false),
  formules: z.array(formuleSchema).max(20).optional().default([]),
  flux: z
    .array(fluxEtapeSchema)
    .max(10)
    .optional()
    .default([])
    .refine((f) => f.length === 0 || f.length >= 2, { message: 'un schéma de mécanisme compte au moins deux étapes' }),
  points: z.array(pointSchema).max(20).optional().default([]),
  /** `frise` : étapes en frise horizontale sur ordinateur (verticale sur mobile). */
  etapes_style: z.enum(['liste', 'frise']).optional().default('liste'),
  simulation: simulationSchema.nullable().optional(),
  /** Simulations supplémentaires, rendues après `simulation` (ex. répartition puis scénario). */
  simulations: z.array(simulationSchema).max(10).optional().default([]),
  donnees_reelles: donneesReellesSchema.nullable().optional(),
  /** Schéma pédagogique dessiné par le code (lib/academy/illustrations.ts). */
  illustration: illustrationSchema.nullable().optional(),
  /** Encadrés (règle d'or, lecture clé, avertissement), rendus après le texte. */
  encadres: z.array(encadreSchema).max(10).optional().default([]),
  /** Graphiques placés DANS la section, à côté de ce qu'ils illustrent. */
  graphiques: z.array(chartSchema).max(16).optional().default([]),
});

/** Image illustrative d'une leçon — remplie côté serveur après recherche Pexels. */
export const lessonImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(300).default(''),
  credit: z.string().max(200).default(''),
});

/**
 * Badge « Nouveau » / « Mis à jour » (2026-11-23). `depuis` = date de mise en
 * ligne ; le badge s'éteint seul au bout de DUREE_NOUVEAUTE_JOURS
 * (lib/academy/nouveaute.ts) : jamais un « nouveau » permanent.
 */
export const nouveauteSchema = z.object({
  type: z.enum(['nouveau', 'mis_a_jour']),
  depuis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const lessonSchema = z.object({
  titre: z.string().min(1).max(200),
  categorie: z.enum(CATEGORIES).default('general'),
  /** Sous-titre pédagogique de l'en-tête éditorial (facultatif). */
  sous_titre: z.string().max(300).nullable().optional(),
  resume: z.string().min(1).max(2000),
  /** Mention réglementaire affichée en pied d'article (facultatif). */
  avertissement: z.string().max(1000).nullable().optional(),
  sections: z.array(sectionSchema).min(1).max(40),
  chart: chartSchema.nullable().optional(),
  // Graphiques multiples (leçons enrichies) — rendus après `chart`.
  charts: z.array(chartSchema).max(24).optional().default([]),
  nouveaute: nouveauteSchema.nullable().optional(),
  qcm: qcmSchema.nullable().optional(),
  /**
   * Quiz en série (2026-10-20). Prime sur `qcm` à l'affichage quand il est
   * présent ; `qcm` reste lu par l'éditeur admin et la banque d'examens.
   */
  quiz: z
    .array(qcmSchema.refine((q) => q.correct < q.options.length, { message: 'bonne réponse hors des options' }))
    .min(1)
    .max(20)
    .nullable()
    .optional(),
  // Mots-clés EN fournis par le LLM pour rechercher une image (ex. "stock market chart").
  imageQuery: z.string().max(120).nullable().optional(),
  // Rempli côté serveur après fetch Pexels (absent de la sortie LLM).
  image: lessonImageSchema.nullable().optional(),
  // ── Academy v2 ──
  // Durée de lecture estimée, affichée dans le sommaire.
  duree_min: z.number().int().min(1).max(180).nullable().optional(),
  // Liens « Pratiquer sur WESTBOURSE » (onglet Ressources du shell).
  liens: z
    .array(z.object({ label: z.string().min(1).max(120), href: z.string().min(1).max(300) }))
    .max(12)
    .optional()
    .default([]),
  // P3 : identifiant d'exercice live (registre lib/academy/exercises.ts).
  exercice_id: z.string().max(60).nullable().optional(),
  // Nom du module — regroupe les leçons dans le sommaire (organisation par niveau).
  module: z.string().max(200).nullable().optional(),
});

export const glossaireItemSchema = z.object({
  terme: z.string().min(1).max(120),
  definition: z.string().min(1).max(1000),
});

export const courseContentSchema = z.object({
  titre: z.string().min(1).max(200),
  niveau: z.enum(NIVEAUX),
  intro: z.string().min(1).max(3000),
  // Visuel de couverture (bannière en tête), défini côté serveur/admin — jamais
  // par le LLM. Stocké dans content pour survivre à la régénération (préservé).
  coverUrl: z.string().url().nullable().optional(),
  // Liens « À lire aussi » vers d'autres cours (navigation pleine page).
  relatedLinks: z
    .array(z.object({ slug: z.string().min(1), label: z.string().min(1).max(120) }))
    .optional()
    .default([]),
  lessons: z.array(lessonSchema).min(1).max(60),
  glossaire: z.array(glossaireItemSchema).max(120).optional().default([]),
});

export type CourseContent = z.infer<typeof courseContentSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionStat = z.infer<typeof statSchema>;
export type SectionTableau = z.infer<typeof tableauSchema>;
export type SectionEtape = z.infer<typeof etapeSchema>;
export type Qcm = z.infer<typeof qcmSchema>;
export type Chart = z.infer<typeof chartSchema>;
export type LessonImage = z.infer<typeof lessonImageSchema>;

export const NIVEAU_LABEL: Record<Niveau, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  expert: 'Expert',
};

export const CATEGORIE_LABEL: Record<Categorie, string> = {
  general: 'Général',
  income: 'Revenus',
  fundamental: 'Fondamental',
  technical: 'Technique',
  regulatory: 'Réglementaire',
  evaluation: 'Évaluation',
};

export const SECTION_LABEL: Record<SectionType, string> = {
  definition: 'Définition',
  importance: 'Pourquoi c’est important',
  // « Cas réel BRVM » s'affichait aussi sur des simulations : le libellé par
  // défaut est neutre, le réel se déclare (`reel: true`, voir libelleSection).
  cas: 'Exemple',
  piege: 'Pièges fréquents',
  lexique: 'Lexique',
  retenir: 'À retenir',
};

/** Libellé d'une section ; « Cas réel BRVM » seulement pour un cas déclaré réel. */
export function libelleSection(s: Pick<Section, 'type' | 'reel'>): string {
  if (s.type === 'cas' && s.reel) return 'Cas réel BRVM';
  return SECTION_LABEL[s.type];
}

/** Slug URL-safe depuis un titre. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
