import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { fetchAllRowsOuErreur } from '@/lib/supabase/paginate';
import { sendEmail } from '@/lib/server/email';
import { individualHtml, siteUrl, textToHtml } from '@/lib/email/templates';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { paysValide } from '@/lib/crm/geo';
import { appareilDe } from './appareil';
import { choisirFermetures, verifierGardeFou, type SessionVivante } from './plafond';
import { evaluerCompte, groupesInscriptions, mediane, type DonneesCompte, type Evaluation } from './signaux';
import { composerRapport, type StatsRapport } from './rapport';
import { emailFermeture } from './emails';
import { suspensionActive, type Decision } from './decisions';

/**
 * Sécurité des comptes — orchestration SERVEUR (service_role).
 *
 * Trois entrées :
 *  - `apresConnexion` : appelée juste après une connexion (code e-mail ou
 *    Google). Journalise la connexion et applique le plafond au compte, en
 *    gardant TOUJOURS la session qui vient de s'ouvrir. Ne lève jamais : un
 *    incident ici ne doit pas empêcher quelqu'un de se connecter.
 *  - `appliquerPlafond` : rattrapage horaire (connexion passée hors de nos
 *    pages, appel après connexion perdu).
 *  - `rapportQuotidien` : signaux du jour, puis rapport Telegram. Échoue
 *    BRUYAMMENT : un rapport non parti doit rendre le workflow rouge.
 *
 * Lectures en échec = arrêt (fetchAllRowsOuErreur) : « illisible » ne vaut
 * jamais « rien à signaler ».
 */

type Db = ReturnType<typeof getServiceClient>;
export type Mode = 'off' | 'simulation' | 'actif';
export interface Reglages {
  plafond: number;
  mode: Mode;
}

const JOUR = 86_400_000;
const PREFIXE = '🛡️ WESTBOURSE';

export async function lireReglages(db: Db): Promise<Reglages> {
  const { data, error } = await db.from('securite_reglages').select('plafond, mode').eq('id', true).maybeSingle();
  if (error) throw new Error(`réglages illisibles : ${error.message}`);
  if (!data) throw new Error('réglages absents (migration 0273 non appliquée ?)');
  const mode = (data as { mode: string }).mode;
  if (mode !== 'off' && mode !== 'simulation' && mode !== 'actif') throw new Error(`mode inconnu : ${mode}`);
  return { plafond: Number((data as { plafond: number }).plafond), mode };
}

interface LigneSession {
  session_id: string;
  user_id: string;
  user_agent: string | null;
  reseau: string | null;
  cree_le: string;
  activite: string;
  est_premium: boolean;
  exempte: boolean;
}

export async function lireSessionsVivantes(db: Db, userId?: string): Promise<SessionVivante[]> {
  const lignes = await fetchAllRowsOuErreur<LigneSession>((from, to) =>
    db.rpc('securite_lire_sessions', { p_user: userId ?? null }).order('session_id').range(from, to),
  );
  return lignes.map((l) => ({
    sessionId: l.session_id,
    userId: l.user_id,
    userAgent: l.user_agent,
    reseau: l.reseau,
    creeLe: l.cree_le,
    activite: l.activite,
    estPremium: Boolean(l.est_premium),
    exempte: Boolean(l.exempte),
  }));
}

// ── Plafond ──────────────────────────────────────────────────────────────────

export interface BilanPlafond {
  mode: Mode;
  plafond: number;
  comptesExamines: number;
  fermees: number;
  recentes: number;
  simulees: number;
  emails: { envoyes: number; echecs: number; incertains: number };
  /** Renseigné quand le garde-fou a refusé de fermer quoi que ce soit. */
  refus?: string;
}

type Notifie = 'envoye' | 'echec' | 'incertain';

