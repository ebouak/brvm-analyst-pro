/**
 * Résumé factuel et check quotidien — PURS. Chaque phrase est assemblée à partir
 * d'un chiffre mesuré ; aucune cause n'est avancée (« à cause de », « grâce à »),
 * aucune tendance n'est extrapolée. Un bloc indisponible est dit indisponible.
 */
import { delta, fmtDelta, sousTotalUemoa } from './lignes';
import type { Audience, JourSerie, Overview } from './types';

const n = (x: number) => Math.round(x).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const pct = (x: number) => `${Math.round(x)} %`;

export const MENTION_COOKIES = "Ne compte que les visiteurs ayant accepté les cookies de mesure (RGPD) : l'audience réelle est supérieure.";

export function resumeAudience(a: Audience, precedent: Overview | null): string[] {
  const l: string[] = [];
  if (a.overview.ok) {
    const o = a.overview.data;
    const d = precedent ? delta(o.personnes, precedent.personnes) : null;
    l.push(`${n(o.personnes)} personne(s) mesurée(s)${d !== null ? ` (${fmtDelta(d)} par rapport à la période précédente)` : ''}, ${n(o.sessions)} session(s), ${n(o.pagesVues)} page(s) vue(s).`);
    if (a.continents.ok) {
      const af = a.continents.data.find((c) => c.code === 'AF');
      if (af && o.personnes > 0) l.push(`L'Afrique compte ${n(af.personnes)} personne(s), soit ${pct(Math.min(100, (af.personnes / o.personnes) * 100))} des personnes mesurées.`);
      else if (!af) l.push('Aucune personne mesurée en Afrique sur la période.');
    } else l.push('Répartition par continent indisponible.');
    if (a.pays.ok) {
      const u = sousTotalUemoa(a.pays.data);
      if (u.pays > 0) l.push(`Zone UEMOA : ${n(u.personnes)} personne(s) sur ${u.pays} pays (somme par pays).`);
    }
  } else l.push('Chiffres généraux indisponibles (PostHog injoignable).');

  if (a.pages.ok && a.pages.data[0]) l.push(`Page la plus vue : ${a.pages.data[0].chemin} (${n(a.pages.data[0].vues)} vue(s)).`);
  if (a.entonnoir.ok) {
    const e = a.entonnoir.data;
    l.push(`Academy : ${n(e.academy)} personne(s) ont consulté la formation, ${n(e.lecon)} ont ouvert une leçon, ${n(e.inscription)} ont atteint l'inscription (étapes non ordonnées).`);
  } else l.push('Entonnoir Academy indisponible.');
  if (a.formationCrm.ok) {
    const f = a.formationCrm.data;
    l.push(`CRM : ${n(f.comptes)} compte(s) connecté(s) ont consulté la formation (${n(f.afrique)} en Afrique, dont ${n(f.uemoa)} en UEMOA).`);
  } else l.push('Intérêt formation du CRM indisponible.');
  return l;
}

/** Baisse anormale : moins de la moitié de la moyenne de référence. Sans référence (moyenne nulle), jamais d'alerte. */
export function alerteBaisse(jour: number, moyenne7: number): boolean {
  return moyenne7 > 0 && jour < 0.5 * moyenne7;
}

export interface AnalyseJour {
  jour: JourSerie;
  moyenne: { personnes: number; sessions: number; pagesVues: number; afrique: number };
  baisse: boolean;
}

/** `veille` = « AAAA-MM-JJ » de la veille ; les 7 jours précédents servent de référence (un jour absent de la série compte pour 0). */
export function analyseJour(serie: JourSerie[], veille: string): AnalyseJour {
  const t0 = Date.parse(`${veille}T00:00:00Z`);
  const ref: string[] = [];
  for (let i = 1; i <= 7; i++) ref.push(new Date(t0 - i * 86_400_000).toISOString().slice(0, 10));
  const parJour = new Map(serie.map((s) => [s.jour, s]));
  const j = parJour.get(veille) ?? { jour: veille, personnes: 0, sessions: 0, pagesVues: 0, afrique: 0 };
  const moy = (k: keyof Omit<JourSerie, 'jour'>) => ref.reduce((s, d) => s + (parJour.get(d)?.[k] ?? 0), 0) / 7;
  const moyenne = { personnes: moy('personnes'), sessions: moy('sessions'), pagesVues: moy('pagesVues'), afrique: moy('afrique') };
  return { jour: j, moyenne, baisse: alerteBaisse(j.personnes, moyenne.personnes) };
}

export function messageJour(a: AnalyseJour): { titre: string; texte: string } {
  const ligne = (lib: string, v: number, m: number) => `${lib} ${n(v)} (moy. 7 j ${n(m)}, ${fmtDelta(delta(v, m))})`;
  const corps = [
    ligne('Personnes', a.jour.personnes, a.moyenne.personnes),
    ligne('Sessions', a.jour.sessions, a.moyenne.sessions),
    ligne('Pages vues', a.jour.pagesVues, a.moyenne.pagesVues),
    ligne('Afrique', a.jour.afrique, a.moyenne.afrique),
  ].join(' · ');
  const tete = a.baisse ? `⚠️ Baisse anormale : moins de 50 % de la moyenne des 7 jours précédents. ` : '';
  return { titre: a.baisse ? '⚠️ Audience' : '📈 Audience', texte: `${tete}Audience du ${a.jour.jour} — ${corps}. Visiteurs ayant accepté les cookies de mesure seulement.` };
}

/** Aucun événement reçu sur toute la série : l'ingestion PostHog est cassée (ou le consentement a disparu), c'est un incident. */
export const serieVide = (serie: JourSerie[]): boolean => serie.every((j) => j.personnes === 0 && j.sessions === 0 && j.pagesVues === 0);

export const MESSAGE_SERIE_VIDE = '⚠️ aucune donnée reçue par PostHog depuis 7 jours';

/** Décision HTTP du check quotidien : tout ce qui n'est pas un message livré est un échec visible. */
export function decisionJour(serie: JourSerie[], notifie: boolean): { http: 200 | 500; erreur?: 'serie_vide' | 'notification' } {
  if (serieVide(serie)) return { http: 500, erreur: 'serie_vide' };
  if (!notifie) return { http: 500, erreur: 'notification' };
  return { http: 200 };
}

/** Classe d'erreur sûre à journaliser et à annoncer (jamais un message brut). */
export function classeErreur(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code;
  if (e instanceof Error && e.name === 'ErreurPosthog' && typeof c === 'string') return c === 'http' ? 'http' : c;
  return 'autre';
}

const NOMS_BLOCS: Record<string, string> = {
  overview: 'chiffres généraux', overviewPrecedent: 'période précédente', continents: 'continents', continentsPrecedent: 'continents (précédent)',
  pays: 'pays Afrique', villes: 'villes Afrique', sessions: 'sessions', pages: 'pages', clics: 'clics', appareils: 'appareils',
  tendance: 'tendance', entonnoir: 'entonnoir Academy', formationCrm: 'intérêt formation CRM',
};
/** Noms lisibles des blocs en échec (aucune donnée). */
export function blocsIndisponibles(a: Audience): string[] {
  return Object.keys(NOMS_BLOCS).filter((k) => {
    const b = (a as unknown as Record<string, { ok: boolean }>)[k];
    return b && !b.ok;
  }).map((k) => NOMS_BLOCS[k]);
}
