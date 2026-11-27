/**
 * Leçon 7 « Les risques » — textes éditoriaux du parcours premium.
 *
 * Ce fichier ne contient AUCUNE donnée de marché : des définitions, des
 * mécanismes et des points de vigilance tirés de la leçon. Les exemples chiffrés
 * « BRVM » de la cartographie sont calculés à l'affichage depuis les données
 * réelles (dividendes lus en base, relevé de liquidité daté), jamais écrits ici.
 */

export type CleRisque = 'marche' | 'entreprise' | 'liquidite';

export interface FicheRisque {
  cle: CleRisque;
  /** Repère du point correspondant dans la section « Les trois risques » (titre). */
  motifPoint: RegExp;
  accroche: string;
  indicateurs: string[];
  consequences: string[];
  protections: string[];
}

export const FICHES: FicheRisque[] = [
  {
    cle: 'marche',
    motifPoint: /march/i,
    accroche: 'Tout baisse en même temps',
    indicateurs: [
      'Les indices BRVM Composite et BRVM 30 : ils mesurent le mouvement d’ensemble de la cote.',
      'Le contexte : taux d’intérêt, conjoncture régionale, confiance des investisseurs.',
      'La part de votre épargne investie en actions, comparée à ce que vous pouvez laisser investi longtemps.',
    ],
    consequences: [
      'La plupart des lignes reculent ensemble, y compris les sociétés solides.',
      'Une perte de valeur apparaît même sans vente : 1 000 000 FCFA qui en valent 850 000, c’est −15 %.',
      'La tentation de vendre au plus bas, au pire moment.',
    ],
    protections: [
      'Un horizon de plusieurs années, pour ne pas être forcé de vendre.',
      'Une épargne de précaution gardée hors de la bourse (étape 7).',
      'Le savoir : la diversification ne l’efface pas (étape 3).',
    ],
  },
  {
    cle: 'entreprise',
    motifPoint: /entreprise/i,
    accroche: 'Une seule société déçoit',
    indicateurs: [
      'Chiffre d’affaires, résultat net et marge, exercice après exercice.',
      'Dette et trésorerie : financent-elles l’activité et la distribution ?',
      'Le dividende : est-il soutenable au regard des bénéfices ?',
      'Les communiqués officiels et les avis publiés par la BRVM.',
    ],
    consequences: [
      'Le cours d’une seule valeur chute sur une mauvaise nouvelle : jusqu’à 25 % dans l’exemple de la leçon.',
      'Le dividende peut être réduit ou supprimé.',
      'L’impact sur votre patrimoine dépend du poids de cette ligne.',
    ],
    protections: [
      'Diversifier : repères de 20 % par société et de 35 % par secteur.',
      'Lire les résultats publiés de chaque société détenue.',
      'Vérifier les dépendances communes : même matière première, même marché, même client.',
    ],
  },
  {
    cle: 'liquidite',
    motifPoint: /liquidit/i,
    accroche: 'Vendre devient difficile',
    indicateurs: [
      'Les capitaux et volumes échangés sur la valeur.',
      'La fréquence des échanges : combien de séances sans aucune transaction ?',
      'L’écart entre le meilleur prix acheteur et le meilleur prix vendeur.',
      'Les quantités disponibles dans le carnet d’ordres.',
    ],
    consequences: [
      'Attendre plusieurs séances, ou fractionner la vente.',
      'Accepter un prix plus bas pour trouver un acheteur.',
      'Un ordre au mieux exécuté à un prix défavorable.',
    ],
    protections: [
      'Passer des ordres à cours limité sur les valeurs peu échangées.',
      'Vérifier la liquidité avant d’acheter, pas au moment de vendre.',
      'Proportionner la taille de la ligne aux volumes habituels.',
    ],
  },
];

/** Les huit étapes du parcours (ancres, sommaire, progression). */
export const ETAPES = [
  { id: 'risques', court: 'Les trois risques' },
  { id: 'dividendes', court: 'Dividendes réels' },
  { id: 'diversification', court: 'Diversifier' },
  { id: 'regles', court: 'Règles des ordres' },
  { id: 'atelier', court: 'Atelier d’ordres' },
  { id: 'baisse', court: 'Baisse de 20 %' },
  { id: 'precaution', court: 'Épargne de précaution' },
  { id: 'valider', court: 'Check-list et quiz' },
] as const;
export type IdEtape = (typeof ETAPES)[number]['id'];

/** Notion d'une question de quiz → étape où la retravailler. */
export const NOTION_ETAPE: Record<string, IdEtape> = {
  'Les trois risques': 'risques',
  Liquidité: 'risques',
  Dividendes: 'dividendes',
  Diversification: 'diversification',
  'Règles des ordres BRVM': 'regles',
  'Fixing et marché continu': 'regles',
  'Passer un ordre': 'atelier',
  'Réagir à une baisse': 'baisse',
  'Épargne de précaution': 'precaution',
};

export type ChoixBaisse = 'vendre' | 'conserver' | 'analyser';

export const DECISIONS: { cle: ChoixBaisse; titre: string; sous: string; verdict: string; ton: 'alerte' | 'attention' | 'cle'; consequences: string[] }[] = [
  {
    cle: 'vendre',
    titre: 'Vendre immédiatement',
    sous: 'Couper la perte avant qu’elle ne grandisse.',
    verdict: 'Une réaction, pas une décision.',
    ton: 'alerte',
    consequences: [
      'La perte de 100 000 FCFA devient définitive (avant frais de courtage).',
      'Si la baisse vient de tout le marché et que la société reste solide, vous sortez au plus bas.',
      'Pour retrouver 500 000 FCFA, il faudra ensuite gagner 25 % ailleurs.',
      'Sur une valeur peu échangée, une vente au mieux peut être exécutée encore plus bas.',
    ],
  },
  {
    cle: 'conserver',
    titre: 'Conserver sans vérifier',
    sous: 'Attendre que ça remonte.',
    verdict: 'Une attente, pas une analyse.',
    ton: 'attention',
    consequences: [
      'Vous ne cristallisez pas la perte : c’est un avantage si les fondamentaux tiennent.',
      'Mais une baisse n’est pas une affaire automatique : une société dont les comptes se dégradent peut continuer de baisser.',
      'Si le dividende est réduit, le revenu attendu baisse aussi.',
      'Sans vérification, vous ne savez pas lequel de ces deux cas vous vivez.',
    ],
  },
  {
    cle: 'analyser',
    titre: 'Analyser avant de décider',
    sous: 'Comprendre d’où vient la baisse.',
    verdict: 'La méthode de la leçon.',
    ton: 'cle',
    consequences: [
      'Vous distinguez une baisse de marché d’un problème propre à l’entreprise.',
      'Votre décision (conserver, réduire ou vendre) repose sur des faits vérifiables.',
      'Vous évitez à la fois la vente panique et l’attente aveugle.',
    ],
  },
];
