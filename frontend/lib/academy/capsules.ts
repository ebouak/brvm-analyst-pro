import { badgeEnsemble, type Badge, type Nouveaute } from './nouveaute';

/**
 * Logique pure des « capsules intelligentes » et de l'organisation type Coursera
 * de la WestBourse Academy :
 *  - extraction des métadonnées réelles par leçon et par cours ;
 *  - filtres par capsules (uniquement ceux qui ont > 0 cours) ;
 *  - recommandations selon l'objectif choisi par l'apprenant ;
 *  - calendrier d'activité mensuel et compteur hebdomadaire/quotidien.
 *
 * Aucune dépendance React ni serveur : importable côté serveur, client et tests.
 */

export type ObjectifId = 'debuter' | 'dividendes' | 'technique' | 'certification';

export interface ObjectifLearning {
  id: ObjectifId;
  titre: string;
  description: string;
}

export const OBJECTIFS_LEARNING: readonly ObjectifLearning[] = [
  {
    id: 'debuter',
    titre: 'Faire mes premiers pas à la BRVM',
    description: 'Comprendre la bourse, les SGI, les frais et la gestion du risque.',
  },
  {
    id: 'dividendes',
    titre: 'Bâtir un portefeuille à dividendes',
    description: 'Lire les comptes, évaluer la pérennité d’un dividende et calculer le rendement net.',
  },
  {
    id: 'technique',
    titre: 'Lire les graphiques et le carnet',
    description: 'Maîtriser bougies, moyennes mobiles, RSI, MACD et liquidité BRVM.',
  },
  {
    id: 'certification',
    titre: 'Obtenir mes certificats par niveau',
    description: 'Valider les 4 niveaux complets, réussir les examens et publier mes certificats.',
  },
] as const;

export type CapsuleFiltreId =
  | 'tous'
  | 'debutant'
  | 'intermediaire'
  | 'avance'
  | 'expert'
  | 'ateliers'
  | 'fondamental'
  | 'technique'
  | 'revenus'
  | 'cas_reels'
  | 'simulateurs'
  | 'recent';

export type ThemeCours = 'fondamental' | 'technique' | 'revenus' | 'cas_reels';

export interface CapsuleBadge {
  id: string;
  label: string;
  ton: 'up' | 'accent' | 'purple' | 'neutre';
}

export interface LeconCapsule {
  type: 'video' | 'lecture' | 'simulateur' | 'quiz' | 'reel';
  label: string;
}

export interface CourseProgressLite {
  done: number;
  total: number;
  pct: number;
  nextIdx: number;
}

export interface HubCourseEnriched {
  id: string;
  slug: string;
  titre: string;
  niveau: string | null;
  format: 'parcours' | 'atelier';
  resume: string | null;
  cover: string | null;
  lessonsCount: number;
  modulesCount: number;
  totalMinutes: number;
  simulatorsCount: number;
  quizCount: number;
  hasRealData: boolean;
  hasVideo: boolean;
  categories: string[];
  themes: ThemeCours[];
  badge: Badge | null;
  capsules: CapsuleBadge[];
  moduleTitles: string[];
  nextLessonTitle: string | null;
  nextLessonCapsules: LeconCapsule[];
  progress: CourseProgressLite;
}

export interface LessonLike {
  titre?: string | null;
  module?: string | null;
  categorie?: string | null;
  duree_min?: number | null;
  nouveaute?: Nouveaute | null;
  qcm?: unknown | null;
  quiz?: unknown[] | null;
  sections?: {
    reel?: boolean;
    simulation?: unknown | null;
    simulations?: unknown[] | null;
    donnees_reelles?: unknown | null;
  }[] | null;
}

