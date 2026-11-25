import { NIVEAU_LABEL, type Niveau } from './types';

/** Jours d'inactivité minimum avant d'envoyer un rappel de progression. */
export const DELAI_INACTIVITE_JOURS = 5;
/** Au-delà de 45 jours sans connexion, on bascule sur un réengagement global CRM. */
export const FENETRE_MAX_JOURS = 45;
/** Délai minimum entre deux rappels pour un même utilisateur. */
export const COOLDOWN_RELANCE_JOURS = 14;
/** Plafond quotidien pour protéger le quota Resend et la réputation du domaine. */
export const PLAFOND_RELANCES_PAR_JOUR = 30;

const JOUR_MS = 86_400_000;

export interface CandidatRelanceAcademy {
  userId: string;
  email: string;
  displayName: string | null;
  courseSlug: string;
  courseTitre: string;
  niveau: string | null;
  doneLessons: number;
  totalLessons: number;
  nextLessonIdx: number;
  nextLessonTitle: string | null;
  lastActivityAt: string;
  examPassed: boolean;
  oppose: boolean;
  lastReminderAt: string | null;
}

export interface RelanceSelectionnee {
  userId: string;
  email: string;
  displayName: string | null;
  courseSlug: string;
  courseTitre: string;
  niveau: string | null;
  doneLessons: number;
  totalLessons: number;
  remainingLessons: number;
  nextLessonIdx: number;
  nextLessonTitle: string | null;
  joursInactif: number;
}

/** Jeton d'arrêt posé sur chaque envoi réel (`academy_reminder_logs.jeton_arret`, 0272). */
const JETON_ARRET = /^[a-f0-9]{48}$/;

export function estJetonArret(t: unknown): t is string {
  return typeof t === 'string' && JETON_ARRET.test(t);
}

/**
 * Statuts qui ouvrent le délai de 14 jours. `envoi` = trace posée avant l'appel
 * à Resend dont l'issue n'a pas pu être notée : « peut-être parti », donc compté.
 * `echec` ne compte pas (Resend a répondu non, rien n'est parti). En simulation,
 * les passages simulés comptent aussi, sinon chaque jour resimulerait les mêmes
 * personnes ; en réel ils ne comptent pas, sinon la bascule repousserait de
 * 14 jours le premier vrai rappel.
 */
export function statutsCooldown(mode: 'simulation' | 'actif'): string[] {
  return mode === 'simulation' ? ['simulation', 'envoi', 'envoye'] : ['envoi', 'envoye'];
}

/**
 * Vrai si une activité datée `lastActivityAt` tombe dans la fenêtre J+5 → J+45
 * et qu'aucun rappel n'a eu lieu depuis moins de 14 jours. Sert au tri préalable
 * de la route (elle ne cherche l'adresse que des personnes concernées) ET à la
 * sélection : une seule règle.
 */
export function dansFenetreDeRelance(
  lastActivityAt: string,
  lastReminderAt: string | null,
  maintenant: Date,
): boolean {
  const nowMs = maintenant.getTime();
  const lastAtMs = Date.parse(lastActivityAt);
  if (!Number.isFinite(lastAtMs)) return false;
  const joursInactif = Math.floor((nowMs - lastAtMs) / JOUR_MS);
  if (joursInactif < DELAI_INACTIVITE_JOURS || joursInactif > FENETRE_MAX_JOURS) return false;
  if (lastReminderAt) {
    const lastRemMs = Date.parse(lastReminderAt);
    if (Number.isFinite(lastRemMs) && nowMs - lastRemMs < COOLDOWN_RELANCE_JOURS * JOUR_MS) return false;
  }
  return true;
}

