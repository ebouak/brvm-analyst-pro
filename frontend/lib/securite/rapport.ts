/**
 * Rapport quotidien Telegram — PUR.
 *
 * Conversation PRIVÉE de l'exploitant (TELEGRAM_CHAT_ID), mais aucune donnée
 * personnelle quand même : des compteurs et un lien vers la console. Un
 * message Telegram se transfère d'un geste ; l'identité d'un compte suspecté
 * n'a rien à y faire.
 *
 * Envoyé même quand il n'y a rien à signaler : un rapport qui n'arrive pas doit
 * se remarquer, ce qui suppose qu'il arrive aussi les jours calmes.
 */

export interface StatsRapport {
  /** AAAA-MM-JJ. */
  jour: string;
  mode: 'off' | 'simulation' | 'actif';
  plafond: number;
  fermetures24h: { sessions: number; comptes: number; recentes: number; emailsEnvoyes: number; emailsEchecs: number; simulees: number };
  suspects: number;
  nouveauxSuspects: number;
  aSurveiller: number;
  groupes: { nombre: number; comptes: number };
  suspensionsActives: number;
  lien: string;
}

function dateFr(jour: string): string {
  const [a, m, j] = jour.split('-');
  return `${j}/${m}/${a}`;
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

export function composerRapport(s: StatsRapport): string {
  const l: string[] = [`Sécurité des comptes — ${dateFr(s.jour)}`];

  const modeTxt = s.mode === 'actif' ? 'actif' : s.mode === 'simulation' ? 'en SIMULATION (rien n’est fermé)' : 'COUPÉ';
  l.push(`Plafond Premium : ${s.plafond} appareils, ${modeTxt}.`);

  const f = s.fermetures24h;
  if (f.sessions + f.simulees === 0) {
    l.push('Fermetures en 24 h : aucune.');
  } else {
    if (f.sessions > 0) {
      l.push(
        `Fermetures en 24 h : ${pluriel(f.sessions, 'session', 'sessions')} sur ${pluriel(f.comptes, 'compte', 'comptes')}, dont ${f.recentes} encore utilisée${f.recentes > 1 ? 's' : ''}` +
          ` (e-mails : ${f.emailsEnvoyes} envoyé${f.emailsEnvoyes > 1 ? 's' : ''}${f.emailsEchecs ? `, ${f.emailsEchecs} NON CONFIRMÉ${f.emailsEchecs > 1 ? 'S' : ''}` : ''}).`,
      );
    }
    if (f.simulees > 0) l.push(`Fermetures simulées en 24 h : ${f.simulees}.`);
  }

  if (s.suspects + s.aSurveiller === 0) {
    l.push('Comptes à examiner : aucun.');
  } else {
    l.push(
      `Comptes suspects : ${s.suspects}${s.nouveauxSuspects ? ` (dont ${s.nouveauxSuspects} nouveau${s.nouveauxSuspects > 1 ? 'x' : ''})` : ''} · à surveiller : ${s.aSurveiller}.`,
    );
  }
  if (s.groupes.nombre > 0) {
    l.push(`Inscriptions groupées : ${pluriel(s.groupes.nombre, 'groupe', 'groupes')}, ${pluriel(s.groupes.comptes, 'compte', 'comptes')}.`);
  }
  if (s.suspensionsActives > 0) l.push(`Suspensions du Premium en cours : ${s.suspensionsActives}.`);
  l.push(`Détail : ${s.lien}`);
  return l.join('\n');
}
