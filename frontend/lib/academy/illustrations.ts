import { z } from 'zod';

/**
 * Schémas pédagogiques dessinés par le code (bloc `illustration` d'une section
 * de leçon Academy). Fonctions PURES et testées (illustrations.test.ts).
 *
 * Cinq gabarits, chacun pour une idée qui se comprend mieux vue que lue :
 *  - `cascade`       : un montant de départ, des ajouts et des retraits, un total
 *                      CALCULÉ (du chiffre d'affaires au résultat net, du PNB au
 *                      résultat d'une banque, l'effet des frais d'un fonds) ;
 *  - `bilan`         : actif et passif en blocs proportionnels, totaux égaux ;
 *  - `decomposition` : un résultat expliqué par ses facteurs (somme, produit,
 *                      quotient), l'égalité étant VÉRIFIÉE par le schéma ;
 *  - `echeancier`    : les flux d'une obligation, CALCULÉS à partir du nominal,
 *                      du taux et du mode de remboursement ;
 *  - `avant_apres`   : deux ou trois états côte à côte (dilution, part du
 *                      résultat qui ne se répète pas, structure de financement).
 *
 * Aucun chiffre de marché : les valeurs sont des hypothèses écrites dans la
 * leçon (`reel: false`, annoncées « exemple fictif »), ou des chiffres publiés
 * datés (`reel: true`, `source` obligatoire, avec une année). Tout total est
 * calculé ici, jamais saisi : un schéma ne peut pas afficher une somme fausse.
 */

const libelle = z.string().min(1).max(40);
const ligne = z.object({ label: libelle, valeur: z.number().finite() });

/** Terme d'une décomposition ; `unite` remplace l'unité commune (cours en FCFA, PER sans unité). */
const termeDecomposition = ligne.extend({
  pourcentage: z.boolean().optional().default(false),
  unite: z.string().max(20).optional(),
});

const commun = {
  titre: z.string().min(1).max(140),
  /** Phrase d'interprétation affichée sous le schéma. */
  note: z.string().min(1).max(400),
  unite: z.string().max(20).optional().default(''),
  /** true = chiffres publiés (source datée obligatoire) ; false = exemple fictif. */
  reel: z.boolean().optional().default(false),
  source: z.string().max(200).optional().default(''),
};