async function notifierFermeture(
  db: Db,
  userId: string,
  plafond: number,
  appareils: { libelle: string; derniereActivite: string | null }[],
): Promise<Notifie> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  const email = data?.user?.email ?? null;
  if (error || !email) return 'echec';
  const m = emailFermeture({ plafond, appareils, siteUrl: siteUrl() });
  const r = await sendEmail({
    to: email,
    subject: m.sujet,
    html: individualHtml(textToHtml(m.texte)),
    text: m.texte,
    replyTo: 'support@westbourse.com',
  });
  if (r.ok) return 'envoye';
  return r.incertain ? 'incertain' : 'echec';
}

/**
 * Ferme ce qui dépasse le plafond. `simulation: true` (essai à blanc demandé
 * par l'exploitant) calcule sans RIEN écrire ; le mode « simulation » des
 * réglages, lui, journalise une fois chaque fermeture qui aurait eu lieu.
 */
export async function appliquerPlafond(
  opts: { userId?: string; garder?: string | null; simulation?: boolean; maintenant?: Date } = {},
): Promise<BilanPlafond> {
  const db = getServiceClient();
  const maintenant = opts.maintenant ?? new Date();
  const reglages = await lireReglages(db);
  const bilan: BilanPlafond = {
    mode: reglages.mode,
    plafond: reglages.plafond,
    comptesExamines: 0,
    fermees: 0,
    recentes: 0,
    simulees: 0,
    emails: { envoyes: 0, echecs: 0, incertains: 0 },
  };
  if (reglages.mode === 'off' && !opts.simulation) return bilan;

  const sessions = await lireSessionsVivantes(db, opts.userId);
  bilan.comptesExamines = new Set(sessions.filter((s) => s.estPremium && !s.exempte).map((s) => s.userId)).size;
  const fermetures = choisirFermetures(sessions, { plafond: reglages.plafond, garder: opts.garder, maintenant });
  if (fermetures.length === 0) return bilan;

  const garde = verifierGardeFou(fermetures);
  if (!garde.ok) {
    await alerterExploitant(
      `plafond d'appareils : AUCUNE session fermée, ${garde.raison}. Vérifier la sélection avant toute relance.`,
      PREFIXE,
    ).catch(() => false);
    return { ...bilan, refus: garde.raison };
  }

  if (opts.simulation) {
    return { ...bilan, simulees: fermetures.length, recentes: fermetures.filter((f) => f.recente).length };
  }

  if (reglages.mode === 'simulation') {
    const ids = fermetures.map((f) => f.session.sessionId);
    const { data: deja, error } = await db.from('securite_revocations').select('session_id').eq('simulee', true).in('session_id', ids);
    if (error) throw new Error(`journal des simulations illisible : ${error.message}`);
    const connues = new Set(((deja ?? []) as { session_id: string }[]).map((d) => d.session_id));
    const nouvelles = fermetures.filter((f) => !connues.has(f.session.sessionId));
    if (nouvelles.length > 0) {
      const { error: e2 } = await db.from('securite_revocations').insert(
        nouvelles.map((f) => ({
          user_id: f.session.userId,
          session_id: f.session.sessionId,
          user_agent: f.session.userAgent,
          derniere_activite: f.session.activite,
          motif: 'plafond',
          simulee: true,
          notifie: 'non_requis',
        })),
      );
      if (e2) throw new Error(`journal des simulations : ${e2.message}`);
    }
    return { ...bilan, simulees: nouvelles.length, recentes: nouvelles.filter((f) => f.recente).length };
  }

  // Mode actif : fermeture et journal dans la même transaction (fonction SQL).
  const recente = new Map(fermetures.map((f) => [f.session.sessionId, f.recente]));
  const { data, error } = await db.rpc('securite_fermer_sessions', {
    p_sessions: fermetures.map((f) => f.session.sessionId),
    p_motif: 'plafond',
  });
  if (error) throw new Error(`fermeture impossible : ${error.message}`);
  const fermees = (data ?? []) as { revocation_id: number; session_id: string; user_id: string; user_agent: string | null; activite: string }[];
  bilan.fermees = fermees.length;

  const parCompte = new Map<string, typeof fermees>();
  for (const f of fermees) {
    const l = parCompte.get(f.user_id);
    if (l) l.push(f);
    else parCompte.set(f.user_id, [f]);
  }

  for (const [userId, lignes] of parCompte) {
    const recentes = lignes.filter((l) => recente.get(l.session_id));
    const dormantes = lignes.filter((l) => !recente.get(l.session_id));
    bilan.recentes += recentes.length;

    if (dormantes.length > 0) {
      const { error: e } = await db.from('securite_revocations').update({ notifie: 'non_requis' }).in('id', dormantes.map((l) => l.revocation_id));
      if (e) console.error('[securite] statut de notification non écrit :', e.message);
    }
    if (recentes.length === 0) continue;

    // Une session dormante fermée ne mérite pas d'e-mail : l'abonné ne s'en
    // souvient pas, et le message l'inquiéterait pour rien.
    const issue = await notifierFermeture(
      db,
      userId,
      reglages.plafond,
      recentes.map((l) => ({ libelle: appareilDe(l.user_agent).libelle, derniereActivite: l.activite })),
    );
    if (issue === 'envoye') bilan.emails.envoyes++;
    else if (issue === 'incertain') bilan.emails.incertains++;
    else bilan.emails.echecs++;
    const { error: e } = await db.from('securite_revocations').update({ notifie: issue }).in('id', recentes.map((l) => l.revocation_id));
    if (e) console.error('[securite] statut de notification non écrit :', e.message);
  }
  return bilan;
}

