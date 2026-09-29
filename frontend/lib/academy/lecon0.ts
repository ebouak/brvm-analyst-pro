/**
 * Leçon 0 — « Qui fait quoi sur le marché financier régional de l'UMOA ».
 *
 * Gratuite et ouverte à tous, comptes ou non (décision du 2026-09-29) : c'est
 * la porte d'entrée de la formation, envoyée à chaque nouvelle inscription et
 * à chaque abonnement payant (scraper/src/bienvenue/).
 *
 * La vidéo est servie depuis notre stockage (bucket public academy-videos) :
 * aucun lecteur tiers, la promesse « aucun traceur » tient.
 *
 * COPIE de remotion/ecosysteme.json (textes et voix off) : deux paquets
 * distincts, pas de module partagé. Toute correction du contenu est à
 * reporter des deux côtés, puis la vidéo à re-rendre.
 */

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const DOSSIER = `${BASE}/storage/v1/object/public/academy-videos`;

export const LECON0 = {
  chemin: '/formations/academy/lecon-0',
  titre: 'Qui fait quoi sur le marché financier de l’UMOA',
  resume:
    'Le régulateur, la Bourse, le dépositaire, les intermédiaires, les émetteurs et les investisseurs : la carte des acteurs en moins de deux minutes.',
  video: `${DOSSIER}/ecosysteme-umoa.mp4`,
  affiche: `${DOSSIER}/ecosysteme-umoa-poster.jpg`,
  vignette: `${DOSSIER}/ecosysteme-umoa.jpg`,
  duree: '1 min 42',
} as const;

export interface Famille {
  numero: string;
  nom: string;
  acteurs: { sigle: string; nom: string; roles: string[] }[];
}

export const FAMILLES: Famille[] = [
  {
    numero: '01',
    nom: 'Régulation et contrôle',
    acteurs: [
      { sigle: 'AMF-UMOA', nom: 'Autorité des Marchés Financiers — le gendarme du marché', roles: ['Surveillance du marché', 'Octroi des agréments', 'Protection des investisseurs', 'Sanction des manquements'] },
    ],
  },
  {
    numero: '02',
    nom: 'Infrastructures de marché',
    acteurs: [
      { sigle: 'BRVM', nom: 'Bourse Régionale des Valeurs Mobilières', roles: ['Organisation de la cotation', 'Promotion du marché', 'Gestion des indices boursiers'] },
      { sigle: 'DC/BR', nom: 'Dépositaire Central / Banque de Règlement', roles: ['Conservation des titres', 'Règlement-livraison', 'Banque de règlement'] },
    ],
  },
  {
    numero: '03',
    nom: 'Intermédiaires agréés',
    acteurs: [
      { sigle: 'SGI', nom: 'Société de Gestion et d’Intermédiation — investissement direct', roles: ['Ouverture du compte-titres', 'Plateforme de passage d’ordres', 'Exécution des ordres', 'Conseil'] },
      { sigle: 'SGO', nom: 'Société de Gestion d’OPCVM — investissement indirect', roles: ['Création et gestion de FCP', 'Mutualisation des risques', 'Gestion professionnelle dédiée'] },
    ],
  },
  {
    numero: '04',
    nom: 'Participants au marché',
    acteurs: [
      { sigle: 'Émetteurs', nom: 'Ils ont besoin de fonds', roles: ['États — marché obligataire', 'Entreprises — actions et obligations'] },
      { sigle: 'Investisseurs', nom: 'Ils apportent les capitaux', roles: ['Particuliers', 'Institutionnels — banques, assurances'] },
    ],
  },
];

/** Transcription de la voix off, dans l'ordre. */
export const TRANSCRIPTION: string[] = [
  'Qui fait quoi sur le marché financier régional de l’UMOA ? Quatre familles d’acteurs, un seul marché pour les huit pays de l’Union.',
  'D’abord, le régulateur : l’AMF-UMOA, le gendarme du marché. Elle surveille le marché, délivre les agréments, protège les investisseurs, et sanctionne les manquements.',
  'Ensuite, les infrastructures. La BRVM, la Bourse régionale, organise la cotation, fait la promotion du marché et gère les indices boursiers. Le DC/BR, dépositaire central et banque de règlement, conserve les titres et assure le règlement-livraison des transactions.',
  'Pour accéder au marché, on passe par des intermédiaires agréés. La SGI, société de gestion et d’intermédiation, ouvre votre compte-titres et exécute vos ordres : c’est l’investissement direct. La SGO gère des fonds communs de placement : c’est l’investissement indirect, avec des risques mutualisés et une gestion professionnelle.',
  'Enfin, les participants. Les émetteurs cherchent des fonds : les États, sur le marché obligataire, et les entreprises, en actions et en obligations. Les investisseurs apportent les capitaux : particuliers comme institutionnels, banques et assurances.',
  'Régulation, infrastructures, intermédiaires, participants : chacun a son rôle, et ensemble ils font vivre le marché.',
  'Pour investir en direct, tout commence par une SGI agréée. Comparez-les sur westbourse.com.',
];
