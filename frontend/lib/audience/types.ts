/** Types de l'audience PostHog — agrégats seulement, aucune donnée personnelle. */
export interface Overview { evenements: number; pagesVues: number; personnes: number; sessions: number }
export interface ContinentLigne { code: string | null; nom: string; personnes: number; sessions: number }
export interface PaysLigne { code: string | null; nom: string; personnes: number; sessions: number; uemoa: boolean }
export interface VilleLigne { ville: string; pays: string; personnes: number }
export interface SessionsStats { sessions: number; dureeMoyenneS: number | null; dureeMedianeS: number | null; pagesParSession: number | null }
export interface PageLigne { chemin: string; vues: number; personnes: number }
export interface ClicLigne { libelle: string; clics: number; personnes: number }
export interface AppareilLigne { type: string; personnes: number; sessions: number }
export interface TendancePoint { semaine: string; continent: string; personnes: number }
export interface Entonnoir { academy: number; lecon: number; inscription: number }
export interface JourSerie { jour: string; personnes: number; sessions: number; pagesVues: number; afrique: number }

/** Un bloc qui échoue n'emporte pas la page : il est déclaré indisponible. */
export type Bloc<T> = { ok: true; data: T } | { ok: false; erreur: string };

export interface FormationCrm {
  /** Comptes avec au moins un signal `formation_vue` dans la fenêtre. */
  comptes: number;
  afrique: number;
  uemoa: number;
  paysInconnu: number;
}

export interface Audience {
  debut: string; // ISO
  fin: string;
  overview: Bloc<Overview>;
  overviewPrecedent: Bloc<Overview>;
  continents: Bloc<ContinentLigne[]>;
  continentsPrecedent: Bloc<ContinentLigne[]>;
  pays: Bloc<PaysLigne[]>;
  villes: Bloc<VilleLigne[]>;
  sessions: Bloc<SessionsStats>;
  pages: Bloc<PageLigne[]>;
  clics: Bloc<ClicLigne[]>;
  appareils: Bloc<AppareilLigne[]>;
  tendance: Bloc<TendancePoint[]>;
  entonnoir: Bloc<Entonnoir>;
  formationCrm: Bloc<FormationCrm>;
}