// ── Connexion ────────────────────────────────────────────────────────────────

/**
 * Après une connexion réussie. Ne lève JAMAIS.
 *
 * La connexion n'est journalisée que si la session a moins de 15 minutes : la
 * route est appelable à tout moment par un compte connecté, et ne doit pas
 * permettre de remplir le journal. Une seule ligne par session (index unique).
 */
export async function apresConnexion(p: {
  userId: string;
  email: string | null;
  sessionId: string | null;
  entetes: Headers;
  maintenant?: Date;
}): Promise<'ok' | 'sans_session' | 'erreur'> {
  if (!p.sessionId) return 'sans_session';
  const maintenant = p.maintenant ?? new Date();
  try {
    const db = getServiceClient();
    const sessions = await lireSessionsVivantes(db, p.userId);
    const s = sessions.find((x) => x.sessionId === p.sessionId);
    if (!s) return 'sans_session';

    // Même règle que le CRM : hors Vercel, l'en-tête pays peut être forgé.
    const pays = process.env.VERCEL ? paysValide(p.entetes.get('x-vercel-ip-country')) : null;

    if (maintenant.getTime() - Date.parse(s.creeLe) < 15 * 60_000) {
      const ip = p.entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      const { error } = await db.from('auth_events').upsert(
        {
          user_id: p.userId,
          email: p.email?.toLowerCase().trim() ?? null,
          event: 'sign_in',
          ip_address: ip,
          user_agent: (p.entetes.get('user-agent') ?? '').slice(0, 400) || null,
          pays,
          session_id: p.sessionId,
        },
        { onConflict: 'event,session_id', ignoreDuplicates: true },
      );
      if (error) console.error('[securite] connexion non journalisée :', error.message);
    }

    const { error: e2 } = await db.from('securite_sessions').upsert(
      {
        session_id: s.sessionId,
        user_id: s.userId,
        user_agent: s.userAgent,
        reseau: s.reseau,
        premiere_vue: s.creeLe,
        derniere_vue: s.activite,
        ...(pays ? { pays } : {}),
      },
      { onConflict: 'session_id' },
    );
    if (e2) console.error('[securite] session non enregistrée :', e2.message);

    if (s.estPremium && !s.exempte) await appliquerPlafond({ userId: p.userId, garder: p.sessionId, maintenant });
    return 'ok';
  } catch (e) {
    console.error('[securite] après connexion :', e instanceof Error ? e.message : e);
    return 'erreur';
  }
}

