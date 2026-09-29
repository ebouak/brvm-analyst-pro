/**
 * Pass premium Chariow — tâche quotidienne (workflow pass.yml).
 *
 *   1. expirer les pass échus (fonction SQL expirer_pass_chariow, qui retire
 *      le premium seulement si plus aucun abonnement payant actif ne le
 *      justifie) ;
 *   2. prévenir, UNE fois, les porteurs dont le pass finit dans ≤ 7 jours.
 *
 * IDEMPOTENCE : `rappel_expiration_at` est posé après un envoi réussi, et
 * l'écriture ne vise que les lignes où il est encore nul. Racheter le pass
 * remet ce champ à nul (accorder_achat) : la période suivante aura son rappel.
 *
 * CONFIGURATION ABSENTE = ÉCHEC DU JOB (même règle que runBienvenue) : sans
 * Resend, on s'arrête sans rien marquer, pour ne pas « consommer » un rappel
 * jamais parti.
 *
 * `--mock` : n'expire rien, n'envoie rien, n'écrit rien.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendEmail } from '../alerts/channels.js';
import { aRappeler, composerRappel, PREAVIS_JOURS, type PassActif } from './rappels.js';

const log = logger.child({ module: 'pass' });
const SITE = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/$/, '');

export interface PassResult {
  expires: number;
  candidats: number;
  envoyes: number;
  echecs: number;
}

export async function runPass({ mock = false } = {}): Promise<PassResult> {
  const sb = getSupabase();
  const maintenant = new Date();

  let expires = 0;
  if (!mock) {
    const { data, error } = await sb.rpc('expirer_pass_chariow');
    if (error) throw new Error(`expirer_pass_chariow (migration 0146 appliquée ?) : ${error.message}`);
    expires = Number(data ?? 0);
  }

  const horizon = new Date(maintenant.getTime() + PREAVIS_JOURS * 24 * 3600 * 1000).toISOString();
  const { data: subs, error: e1 } = await sb
    .from('subscriptions')
    .select('id, user_id, renews_at, rappel_expiration_at, subscription_plans(name)')
    .eq('source', 'chariow')
    .eq('status', 'active')
    .is('rappel_expiration_at', null)
    .lte('renews_at', horizon);
  if (e1) throw new Error(`lecture des pass : ${e1.message}`);

  const pass: PassActif[] = (subs ?? []).map((s: Record<string, unknown>) => {
    const plan = s.subscription_plans as { name: string } | { name: string }[] | null;
    return {
      id: s.id as string,
      user_id: s.user_id as string,
      renews_at: (s.renews_at as string | null) ?? null,
      rappel_expiration_at: (s.rappel_expiration_at as string | null) ?? null,
      plan: (Array.isArray(plan) ? plan[0]?.name : plan?.name) ?? 'Premium',
    };
  });
  const cibles = aRappeler(pass, maintenant);

  const emails = new Map<string, string>();
  if (cibles.length) {
    const { data, error } = await sb.from('profiles').select('id, email').in('id', cibles.map((c) => c.user_id));
    if (error) throw new Error(`lecture profiles : ${error.message}`);
    for (const p of data ?? []) if (p.email) emails.set(p.id as string, p.email as string);
  }

  let envoyes = 0, echecs = 0;
  for (const c of cibles) {
    const email = emails.get(c.user_id);
    if (!email) continue; // compte sans adresse : rien à envoyer, pas un échec
    const m = composerRappel({ plan: c.plan, echeance: c.renews_at!, lien: `${SITE}/account/plan` });
    if (mock) {
      log.info({ subscription: c.id }, `[mock] « ${m.sujet} » serait envoyé`);
      continue;
    }
    const r = await sendEmail({ to: email, subject: m.sujet, body: m.texte, html: m.html });
    if (r === null) {
      throw new Error('Envoi d’email non configuré (RESEND_API_KEY / ALERTS_EMAIL_FROM) — aucun rappel marqué.');
    }
    if (r.status !== 'sent') {
      echecs++;
      log.error({ subscription: c.id, err: (r.error ?? '').slice(0, 200) }, 'rappel non envoyé');
      continue; // non marqué : il repartira demain
    }
    envoyes++;
    const { error } = await sb
      .from('subscriptions')
      .update({ rappel_expiration_at: new Date().toISOString() })
      .eq('id', c.id)
      .is('rappel_expiration_at', null);
    if (error) log.error({ subscription: c.id, err: error.message }, 'marquage du rappel impossible');
    // L'adresse n'est jamais journalisée.
    log.info({ subscription: c.id }, 'rappel d’échéance envoyé');
  }

  log.info({ expires, candidats: cibles.length, envoyes, echecs, mock }, 'pass Chariow');
  return { expires, candidats: cibles.length, envoyes, echecs };
}
