import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chargerTour } from '@/lib/controle/tour';
import type { Signal } from '@/lib/controle/types';
import { controleBoc } from '@/lib/boc/charger';
import { loadAttention } from '@/lib/admin/attention';
import { isTestSender } from '@/lib/server/email';
import { redacteursDisponibles, parametresFournisseur } from '@/lib/server/redacteur';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { blandConfigure } from '@/lib/voix/bland';
import { compterAppelsDuJour } from '@/lib/voix/appel';
import { plafondJour } from '@/lib/voix/statut';
import { resoudreCode } from '@/lib/agent/outils';
import { getLastMarketDate } from '@/lib/marketDate';
import { verifierWebhookOps, type InlineKeyboardButton } from './telegramApi';
import {
  echapperHtmlPur,
  formaterBocHtml,
  formaterCoherenceHtml,
  formaterTourHtml,
} from './formatters';

export { formaterBocHtml, formaterCoherenceHtml, formaterTourHtml };

const CHAINE_CLOTURE: Array<{ idPrefix: string; label: string; workflow: string }> = [
  { idPrefix: 'donnees:cloture', label: 'Clôture consolidée', workflow: 'daily-brvm' },
  { idPrefix: 'donnees:cours', label: 'Cours & Indices', workflow: 'daily-brvm' },
  { idPrefix: 'donnees:signaux', label: 'Signaux & Liquidité', workflow: 'score' },
  { idPrefix: 'donnees:carnet', label: 'Carnet d’ordres', workflow: 'carnet' },
  { idPrefix: 'donnees:video', label: 'Vidéo de séance', workflow: 'video-seance' },
  { idPrefix: 'envois:alertes', label: 'Envoi des alertes', workflow: 'alerts' },
];

export async function executerControleCloture(
  db: SupabaseClient,
  onProgress?: (html: string) => Promise<void>,
): Promise<{ html: string; boutons: InlineKeyboardButton[][] }> {
  if (onProgress) {
    await onProgress('⏳ <b>Contrôle post-séance</b>\n[1/3] Lecture de la Tour de contrôle…');
  }
  const tour = await chargerTour();

  if (onProgress) {
    await onProgress('⏳ <b>Contrôle post-séance</b>\n[2/3] Vérification des maillons de clôture et du BOC…');
  }

  const [bocRes, attention] = await Promise.all([
    controleBoc(db).catch(() => null),
    loadAttention().catch(() => []),
  ]);

  const lignes: string[] = [
    `🌆 <b>Contrôle chaîne de clôture</b> (${tour.observeA.slice(11, 16)} UTC)`,
    '',
  ];
  const manquantWorkflows = new Set<string>();

  for (const maillon of CHAINE_CLOTURE) {
    const matches = tour.signaux.filter((s) => s.id === maillon.idPrefix || s.id.startsWith(`${maillon.idPrefix}:`));
    const pire = matches.find((m) => m.niveau === 'alerte' || m.niveau === 'inconnu') ??
      matches.find((m) => m.niveau === 'attention') ??
      matches[0];

    const icon = !pire
      ? '⚪'
      : pire.niveau === 'ok' || pire.niveau === 'na'
        ? '✅'
        : pire.niveau === 'attention'
          ? '🟠'
          : '🔴';

    if (pire && (pire.niveau === 'alerte' || pire.niveau === 'inconnu')) {
      manquantWorkflows.add(maillon.workflow);
    }

    lignes.push(
      `${icon} <b>${echapperHtmlPur(maillon.label)}</b> : ${echapperHtmlPur(pire?.detail ?? 'Aucun signal')}`,
    );
  }

  if (bocRes) {
    const ecarts = bocRes.filter((c) => c.per.etat === 'ecart' || c.rendement.etat === 'ecart').length;
    lignes.push(
      ecarts > 0
        ? `🟠 <b>Contrôle BOC</b> : ${ecarts} écart(s) détecté(s) sur ${bocRes.length} valeurs.`
        : `✅ <b>Contrôle BOC</b> : 0 écart sur ${bocRes.length} valeurs.`,
    );
  } else {
    lignes.push('🟣 <b>Contrôle BOC</b> : illisible.');
  }

  const critiques = attention.filter((a) => a.level === 'critical').length;
  if (critiques > 0) {
    lignes.push('', `🚨 ${critiques} alerte(s) critique(s) ouverte(s) côté Admin.`);
  }

  const boutons: InlineKeyboardButton[][] = [];
  if (manquantWorkflows.size > 0) {
    const row: InlineKeyboardButton[] = [...manquantWorkflows].slice(0, 3).map((wf) => ({
      text: `⚡ Relancer ${wf}`,
      callback_data: `wf:${wf}`,
    }));
    boutons.push(row);
  }
  boutons.push([
    { text: '📊 Voir BOC', callback_data: 'cmd:boc' },
    { text: '🛰️ Tour complète', callback_data: 'cmd:tour' },
    { text: '🩺 Diagnostic IA', callback_data: 'diag:cloture' },
  ]);

  return { html: lignes.join('\n'), boutons };
}

