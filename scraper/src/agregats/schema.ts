/**
 * Lecture structurée des agrégats bancaires par Gemini — schéma zod et prompt.
 * PUR. Le modèle RECOPIE ce qui est imprimé (texte + unité + devise + page +
 * extrait) ; la mise à l'unité et tous les contrôles se font ensuite, en code
 * testé. Aucune conversion de devise (un document en USD reste en USD).
 */
import { z } from 'zod';
import { AGREGATS, INDICATEURS_AGREGATS } from './indicateurs.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v ?? null);

export const schemaValeurLue = z.object({
  indicateur: z.enum(INDICATEURS_AGREGATS as [string, ...string[]]),
  trouve: z.boolean(),
  texte: z.string().max(40).nullable().optional().transform((v) => v ?? null),
  unite: z.enum(['unites', 'milliers', 'millions', 'milliards', 'pct']).nullable().optional().transform((v) => v ?? null),
  perimetre: z.enum(['individuel', 'consolide', 'non_precise']).default('non_precise'),
  page: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
  libelle_exact: z.string().max(200).nullable().optional().transform((v) => v ?? null),
  extrait: z.string().max(600).nullable().optional().transform((v) => v ?? null),
  colonne: z.enum(['courante', 'comparative']).default('courante'),
  comparateur: z.enum(['=', '>', '>=', '<', '<=']).default('='),
  approximation: z.boolean().default(false),
});
export type ValeurLue = z.infer<typeof schemaValeurLue>;

export const schemaLecture = z.object({
  devise: z.string().max(20).nullable().optional().transform((v) => v ?? null),
  date_arrete: date,
  date_arrete_comparative: date,
  cumul_depuis_debut_exercice: z.boolean().nullable().optional().transform((v) => v ?? null),
  provisoire: z.boolean().default(false),
  valeurs: z.array(schemaValeurLue).max(120),
});
export type Lecture = z.infer<typeof schemaLecture>;

export function promptAgregats(code: string, libelle: string): { systeme: string; consigne: string } {
  const liste = AGREGATS.map((a) => `  - ${a.indicateur} : ${a.libelle}`).join('\n');
  const systeme = [
    'Tu lis un document publié par une BANQUE cotée à la BRVM (rapport d’activités, états financiers, bilan, communiqué).',
    'Tu RECOPIES des valeurs imprimées. Tu ne calcules JAMAIS rien : ni somme, ni différence, ni ratio, ni conversion d’unité ou de devise.',
    'Réponds UNIQUEMENT en JSON strict :',
    '{ "devise": "FCFA"|"USD"|…, "date_arrete": "AAAA-MM-JJ"|null, "date_arrete_comparative": "AAAA-MM-JJ"|null,',
    '  "cumul_depuis_debut_exercice": true|false|null, "provisoire": true|false,',
    '  "valeurs": [ { "indicateur": …, "trouve": true|false, "texte": "152 345,6"|null, "unite": "unites"|"milliers"|"millions"|"milliards"|"pct"|null,',
    '                 "perimetre": "individuel"|"consolide"|"non_precise", "page": 3|null, "libelle_exact": …|null, "extrait": …|null,',
    '                 "colonne": "courante"|"comparative", "comparateur": "="|">"|">="|"<"|"<=", "approximation": true|false } ] }',
    '',
    'Indicateurs (une entrée "courante" par indicateur, trouvé ou non ; une entrée "comparative" seulement si la colonne de l’année précédente figure) :',
    liste,
    '',
    'RÈGLES IMPÉRATIVES :',
    '1. texte = le nombre EXACTEMENT comme imprimé, sans l’unité (garde espaces, virgule, parenthèses, signe). Introuvable ou illisible → trouve=false, texte=null.',
    '2. unite = l’unité de l’EN-TÊTE du tableau (« en millions de FCFA » → millions). Les ratios en pourcentage → pct.',
    '3. perimetre = individuel (comptes sociaux / de la banque) ou consolide (comptes du groupe) SEULEMENT si le document l’écrit ; sinon non_precise. Ne mélange jamais les deux.',
    '4. Une valeur propre à une branche, une fenêtre ou une filiale (ex. « fenêtre islamique », « branche islamique ») N’EST PAS la valeur de la banque : ne la recopie pas (trouve=false), sauf si le libellé l’indique — alors recopie-la et garde ce libellé dans libelle_exact.',
    '5. Une borne (« supérieur à 14 % ») : comparateur ">" et le nombre. « environ », « près de » → approximation=true.',
    '6. charges_interets, charges_exploitation, cout_du_risque : recopie le nombre imprimé, signe compris ; ne change jamais un signe.',
    '7. charges_exploitation = frais généraux + dotations aux amortissements, UNIQUEMENT si une ligne imprimée porte ce total (« charges générales d’exploitation et dotations », « total charges d’exploitation ») ; sinon trouve=false.',
    '8. resultat_brut_exploitation, marge_interets, commissions_nettes : uniquement s’ils figurent TELS QUELS ; jamais déduits d’autres lignes.',
    '9. Encours (crédits, dépôts, total du bilan, fonds propres, créances en souffrance) : à la date d’arrêté, pas une moyenne.',
    '10. extrait = la ligne ou la phrase du document où tu lis la valeur (600 caractères au plus) ; page = numéro de page du PDF.',
    '11. provisoire=true si le document dit que les chiffres sont provisoires ou non audités « sous réserve ».',
    '12. devise = la devise des en-têtes (FCFA, USD…). Un document en dollars (USD) se recopie en USD : ne convertis jamais en FCFA.',
  ].join('\n');
  const consigne = `Banque BRVM : ${code}. Publication : ${libelle}. Le PDF est joint (il peut être scanné). Réponds uniquement par le JSON demandé.`;
  return { systeme, consigne };
}
