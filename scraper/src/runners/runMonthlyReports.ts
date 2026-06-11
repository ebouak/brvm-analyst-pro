/**
 * Orchestrateur pour la génération de rapports mensuels PDF.
 * Exécuté le 1er de chaque mois à 08h00 UTC via cron.
 *
 * Pipeline:
 * 1. Récupérer tous les utilisateurs premium
 * 2. Pour chaque utilisateur:
 *    - Récupérer les données du mois (paper trading, signaux, événements)
 *    - Appeler LLM pour narrations
 *    - Générer PDF
 *    - Upload vers Vercel Blob
 *    - Sauvegarder en DB
 *    - Envoyer email
 * 3. Journaliser les résultats
 */

import { getSupabase } from '../persistence/supabase.js';
import { ReportNarrator, createReportNarrator } from '../services/reportNarrator.js';
import { generateMonthlyReportPDF, pdfToBuffer, type MonthlyReportData } from '../services/pdfGenerator.js';
import { dispatch } from '../alerts/channels.js';
import { logger } from '../logger.js';
import { PaperTradingService } from '../services/paperTradingService.js';

export interface MonthlyReportRunOptions {
  month?: string; // Override month (YYYY-MM format), default = current month
  dryRun?: boolean; // Don't write to DB or send emails
}

export interface MonthlyReportRunResult {
  status: 'success' | 'partial' | 'failed';
  usersProcessed: number;
  reportsGenerated: number;
  emailsSent: number;
  errors: Array<{ userId: string; error: string }>;
  message: string;
}