export async function genererBriefMatinHtml(db: SupabaseClient): Promise<string> {
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const safeCount = async (fn: () => PromiseLike<{ count: number | null }>): Promise<number> => {
    try {
      const { count } = await fn();
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [
    totalUsers,
    newUsers24h,
    premiumUsers,
    pendingPayments,
    unreadContacts,
    openAgregats,
    openIncidents,
    tour,
  ] = await Promise.all([
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true })),
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since24h)),
    safeCount(() => db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true)),
    safeCount(() => db.from('billing_transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(() => db.from('contact_messages').select('*', { count: 'exact', head: true }).eq('statut', 'nouveau')),
    safeCount(() => db.from('indicateur_relecture').select('*', { count: 'exact', head: true }).eq('statut', 'ouverte')),
    safeCount(() => db.from('ops_incidents').select('*', { count: 'exact', head: true }).eq('statut', 'ouvert')),
    chargerTour(),
  ]);

  const alertes = tour.signaux.filter((s) => s.niveau === 'alerte' || s.niveau === 'inconnu');
  const e2e = tour.signaux.find((s) => s.id === 'donnees:e2e');

  const lines: string[] = [
    `☀️ <b>Briefing Fondateur WESTBOURSE</b> · ${new Date().toISOString().slice(0, 10)}`,
    '',
    `👥 Utilisateurs : <b>${totalUsers}</b> (+${newUsers24h} en 24h) · Premium : <b>${premiumUsers}</b>`,
    `💳 Paiements en attente : <b>${pendingPayments}</b> · ✉️ Contacts à répondre : <b>${unreadContacts}</b>`,
    `🏦 Agrégats à relire : <b>${openAgregats}</b> · 🚨 Incidents Ops : <b>${openIncidents}</b>`,
    `🧪 E2E nuit : ${echapperHtmlPur(e2e?.detail ?? 'non mesuré')}`,
    '',
    alertes.length === 0
      ? '🟢 <b>Tour de contrôle :</b> tout est nominal.'
      : `🔴 <b>Tour de contrôle :</b> ${alertes.length} point(s) en alerte/inconnu (${alertes.slice(0, 3).map((a) => echapperHtmlPur(a.titre)).join(', ')})`,
  ];

  return lines.join('\n');
}

export interface SondeCanal {
  nom: string;
  ok: boolean;
  statut: string;
  latenceMs?: number;
  detail: string;
}