export function formatDuree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${String(rem).padStart(2, '0')}`;
}

export function extraireCapsulesLecon(
  lesson: LessonLike | null | undefined,
  opts?: { hasVideo?: boolean },
): LeconCapsule[] {
  if (!lesson) return [];
  const caps: LeconCapsule[] = [];
  if (opts?.hasVideo) {
    caps.push({ type: 'video', label: 'Vidéo' });
  }
  if (typeof lesson.duree_min === 'number' && lesson.duree_min > 0) {
    caps.push({ type: 'lecture', label: `Lecture · ${lesson.duree_min} min` });
  }
  const sections = Array.isArray(lesson.sections) ? lesson.sections : [];
  const sims = sections.reduce(
    (acc, s) => acc + (s?.simulation ? 1 : 0) + (Array.isArray(s?.simulations) ? s.simulations.length : 0),
    0,
  );
  if (sims > 0) {
    caps.push({ type: 'simulateur', label: sims > 1 ? `${sims} simulateurs` : 'Simulateur' });
  }
  const quizLen = Array.isArray(lesson.quiz) && lesson.quiz.length > 0 ? lesson.quiz.length : lesson.qcm ? 1 : 0;
  if (quizLen > 0) {
    caps.push({ type: 'quiz', label: quizLen > 1 ? `Quiz · ${quizLen}` : 'Quiz' });
  }
  const hasReal = sections.some((s) => Boolean(s?.donnees_reelles) || Boolean(s?.reel));
  if (hasReal) {
    caps.push({ type: 'reel', label: 'Données BRVM' });
  }
  return caps;
}

export interface MetadonneesCours {
  modulesCount: number;
  moduleTitles: string[];
  totalMinutes: number;
  simulatorsCount: number;
  quizCount: number;
  hasRealData: boolean;
  hasVideo: boolean;
  categories: string[];
  themes: ThemeCours[];
  badge: Badge | null;
  capsules: CapsuleBadge[];
}

const isCertifiant = (niveau: string | null | undefined, slug?: string | null) =>
  Boolean(niveau && ['debutant', 'intermediaire', 'avance', 'expert'].includes(niveau) && (!slug || slug.startsWith('academy-niveau-')));

export function formatCours(slug: string): 'parcours' | 'atelier' {
  return slug.startsWith('academy-niveau-') ? 'parcours' : 'atelier';
}


export function extraireMetadonneesCours(
  lessons: readonly LessonLike[],
  now: Date,
  opts?: { niveau?: string | null; slug?: string | null; titre?: string | null; hasVideo?: boolean },
): MetadonneesCours {
  const modulesSet = new Set<string>();
  const catsSet = new Set<string>();
  let totalMinutes = 0;
  let simulatorsCount = 0;
  let quizCount = 0;
  let hasRealData = false;

  for (const l of lessons) {
    if (l.module && l.module.trim()) modulesSet.add(l.module.trim());
    if (l.categorie && l.categorie.trim()) catsSet.add(l.categorie.trim());
    if (typeof l.duree_min === 'number' && l.duree_min > 0) totalMinutes += l.duree_min;
    const sections = Array.isArray(l.sections) ? l.sections : [];
    for (const s of sections) {
      if (s?.simulation) simulatorsCount += 1;
      if (Array.isArray(s?.simulations)) simulatorsCount += s.simulations.length;
      if (s?.donnees_reelles || s?.reel) hasRealData = true;
    }
    if (Array.isArray(l.quiz) && l.quiz.length > 0) quizCount += l.quiz.length;
    else if (l.qcm) quizCount += 1;
  }

  const categories = [...catsSet];
  const themesSet = new Set<ThemeCours>();
  const slugAndTitre = `${opts?.slug ?? ''} ${opts?.titre ?? ''}`.toLowerCase();

  if (categories.includes('fundamental') || categories.includes('evaluation') || slugAndTitre.includes('fondamental') || slugAndTitre.includes('per')) {
    themesSet.add('fondamental');
  }
  if (categories.includes('technical') || slugAndTitre.includes('technique')) {
    themesSet.add('technique');
  }
  if (categories.includes('income') || slugAndTitre.includes('dividende')) {
    themesSet.add('revenus');
  }
  if (hasRealData || slugAndTitre.includes('etudes-de-cas') || slugAndTitre.includes('dangote') || slugAndTitre.includes('ipo')) {
    themesSet.add('cas_reels');
  }

  const badge = badgeEnsemble(lessons, now);
  const capsules: CapsuleBadge[] = [];
  if (badge) {
    capsules.push({
      id: `badge-${badge.type}`,
      label: badge.type === 'nouveau' ? 'Nouveau' : 'Récemment mis à jour',
      ton: badge.type === 'nouveau' ? 'accent' : 'up',
    });
  }
  if (simulatorsCount > 0) {
    capsules.push({
      id: 'simulators',
      label: `${simulatorsCount} simulateur${simulatorsCount > 1 ? 's' : ''}`,
      ton: 'neutre',
    });
  }
  if (hasRealData) {
    capsules.push({ id: 'real-data', label: 'Données réelles BRVM', ton: 'neutre' });
  }
  if (isCertifiant(opts?.niveau, opts?.slug)) {
    capsules.push({ id: 'certifiant', label: 'Certifiant', ton: 'neutre' });
  } else if (opts?.slug && formatCours(opts.slug) === 'atelier') {
    capsules.push({ id: 'atelier', label: 'Atelier court', ton: 'neutre' });
  }

  return {
    modulesCount: modulesSet.size > 0 ? modulesSet.size : lessons.length > 0 ? 1 : 0,
    moduleTitles: [...modulesSet],
    totalMinutes,
    simulatorsCount,
    quizCount,
    hasRealData,
    hasVideo: Boolean(opts?.hasVideo),
    categories,
    themes: [...themesSet],
    badge,
    capsules: capsules.slice(0, 3),
  };
}

export function recommanderPourObjectif(
  courses: readonly Pick<HubCourseEnriched, 'slug' | 'niveau' | 'themes'>[],
  goalId: ObjectifId | null,
): Set<string> {
  const out = new Set<string>();
  if (!goalId) return out;
  for (const c of courses) {
    if (goalId === 'debuter' && c.niveau === 'debutant') out.add(c.slug);
    else if (goalId === 'dividendes' && (c.themes.includes('revenus') || c.themes.includes('fondamental'))) out.add(c.slug);
    else if (goalId === 'technique' && (c.themes.includes('technique') || c.slug.includes('technique'))) out.add(c.slug);
    else if (goalId === 'certification' && isCertifiant(c.niveau, c.slug)) out.add(c.slug);
  }
  return out;
}

const FILTRES_ORDRE: { id: CapsuleFiltreId; label: string; match: (c: HubCourseEnriched) => boolean }[] = [
  { id: 'tous', label: 'Tous les cours', match: () => true },
  { id: 'debutant', label: 'Débutant', match: (c) => c.niveau === 'debutant' },
  { id: 'intermediaire', label: 'Intermédiaire', match: (c) => c.niveau === 'intermediaire' },
  { id: 'avance', label: 'Avancé', match: (c) => c.niveau === 'avance' },
  { id: 'expert', label: 'Expert', match: (c) => c.niveau === 'expert' },
  { id: 'ateliers', label: 'Ateliers courts', match: (c) => c.format === 'atelier' },
  { id: 'fondamental', label: 'Analyse fondamentale', match: (c) => c.themes.includes('fondamental') },
  { id: 'technique', label: 'Analyse technique', match: (c) => c.themes.includes('technique') },
  { id: 'revenus', label: 'Dividendes & revenus', match: (c) => c.themes.includes('revenus') },
  { id: 'cas_reels', label: 'Cas réels BRVM', match: (c) => c.themes.includes('cas_reels') },
  { id: 'simulateurs', label: 'Avec simulateurs', match: (c) => c.simulatorsCount > 0 },
  { id: 'recent', label: 'Récents & mis à jour', match: (c) => c.badge !== null },
];

export function construireFiltresCapsules(
  courses: readonly HubCourseEnriched[],
): { id: CapsuleFiltreId; label: string; count: number }[] {
  const res: { id: CapsuleFiltreId; label: string; count: number }[] = [];
  for (const f of FILTRES_ORDRE) {
    const count = courses.filter(f.match).length;
    if (f.id === 'tous' || count > 0) {
      res.push({ id: f.id, label: f.label, count });
    }
  }
  return res;
}

const normaliser = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filtrerCours(
  courses: readonly HubCourseEnriched[],
  opts: {
    tab: 'explorer' | 'en_cours' | 'termines';
    filtre?: CapsuleFiltreId;
    query?: string;
  },
): HubCourseEnriched[] {
  const filtreSpec = FILTRES_ORDRE.find((f) => f.id === (opts.filtre ?? 'tous')) ?? FILTRES_ORDRE[0]!;
  const q = normaliser(opts.query ?? '');

  return courses.filter((c) => {
    if (opts.tab === 'en_cours' && (c.progress.done === 0 || c.progress.pct >= 100)) return false;
    if (opts.tab === 'termines' && c.progress.pct < 100) return false;
    if (opts.tab === 'explorer' && !filtreSpec.match(c)) return false;
    if (q) {
      const hay = normaliser([c.titre, c.resume ?? '', ...c.moduleTitles, c.niveau ?? ''].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface ActiviteCalendrier {
  annee: number;
  mois: number;
  moisLabel: string;
  /** 0 = lundi ... 6 = dimanche */
  premierJourSemaine: number;
  nbJours: number;
  jourCourant: number;
  joursActifs: number[];
  leconsSemaine: number;
  leconsAujourdhui: number;
}

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function ymdUtc(d: Date): { y: number; m: number; day: number; dowMon: number } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const dowSun = d.getUTCDay();
  const dowMon = dowSun === 0 ? 6 : dowSun - 1;
  return { y, m, day, dowMon };
}

export function calculerActiviteCalendrier(
  rows: readonly { completed: boolean; updated_at: string }[],
  now: Date,
): ActiviteCalendrier {
  const cur = ymdUtc(now);
  const firstOfMonth = new Date(Date.UTC(cur.y, cur.m, 1));
  const premierJourSemaine = ymdUtc(firstOfMonth).dowMon;
  const nbJours = new Date(Date.UTC(cur.y, cur.m + 1, 0)).getUTCDate();

  // Début de la semaine courante (lundi 00:00 UTC)
  const mondayStartMs = Date.UTC(cur.y, cur.m, cur.day - cur.dowMon);
  const todayStartMs = Date.UTC(cur.y, cur.m, cur.day);
  const tomorrowStartMs = todayStartMs + 86_400_000;

  const joursSet = new Set<number>();
  let leconsSemaine = 0;
  let leconsAujourdhui = 0;

  for (const r of rows) {
    if (!r.completed) continue;
    const ms = Date.parse(r.updated_at);
    if (!Number.isFinite(ms)) continue;
    const d = ymdUtc(new Date(ms));
    if (d.y === cur.y && d.m === cur.m) joursSet.add(d.day);
    if (ms >= mondayStartMs && ms < tomorrowStartMs) leconsSemaine += 1;
    if (ms >= todayStartMs && ms < tomorrowStartMs) leconsAujourdhui += 1;
  }

  return {
    annee: cur.y,
    mois: cur.m,
    moisLabel: `${MOIS_FR[cur.m]} ${cur.y}`,
    premierJourSemaine,
    nbJours,
    jourCourant: cur.day,
    joursActifs: [...joursSet].sort((a, b) => a - b),
    leconsSemaine,
    leconsAujourdhui,
  };
}

export interface FormuleMemo {
  leconTitre: string;
  nom: string;
  expression: string;
  exemple: string;
}

export interface PiegeMemo {
  leconTitre: string;
  titre: string;
  detail: string;
  verifier: string;
}

export interface FlashcardMemo {
  id: string;
  categorie: 'Formule' | 'Lexique' | 'Piège' | 'À retenir';
  recto: string;
  verso: string;
  source: string;
}

export interface CartesRevision {
  formules: FormuleMemo[];
  pieges: PiegeMemo[];
  flashcards: FlashcardMemo[];
}

export interface RevisionCourseLike {
  glossaire?: { terme: string; definition: string }[] | null;
  lessons: {
    titre: string;
    sections: {
      type: string;
      titre: string;
      formules?: { nom: string; expression: string; exemple?: string }[] | null;
      points?: { titre: string; detail?: string; verifier?: string }[] | null;
    }[];
  }[];
}

export function extraireCartesRevision(content: RevisionCourseLike): CartesRevision {
  const formules: FormuleMemo[] = [];
  const pieges: PiegeMemo[] = [];
  const flashcards: FlashcardMemo[] = [];
  const seenRectos = new Set<string>();

  const pushCard = (c: Omit<FlashcardMemo, 'id'>) => {
    const key = `${c.categorie}:${c.recto.trim().toLowerCase()}`;
    if (!c.recto.trim() || !c.verso.trim() || seenRectos.has(key)) return;
    seenRectos.add(key);
    flashcards.push({ id: `fc-${flashcards.length + 1}`, ...c });
  };

  for (const l of content.lessons) {
    for (const s of l.sections) {
      for (const f of s.formules ?? []) {
        formules.push({
          leconTitre: l.titre,
          nom: f.nom,
          expression: f.expression,
          exemple: f.exemple ?? '',
        });
        pushCard({
          categorie: 'Formule',
          recto: f.nom,
          verso: f.exemple ? `${f.expression}\n\nExemple : ${f.exemple}` : f.expression,
          source: l.titre,
        });
      }
      if (s.type === 'piege') {
        for (const p of s.points ?? []) {
          if (!p.detail) continue;
          pieges.push({
            leconTitre: l.titre,
            titre: p.titre,
            detail: p.detail,
            verifier: p.verifier ?? '',
          });
          pushCard({
            categorie: 'Piège',
            recto: `Piège : ${p.titre}`,
            verso: p.verifier ? `${p.detail}\n\nÀ vérifier : ${p.verifier}` : p.detail,
            source: l.titre,
          });
        }
      } else if (s.type === 'retenir') {
        for (const p of s.points ?? []) {
          if (!p.detail) continue;
          pushCard({
            categorie: 'À retenir',
            recto: p.titre,
            verso: p.detail,
            source: l.titre,
          });
        }
      }
    }
  }

  for (const g of content.glossaire ?? []) {
    pushCard({
      categorie: 'Lexique',
      recto: g.terme,
      verso: g.definition,
      source: 'Glossaire du cours',
    });
  }

  return { formules, pieges, flashcards };
}