export async function runMonthlyReports(
  opts: MonthlyReportRunOptions = {},
): Promise<MonthlyReportRunResult> {
  const supabase = getSupabase();
  const narrator = createReportNarrator();
  const paperTradingService = new PaperTradingService();

  const now = new Date();
  const month = opts.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  logger.info({ month, dryRun: opts.dryRun }, 'Starting monthly reports generation');

  const result: MonthlyReportRunResult = {
    status: 'success',
    usersProcessed: 0,
    reportsGenerated: 0,
    emailsSent: 0,
    errors: [],
    message: '',
  };

  try {
    // 1. Récupérer tous les utilisateurs premium
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('is_premium', true);

    if (profileError) {
      throw new Error(`Failed to fetch premium users: ${profileError.message}`);
    }

    const users = profiles || [];
    logger.info({ count: users.length }, 'Retrieved premium users');

    // 2. Traiter chaque utilisateur
    for (const user of users) {
      try {
        await generateReportForUser(
          supabase,
          user.id,
          user.email,
          user.full_name || 'Utilisateur',
          month,
          narrator,
          paperTradingService,
          opts.dryRun || false,
        );

        result.usersProcessed++;
        result.reportsGenerated++;
      } catch (error) {
        logger.error({ userId: user.id, error }, 'Failed to generate report for user');
        result.status = 'partial';
        result.errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. Calculer le résultat final
    if (result.errors.length === 0) {
      result.message = `Generated and sent ${result.reportsGenerated} reports`;
    } else if (result.reportsGenerated > 0) {
      result.message = `Generated ${result.reportsGenerated} reports, ${result.errors.length} failed`;
    } else {
      result.status = 'failed';
      result.message = `No reports generated. All ${result.errors.length} users failed.`;
    }

    logger.info(result, 'Monthly reports generation completed');
    return result;
  } catch (error) {
    logger.error({ error }, 'Monthly reports generation failed');
    result.status = 'failed';
    result.message = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function generateReportForUser(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  email: string,
  fullName: string,
  month: string,
  narrator: ReturnType<typeof createReportNarrator>,
  paperTradingService: PaperTradingService,
  dryRun: boolean,
): Promise<void> {
  logger.info({ userId, month }, 'Generating report for user');

  const parts = month.split('-');
  const monthYear = parts[0] || '';
  const monthMonth = parts[1] || '';
  const monthNum = parseInt(monthMonth, 10);
  const yearNum = parseInt(monthYear, 10);

  // 1. Récupérer le compte paper trading
  const account = await paperTradingService.getAccount(userId);
  if (!account) {
    logger.warn({ userId }, 'User has no paper trading account, skipping');
    return;
  }

  // 2. Récupérer les positions fermées du mois
  const { data: positions, error: posError } = await supabase
    .from('paper_trading_positions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('exit_date', month)
    .lt('exit_date', getNextMonth(month));

  if (posError) {
    throw new Error(`Failed to fetch positions: ${posError.message}`);
  }

  // 3. Récupérer les 3 meilleurs signaux du mois
  const { data: signals, error: sigError } = await supabase
    .from('signals_daily')
    .select('id, code, score_total, inputs')
    .gte('date_marche', month)
    .lt('date_marche', getNextMonth(month))
    .order('score_total', { ascending: false })
    .limit(3);

  if (sigError) {
    throw new Error(`Failed to fetch signals: ${sigError.message}`);
  }

  // 4. Récupérer les événements du mois
  const { data: events, error: eventError } = await supabase
    .from('brvm_events')
    .select('title, event_date, event_type')
    .gte('event_date', month)
    .lt('event_date', getNextMonth(month))
    .limit(10);

  if (eventError) {
    throw new Error(`Failed to fetch events: ${eventError.message}`);
  }

  // 5. Enrichir les signaux avec les fondamentaux
  const enrichedSignals = await Promise.all(
    (signals || []).map(async (sig) => {
      const { data: fund } = await supabase
        .from('fundamentals')
        .select('per, pb, graham')
        .eq('code', sig.code as string)
        .eq('year', yearNum)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      return {
        code: sig.code,
        entryPrice: 0, // Sera enrichi depuis positions
        exitPrice: 0,
        entryDate: '',
        exitDate: '',
        pnlPct: 0,
        daysHeld: 0,
        fundamentals: fund
          ? {
              per: fund.per,
              pb: fund.pb,
              graham: fund.graham,
            }
          : undefined,
      };
    }),
  );

  // Enrichir depuis les positions fermées
  const posMap = new Map();
  (positions || []).forEach((pos) => {
    posMap.set(pos.code, pos);
  });

  enrichedSignals.forEach((sig) => {
    const pos = posMap.get(sig.code);
    if (pos) {
      sig.entryPrice = pos.entry_price;
      sig.exitPrice = pos.exit_price || pos.entry_price;
      sig.entryDate = pos.entry_date;
      sig.exitDate = pos.exit_date || pos.entry_date;
      sig.pnlPct = pos.pnl_pct;
      sig.daysHeld = pos.days_held || 0;
    }
  });

  // 6. Générer les narrations LLM
  const signalNarrative = await narrator.narrateSignals(enrichedSignals);

  const eventNarrative = await narrator.narrateEvents(
    (events || []).map((e) => ({
      title: e.title,
      date: e.event_date,
      impact: e.event_type || 'Événement de marché',
    })),
  );

  // Récupérer les secteurs pour recommandations
  const topSectors = await getTopSectorsByRsi(supabase, month, getNextMonth(month));
  const recommendations = await narrator.generateRecommendations(topSectors);

  // 7. Construire les données du rapport
  const reportData: MonthlyReportData = {
    month,
    userName: fullName,
    kpis: {
      pnlTotal: account.pnl_total,
      pnlPct: account.pnl_pct,
      capitalCurrent: account.capital_current,
      capitalInitial: account.capital_initial,
    },
    topSignals: enrichedSignals.filter((s) => s.entryPrice > 0).slice(0, 3),
    signalNarrative,
    fundamentals: enrichedSignals.map((s) => ({
      code: s.code,
      per: s.fundamentals?.per,
      pb: s.fundamentals?.pb,
      graham: s.fundamentals?.graham,
    })),
    events: (events || []).map((e) => ({
      title: e.title,
      date: e.event_date,
      impact: e.event_type || 'Événement',
    })),
    eventNarrative,
    recommendations,
  };

  // 8. Générer le PDF
  const pdfStream = generateMonthlyReportPDF(reportData);
  const pdfBuffer = await pdfToBuffer(pdfStream);

  // 9. Upload vers Vercel Blob (ou S3)
  const pdfUrl = await uploadPdfToBlob(pdfBuffer, userId, month);

  // 10. Sauvegarder en BD (si non dry-run)
  if (!dryRun) {
    const { error: dbError } = await supabase.from('monthly_reports').upsert(
      {
        user_id: userId,
        month,
        report_url: pdfUrl,
        report_json: reportData,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,month' },
    );

    if (dbError) {
      throw new Error(`Failed to save report to DB: ${dbError.message}`);
    }

    // 11. Envoyer l'email
    await sendReportEmail(email, fullName, month, pdfUrl);
  }

  logger.info(
    { userId, month, dryRun },
    `Report generated for ${fullName} — ${pdfUrl}`,
  );
}

async function uploadPdfToBlob(buffer: Buffer, userId: string, month: string): Promise<string> {
  // Pour cette implémentation, nous utilisons une URL mock.
  // En production, cela utiliserait Vercel Blob ou S3.
  // Exemple avec Vercel Blob (nécessite @vercel/blob):
  //
  // import { put } from '@vercel/blob';
  // const filename = `reports/${month}/${userId}.pdf`;
  // const blob = await put(filename, buffer, { access: 'public' });
  // return blob.url;

  // Pour l'instant, retourner une URL locale fictive
  const filename = `reports-${userId}-${month}.pdf`;
  return `https://s3.example.com/${filename}`;
}

async function sendReportEmail(
  email: string,
  name: string,
  month: string,
  pdfUrl: string,
): Promise<void> {
  const monthName = getMonthName(month);
  const subject = `BRVM Analyst Pro — Rapport ${monthName}`;
  const body = `Bonjour ${name},

Votre rapport de synthèse pour ${monthName} est prêt.

Télécharger le rapport PDF: ${pdfUrl}

Consulter en ligne: https://brvm.app/premium/reports/${month}

Cordialement,
BRVM Analyst Pro`;

  await dispatch({
    to: email,
    subject,
    body,
  });
}

async function getTopSectorsByRsi(
  supabase: ReturnType<typeof getSupabase>,
  startMonth: string,
  endMonth: string,
): Promise<Array<{ sector: string; avgRsi: number; avgScore: number }>> {
  const { data, error } = await supabase
    .from('signals_daily')
    .select(
      `
      code,
      score_total,
      inputs,
      brvm_instruments!inner(secteur)
    `,
    )
    .gte('date_marche', startMonth as string)
    .lt('date_marche', endMonth as string);

  if (error || !data) {
    logger.warn({ error }, 'Failed to fetch sector data');
    return [];
  }

  const sectorStats = new Map<string, { rsis: number[]; scores: number[] }>();

  data.forEach((row) => {
    const sector = (row.brvm_instruments as any)?.secteur || 'Autre';
    const rsi = (row.inputs as any)?.rsi || 50;
    const score = row.score_total || 0;

    if (!sectorStats.has(sector)) {
      sectorStats.set(sector, { rsis: [], scores: [] });
    }

    const stats = sectorStats.get(sector)!;
    stats.rsis.push(rsi);
    stats.scores.push(score);
  });

  const results: Array<{ sector: string; avgRsi: number; avgScore: number }> = [];

  sectorStats.forEach((stats, sector) => {
    const avgRsi = stats.rsis.reduce((a, b) => a + b, 0) / stats.rsis.length;
    const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
    results.push({ sector, avgRsi, avgScore });
  });

  return results.sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
}

function getMonthName(month: string): string {
  const parts = month.split('-');
  const year = parts[0] || '2026';
  const monthStr = parts[1] || '01';
  const monthNum = parseInt(monthStr, 10);
  const date = new Date(parseInt(year, 10), monthNum - 1, 1);
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
}

function getNextMonth(month: string): string {
  const parts = month.split('-');
  const year = parts[0] || '2026';
  const monthStr = parts[1] || '01';
  let nextMonth = parseInt(monthStr, 10) + 1;
  let nextYear = parseInt(year, 10);

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}