export const illustrationSchema = z
  .discriminatedUnion('gabarit', [
    z.object({
      gabarit: z.literal('cascade'),
      ...commun,
      depart: z.object({ label: libelle, valeur: z.number().positive() }),
      etapes: z.array(ligne.refine((l) => l.valeur !== 0, { message: 'une étape nulle n’apporte rien' })).min(1).max(7),
      /** Libellé du total, qui est CALCULÉ (départ + étapes). */
      arrivee: libelle,
    }),
    z.object({
      gabarit: z.literal('bilan'),
      ...commun,
      actif: z.array(z.object({ label: libelle, valeur: z.number().positive() })).min(1).max(5),
      passif: z
        .array(z.object({ label: libelle, valeur: z.number().positive(), nature: z.enum(['fonds_propres', 'dettes']) }))
        .min(1)
        .max(5),
    }),
    z.object({
      gabarit: z.literal('decomposition'),
      ...commun,
      operation: z.enum(['somme', 'produit', 'quotient']),
      /** `pourcentage` : la valeur est en % (25 = 25 %) et compte pour 0,25 dans le calcul. */
      facteurs: z.array(termeDecomposition).min(2).max(3),
      resultat: termeDecomposition,
    }),
    z.object({
      gabarit: z.literal('echeancier'),
      ...commun,
      nominal: z.number().positive().max(1e12),
      taux_pct: z.number().min(0).max(30),
      annees: z.number().int().min(1).max(10),
      mode: z.enum(['in_fine', 'amortissable']),
      /** Prix payé à l'achat (facultatif), montré comme une sortie en année 0. */
      prix_achat: z.number().positive().max(1e12).optional(),
    }),
    z.object({
      gabarit: z.literal('avant_apres'),
      ...commun,
      colonnes: z
        .array(
          z.object({
            label: libelle,
            segments: z.array(z.object({ label: libelle, valeur: z.number().min(0) })).min(1).max(4),
          }),
        )
        .min(2)
        .max(3),
      /** Affiche, sous chaque colonne, la part du PREMIER segment dans le total. */
      part_du_premier: z.boolean().optional().default(false),
    }),
  ])
  .superRefine((ill, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (ill.reel && !/\b(19|20)\d{2}\b/.test(ill.source)) {
      issue('des chiffres réels exigent une source datée (au moins une année)');
    }
    if (!ill.reel && ill.source) issue('un exemple fictif ne cite pas de source');
    if (ill.gabarit === 'cascade') {
      let courant = ill.depart.valeur;
      for (const e of ill.etapes) {
        courant += e.valeur;
        if (courant < 0) issue('le cumul d’une cascade ne passe pas sous zéro');
      }
    }
    if (ill.gabarit === 'bilan') {
      const a = somme(ill.actif.map((x) => x.valeur));
      const p = somme(ill.passif.map((x) => x.valeur));
      if (Math.abs(a - p) > a * 0.005) issue(`bilan déséquilibré : actif ${a}, passif ${p}`);
      // Un bloc trop petit ne peut pas porter son libellé : on préfère regrouper.
      for (const x of [...ill.actif, ...ill.passif]) if (x.valeur < a * 0.08) issue(`bloc « ${x.label} » trop petit (< 8 % du total)`);
    }
    if (ill.gabarit === 'decomposition') {
      if (ill.operation === 'quotient' && ill.facteurs.length !== 2) issue('un quotient a exactement deux termes');
      const calcule = calculerDecomposition(ill);
      const attendu = valeurCalcul(ill.resultat);
      const tol = Math.max(Math.abs(attendu) * 0.005, 0.005);
      if (!Number.isFinite(calcule) || Math.abs(calcule - attendu) > tol) {
        issue(`décomposition fausse : le calcul donne ${calcule}, le résultat affiché vaut ${attendu}`);
      }
    }
    if (ill.gabarit === 'avant_apres') {
      if (ill.colonnes.some((c) => somme(c.segments.map((s) => s.valeur)) <= 0)) issue('chaque colonne a un total positif');
    }
  });

export type Illustration = z.infer<typeof illustrationSchema>;
export type Gabarit = Illustration['gabarit'];
export const GABARITS: readonly Gabarit[] = ['cascade', 'bilan', 'decomposition', 'echeancier', 'avant_apres'];

type De<G extends Gabarit> = Extract<Illustration, { gabarit: G }>;

const somme = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const valeurCalcul = (x: { valeur: number; pourcentage?: boolean }) => (x.pourcentage ? x.valeur / 100 : x.valeur);

// ── Formatage (français, chiffres seuls : l'unité s'ajoute à part) ──────────

export function fmtNombre(n: number, decimales = 2): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(n).replace('-', '−');
}

/** Valeur + unité (« 2 000 M FCFA », « 25 % », « 15 »). */
export function fmtValeur(n: number, unite = '', pourcentage = false): string {
  if (pourcentage) return `${fmtNombre(n)} %`;
  return unite ? `${fmtNombre(n)} ${unite}` : fmtNombre(n);
}

// ── Calculs ─────────────────────────────────────────────────────────────────

export interface LigneCascade {
  label: string;
  /** Montant de la ligne (signé pour une étape ; total pour départ/arrivée). */
  valeur: number;
  /** Bornes du segment dessiné, sur l'échelle des cumuls. */
  de: number;
  a: number;
  nature: 'depart' | 'hausse' | 'baisse' | 'arrivee';
}

