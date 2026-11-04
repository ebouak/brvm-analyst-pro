/** Intentions d'un message WhatsApp libre ; la description EST le critère envoyé à Jev. */
export const INTENTIONS = {
  cours: 'Demande le cours, le prix ou la variation du jour d’une société cotée précise.',
  dividendes: 'Demande le dividende, le rendement ou la date de paiement du dividende d’une société cotée précise.',
  palmares_hausses: 'Demande les plus fortes hausses de la séance, les actions qui montent le plus.',
  palmares_baisses: 'Demande les plus fortes baisses de la séance, les actions qui baissent le plus.',
  palmares_volumes: 'Demande les actions les plus échangées de la séance, les plus gros volumes.',
  aide: 'Demande ce que le service sait faire ou comment l’utiliser.',
  humain: 'Veut parler à une personne de l’équipe, être rappelé ou contacté par quelqu’un.',
  conseil: 'Demande s’il faut acheter, vendre ou conserver, ou quelle action choisir : une recommandation d’investissement.',
  analyse: 'Pose une vraie question d’analyse ou d’explication (pourquoi, comparer, expliquer une notion), sans demander un simple chiffre.',
  salutation: 'Salue, remercie ou prend congé, sans autre demande.',
  autre: 'Rien de ce qui précède : hors sujet ou incompréhensible.',
} as const;

export type Intention = keyof typeof INTENTIONS;

export const LISTE_INTENTIONS = Object.keys(INTENTIONS) as Intention[];

export const estIntention = (x: unknown): x is Intention => typeof x === 'string' && x in INTENTIONS;
