/**
 * Extraction LLM des chiffres clés d'un rapport intermédiaire : schéma, prompt,
 * garde-fous. PUR (aucune I/O), testé (tests/interim.test.ts).
 *
 * Un rapport d'activités trimestriel ou semestriel ne contient PAS d'états
 * complets : quelques agrégats (CA ou PNB, résultats, encours). On ne demande
 * que ceux-là ; tout le reste reste nul. Rien n'est inventé ni recalculé.
 */
import { z } from 'zod';
import { MOIS, type CodeInterim } from './periode.js';

const montant = z.number().finite().nullable().optional().transform((v) => v ?? null);

export const schemaPeriode = z.object({
  annee: z.number().int().min(2000).max(2100),
  revenu_total: montant,
  resultat_exploitation: montant,
  resultat_avant_impots: montant,
  resultat_net: montant,
  total_actifs: montant,
  total_capitaux_propres: montant,
  pnb: montant,
  depots_clientele: montant,
  credits_clientele: montant,
});
export type ChiffresPeriode = z.infer<typeof schemaPeriode>;

export const schemaExtraction = z.object({
  devise_source: z.string().nullable().optional(),
  unite_source: z.string().nullable().optional(),
  cumul_depuis_debut_exercice: z.boolean().nullable().optional(),
  date_arrete: z.string().nullable().optional(),
  periodes: z.array(schemaPeriode).max(4),
});
export type Extraction = z.infer<typeof schemaExtraction>;

export type Famille = 'banque' | 'assurance' | 'general';

export function promptSysteme(famille: Famille): string {
  const revenu =
    famille === 'banque'
      ? "revenu_total = le Produit Net Bancaire (PNB) ; renseigne aussi pnb avec la même valeur."
      : famille === 'assurance'
        ? "revenu_total = le chiffre d'affaires (primes) tel que publié."
        : "revenu_total = le chiffre d'affaires.";
  return [
    "Tu extrais les chiffres clés d'un rapport d'activités INTERMÉDIAIRE (trimestre ou semestre) d'une société cotée à la BRVM.",
    'Réponds UNIQUEMENT en JSON strict :',
    '{ "devise_source": "fcfa"|"usd"|"eur"|"autre", "unite_source": "fcfa"|"milliers"|"millions"|"milliards",',
    '  "cumul_depuis_debut_exercice": true|false, "date_arrete": "AAAA-MM-JJ" ou null,',
    '  "periodes": [ { "annee": 2026, "revenu_total": …, "resultat_exploitation": …, "resultat_avant_impots": …,',
    '                  "resultat_net": …, "total_actifs": …, "total_capitaux_propres": …, "pnb": …,',
    '                  "depots_clientele": …, "credits_clientele": … } ] }',
    '',
    "RÈGLES IMPÉRATIVES :",
    "1. N'INVENTE RIEN. Un chiffre absent, illisible, ou dont le LIBELLÉ de ligne n'est pas lisible → null. Ne déduis jamais une ligne de sa position dans le tableau.",
    "2. UNITÉ : lis l'en-tête du tableau. Convertis tous les montants en FCFA BRUTS (milliers ×1 000 ; millions ×1 000 000 ; milliards ×1 000 000 000).",
    "3. Une entrée par période présente dans le tableau : la période courante ET, si elle figure, la même période de l'année précédente (colonne comparative). Les colonnes « variation » ou « % » ne sont pas des périodes.",
    "4. cumul_depuis_debut_exercice = true si les montants couvrent la période depuis le début de l'exercice (ex. « au 30 juin », « 1er semestre », « 9 mois »). false s'ils couvrent un trimestre ISOLÉ (ex. « 2e trimestre seul », « T3 seul »).",
    "5. " + revenu,
    "6. resultat_net = résultat net de la période (part du groupe si consolidé). SIGNE : un montant précédé d'un « - », entre parenthèses, ou qualifié de perte est NÉGATIF. Contrôle-le avec la colonne variation et le commentaire : si le résultat « recule » d'un montant supérieur au résultat de l'année précédente, le résultat courant est une PERTE (vu chez BNBC : « recule de 81 MCFA », variation −506 %).",
    "7. total_actifs = total du bilan ; depots_clientele et credits_clientele = encours en FIN de période (pas les encours moyens).",
    "8. Si le document contient des tableaux en FCFA et en devises, utilise UNIQUEMENT les tableaux en FCFA.",
  ].join('\n');
}