// ── Instantané et rapport quotidien ──────────────────────────────────────────

export async function instantane(db: Db = getServiceClient()): Promise<{ vues: number; fermees: number }> {
  const { data, error } = await db.rpc('securite_instantane');
  if (error) throw new Error(`instantané impossible : ${error.message}`);
  const d = (data ?? {}) as { vues?: number; fermees?: number };
  return { vues: Number(d.vues ?? 0), fermees: Number(d.fermees ?? 0) };
}

async function prendreVerrou(db: Db, jour: string, forcer: boolean): Promise<'pris' | 'deja'> {
  const { error } = await db.from('securite_rapports').insert({ jour, statut: 'envoi' });
  if (!error) return 'pris';
  if (error.code !== '23505') throw new Error(`verrou du rapport : ${error.message}`);
  const { data, error: e2 } = await db.from('securite_rapports').select('statut, created_at').eq('jour', jour).single();
  if (e2 || !data) throw new Error(`verrou du rapport illisible : ${e2?.message ?? 'absent'}`);
  const v = data as { statut: string; created_at: string };
  if (!forcer && v.statut === 'envoye') return 'deja';
  // Un « envoi » de moins d'une heure : un autre passage est en cours.
  if (!forcer && v.statut === 'envoi' && Date.now() - Date.parse(v.created_at) < 3_600_000) return 'deja';
  const { error: e3 } = await db.from('securite_rapports').update({ statut: 'envoi', created_at: new Date().toISOString() }).eq('jour', jour);
  if (e3) throw new Error(`verrou du rapport : ${e3.message}`);
  return 'pris';
}

export interface ResultatSignaux {
  evaluations: Evaluation[];
  stats: StatsRapport;
}

