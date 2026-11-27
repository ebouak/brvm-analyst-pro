/**
 * Cours vidéo gratuit — « Maîtriser le Simulateur & Comparateur SGI WESTBOURSE ».
 *
 * Ouvert à tous sans compte (comme la Leçon 0) et également intégré comme
 * atelier vidéo pratique dans la Leçon 6 du Niveau 1 (« Ouvrir un compte et
 * passer son premier ordre »).
 *
 * Hébergé dans le bucket public `academy-lecon0` : aucun lecteur tiers,
 * aucun traceur.
 */

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const DOSSIER = `${BASE}/storage/v1/object/public/academy-lecon0`;

export const GUIDE_SGI = {
  chemin: '/formations/academy/simulateur-sgi',
  titre: 'Maîtriser le Simulateur & Comparateur SGI WESTBOURSE',
  resume:
    'Guide pas à pas avec les vrais écrans : paramétrer votre profil, comparer 40 SGI sur 3 scénarios réels, lire le score Matchmaker / 100 et intégrer TVA, TAF et IRVM.',
  video: `${DOSSIER}/sgi-simulateur.mp4`,
  affiche: `${DOSSIER}/sgi-simulateur.jpg`,
  vignette: `${DOSSIER}/sgi-simulateur.jpg`,
  duree: '4 min 15',
} as const;

export interface ScenarioSgiGuide {
  id: string;
  profil: string;
  parametres: string;
  gagnant: string;
  economie: string;
  lecon: string;
}

export const SCENARIOS_SGI: readonly ScenarioSgiGuide[] = [
  {
    id: 'debutant',
    profil: 'Scénario 1 · Débutant',
    parametres: '100 000 FCFA · 1 an · 2 achats · dépôt ≤ 100 000 F (27 SGI)',
    gagnant: 'Invictus Capital & Finance : 1 400 FCFA (1,40 %)',
    economie: '79 % de moins que la moyenne du marché (6 802 FCFA) ; jusqu’à 17 425 FCFA en haut de grille.',
    lecon: 'Sur un petit capital, la tenue de compte fixe crée des écarts jusqu’à ×12,4.',
  },
  {
    id: 'regulier',
    profil: 'Scénario 2 · Régulier',
    parametres: '1 000 000 FCFA · 1 an · 4 achats + 4 ventes (37 SGI)',
    gagnant: 'Images Finances Internationales : 19 000 FCFA (1,90 %)',
    economie: '44 % d’économie (14 777 FCFA) face à la moyenne de 33 777 FCFA ; devant Impaxis et Invictus (26 000 FCFA).',
    lecon: 'Le seuil pour amortir un aller-retour démarre à +1,00 % chez la moins chère.',
  },
  {
    id: 'patrimonial',
    profil: 'Scénario 3 · Patrimonial',
    parametres: '5 000 000 FCFA · 3 ans · 6 achats + 2 ventes (37 SGI)',
    gagnant: 'Impaxis Securities : 109 333 FCFA (2,19 %)',
    economie: '50 142 FCFA économisés face à la moyenne de 159 475 FCFA (et 99 209 FCFA sous le haut de grille).',
    lecon: 'Sur 3 ans et 5 M FCFA, les droits de garde annuels inversent complètement le classement.',
  },
];

export const FISCALITE_SGI = [
  {
    poste: 'TVA / TAF sur commissions',
    regle: '10 % à 18 % uniquement sur les frais de courtage et commissions (0 % sur le capital investi).',
  },
  {
    poste: 'IRVM sur dividendes (retenue à la source)',
    regle: 'Selon le pays de la société cotée : Togo 3 %, Bénin 5 %, Mali 7 %, Sénégal 10 %, Côte d’Ivoire 12 % (LF 2025), Burkina Faso 12,5 %.',
  },
  {
    poste: 'Plus-values boursières',
    regle: 'Exonérations ou barèmes variables selon votre pays de résidence UEMOA : à vérifier dans votre régime local.',
  },
] as const;

export const TRANSCRIPTION_SGI: readonly string[] = [
  'Sur la BRVM, investir 100 000 francs peut vous coûter 1 400 francs de frais par an, ou 17 425 francs selon votre SGI. Soit douze fois plus cher ! Voici comment utiliser le simulateur WESTBOURSE pour choisir la vôtre sur des chiffres réels.',
  'Sur westbourse.com/comparateur-sgi, vous accédez à quarante SGI suivies sur sept pays de l’UEMOA, dont trente-sept barèmes complets et trente-quatre officiellement homologués par l’AMF-UMOA. Cinq modules vous guident : vue d’ensemble, simulateur de frais, outil trouver ma SGI, comparateur et annuaire.',
  'Le moteur calcule cinq postes transparents : d’abord le courtage SGI de 0,1 à 1 % hors taxes, ensuite la commission fixe BRVM et DC/BR de 0,3 % par ordre, puis les droits de garde annuels ou trimestriels, la tenue de compte et les frais de virement signalés lorsqu’ils manquent.',
  'Dans l’onglet Simuler mes frais, réglez votre capital de 50 000 à 100 millions, votre durée de 3 mois à 5 ans, puis le nombre d’achats et de ventes. Filtrez par pays ou par dépôt minimum : chaque réglage recalcule le classement en direct et génère une URL partageable.',
  'Premier scénario, profil débutant : 100 000 francs sur un an, deux achats et un dépôt maximum de 100 000 francs. Sur vingt-sept SGI affichées, la moyenne est à 6 802 francs. Invictus arrive en tête à 1 400 francs, soit 79 % de moins, tandis que SGI Mali atteint 14 300 francs à cause de la tenue de compte fixe.',
  'Deuxième scénario, profil régulier : un million sur un an, quatre achats et quatre ventes, soit huit ordres. Sur trente-sept SGI, Images Finances ressort à 19 000 francs, devant Impaxis et Invictus à 26 000 francs et Société Générale Capital à 27 000, contre 33 777 en moyenne, soit 44 % d’économie.',
  'Troisième scénario, portefeuille patrimonial de 5 millions sur trois ans, avec six achats et deux ventes. Le classement change complètement : les droits de garde dominent sur la durée ! Impaxis prend la tête à 109 333 francs, devant Invictus à 110 000, face à une moyenne à 159 475 francs et plus de 208 000 en haut de tableau.',
  'Pour trancher au-delà du prix, utilisez Trouver ma SGI : l’outil note chaque SGI sur 100 selon cinq critères pondérés : coût, dépôt minimum, pays ou diaspora, gestion en ligne ou accompagnée et adossement bancaire. Affinez ensuite dans le comparateur côte à côte et vérifiez les PDF officiels dans l’annuaire.',
  'Dernier point clé : les barèmes sont hors taxes ! Sur l’avis d’opéré, la TVA ou la TAF s’ajoute uniquement sur les commissions, jamais sur le capital investi. Pour vos dividendes, l’IRVM est retenu à la source selon le pays de l’entreprise cotée : 3 % au Togo, 10 au Sénégal, 12 en Côte d’Ivoire, et vérifiez le régime des plus-values dans votre pays.',
  'En résumé : simulez votre vrai scénario, vérifiez dépôt minimum, tenue de compte et fiscalité, puis confirmez la grille écrite avec la SGI choisie. Rendez-vous dès maintenant sur westbourse.com/comparateur-sgi. Ceci n’est pas un conseil en investissement ni un conseil fiscal.',
];