export function calculerCascade(ill: De<'cascade'>): { lignes: LigneCascade[]; total: number; max: number } {
  const lignes: LigneCascade[] = [{ label: ill.depart.label, valeur: ill.depart.valeur, de: 0, a: ill.depart.valeur, nature: 'depart' }];
  let courant = ill.depart.valeur;
  let max = courant;
  for (const e of ill.etapes) {
    const avant = courant;
    courant += e.valeur;
    max = Math.max(max, courant);
    lignes.push({ label: e.label, valeur: e.valeur, de: Math.min(avant, courant), a: Math.max(avant, courant), nature: e.valeur > 0 ? 'hausse' : 'baisse' });
  }
  const total = arrondi(courant);
  lignes.push({ label: ill.arrivee, valeur: total, de: 0, a: total, nature: 'arrivee' });
  return { lignes, total, max };
}

/** Arrondi d'affichage qui efface les résidus binaires (0,1 + 0,2). */
const arrondi = (n: number) => Math.round(n * 1e6) / 1e6;

export function calculerBilan(ill: De<'bilan'>) {
  const total = somme(ill.actif.map((x) => x.valeur));
  const fondsPropres = somme(ill.passif.filter((x) => x.nature === 'fonds_propres').map((x) => x.valeur));
  return { total, fondsPropres, partFondsPropresPct: (fondsPropres / total) * 100 };
}

export function calculerDecomposition(ill: Pick<De<'decomposition'>, 'operation' | 'facteurs'>): number {
  const v = ill.facteurs.map(valeurCalcul);
  if (ill.operation === 'somme') return somme(v);
  if (ill.operation === 'produit') return v.reduce((t, x) => t * x, 1);
  return v[1] === 0 ? Number.NaN : v[0]! / v[1]!;
}

export const SYMBOLE_OPERATION = { somme: '+', produit: '×', quotient: '÷' } as const;

export interface FluxEcheance {
  annee: number;
  coupon: number;
  capital: number;
  total: number;
  /** Capital restant dû au début de l'année. */
  restantDu: number;
}

export function calculerEcheancier(ill: De<'echeancier'>): { flux: FluxEcheance[]; totalCoupons: number; totalCapital: number } {
  const t = ill.taux_pct / 100;
  const flux: FluxEcheance[] = [];
  let restant = ill.nominal;
  for (let a = 1; a <= ill.annees; a++) {
    const coupon = arrondi(restant * t);
    const capital = ill.mode === 'in_fine' ? (a === ill.annees ? ill.nominal : 0) : arrondi(ill.nominal / ill.annees);
    flux.push({ annee: a, coupon, capital, total: arrondi(coupon + capital), restantDu: arrondi(restant) });
    restant -= capital;
  }
  return { flux, totalCoupons: arrondi(somme(flux.map((f) => f.coupon))), totalCapital: arrondi(somme(flux.map((f) => f.capital))) };
}

export function calculerAvantApres(ill: De<'avant_apres'>) {
  /** Un même libellé garde la même couleur d'une colonne à l'autre. */
  const ordre: string[] = [];
  for (const c of ill.colonnes) for (const s of c.segments) if (!ordre.includes(s.label)) ordre.push(s.label);
  const colonnes = ill.colonnes.map((c) => {
    const total = somme(c.segments.map((s) => s.valeur));
    return { label: c.label, total, partPremierPct: (c.segments[0]!.valeur / total) * 100, segments: c.segments.map((s) => ({ ...s, teinte: ordre.indexOf(s.label) })) };
  });
  return { colonnes, max: Math.max(...colonnes.map((c) => c.total)), legende: ordre };
}

// ── Texte équivalent (lecteurs d'écran, mode sans image) ────────────────────

