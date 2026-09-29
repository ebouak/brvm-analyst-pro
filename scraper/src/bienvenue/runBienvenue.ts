/**
 * Emails de bienvenue — orchestration des entrées/sorties.
 *
 * La DÉCISION vit dans deux modules purs et testés : `selection.ts` (qui
 * reçoit quoi) et `message.ts` (ce qui est écrit). Ici : lire, envoyer,
 * journaliser dans emails_bienvenue (migration 0145).
 *
 * IDEMPOTENCE : un couple (compte, motif) déjà 'envoye' est sauté ; relancer
 * le job — toutes les heures, ou à la main — ne réécrit à personne.
 *
 * CONFIGURATION ABSENTE = ÉCHEC DU JOB, pas du compte. Sans clé Resend ou
 * sans expéditeur, `sendEmail` rend null : on s'arrête en erreur SANS rien
 * journaliser. Journaliser un 'echec' par compte brûlerait une tentative à
 * chaque passage, et au troisième ces comptes seraient abandonnés pour une
 * faute qui n'est pas la leur.
 *
 * `--mock` : n'envoie rien, n'écrit rien, journalise ce qui serait parti.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendEmail } from '../alerts/channels.js';
import { aEnvoyer, MISE_EN_SERVICE, type Abonnement, type Compte, type Journal } from './selection.js';
import { composer } from './message.js';

const log = logger.child({ module: 'bienvenue' });
const SITE = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/$/, '');

export interface BienvenueResult {
  candidats: number;
  envoyes: number;
  echecs: number;
}

export async function runBienvenue({ mock = false } = {}): Promise<BienvenueResult> {
  const sb = getSupabase();

  const { data: nouveaux, error: e1 } = await sb
    .from('profiles').select('id, email, created_at').gte('created_at', MISE_EN_SERVICE);
  if (e1) throw new Error(`lecture profiles : ${e1.message}`);

  const { data: subs, error: e2 } = await sb
    .from('subscriptions')
    .select('user_id, status, started_at, subscription_plans(price_monthly)')
    .eq('status', 'active')
    .gte('started_at', MISE_EN_SERVICE);
  if (e2) throw new Error(`lecture subscriptions : ${e2.message}`);

  const abonnements: Abonnement[] = (subs ?? []).map((s: Record<string, unknown>) => {
    const plan = s.subscription_plans as { price_monthly: number } | { price_monthly: number }[] | null;
    const prix = Array.isArray(plan) ? plan[0]?.price_monthly : plan?.price_monthly;
    return { user_id: s.user_id as string, status: s.status as string, started_at: s.started_at as string | null, payant: Number(prix) > 0 };
  });

  // Les abonnés peuvent avoir un compte ancien : on lit aussi leur profil.
  const comptes = new Map<string, Compte>((nouveaux ?? []).map((c) => [c.id, c as Compte]));
  const manquants = abonnements.map((a) => a.user_id).filter((id) => !comptes.has(id));
  if (manquants.length) {
    const { data, error } = await sb.from('profiles').select('id, email, created_at').in('id', manquants);
    if (error) throw new Error(`lecture profiles abonnés : ${error.message}`);
    for (const c of data ?? []) comptes.set(c.id, c as Compte);
  }

  const ids = [...comptes.keys()];
  let journal: Journal[] = [];
  if (ids.length) {
    const { data, error } = await sb.from('emails_bienvenue').select('user_id, motif, statut, tentatives').in('user_id', ids);
    if (error) throw new Error(`lecture emails_bienvenue (migration 0145 appliquée ?) : ${error.message}`);
    journal = (data ?? []) as Journal[];
  }

  const envois = aEnvoyer({ comptes: [...comptes.values()], abonnements, journal });
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const liens = {
    lecon: `${SITE}/formations/academy/lecon-0`,
    affiche: `${url}/storage/v1/object/public/academy-videos/ecosysteme-umoa.jpg`,
    sgi: `${SITE}/comparateur-sgi`,
  };

  let envoyes = 0, echecs = 0;
  for (const e of envois) {
    const m = composer(e.motif, liens);
    if (mock) {
      log.info({ user_id: e.user_id, motif: e.motif }, `[mock] « ${m.sujet} » serait envoyé`);
      continue;
    }
    const r = await sendEmail({ to: e.email, subject: m.sujet, body: m.texte, html: m.html });
    if (r === null) {
      throw new Error('Envoi d’email non configuré (RESEND_API_KEY / ALERTS_EMAIL_FROM) — rien n’a été journalisé.');
    }
    const ok = r.status === 'sent';
    if (ok) envoyes++; else echecs++;
    const { error } = await sb.from('emails_bienvenue').upsert({
      user_id: e.user_id,
      motif: e.motif,
      statut: ok ? 'envoye' : 'echec',
      tentatives: e.tentatives + 1,
      erreur: ok ? null : (r.error ?? 'échec inconnu').slice(0, 500),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,motif' });
    if (error) log.error({ user_id: e.user_id, motif: e.motif, err: error.message }, 'journalisation impossible');
    // L'adresse n'est jamais journalisée : l'identifiant suffit à l'exploitant.
    log.info({ user_id: e.user_id, motif: e.motif, statut: ok ? 'envoye' : 'echec' }, 'bienvenue');
  }

  log.info({ candidats: envois.length, envoyes, echecs, mock }, 'emails de bienvenue');
  return { candidats: envois.length, envoyes, echecs };
}
