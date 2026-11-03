import 'server-only';
import { signalInconnu, trierSignaux, type Signal } from './types';
import { evaluerEnvois } from './envois';
import { chargerEnvois } from './lectureEnvois';
import { evaluerTaches } from './taches';
import { chargerTaches } from './lectureTaches';
import { evaluerDonnees } from './donnees';
import { chargerDonnees } from './lectureDonnees';

export interface Tour {
  signaux: Signal[];
  /** Instant où la page a été calculée. */
  observeA: string;
  /** Dernière photo des workflows GitHub (ops_workflows), null si illisible. */
  collecteWorkflows: string | null;
}

/**
 * Assemble les trois domaines de la Tour de contrôle. Les chargeurs tournent
 * en parallèle ; celui qui échoue devient UN signal « inconnu » — jamais une
 * section vide qui passerait pour saine.
 */
export async function chargerTour(maintenant = new Date()): Promise<Tour> {
  const [envois, taches, donnees] = await Promise.allSettled([chargerEnvois(), chargerTaches(), chargerDonnees()]);
  const signaux: Signal[] = [];
  signaux.push(
    ...(envois.status === 'fulfilled'
      ? evaluerEnvois(envois.value, maintenant)
      : [signalInconnu('envois', 'envois:lecture', 'Journaux d’envoi', 'notifications, dossiers, contact, réseaux')]),
  );
  signaux.push(
    ...(taches.status === 'fulfilled'
      ? evaluerTaches(taches.value, maintenant)
      : [signalInconnu('taches', 'taches:lecture', 'Tâches planifiées', 'collecte des workflows GitHub et scraper_runs')]),
  );
  signaux.push(
    ...(donnees.status === 'fulfilled'
      ? evaluerDonnees(donnees.value, maintenant)
      : [signalInconnu('donnees', 'donnees:lecture', 'Fraîcheur des données', 'tables de marché et vidéo de séance')]),
  );
  return {
    signaux: trierSignaux(signaux),
    observeA: maintenant.toISOString(),
    collecteWorkflows: taches.status === 'fulfilled' ? taches.value.collecteAt : null,
  };
}