/** Une phrase courte : l'`aria-label` du schéma. */
export function resumeIllustration(ill: Illustration): string {
  const u = ill.unite;
  switch (ill.gabarit) {
    case 'cascade': {
      const { total } = calculerCascade(ill);
      return `Schéma en cascade : de ${ill.depart.label.toLowerCase()} (${fmtValeur(ill.depart.valeur, u)}) à ${ill.arrivee.toLowerCase()} (${fmtValeur(total, u)}).`;
    }
    case 'bilan': {
      const b = calculerBilan(ill);
      return `Schéma d’un bilan : actif et passif de ${fmtValeur(b.total, u)} chacun, dont ${fmtNombre(b.partFondsPropresPct, 0)} % de fonds propres.`;
    }
    case 'decomposition':
      return `Décomposition : ${ill.resultat.label} = ${ill.facteurs.map((f) => f.label).join(` ${SYMBOLE_OPERATION[ill.operation]} `)}.`;
    case 'echeancier': {
      const e = calculerEcheancier(ill);
      return `Échéancier sur ${ill.annees} an${ill.annees > 1 ? 's' : ''} : ${fmtValeur(e.totalCoupons, u)} de coupons et ${fmtValeur(e.totalCapital, u)} de capital remboursé.`;
    }
    case 'avant_apres':
      return `Comparaison : ${ill.colonnes.map((c) => c.label).join(', ')}.`;
  }
}

/** Toutes les valeurs, une ligne par élément : la version texte du schéma. */
export function texteEquivalent(ill: Illustration): string[] {
  const u = ill.unite;
  switch (ill.gabarit) {
    case 'cascade': {
      const { lignes } = calculerCascade(ill);
      return lignes.map((l) =>
        l.nature === 'hausse' ? `${l.label} : + ${fmtValeur(l.valeur, u)}` : l.nature === 'baisse' ? `${l.label} : − ${fmtValeur(-l.valeur, u)}` : `${l.label} : ${fmtValeur(l.valeur, u)}`,
      );
    }
    case 'bilan': {
      const b = calculerBilan(ill);
      return [
        `Actif (${fmtValeur(b.total, u)}) : ${ill.actif.map((x) => `${x.label} ${fmtValeur(x.valeur, u)}`).join(' ; ')}.`,
        `Passif (${fmtValeur(b.total, u)}) : ${ill.passif.map((x) => `${x.label} ${fmtValeur(x.valeur, u)}`).join(' ; ')}.`,
      ];
    }
    case 'decomposition': {
      const f = (x: { label: string; valeur: number; pourcentage?: boolean; unite?: string }) => `${x.label} (${fmtValeur(x.valeur, x.unite ?? u, x.pourcentage)})`;
      return [`${f(ill.resultat)} = ${ill.facteurs.map(f).join(` ${SYMBOLE_OPERATION[ill.operation]} `)}`];
    }
    case 'echeancier': {
      const e = calculerEcheancier(ill);
      const lignes = e.flux.map((x) => `Année ${x.annee} : coupon ${fmtValeur(x.coupon, u)}${x.capital ? `, capital remboursé ${fmtValeur(x.capital, u)}` : ''}, total ${fmtValeur(x.total, u)}`);
      return ill.prix_achat ? [`Année 0 : prix payé ${fmtValeur(ill.prix_achat, u)}`, ...lignes] : lignes;
    }
    case 'avant_apres': {
      const r = calculerAvantApres(ill);
      return r.colonnes.map(
        (c) =>
          `${c.label} : ${c.segments.map((s) => `${s.label} ${fmtValeur(s.valeur, u)}`).join(', ')} ; total ${fmtValeur(c.total, u)}` +
          (ill.part_du_premier ? ` ; ${c.segments[0]!.label.toLowerCase()} : ${fmtNombre(c.partPremierPct, 1)} %` : ''),
      );
    }
  }
}

/** Coupe un libellé en lignes d'au plus `largeur` caractères (mots entiers). */
export function couperLibelle(texte: string, largeur = 18, maxLignes = 2): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  for (const m of mots) {
    const derniere = lignes[lignes.length - 1];
    if (derniere !== undefined && (derniere + ' ' + m).length <= largeur) lignes[lignes.length - 1] = `${derniere} ${m}`;
    else lignes.push(m);
  }
  if (lignes.length <= maxLignes) return lignes;
  const tete = lignes.slice(0, maxLignes - 1);
  return [...tete, lignes.slice(maxLignes - 1).join(' ')];
}
