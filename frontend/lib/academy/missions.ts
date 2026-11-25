import type { Niveau } from './types';

/** Compteurs réels de l'utilisateur lus côté serveur (RLS / service_role). */
export interface ActivitySnapshot {
  watchlistCount: number;
  paperAccountsCount: number;
  paperOrdersCount: number;
  alertsCount: number;
  thesesCount: number;
  portfolioPositionsCount: number;
  passedExamsCount: number;
}

export interface MissionPratique {
  id: string;
  niveau: Niveau;
  titre: string;
  description: string;
  href: string;
  cta: string;
  actuel: number;
  cible: number;
  complete: boolean;
}

export interface ResumeMissions {
  missions: MissionPratique[];
  done: number;
  total: number;
  pct: number;
  nextMission: MissionPratique | null;
}

interface MissionDef {
  id: string;
  niveau: Niveau;
  titre: string;
  description: string;
  href: string;
  cta: string;
  cible: number;
  lire: (s: ActivitySnapshot) => number;
}

const MISSIONS_DEFS: readonly MissionDef[] = [
  {
    id: 'n1-watchlist',
    niveau: 'debutant',
    titre: 'Suivre 3 actions BRVM en watchlist',
    description: 'Sélectionnez au moins 3 sociétés de la cote pour observer leurs séances et dividendes au quotidien.',
    href: '/portefeuille',
    cta: 'Ouvrir ma watchlist',
    cible: 3,
    lire: (s) => s.watchlistCount,
  },
  {
    id: 'n1-paper-account',
    niveau: 'debutant',
    titre: 'Ouvrir un portefeuille virtuel Paper Trading',
    description: 'Initialisez un capital fictif adossé aux vrais cours de la BRVM sans engager d’argent réel.',
    href: '/premium/paper-trading',
    cta: 'Créer mon portefeuille virtuel',
    cible: 1,
    lire: (s) => s.paperAccountsCount,
  },
  {
    id: 'n2-these',
    niveau: 'intermediaire',
    titre: 'Rédiger votre 1re thèse d’investissement',
    description: 'Documentez votre raisonnement (scénario, horizon, niveau cible) avant de prendre position.',
    href: '/journal',
    cta: 'Ouvrir le journal de thèses',
    cible: 1,
    lire: (s) => s.thesesCount,
  },
  {
    id: 'n2-paper-ordre',
    niveau: 'intermediaire',
    titre: 'Simuler un premier ordre sur cours réels',
    description: 'Passez votre premier ordre fictif (cours limité ou au mieux) pour tester la mécanique du carnet.',
    href: '/premium/paper-trading',
    cta: 'Passer un ordre fictif',
    cible: 1,
    lire: (s) => s.paperOrdersCount,
  },
  {
    id: 'n3-alerte',
    niveau: 'avance',
    titre: 'Poser une alerte de prix sur un niveau clé',
    description: 'Paramétrez un seuil de support ou de résistance pour être prévenu sans surveiller la cote en continu.',
    href: '/portefeuille',
    cta: 'Créer une alerte prix',
    cible: 1,
    lire: (s) => s.alertsCount,
  },
  {
    id: 'n3-paper-3-ordres',
    niveau: 'avance',
    titre: 'Exécuter 3 ordres simulés en Paper Trading',
    description: 'Mettez votre discipline de risque en pratique sur au moins 3 opérations virtuelles distinctes.',
    href: '/premium/paper-trading',
    cta: 'Continuer en Paper Trading',
    cible: 3,
    lire: (s) => s.paperOrdersCount,
  },
  {
    id: 'n4-portefeuille',
    niveau: 'expert',
    titre: 'Structurer un portefeuille suivi (≥ 3 lignes)',
    description: 'Suivez une allocation diversifiée d’au moins 3 valeurs avec PRU, pondération et concentration HHI.',
    href: '/portefeuille',
    cta: 'Gérer mon portefeuille',
    cible: 3,
    lire: (s) => s.portfolioPositionsCount,
  },
  {
    id: 'n4-certificat',
    niveau: 'expert',
    titre: 'Réussir au moins un examen certifiant (≥ 70 %)',
    description: 'Validez vos acquis lors d’un examen chronométré officiel pour générer votre certificat vérifiable.',
    href: '/formations/academy/examen/debutant',
    cta: 'Passer un examen',
    cible: 1,
    lire: (s) => s.passedExamsCount,
  },
];

export const EMPTY_ACTIVITY_SNAPSHOT: ActivitySnapshot = {
  watchlistCount: 0,
  paperAccountsCount: 0,
  paperOrdersCount: 0,
  alertsCount: 0,
  thesesCount: 0,
  portfolioPositionsCount: 0,
  passedExamsCount: 0,
};

/** Évalue l'état d'avancement des 8 missions pratiques à partir d'un cliché d'activité. */
export function evaluerMissions(snapshot: ActivitySnapshot): ResumeMissions {
  const missions: MissionPratique[] = MISSIONS_DEFS.map((d) => {
    const brut = Math.max(0, Math.floor(d.lire(snapshot) || 0));
    return {
      id: d.id,
      niveau: d.niveau,
      titre: d.titre,
      description: d.description,
      href: d.href,
      cta: d.cta,
      actuel: Math.min(brut, d.cible),
      cible: d.cible,
      complete: brut >= d.cible,
    };
  });

  const done = missions.filter((m) => m.complete).length;
  const total = missions.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const nextMission = missions.find((m) => !m.complete) ?? null;

  return { missions, done, total, pct, nextMission };
}