/** Liens de retrait d'un e-mail : page à bouton, URL « un clic » (RFC 8058), préférences. */
export function liensArret(siteUrl: string, jeton: string): { page: string; unClic: string; preferences: string } {
  const base = siteUrl.replace(/\/+$/, '');
  const t = encodeURIComponent(jeton);
  return {
    page: `${base}/academy/rappels/arret?t=${t}`,
    unClic: `${base}/api/academy/rappels/arret?t=${t}`,
    preferences: `${base}/parametres/alertes`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sélectionne au plus une relance par utilisateur parmi les cours entamés
 * et laissés au repos entre J+5 et J+45, hors utilisateurs opposés ou déjà
 * certifiés sur le niveau concerné, et hors cooldown de 14 jours.
 */
export function selectionnerRelancesAcademy(
  candidats: readonly CandidatRelanceAcademy[],
  maintenant: Date,
  plafond = PLAFOND_RELANCES_PAR_JOUR,
): RelanceSelectionnee[] {
  const nowMs = maintenant.getTime();
  const parUser = new Map<string, { item: RelanceSelectionnee; lastAtMs: number }>();

  for (const c of candidats) {
    if (!c.email || c.oppose || c.examPassed) continue;
    if (c.doneLessons < 1 || c.totalLessons <= c.doneLessons) continue;

    const lastAtMs = Date.parse(c.lastActivityAt);
    if (!dansFenetreDeRelance(c.lastActivityAt, c.lastReminderAt, maintenant)) continue;
    const joursInactif = Math.floor((nowMs - lastAtMs) / JOUR_MS);

    const remainingLessons = c.totalLessons - c.doneLessons;
    const item: RelanceSelectionnee = {
      userId: c.userId,
      email: c.email,
      displayName: c.displayName,
      courseSlug: c.courseSlug,
      courseTitre: c.courseTitre,
      niveau: c.niveau,
      doneLessons: c.doneLessons,
      totalLessons: c.totalLessons,
      remainingLessons,
      nextLessonIdx: c.nextLessonIdx,
      nextLessonTitle: c.nextLessonTitle,
      joursInactif,
    };

    const existing = parUser.get(c.userId);
    if (
      !existing ||
      item.remainingLessons < existing.item.remainingLessons ||
      (item.remainingLessons === existing.item.remainingLessons && lastAtMs > existing.lastAtMs)
    ) {
      parUser.set(c.userId, { item, lastAtMs });
    }
  }

  return [...parUser.values()]
    .map((x) => x.item)
    .sort((a, b) => a.remainingLessons - b.remainingLessons || a.joursInactif - b.joursInactif)
    .slice(0, Math.max(0, plafond));
}

/**
 * Échec fermé : sans jeton d'arrêt valide, l'e-mail n'est pas composé — on
 * n'écrit jamais à quelqu'un sans lui donner le moyen d'arrêter.
 */
export function composerEmailRelanceAcademy(
  cible: RelanceSelectionnee,
  options: { jetonArret: string; siteUrl?: string },
): { subject: string; text: string; html: string; resumeUrl: string; headers: Record<string, string> } {
  if (!estJetonArret(options.jetonArret)) throw new Error("Jeton d'arrêt invalide : e-mail refusé.");
  const base = (options.siteUrl ?? 'https://www.westbourse.com').replace(/\/+$/, '');
  const arret = liensArret(base, options.jetonArret);
  const resumeUrl = `${base}/formations/academy/${encodeURIComponent(cible.courseSlug)}?lecon=${
    cible.nextLessonIdx + 1
  }`;
  const niveauLabel =
    (cible.niveau && NIVEAU_LABEL[cible.niveau as Niveau]) || cible.courseTitre;

  const subject =
    cible.remainingLessons === 1
      ? `Plus qu’une leçon pour débloquer votre examen ${niveauLabel} — WESTBOURSE Academy`
      : cible.remainingLessons <= 3
        ? `Plus que ${cible.remainingLessons} leçons avant l’examen ${niveauLabel} — WESTBOURSE Academy`
        : `Reprenez ${cible.courseTitre} (${cible.doneLessons}/${cible.totalLessons} leçons) — WESTBOURSE Academy`;

  const salutation = cible.displayName?.trim() ? `Bonjour ${cible.displayName.trim()},` : 'Bonjour,';
  const pct = Math.round((cible.doneLessons / cible.totalLessons) * 100);
  const leconTexte = cible.nextLessonTitle
    ? `Prochaine leçon prête : ${cible.nextLessonTitle}`
    : `Prochaine leçon prête : Leçon ${cible.nextLessonIdx + 1}`;

  const text = [
    salutation,
    '',
    `Vous avez déjà validé ${cible.doneLessons} sur ${cible.totalLessons} leçons (${pct} %) dans « ${cible.courseTitre} ».`,
    `Il ne vous reste plus que ${cible.remainingLessons} leçon${cible.remainingLessons > 1 ? 's' : ''} pour accéder à l’examen certifiant.`,
    leconTexte,
    '',
    `Reprendre directement : ${resumeUrl}`,
    '',
    '— L’équipe WESTBOURSE Academy',
    '',
    `Ne plus recevoir ces rappels : ${arret.page}`,
    `Toutes vos préférences : ${arret.preferences}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f5f2eb;">
  <div style="max-width:560px;margin:0 auto;background:#131822;border:1px solid #263042;border-radius:16px;padding:28px;">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#e5c45f;text-transform:uppercase;">WESTBOURSE Academy</p>
    <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;color:#f5f2eb;">${escapeHtml(salutation)}</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#c2cada;">
      Vous avez déjà validé <strong style="color:#f5f2eb;">${cible.doneLessons} / ${cible.totalLessons} leçons (${pct} %)</strong>
      dans <em>${escapeHtml(cible.courseTitre)}</em>.
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#c2cada;">
      Il ne vous reste que <strong style="color:#46dca4;">${cible.remainingLessons} leçon${
        cible.remainingLessons > 1 ? 's' : ''
      }</strong> pour débloquer l’examen de certification et votre attestation vérifiable.
    </p>
    <div style="margin:0 0 22px;padding:14px 16px;background:#0d1118;border:1px solid #253042;border-radius:10px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#8b97ad;">Prochaine étape</p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#f5f2eb;">${escapeHtml(
        cible.nextLessonTitle ?? `Leçon ${cible.nextLessonIdx + 1}`,
      )}</p>
    </div>
    <p style="margin:0 0 22px;">
      <a href="${escapeHtml(resumeUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#c59b27;color:#0b0e14;font-size:14px;font-weight:700;text-decoration:none;">
        Reprendre ma progression →
      </a>
    </p>
    <hr style="border:none;border-top:1px solid #232c3d;margin:20px 0 14px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7f8ba1;">
      Rappel pédagogique envoyé après ${cible.joursInactif} jours d’inactivité.
      <a href="${escapeHtml(arret.page)}" style="color:#e5c45f;text-decoration:underline;">Ne plus recevoir ces rappels</a>
      · <a href="${escapeHtml(arret.preferences)}" style="color:#e5c45f;text-decoration:underline;">Mes préférences</a>.
    </p>
  </div>
</body>
</html>`;

  const headers = {
    'List-Unsubscribe': `<${arret.unClic}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  return { subject, text, html, resumeUrl, headers };
}
