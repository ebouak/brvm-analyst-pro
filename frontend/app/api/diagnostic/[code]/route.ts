import { NextResponse } from 'next/server';
import { checkFeature } from '@/lib/server/featureGate';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { redacteursDisponibles, redigerEnFlux } from '@/lib/server/redacteur';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { computeDiagnosticMetrics } from '@/lib/diagnostic/metrics';
import { buildDiagnosticPrompt } from '@/lib/diagnostic/prompt';
import { computeRedFlags } from '@/lib/diagnostic/redFlags';
import { findNewsSignals, type NewsCategory } from '@/lib/diagnostic/newsSignals';
import { findWebSignals } from '@/lib/diagnostic/webSearch';
import { MARQUE_ECHEC } from '@/lib/diagnostic/echec';
import { chargerContexteQuant } from '@/lib/diagnostic/contexteQuant';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { lectureIntermediaire } from '@/lib/financials/interim';

export const maxDuration = 120;

const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supa.from('profiles').select('is_premium').eq('id', user.id).single();
  const isPremium = Boolean(profile?.is_premium);

  // Accès (free/premium/désactivé) piloté depuis /admin/features — SANS consommer
  // de quota ici : le décompte n'a lieu qu'en cas de génération réelle (une
  // lecture du cache ne coûte aucun token — cf. plus bas).
  const gate = await checkFeature(
    'diagnostic_ia',
    { id: user.id, email: user.email, isPremium },
    { consume: false },
  );
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: gate.status });
  }

  const code = params.code.toUpperCase();
  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force === true;

  const admin = createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Cache check
  if (!force) {
    const { data: cached } = await admin
      .from('diagnostic_reports')
      .select('markdown_content, generated_at')
      .eq('code', code)
      .single();
    if (cached && Date.now() - new Date(cached.generated_at).getTime() < MAX_AGE_MS) {
      return NextResponse.json({ markdown: cached.markdown_content, cached: true, generated_at: cached.generated_at });
    }
  }

  // À partir d'ici, une génération LLM VA avoir lieu (le cache n'a pas répondu) :
  // c'est le seul moment où le quota doit être décompté. Décompter plus tôt
  // aurait puni la simple relecture d'un diagnostic déjà en cache.
  const consumed = await checkFeature('diagnostic_ia', {
    id: user.id,
    email: user.email,
    isPremium,
  });
  if (!consumed.allowed) {
    return NextResponse.json({ error: consumed.reason }, { status: consumed.status });
  }

  // async-parallel : données financières, contexte de pairs et clés LLM sont
  // indépendants → en parallèle
  const [data, contexteQuant, redacteurs, { data: titre }] = await Promise.all([
    loadCompanyFinancials(code),
    chargerContexteQuant(admin, code),
    redacteursDisponibles(),
    // Flottant et volume moyen : en base (runDetails), jusqu'ici jamais transmis.
    admin.from('brvm_instruments').select('flottant, vol_moyen_30j').eq('code', code).maybeSingle(),
  ]);
  if (!data) return NextResponse.json({ error: 'Instrument inconnu' }, { status: 404 });
  if (redacteurs.length === 0) {
    return NextResponse.json({ error: 'Aucune clé LLM configurée (DeepSeek, Gemini ou Grok requis)' }, { status: 503 });
  }

  const inc_n  = data.incomeStatements[0] ?? null;
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n  = data.balanceSheets[0] ?? null;
  const bal_n1 = data.balanceSheets[1] ?? null;
  const cf_n   = data.cashFlowStatements[0] ?? null;
  const cf_n1  = data.cashFlowStatements[1] ?? null;
  const cours  = data.latestDaily?.cours_jour ?? null;

  const ratios = calculateFundamentals({
    coursActuel: cours,
    shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null,
    cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n, incomePrev: inc_n1, balance: bal_n, cashflow: cf_n,
  });

  const m = computeDiagnosticMetrics({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation: ratios.capitalisation });
  // Famille comptable : la colonne de l'instrument, sinon le référentiel curé.
  const famille = data.instrument.famille_comptable ?? FAMILLE_PAR_CODE[code] ?? 'general';
  const redFlags = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m, famille });

  const newsSignals = await findNewsSignals(admin, code);
  const categoriesSansResultat = (Object.keys(newsSignals) as NewsCategory[])
    .filter((cat) => newsSignals[cat].length === 0);
  const webSignals = await findWebSignals(admin, code, data.instrument.designation ?? code, categoriesSansResultat);

  // Comptes intermédiaires postérieurs au dernier annuel : confrontés aux MÊMES
  // annuels que les tableaux du prompt (income_statements), pour que les douze
  // mois glissants se calculent sur les chiffres que le modèle voit.
  const interim = lectureIntermediaire([
    ...data.incomeStatements,
    ...data.incomeInterim,
  ].map((l) => ({
    periode: String(l.periode),
    revenu_total: l.revenu_total == null ? null : Number(l.revenu_total),
    resultat_net: l.resultat_net == null ? null : Number(l.resultat_net),
  })));

  const prompt = buildDiagnosticPrompt({
    code,
    designation: data.instrument.designation,
    secteur: data.instrument.secteur,
    cours,
    cours_bas_52s: ratios.cours_bas_52s,
    cours_haut_52s: ratios.cours_haut_52s,
    inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m,
    periode_n: inc_n?.periode ?? 'N',
    periode_n1: inc_n1?.periode ?? 'N-1',
    redFlags, newsSignals, webSignals,
    interim, contexteQuant, famille,
    marche: {
      actions: data.instrument.shares ?? inc_n?.actions_en_circulation ?? null,
      flottant: (titre as { flottant?: number | null } | null)?.flottant ?? null,
      volMoyen30j: (titre as { vol_moyen_30j?: number | null } | null)?.vol_moyen_30j ?? null,
    },
    // Sans elle, le modèle inventait une date (« 26 mai 2025 » sur un rapport
    // de juin 2026).
    dateRapport: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      let usedModel = 'unknown';

      // Cascade DeepSeek → Gemini → Grok (lib/server/redacteur). Elle ne joue
      // qu'avant le premier octet : un fournisseur qui tombe en cours de flux
      // laisse un rapport partiel, qui n'est PAS mis en cache (voir plus bas).
      let complet = false;
      try {
        const redaction = await redigerEnFlux(
          [{ role: 'user', content: prompt }],
          { maxTokens: 7000, temperature: 0.3, timeoutMs: 110_000 },
        );
        if (redaction) {
          usedModel = redaction.modele;
          for await (const fragment of redaction.fragments) {
            full += fragment;
            controller.enqueue(encoder.encode(fragment));
          }
          complet = true;
        }
      } catch (e) {
        console.error('[diagnostic] flux interrompu pour', code, (e as Error).name);
      }

      if (full && complet) {
        await admin.from('diagnostic_reports').upsert(
          { code, markdown_content: full, model_used: usedModel, metrics_snapshot: m as unknown as Record<string, unknown>, red_flag_score: redFlags.overallScore },
          { onConflict: 'code' },
        );
      } else if (!full) {
        // Marqueur, pas de prose : écrire la panne dans le flux de CONTENU la
        // rendait indistinguable d'un rapport, et le client l'affichait comme
        // une analyse. Le statut HTTP ne peut pas servir — il est arrêté à 200
        // avant même qu'un fournisseur soit interrogé.
        console.error('[diagnostic] aucun fournisseur n’a répondu pour', code);
        controller.enqueue(encoder.encode(MARQUE_ECHEC));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
