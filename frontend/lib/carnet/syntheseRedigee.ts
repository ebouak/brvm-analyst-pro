/**
 * Synthèse de séance RÉDIGÉE par un modèle — partie pure.
 *
 * Le modèle ne lit que les constats déjà calculés par `commenterSeance` et la
 * synthèse déterministe ; il reformule, il n'apprend rien de neuf. Sa sortie
 * est REFUSÉE (repli sur la synthèse déterministe) dès qu'elle :
 *   - contient un nombre absent des constats ;
 *   - affirme une cause (« porté par », « en raison de »…) ;
 *   - prédit, recommande ou conseille.
 * Ces trois règles sont celles de l'analyse hebdomadaire (lib/hebdo), qui les
 * applique en production depuis juillet.
 */
import type { Commentaire } from './commentaire';
import { assertNoCausalClaim, assertNoForeignNumber } from '@/lib/hebdo/narrative';
import type { MessageLlm } from '@/lib/llm/redaction';

/** Toute la matière que le modèle a le droit d'utiliser. */
export function matiere(c: Commentaire): string {
  const lignes = c.constats.map((k) => `- ${k.fait}${k.portee ? ` (${k.portee})` : ''}`);
  return [
    'CONSTATS :',
    ...lignes,
    '',
    `SYNTHÈSE DE RÉFÉRENCE : ${c.synthese ?? '(aucune)'}`,
  ].join('\n');
}

/** Nombres autorisés : ceux qui figurent dans la matière, et eux seuls. */
export function chiffresAutorises(c: Commentaire): number[] {
  const texte = matiere(c).replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
  return (texte.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
}

/**
 * Formulations de conseil ou de prévision. La synthèse décrit une séance
 * passée ; elle ne dit ni quoi faire ni ce qui va arriver.
 */
const INTERDITS = [
  'acheter', 'vendre', 'achetez', 'vendez', 'recommand', 'conseill',
  'opportunité', 'opportunite', 'il faut', 'devrait', 'devraient',
  'va monter', 'va baisser', 'vont monter', 'vont baisser', 'prévoi', 'prevoi',
  'objectif de cours', 'à surveiller de près',
];

export function sansConseilNiPrevision(texte: string): boolean {
  const t = texte.toLowerCase();
  return !INTERDITS.some((m) => t.includes(m));
}

/** Longueur bornée : une synthèse n'est pas un article. */
const MAX_CARACTERES = 700;

export function syntheseAcceptable(texte: string, c: Commentaire): boolean {
  return (
    texte.length > 0 &&
    texte.length <= MAX_CARACTERES &&
    assertNoForeignNumber(texte, chiffresAutorises(c)) &&
    assertNoCausalClaim(texte) &&
    sansConseilNiPrevision(texte)
  );
}

export function messagesSynthese(c: Commentaire): MessageLlm[] {
  return [
    {
      role: 'system',
      content:
        "Tu rédiges la synthèse d'une séance de bourse pour un investisseur de la BRVM, " +
        'en français clair, en 2 à 4 phrases, sans titre ni liste. ' +
        'Tu dis ce que les constats disent ENSEMBLE : où ils concordent, où ils divergent. ' +
        "Règles absolues : n'utilise AUCUN chiffre qui ne figure pas dans les constats ; " +
        "n'affirme aucune cause (pas de « porté par », « en raison de », « grâce à ») ; " +
        'ne fais aucune prévision et ne donne aucun conseil (pas de « acheter », « vendre », ' +
        '« opportunité », « devrait ») ; si les constats ne disent rien de notable, dis-le simplement.',
    },
    { role: 'user', content: matiere(c) },
  ];
}
