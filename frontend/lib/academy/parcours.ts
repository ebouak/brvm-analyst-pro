/**
 * Parcours d'épargnants RECONSTITUÉS sur des cours et des dividendes réels
 * (Academy, niveau 2, module « Construire son portefeuille »).
 *
 * Fonctions PURES : elles ne lisent que le fichier figé
 * `contenus/niveau2/sources/cours-parcours.json` (clôtures et dividendes nets
 * extraits de la base, datés). Les chiffres écrits dans les leçons sortent
 * d'ici ; `parcours.test.ts` les recalcule et échoue s'ils divergent.
 *
 * Les personnes n'existent pas : ce sont des profils-types. Les cours, les
 * dividendes et les dates, eux, sont ceux du marché.
 *
 * Règles, toutes écrites dans la leçon :
 *  - achat à la clôture de la première séance cotée à partir de la date ;
 *  - actions entières ; frais de 1 % par achat (hypothèse pédagogique) ;
 *  - dividende NET de l'exercice N crédité le 30 avril N+1 sur les titres
 *    détenus à cette date (les dates exactes de paiement, entre avril et
 *    septembre, ne sont pas connues avant 2025) ;
 *  - exercices antérieurs à 2021 : dividendes ABSENTS de la base, donc non
 *    comptés (le résultat des parcours longs est sous-estimé d'autant) ;
 *  - valorisation finale à la dernière clôture du fichier, sans frais de vente.
 */

export interface SourceParcours {
  extrait_le: string;
  cours: Record<string, [ancre: string, seance: string, cloture: number][]>;
  dividendes: Record<string, { exercice: number; net: number }[]>;
}

export interface Versement {
  /** Date d'ancrage présente dans le fichier (1er du mois, ou 20 novembre). */
  ancre: string;
  montant: number;
}

export interface ReglesParcours {
  lignes: string[];
  versements: Versement[];
  /** `egale` : chaque versement est réparti entre toutes les lignes ; `rotation` : une ligne par versement, à tour de rôle. */
  repartition: 'egale' | 'rotation';
  /** Les dividendes encaissés sont-ils ajoutés au versement suivant ? */
  reinvestir: boolean;
  /** Date d'ancrage de la valorisation finale. */
  fin: string;
  frais_pct?: number;
  /** Quotité : titres achetés par multiples de `taille` avant la date (fractionnement ultérieur). */
  lots?: Record<string, { avant: string; taille: number }>;
}

export interface LigneParcours {
  code: string;
  titres: number;
  /** Total payé, frais compris. */
  cout: number;
  cours_fin: number;
  valeur: number;
  dividendes: number;
}

export interface PointAnnuel {
  ancre: string;
  verse: number;
  /** Titres valorisés + liquidités non investies (dividendes compris). */
  valeur: number;
}

export interface ResultatParcours {
  verse: number;
  frais: number;
  lignes: LigneParcours[];
  valeur_titres: number;
  liquidites: number;
  dividendes: number;
  valeur_finale: number;
  gain: number;
  gain_pct: number;
  /** Taux annuel équivalent (taux de rendement interne des versements), en %. */
  taux_annuel_pct: number;
  points: PointAnnuel[];
  achats: { ancre: string; seance: string; code: string; titres: number; cours: number; cout: number }[];
}

const arrondi = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function coursA(src: SourceParcours, code: string, ancre: string): { seance: string; cloture: number } {
  const p = src.cours[code]?.find((x) => x[0] === ancre);
  if (!p) throw new Error(`cours absent : ${code} au ${ancre}`);
  return { seance: p[1], cloture: p[2] };
}

const annees = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000);

/** Taux de rendement interne annuel par dichotomie : flux négatifs = versements. */
export function tauxInterne(flux: { date: string; montant: number }[]): number {
  const t0 = flux[0]!.date;
  const van = (r: number) => flux.reduce((s, f) => s + f.montant / (1 + r) ** annees(t0, f.date), 0);
  let bas = -0.99;
  let haut = 5;
  for (let i = 0; i < 200; i++) {
    const mid = (bas + haut) / 2;
    if (van(mid) > 0) bas = mid;
    else haut = mid;
  }
  return (bas + haut) / 2;
}

type Evenement =
  | { date: string; type: 'dividende'; exercice: number }
  | { date: string; type: 'versement'; v: Versement; rang: number }
  | { date: string; type: 'point'; ancre: string };