/** Calcule et range les signaux du jour ; renvoie de quoi composer le rapport. */
export async function calculerSignaux(db: Db, maintenant: Date): Promise<ResultatSignaux> {
  const jour = maintenant.toISOString().slice(0, 10);
  const hier = new Date(maintenant.getTime() - JOUR).toISOString().slice(0, 10);
  const depuis30 = new Date(maintenant.getTime() - 30 * JOUR).toISOString();
  const depuis24h = maintenant.getTime() - JOUR;

  const reglages = await lireReglages(db);
  const [comptes, sessions, fermetures, connexions, usages, decisions, suspectsHier] = await Promise.all([
    fetchAllRowsOuErreur<{ user_id: string; cree_le: string; est_premium: boolean; exempte: boolean }>((f, t) =>
      db.rpc('securite_comptes').order('user_id').range(f, t)),
    fetchAllRowsOuErreur<{ session_id: string; user_id: string; user_agent: string | null; reseau: string | null; premiere_vue: string; derniere_vue: string }>((f, t) =>
      db.from('securite_sessions').select('session_id, user_id, user_agent, reseau, premiere_vue, derniere_vue').gte('derniere_vue', depuis30).order('session_id').range(f, t)),
    fetchAllRowsOuErreur<{ id: number; user_id: string; created_at: string; derniere_activite: string | null; motif: string; simulee: boolean; notifie: string | null }>((f, t) =>
      db.from('securite_revocations').select('id, user_id, created_at, derniere_activite, motif, simulee, notifie').gte('created_at', depuis30).order('id').range(f, t)),
    fetchAllRowsOuErreur<{ id: number; user_id: string | null; created_at: string; pays: string | null }>((f, t) =>
      db.from('auth_events').select('id, user_id, created_at, pays').eq('event', 'sign_in').gte('created_at', depuis30).order('id').range(f, t)),
    fetchAllRowsOuErreur<{ user_id: string; feature_code: string; jour: string; compteur: number }>((f, t) =>
      db.from('feature_usage').select('user_id, feature_code, jour, compteur').in('feature_code', ['assistant_ia', 'diagnostic_ia']).gte('jour', depuis30.slice(0, 10)).order('user_id').order('feature_code').order('jour').range(f, t)),
    fetchAllRowsOuErreur<Decision & { id: number }>((f, t) =>
      db.from('securite_decisions').select('id, user_id, type, jusqu_au, created_at').order('id').range(f, t)),
    fetchAllRowsOuErreur<{ user_id: string }>((f, t) =>
      db.from('securite_signaux').select('user_id').eq('jour', hier).eq('niveau', 'suspect').order('user_id').range(f, t)),
  ]);

  const grouper = <T extends { user_id: string | null }>(l: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of l) {
      if (!x.user_id) continue;
      const a = m.get(x.user_id);
      if (a) a.push(x);
      else m.set(x.user_id, [x]);
    }
    return m;
  };
  const sessionsPar = grouper(sessions);
  const fermeturesPar = grouper(fermetures.filter((f) => f.motif === 'plafond'));
  const connexionsPar = grouper(connexions);
  const decisionsPar = grouper(decisions);
  const usagePar = new Map<string, number>();
  for (const u of usages) usagePar.set(u.user_id, (usagePar.get(u.user_id) ?? 0) + Number(u.compteur ?? 0));

  const medianeUsageIa = mediane(comptes.filter((c) => c.est_premium && !c.exempte).map((c) => usagePar.get(c.user_id) ?? 0));

  const groupes = groupesInscriptions(
    comptes.map((c) => {
      const premiere = (sessionsPar.get(c.user_id) ?? []).sort((a, b) => Date.parse(a.premiere_vue) - Date.parse(b.premiere_vue))[0];
      return {
        userId: c.user_id,
        creeLe: c.cree_le,
        exempte: Boolean(c.exempte),
        premiere: premiere ? { userAgent: premiere.user_agent, reseau: premiere.reseau } : null,
      };
    }),
    maintenant,
  );

  const evaluations: Evaluation[] = comptes.map((c) => {
    const dec = (decisionsPar.get(c.user_id) ?? []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const derniere = dec[0];
    const donnees: DonneesCompte = {
      userId: c.user_id,
      estPremium: Boolean(c.est_premium),
      exempte: Boolean(c.exempte),
      sessions: (sessionsPar.get(c.user_id) ?? []).map((s) => ({ userAgent: s.user_agent, derniereVue: s.derniere_vue })),
      fermeturesPlafond: (fermeturesPar.get(c.user_id) ?? []).map((f) => ({ createdAt: f.created_at, derniereActivite: f.derniere_activite })),
      connexions: (connexionsPar.get(c.user_id) ?? []).map((x) => ({ createdAt: x.created_at, pays: x.pays })),
      usageIa30j: usagePar.get(c.user_id) ?? 0,
      tailleGroupe: groupes.get(c.user_id) ?? 0,
      legitimeJusquau: derniere?.type === 'legitime' ? derniere.jusqu_au : null,
    };
    return evaluerCompte(donnees, { maintenant, medianeUsageIa });
  });

  // Les signaux du jour sont recalculés en entier : un compte redevenu normal
  // ne doit pas garder la ligne d'un passage précédent du même jour.
  const { error: eDel } = await db.from('securite_signaux').delete().eq('jour', jour);
  if (eDel) throw new Error(`signaux du jour non effacés : ${eDel.message}`);
  const aRanger = evaluations.filter((e) => e.niveau !== 'normal');
  if (aRanger.length > 0) {
    const { error: eIns } = await db.from('securite_signaux').insert(
      aRanger.map((e) => ({ user_id: e.userId, jour, niveau: e.niveau, raisons: e.raisons })),
    );
    if (eIns) throw new Error(`signaux non enregistrés : ${eIns.message}`);
  }

  const f24 = fermetures.filter((f) => f.motif === 'plafond' && Date.parse(f.created_at) >= depuis24h);
  const reelles = f24.filter((f) => !f.simulee);
  const dejaSuspects = new Set(suspectsHier.map((s) => s.user_id));
  const suspects = evaluations.filter((e) => e.niveau === 'suspect');
  let nombreGroupes = 0;
  for (const taille of groupes.values()) nombreGroupes += 1 / taille;

  const stats: StatsRapport = {
    jour,
    mode: reglages.mode,
    plafond: reglages.plafond,
    fermetures24h: {
      sessions: reelles.length,
      comptes: new Set(reelles.map((f) => f.user_id)).size,
      recentes: reelles.filter((f) => f.derniere_activite && Date.parse(f.created_at) - Date.parse(f.derniere_activite) <= 14 * JOUR).length,
      emailsEnvoyes: reelles.filter((f) => f.notifie === 'envoye').length,
      emailsEchecs: reelles.filter((f) => f.notifie === 'echec' || f.notifie === 'incertain').length,
      simulees: f24.filter((f) => f.simulee).length,
    },
    suspects: suspects.length,
    nouveauxSuspects: suspects.filter((e) => !dejaSuspects.has(e.userId)).length,
    aSurveiller: evaluations.filter((e) => e.niveau === 'surveiller').length,
    groupes: { nombre: Math.round(nombreGroupes), comptes: groupes.size },
    suspensionsActives: [...decisionsPar.values()].filter((l) => suspensionActive(l, maintenant) !== null).length,
    lien: `${siteUrl()}/admin/securite`,
  };
  return { evaluations, stats };
}

