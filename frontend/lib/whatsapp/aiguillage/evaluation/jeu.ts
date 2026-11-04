import type { Intention } from '../intentions';

export interface MessageEval {
  texte: string;
  intention: Intention;
  /** Code attendu pour cours / dividendes. */
  code?: string;
}

export const JEU: MessageEval[] = [
  { texte: 'quel est le cours de Sonatel aujourd’hui ?', intention: 'cours', code: 'SNTS' },
  { texte: 'combien vaut l’action Orange Côte d’Ivoire', intention: 'cours', code: 'ORAC' },
  { texte: 'prix de la SGBCI', intention: 'cours', code: 'SGBC' },
  { texte: 'le titre TotalEnergies Côte d’Ivoire a bougé comment aujourd’hui ?', intention: 'cours', code: 'TTLC' },
  { texte: 'cours Nestlé CI', intention: 'cours', code: 'NTLC' },
  { texte: 'à combien est la CIE ?', intention: 'cours', code: 'CIEC' },
  { texte: 'Sonatel est à combien ce matin', intention: 'cours', code: 'SNTS' },
  { texte: 'donne moi le cours de palmci', intention: 'cours', code: 'PALC' },
  { texte: 'ecobank transnational cours du jour', intention: 'cours', code: 'ETIT' },
  { texte: 'cours de l’opérateur télécom du Burkina', intention: 'cours', code: 'ONTBF' },
  { texte: 'Sonatel verse combien de dividende ?', intention: 'dividendes', code: 'SNTS' },
  { texte: 'quand est payé le dividende d’Orange CI', intention: 'dividendes', code: 'ORAC' },
  { texte: 'dividende SGBCI cette année', intention: 'dividendes', code: 'SGBC' },
  { texte: 'la SODECI distribue-t-elle un dividende ?', intention: 'dividendes', code: 'SDCC' },
  { texte: 'rendement du dividende de TotalEnergies CI', intention: 'dividendes', code: 'TTLC' },
  { texte: 'DIV PALC', intention: 'dividendes', code: 'PALC' },
  { texte: 'quelles actions montent le plus aujourd’hui ?', intention: 'palmares_hausses' },
  { texte: 'les plus fortes baisses de la séance', intention: 'palmares_baisses' },
  { texte: 'quels titres ont le plus échangé aujourd’hui', intention: 'palmares_volumes' },
  { texte: 'top des hausses', intention: 'palmares_hausses' },
  { texte: 'PALMARES', intention: 'palmares_hausses' },
  { texte: 'comment ça marche ?', intention: 'aide' },
  { texte: 'qu’est-ce que je peux vous demander', intention: 'aide' },
  { texte: 'je dois acheter Sonatel maintenant ?', intention: 'conseil' },
  { texte: 'quelle action acheter pour avoir des dividendes', intention: 'conseil' },
  { texte: 'est-ce le moment de vendre mes Orange CI ?', intention: 'conseil' },
  { texte: 'tu me conseilles SGBCI ou Ecobank ?', intention: 'conseil' },
  { texte: 'quelle est la meilleure action de la BRVM', intention: 'conseil' },
  { texte: 'faut-il garder mes actions TotalEnergies', intention: 'conseil' },
  { texte: 'bonjour', intention: 'salutation' },
  { texte: 'merci beaucoup', intention: 'salutation' },
  { texte: 'bonsoir', intention: 'salutation' },
  { texte: 'merci pour l’info', intention: 'salutation' },
  { texte: 'je voudrais parler à quelqu’un de l’équipe', intention: 'humain' },
  { texte: 'pouvez-vous me rappeler s’il vous plaît', intention: 'humain' },
  { texte: 'pourquoi Sonatel a baissé cette semaine ?', intention: 'analyse' },
  { texte: 'compare Orange CI et Sonatel sur cinq ans', intention: 'analyse' },
  { texte: 'expliquez-moi ce qu’est un dividende', intention: 'analyse' },
  { texte: 'je cherche un appartement à Abidjan', intention: 'autre' },
  { texte: 'quelle heure est-il', intention: 'autre' },
];
