/**
 * Classement d'une question posée sur la fiche d'une valeur, par Jev (TypeSafe).
 * Module PUR : construction de la requête, validation de la réponse, décision.
 *
 * La valeur est connue (on est sur sa fiche) : Jev ne classe que la DEMANDE.
 * Une intention à réponse déterministe, classée avec assurance, est servie
 * sans LLM (gabarits + chiffres lus en base). Tout le reste, et tout doute,
 * part vers l'IA avec outils et contrôle des chiffres.
 */
import { MARGE_INTENTION, SEUIL_INTENTION } from '@/lib/whatsapp/aiguillage/decider';

/** La description EST le critère envoyé à Jev. */
export const INTENTIONS_FICHE = {
  cours_jour: 'Demande le cours, le prix ou la variation de la dernière séance de cette valeur.',
  historique:
    'Demande comment le cours a évolué sur une période (une semaine, des mois, un an, depuis l’introduction), sans demander pourquoi.',
  actualites: 'Demande les actualités, communiqués ou publications récentes de cette société.',
  dividendes: 'Demande les dividendes versés, leur évolution, le rendement ou les dates de détachement et de paiement.',
  comptes:
    'Demande les comptes annuels publiés : chiffre d’affaires, résultat, bilan, ou un résumé des comptes d’un exercice.',
  technique: 'Demande ce que disent les indicateurs techniques (RSI, MACD, moyennes mobiles) aujourd’hui.',
  liquidite: 'Demande si le titre est facile à acheter ou revendre : liquidité, volumes, carnet d’ordres, fourchette.',
  conseil: 'Demande s’il faut acheter, vendre ou conserver, un objectif de cours ou une recommandation personnelle.',
  autre:
    'Toute autre demande : expliquer pourquoi le cours a bougé, le risque, le signal, comparer, ou une question composite.',
} as const;

export type IntentionFiche = keyof typeof INTENTIONS_FICHE;
export type IntentionDeterministe = Exclude<IntentionFiche, 'autre'>;

export const QUESTION_FICHE = 'demande';

const estIntention = (x: unknown): x is IntentionFiche => typeof x === 'string' && x in INTENTIONS_FICHE;
const proba = (p: unknown): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;

export function construireRequeteIntention(question: string, v: { code: string; nom: string | null }) {
  return {
    state: { question, valeur: v.nom ? `${v.code} — ${v.nom}` : v.code },
    questions: {
      [QUESTION_FICHE]: {
        type: 'choice',
        instructions:
          'Que demande `question`, posée sur la fiche de la valeur cotée `valeur` du site d’information boursière WESTBOURSE (BRVM) ?',
        criteria: { ...INTENTIONS_FICHE },
      },
    } as Record<string, unknown>,
  };
}

export interface IntentionValide {
  intention: IntentionFiche;
  probabilites: Partial<Record<IntentionFiche, number>>;
}

export function validerIntention(brut: unknown): IntentionValide | null {
  if (!brut || typeof brut !== 'object') return null;
  const answers = (brut as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const c = (answers as Record<string, unknown>)[QUESTION_FICHE] as
    | { type?: unknown; choice?: unknown; probabilities?: unknown }
    | undefined;
  if (!c || c.type !== 'choice' || !estIntention(c.choice)) return null;
  if (!c.probabilities || typeof c.probabilities !== 'object') return null;
  const probabilites: Partial<Record<IntentionFiche, number>> = {};
  for (const [k, p] of Object.entries(c.probabilities as Record<string, unknown>)) {
    if (!estIntention(k) || !proba(p)) return null;
    probabilites[k] = p;
  }
  if (probabilites[c.choice] === undefined) return null;
  return { intention: c.choice, probabilites };
}

export type Voie = { voie: 'jev'; intention: IntentionDeterministe } | { voie: 'ia' };

/** Mêmes seuils que l'aiguillage WhatsApp : le doute part TOUJOURS vers l'IA vérifiée. */
export function deciderIntention(v: IntentionValide): Voie {
  const p = v.probabilites[v.intention] ?? 0;
  const second = Math.max(
    0,
    ...Object.entries(v.probabilites)
      .filter(([k]) => k !== v.intention)
      .map(([, x]) => x ?? 0),
  );
  if (p < SEUIL_INTENTION || p - second < MARGE_INTENTION) return { voie: 'ia' };
  if (v.intention === 'autre') return { voie: 'ia' };
  return { voie: 'jev', intention: v.intention };
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const MOTS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12,
};

/**
 * Période lue dans la question. `{ jours: null }` = toute la période
 * disponible ; `null` = rien de lisible.
 */
export function lirePeriode(question: string): { jours: number | null } | null {
  const t = sansAccent(question).replace(/[’']/g, "'");
  if (/introduction|depuis toujours|tout l'historique|toute la periode|depuis le debut|historique complet/.test(t)) {
    return { jours: null };
  }
  if (/cette semaine/.test(t)) return { jours: 7 };
  if (/ce mois/.test(t)) return { jours: 30 };
  if (/cette annee/.test(t)) return { jours: 365 };
  const m = /\b(\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\s+(jours?|semaines?|mois|ans|an|annees?)\b/.exec(t);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : MOTS[m[1]!]!;
  const u = m[2]!;
  const base = u.startsWith('jour') ? 1 : u.startsWith('semaine') ? 7 : u === 'mois' ? 30 : 365;
  if (n <= 0) return null;
  return { jours: n * base };
}

export function lireExercice(question: string): number | null {
  const m = /\b(199\d|20\d{2})\b/.exec(question);
  return m ? Number(m[1]) : null;
}