/**
 * Passage quotidien : instantané, signaux, rapport Telegram. `ok` n'est vrai
 * que si le rapport est PARTI (ou déjà parti aujourd'hui).
 */
export async function rapportQuotidien(opts: { maintenant?: Date; forcer?: boolean } = {}): Promise<{
  ok: boolean;
  deja?: boolean;
  stats?: StatsRapport;
  erreur?: string;
}> {
  const db = getServiceClient();
  const maintenant = opts.maintenant ?? new Date();
  const jour = maintenant.toISOString().slice(0, 10);
  const verrou = await prendreVerrou(db, jour, Boolean(opts.forcer));
  if (verrou === 'deja') return { ok: true, deja: true };

  try {
    await instantane(db);
    const { stats } = await calculerSignaux(db, maintenant);
    const parti = await alerterExploitant(composerRapport(stats), PREFIXE);
    const { error } = await db
      .from('securite_rapports')
      .update({ statut: parti ? 'envoye' : 'echec', contenu: stats, envoye_at: parti ? new Date().toISOString() : null })
      .eq('jour', jour);
    if (error) console.error('[securite] statut du rapport non écrit :', error.message);
    return parti ? { ok: true, stats } : { ok: false, stats, erreur: 'rapport Telegram non parti (canal non configuré ou refusé)' };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    await db.from('securite_rapports').update({ statut: 'echec', contenu: { erreur } }).eq('jour', jour);
    return { ok: false, erreur };
  }
}

// ── Fermetures demandées (utilisateur, administrateur) ──────────────────────

/** Ferme ces sessions (journalisées avec leur motif). Par lots de 50, la limite de la fonction SQL. */
export async function fermerSessions(ids: string[], motif: 'admin' | 'utilisateur', db: Db = getServiceClient()): Promise<number> {
  let n = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await db.rpc('securite_fermer_sessions', { p_sessions: ids.slice(i, i + 50), p_motif: motif });
    if (error) throw new Error(`fermeture impossible : ${error.message}`);
    n += ((data ?? []) as unknown[]).length;
  }
  return n;
}

/** Ferme toutes les sessions d'un compte, sauf éventuellement `sauf` (la session de la page en cours). */
export async function fermerToutesSessions(userId: string, motif: 'admin' | 'utilisateur', sauf: string | null = null): Promise<number> {
  const db = getServiceClient();
  const sessions = await lireSessionsVivantes(db, userId);
  return fermerSessions(sessions.filter((s) => s.sessionId !== sauf).map((s) => s.sessionId), motif, db);
}