export async function sonderSanteCanaux(db: SupabaseClient): Promise<SondeCanal[]> {
  const resultats: SondeCanal[] = [];

  const redacteurs = await redacteursDisponibles(['deepseek', 'gemini', 'xai']);
  const llmProbes = await Promise.all(
    (['deepseek', 'gemini', 'xai'] as const).map(async (f): Promise<SondeCanal> => {
      const r = redacteurs.find((x) => x.fournisseur === f);
      if (!r) {
        return { nom: `LLM ${f}`, ok: false, statut: 'clé absente', detail: 'Non configuré' };
      }
      const t0 = Date.now();
      try {
        const resp = await fetch(r.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${r.cle}` },
          body: JSON.stringify({
            model: r.modele,
            messages: [{ role: 'user', content: 'OK' }],
            max_tokens: 5,
            temperature: 0,
            ...parametresFournisseur(r.fournisseur),
          }),
          signal: AbortSignal.timeout(7_000),
        });
        const latenceMs = Date.now() - t0;
        return {
          nom: `LLM ${f}`,
          ok: resp.ok,
          statut: resp.ok ? 'OK' : `HTTP ${resp.status}`,
          latenceMs,
          detail: `${r.modele} · ${latenceMs} ms`,
        };
      } catch (e) {
        return {
          nom: `LLM ${f}`,
          ok: false,
          statut: 'timeout/erreur',
          latenceMs: Date.now() - t0,
          detail: e instanceof Error ? e.message.slice(0, 80) : 'erreur',
        };
      }
    }),
  );
  resultats.push(...llmProbes);

  const [waState, tgInfo, voixDuJour] = await Promise.all([
    passerelleWhatsapp()
      .etatSession()
      .catch(() => ({ joignable: false, statut: 'erreur', compte: null })),
    verifierWebhookOps(),
    compterAppelsDuJour(db).catch(() => -1),
  ]);

  resultats.push({
    nom: 'WhatsApp (WAHA/Meta)',
    ok: waState.joignable && (waState.statut === 'WORKING' || waState.statut === 'OK'),
    statut: waState.joignable ? (waState.statut ?? 'inconnu') : 'injoignable',
    detail: waState.compte ? `Session ${waState.compte}` : 'Passerelle sondée',
  });

  resultats.push({
    nom: 'Telegram Ops Webhook',
    ok: tgInfo.ok,
    statut: !tgInfo.configured ? 'token absent' : tgInfo.ok ? 'actif' : 'non configuré',
    detail: tgInfo.lastError
      ? `Dernière erreur : ${tgInfo.lastError.slice(0, 80)}`
      : `${tgInfo.pendingUpdates ?? 0} update(s) en file`,
  });

  const resendTest = isTestSender();
  resultats.push({
    nom: 'Email Resend',
    ok: Boolean(process.env.RESEND_API_KEY) && !resendTest,
    statut: !process.env.RESEND_API_KEY ? 'clé absente' : resendTest ? 'expéditeur test' : 'OK',
    detail: resendTest ? 'onboarding@resend.dev actif (tiers bloqués)' : 'Domaine vérifié',
  });

  const plafond = plafondJour(process.env.VOIX_MAX_JOUR);
  resultats.push({
    nom: 'Voix critique (Bland)',
    ok: blandConfigure(),
    statut: blandConfigure() ? 'prêt' : 'clé absente',
    detail: voixDuJour >= 0 ? `${voixDuJour}/${plafond} appels aujourd’hui` : `Plafond ${plafond}/j`,
  });

  return resultats;
}

export function formaterSanteHtml(sondes: SondeCanal[]): string {
  const lignes = ['🩺 <b>Santé des canaux & fournisseurs IA</b>', ''];
  for (const s of sondes) {
    const icon = s.ok ? '🟢' : '🔴';
    const lat = s.latenceMs != null ? ` (${s.latenceMs} ms)` : '';
    lignes.push(`${icon} <b>${echapperHtmlPur(s.nom)}</b> : ${echapperHtmlPur(s.statut)}${lat} — ${echapperHtmlPur(s.detail)}`);
  }
  return lignes.join('\n');
}

export async function auditerValeurFlash(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) {
    return {
      ok: false as const,
      html: `⚠️ Aucune société trouvée pour « ${echapperHtmlPur(saisie)} ».`,
      data: { erreur: `Société inconnue : ${saisie}` },
    };
  }

  const asOf = await getLastMarketDate(db);
  const [instrRes, quoteRes, sigRes, liqRes, cohRes, newsRes, divRes, bocList] = await Promise.all([
    db.from('brvm_instruments').select('code, designation, secteur, shares').eq('code', code).maybeSingle(),
    asOf
      ? db
          .from('brvm_actions_daily')
          .select('cours_jour, variation_pct, volume')
          .eq('date_marche', asOf)
          .eq('code', code)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    asOf
      ? db.from('signals_daily').select('signal, confiance').eq('date_marche', asOf).eq('code', code).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from('liquidity_daily')
      .select('date_marche, score, classe')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('coherence_anomalies')
      .select('regle, gravite, message')
      .eq('code', code)
      .is('resolue_le', null),
    db
      .from('brvm_news')
      .select('titre, date_publication')
      .contains('ticker_codes', [code])
      .order('date_publication', { ascending: false })
      .limit(2),
    db
      .from('dividends')
      .select('exercice, montant, ex_date, payment_date')
      .eq('code', code)
      .gt('montant', 0)
      .order('exercice', { ascending: false })
      .limit(2),
    controleBoc(db).catch(() => []),
  ]);

  const boc = bocList.find((b) => b.code === code) ?? null;
  const anomalies = (cohRes.data ?? []) as Array<{ regle: string; gravite: string; message: string }>;
  const q = quoteRes.data as { cours_jour?: number; variation_pct?: number; volume?: number } | null;
  const s = sigRes.data as { signal?: string; confiance?: number } | null;
  const l = liqRes.data as { score?: number; classe?: string } | null;
  const instr = instrRes.data as { designation?: string; secteur?: string } | null;
  const news = (newsRes.data ?? []) as Array<{ titre: string; date_publication: string }>;
  const divs = (divRes.data ?? []) as Array<{ exercice: number; montant: number; ex_date: string | null }>;

  const lignes = [
    `🔍 <b>Audit flash · ${echapperHtmlPur(code)}</b>${instr?.designation ? ` (${echapperHtmlPur(instr.designation)})` : ''}`,
    `Séance : ${asOf ?? '—'} · Secteur : ${echapperHtmlPur(instr?.secteur ?? '—')}`,
    `Cours : <b>${q?.cours_jour != null ? q.cours_jour.toLocaleString('fr-FR') : '—'} FCFA</b> (${q?.variation_pct != null ? `${q.variation_pct >= 0 ? '+' : ''}${q.variation_pct.toFixed(2)} %` : '—'}) · Vol : ${q?.volume ?? '—'}`,
    `Signal : <b>${echapperHtmlPur(s?.signal ?? '—')}</b> (${s?.confiance ?? '—'} %) · Liquidité : ${l?.score ?? '—'}/100 (${echapperHtmlPur(l?.classe ?? '—')})`,
    boc
      ? `BOC (${boc.date_marche}) : PER site ${boc.per.site?.toFixed(2) ?? '—'} vs BOC ${boc.per.boc?.toFixed(2) ?? '—'} (${boc.per.etat}) · Rdt ${boc.rendement.site?.toFixed(2) ?? '—'}% vs ${boc.rendement.boc?.toFixed(2) ?? '—'}%`
      : 'BOC : absent',
    anomalies.length === 0
      ? 'Cohérence : ✅ 0 anomalie ouverte'
      : `Cohérence : 🔴 ${anomalies.length} anomalie(s) — ${anomalies.map((a) => echapperHtmlPur(a.message)).join(' ; ')}`,
    divs[0]
      ? `Dernier dividende : ${divs[0].montant} FCFA (ex. ${divs[0].exercice})`
      : 'Dividende : aucun enregistré',
    news[0] ? `Dernière actu : ${echapperHtmlPur(news[0].titre)} (${news[0].date_publication.slice(0, 10)})` : 'Actualité : aucune récente',
  ];

  return {
    ok: true as const,
    html: lignes.join('\n'),
    data: {
      code,
      societe: instr?.designation ?? null,
      seance: asOf,
      cours: q,
      signal: s,
      liquidite: l,
      boc,
      anomalies,
      dividende: divs[0] ?? null,
    },
  };
}

export async function chargerResumeControleSignals(): Promise<Signal[]> {
  const t = await chargerTour();
  return t.signaux;
}