export function simulerParcours(src: SourceParcours, r: ReglesParcours): ResultatParcours {
  const frais = (r.frais_pct ?? 1) / 100;
  const titres = Object.fromEntries(r.lignes.map((c) => [c, 0])) as Record<string, number>;
  const cout = { ...titres };
  const divs = { ...titres };
  let liquidites = 0;
  let reserveDividendes = 0;
  let verse = 0;
  let totalFrais = 0;
  const achats: ResultatParcours['achats'] = [];
  const points: PointAnnuel[] = [];

  const evenements: Evenement[] = [];
  r.versements.forEach((v, rang) => evenements.push({ date: v.ancre, type: 'versement', v, rang }));
  for (let ex = 2021; ex <= 2025; ex++) evenements.push({ date: `${ex + 1}-04-30`, type: 'dividende', exercice: ex });
  const premiere = Number(r.versements[0]!.ancre.slice(0, 4));
  for (let y = premiere + 1; y <= Number(r.fin.slice(0, 4)); y++) evenements.push({ date: `${y}-11-20`, type: 'point', ancre: `${y}-11-20` });
  const ordre = { dividende: 0, versement: 1, point: 2 } as const;
  evenements.sort((a, b) => a.date.localeCompare(b.date) || ordre[a.type] - ordre[b.type]);

  const acheter = (code: string, budget: number, ancre: string): number => {
    const { seance, cloture } = coursA(src, code, ancre);
    const regle = r.lots?.[code];
    const lot = regle && seance < regle.avant ? regle.taille : 1;
    const n = Math.floor(budget / (cloture * (1 + frais) * lot)) * lot;
    if (n <= 0) return 0;
    const prix = n * cloture;
    const total = arrondi(prix * (1 + frais));
    titres[code]! += n;
    cout[code]! += total;
    totalFrais += total - prix;
    achats.push({ ancre, seance, code, titres: n, cours: cloture, cout: total });
    return total;
  };

  for (const e of evenements) {
    if (e.date > r.fin) continue;
    if (e.type === 'dividende') {
      for (const code of r.lignes) {
        const d = src.dividendes[code]?.find((x) => x.exercice === e.exercice);
        if (!d || !titres[code]) continue;
        const m = arrondi(titres[code]! * d.net);
        divs[code]! += m;
        if (r.reinvestir) liquidites += m;
        else reserveDividendes += m;
      }
    } else if (e.type === 'versement') {
      verse += e.v.montant;
      liquidites += e.v.montant;
      if (r.repartition === 'egale') {
        const part = liquidites / r.lignes.length;
        for (const code of r.lignes) liquidites -= acheter(code, part, e.v.ancre);
      } else {
        liquidites -= acheter(r.lignes[e.rang % r.lignes.length]!, liquidites, e.v.ancre);
      }
    } else {
      const valeur = r.lignes.reduce((s, c) => s + titres[c]! * coursA(src, c, e.ancre).cloture, 0);
      points.push({ ancre: e.ancre, verse, valeur: arrondi(valeur + liquidites + reserveDividendes) });
    }
  }

  const lignes: LigneParcours[] = r.lignes.map((code) => {
    const cours_fin = coursA(src, code, r.fin).cloture;
    return { code, titres: titres[code]!, cout: cout[code]!, cours_fin, valeur: arrondi(titres[code]! * cours_fin), dividendes: divs[code]! };
  });
  const valeur_titres = lignes.reduce((s, l) => s + l.valeur, 0);
  const dividendes = lignes.reduce((s, l) => s + l.dividendes, 0);
  const reste = arrondi(liquidites + reserveDividendes);
  const valeur_finale = valeur_titres + reste;
  const flux = [...r.versements.map((v) => ({ date: v.ancre, montant: -v.montant })), { date: r.fin, montant: valeur_finale }];
  return {
    verse,
    frais: arrondi(totalFrais),
    lignes,
    valeur_titres,
    liquidites: reste,
    dividendes,
    valeur_finale,
    gain: valeur_finale - verse,
    gain_pct: arrondi(((valeur_finale - verse) / verse) * 100, 1),
    taux_annuel_pct: arrondi(tauxInterne(flux) * 100, 1),
    points,
    achats,
  };
}

/** Portefeuille équilibré des parcours : cinq secteurs, deux pays. */
export const LIGNES_EQUILIBRE = ['SNTS', 'SGBC', 'CIEC', 'SOGC', 'TTLS'];
const LOTS = { SNTS: { avant: '2026-10-26', taille: 10 } };
const FIN = '2026-11-20';

const mensuels = (debut: string, n: number, montant: number): Versement[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(Number(debut.slice(0, 4)), Number(debut.slice(5, 7)) - 1 + i, 1));
    return { ancre: d.toISOString().slice(0, 10), montant };
  });

/** Les quatre parcours de la leçon 7. */
export const PARCOURS: Record<'unique' | 'mensuel' | 'annuel' | 'concentre', ReglesParcours> = {
  /** 1 000 000 FCFA en une fois, novembre 2021 ; dividendes encaissés, non réinvestis. */
  unique: { lignes: LIGNES_EQUILIBRE, versements: [{ ancre: '2021-11-20', montant: 1_000_000 }], repartition: 'egale', reinvestir: false, fin: FIN, lots: LOTS },
  /** 50 000 FCFA par mois pendant 60 mois, une ligne par mois ; dividendes réinvestis. */
  mensuel: { lignes: LIGNES_EQUILIBRE, versements: mensuels('2021-12-01', 60, 50_000), repartition: 'rotation', reinvestir: true, fin: FIN, lots: LOTS },
  /** 300 000 FCFA chaque novembre de 2016 à 2025 ; dividendes réinvestis. */
  annuel: {
    lignes: LIGNES_EQUILIBRE,
    versements: Array.from({ length: 10 }, (_, i) => ({ ancre: `${2016 + i}-11-20`, montant: 300_000 })),
    repartition: 'egale',
    reinvestir: true,
    fin: FIN,
    lots: LOTS,
  },
  /** Contre-exemple : 1 000 000 FCFA sur une seule valeur, novembre 2021. */
  concentre: { lignes: ['ONTBF'], versements: [{ ancre: '2021-11-20', montant: 1_000_000 }], repartition: 'egale', reinvestir: false, fin: FIN },
};