export function promptUtilisateur(code: string, libelle: string, texte: string): string {
  return `Société BRVM : ${code}.\nPublication : ${libelle}\n\nTexte du rapport :\n${texte.slice(0, 40000)}`;
}

/* ───────────────────────── Garde-fous ───────────────────────── */

export interface Verdict {
  ok: boolean;
  motifs: string[];
}

/** Référence annuelle de l'exercice précédent, pour contrôler l'ordre de grandeur. */
export interface ReferenceAnnuelle {
  revenu_total: number | null;
  resultat_net: number | null;
}

/**
 * Bornes du rapport cumul / annuel précédent. Larges par construction : une
 * activité saisonnière peut faire 70 % de son année au 1er semestre. Ce contrôle
 * ne vise pas la finesse, il attrape l'ERREUR D'UNITÉ (×1 000, ×1 000 000), qui
 * sort de ces bornes de plusieurs ordres de grandeur.
 */
export function bornesCumul(code: CodeInterim): [number, number] {
  const part = MOIS[code] / 12;
  return [part * 0.35, part * 2.2];
}

/**
 * Valide UNE extraction pour la période courante (annee, code).
 * Rejette le tout plutôt que d'écrire un chiffre douteux : un trou déclaré
 * vaut mieux qu'une ligne fausse et plausible.
 */
export function verifierExtraction(
  e: Extraction,
  cible: { annee: number; code: CodeInterim },
  reference: ReferenceAnnuelle | null,
): Verdict {
  const motifs: string[] = [];
  const devise = (e.devise_source ?? '').toLowerCase();
  if (devise && devise !== 'fcfa' && devise !== 'xof') motifs.push(`devise ${devise}`);
  if (e.cumul_depuis_debut_exercice === false && cible.code !== 'T1') {
    motifs.push('trimestre isolé, pas un cumul depuis le début de l’exercice');
  }

  const courante = e.periodes.find((p) => p.annee === cible.annee);
  if (!courante) {
    motifs.push(`aucune colonne ${cible.annee}`);
    return { ok: false, motifs };
  }
  if (courante.revenu_total == null && courante.resultat_net == null && courante.pnb == null) {
    motifs.push('ni chiffre d’affaires, ni PNB, ni résultat net');
  }
  for (const p of e.periodes) {
    if (p.annee !== cible.annee && p.annee !== cible.annee - 1) motifs.push(`colonne inattendue ${p.annee}`);
    const rev = p.revenu_total ?? p.pnb;
    if (rev != null && rev <= 0) motifs.push(`${p.annee} : chiffre d’affaires non positif`);
    if (rev != null && p.resultat_net != null && Math.abs(p.resultat_net) > Math.abs(rev) * 1.5) {
      motifs.push(`${p.annee} : résultat net supérieur à 1,5 fois le chiffre d’affaires`);
    }
    if (p.total_actifs != null && p.total_capitaux_propres != null && p.total_capitaux_propres > p.total_actifs) {
      motifs.push(`${p.annee} : capitaux propres supérieurs au total du bilan`);
    }
  }

  // Ordre de grandeur contre l'annuel précédent : attrape l'erreur d'unité.
  const rev = courante.revenu_total ?? courante.pnb;
  if (reference?.revenu_total && reference.revenu_total > 0 && rev != null && rev > 0) {
    const [bas, haut] = bornesCumul(cible.code);
    const ratio = rev / reference.revenu_total;
    if (ratio < bas || ratio > haut) {
      motifs.push(
        `chiffre d’affaires = ${(ratio * 100).toFixed(1)} % de l’annuel précédent (attendu ${Math.round(bas * 100)}–${Math.round(haut * 100)} %)`,
      );
    }
  }

  return { ok: motifs.length === 0, motifs };
}
