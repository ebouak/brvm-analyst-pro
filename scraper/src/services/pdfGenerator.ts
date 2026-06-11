/**
 * Service de génération de PDF pour rapports mensuels.
 * Utilise PDFKit pour créer des rapports stylisés (4 pages) en thème dark-finance.
 *
 * Responsabilités:
 * - Générer un PDF 4 pages avec résumé KPIs, signaux, analyse fondamentale, événements
 * - Styler avec les couleurs du design system BRVM (cyan, or, vert/rouge)
 * - Fournir un stream lisible (pour upload Vercel Blob / S3)
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface MonthlyReportData {
  month: string; // 'YYYY-MM'
  userName: string;
  kpis: {
    pnlTotal: number;
    pnlPct: number;
    capitalCurrent: number;
    capitalInitial: number;
  };
  topSignals: Array<{
    code: string;
    entryPrice: number;
    exitPrice: number;
    entryDate: string;
    exitDate: string;
    pnlPct: number;
    daysHeld: number;
  }>;
  signalNarrative: string;
  fundamentals: Array<{
    code: string;
    per?: number;
    pb?: number;
    graham?: number;
  }>;
  events: Array<{
    title: string;
    date: string;
    impact: string;
  }>;
  eventNarrative: string;
  recommendations: string;
}

// Design system colors (DeFi cyan theme)
const COLORS = {
  bg: '#030303',
  surface: '#0a1417',
  accent: '#56D7FD', // cyan
  gold: '#FFD700',
  info: '#56D7FD', // cyan
  up: '#3fe18b', // green
  down: '#ff6b6b', // red
  text: '#FCFCFC', // white
  muted: '#8b93a7', // gray
};

/**
 * Génère un PDF de rapport mensuel.
 * Retourne un stream Readable compatible avec Vercel Blob upload.
 */
export function generateMonthlyReportPDF(data: MonthlyReportData): Readable {
  // Créer le document avec un buffer en mémoire
  const buffers: Buffer[] = [];

  const doc = new PDFDocument({
    bufferPages: true,
    size: 'A4',
    margin: 40,
    info: {
      Title: `Rapport BRVM Analyst Pro — ${data.month}`,
      Subject: `Monthly Investment Report ${data.month}`,
      Author: 'BRVM Analyst Pro',
    },
  });

  // Rediriger la sortie dans notre buffer
  doc.on('data', (chunk: Buffer) => {
    buffers.push(chunk);
  });

  doc.on('end', () => {
    // Complétion
  });

  // PAGE 1: Résumé du mois
  renderPage1(doc, data);

  // PAGE 2: Signaux gagnants
  doc.addPage();
  renderPage2(doc, data);

  // PAGE 3: Analyse fondamentale
  doc.addPage();
  renderPage3(doc, data);

  // PAGE 4: Événements et contexte
  doc.addPage();
  renderPage4(doc, data);

  // Ajouter footer sur toutes les pages
  addPageFooters(doc, data.month);

  doc.end();

  // Créer un stream Readable à partir du buffer
  return Readable.from(async function* () {
    for (const buffer of buffers) {
      yield buffer;
    }
  }());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPage1(doc: any, data: MonthlyReportData): void {
  // Titre
  doc.fontSize(24).fillColor(COLORS.accent).text('Synthèse mensuelle', { align: 'center' });
  doc.fontSize(11).fillColor(COLORS.muted).text(`BRVM Analyst Pro — ${data.month}`, {
    align: 'center',
  });
  doc.fontSize(10).fillColor(COLORS.muted).text(`Préparé pour: ${data.userName}`, {
    align: 'center',
  });

  doc.moveDown(1);

  // Section KPIs
  doc.fontSize(13).fillColor(COLORS.text).text('Performance du mois', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor(COLORS.muted).text('P&L Total:', { continued: true });
  const pnlColor = data.kpis.pnlTotal >= 0 ? COLORS.up : COLORS.down;
  doc
    .fillColor(pnlColor)
    .text(`  ${data.kpis.pnlTotal.toFixed(0)} FCFA (${data.kpis.pnlPct.toFixed(2)}%)`);

  doc
    .fillColor(COLORS.muted)
    .text('Capital actuel:', { continued: true })
    .fillColor(COLORS.text)
    .text(`  ${data.kpis.capitalCurrent.toFixed(0)} FCFA`);

  doc
    .fillColor(COLORS.muted)
    .text('Capital initial:', { continued: true })
    .fillColor(COLORS.text)
    .text(`  ${data.kpis.capitalInitial.toFixed(0)} FCFA`);

  doc.moveDown(1);

  // Placeholder pour graphique
  doc.fontSize(10).fillColor(COLORS.muted);
  doc.rect(50, doc.y, 475, 100).stroke(COLORS.muted);
  doc.fontSize(9).text('[Courbe de performance — À générer via ECharts]', {
    align: 'center',
    valign: 'center',
  });

  doc.moveDown(2.5);

  // Narrative
  doc.fontSize(12).fillColor(COLORS.text).text('Analyse du mois', { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.signalNarrative, { align: 'justify', width: 475 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPage2(doc: any, data: MonthlyReportData): void {
  doc.fontSize(18).fillColor(COLORS.accent).text('Top 3 Signaux', { align: 'left' });
  doc.moveDown(0.7);

  data.topSignals.forEach((sig, idx) => {
    doc
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(`${idx + 1}. ${sig.code}`, { underline: true });

    doc.fontSize(9.5).fillColor(COLORS.muted);
    doc.text(`Entrée: ${sig.entryPrice.toFixed(0)} FCFA (${sig.entryDate})`);
    doc.text(`Sortie: ${sig.exitPrice.toFixed(0)} FCFA (${sig.exitDate})`);

    const pnlColor = sig.pnlPct >= 0 ? COLORS.up : COLORS.down;
    doc
      .fillColor(pnlColor)
      .text(`P&L: ${sig.pnlPct >= 0 ? '+' : ''}${sig.pnlPct.toFixed(2)}% (${sig.daysHeld} jours)`);

    doc.moveDown(0.3);
  });

  doc.moveDown(0.7);

  // Narrative des signaux
  doc.fontSize(11).fillColor(COLORS.text).text('Pourquoi ces gains?', { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.signalNarrative, { align: 'justify', width: 475 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPage3(doc: any, data: MonthlyReportData): void {
  doc.fontSize(18).fillColor(COLORS.accent).text('Analyse Fondamentale', { align: 'left' });
  doc.moveDown(0.7);

  if (data.fundamentals.length === 0) {
    doc
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(
        'Données fondamentales non disponibles pour cette période. Les signaux reposent sur une analyse technique.',
      );
  } else {
    data.fundamentals.forEach((fund) => {
      doc.fontSize(11).fillColor(COLORS.text).text(fund.code, { underline: true });

      doc.fontSize(9.5).fillColor(COLORS.muted);
      if (fund.per !== undefined && fund.per > 0) {
        doc.text(`PER: ${fund.per.toFixed(1)}x`);
      }
      if (fund.pb !== undefined && fund.pb > 0) {
        doc.text(`P/B: ${fund.pb.toFixed(2)}x`);
      }
      if (fund.graham !== undefined && fund.graham > 0) {
        doc.text(`Nombre de Graham: ${fund.graham.toFixed(0)} FCFA`);
      }

      doc.moveDown(0.2);
    });

    doc.moveDown(0.5);
  }

  // Recommandations
  doc.fontSize(11).fillColor(COLORS.text).text('À surveiller le mois prochain', { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.recommendations, { align: 'justify', width: 475 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPage4(doc: any, data: MonthlyReportData): void {
  doc.fontSize(18).fillColor(COLORS.accent).text('Événements & Contexte', { align: 'left' });
  doc.moveDown(0.7);

  if (data.events.length === 0) {
    doc.fontSize(10).fillColor(COLORS.muted).text('Aucun événement majeur ce mois.');
  } else {
    data.events.slice(0, 5).forEach((event) => {
      doc
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(`${event.date}: ${event.title}`, { underline: true });
      doc.fontSize(9.5).fillColor(COLORS.muted).text(event.impact, { width: 475 });
      doc.moveDown(0.3);
    });
  }

  if (data.events.length > 5) {
    doc
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`... et ${data.events.length - 5} autres événements`);
  }

  doc.moveDown(0.7);

  // Impact narrative
  doc.fontSize(11).fillColor(COLORS.text).text('Impact sur le marché', { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(data.eventNarrative, { align: 'justify', width: 475 });

  doc.moveDown(1);

  // Disclaimer
  doc
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text('Ce rapport est fourni à titre informatif. Les performances passées ne garantissent pas les résultats futurs.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addPageFooters(doc: any, month: string): void {
  const pages = doc.bufferedPageRange().count;

  for (let i = 0; i < pages; i++) {
    doc.switchToPage(i);

    const footerY = doc.page.height - 30;

    doc.fontSize(8).fillColor(COLORS.muted);
    doc.text(`BRVM Analyst Pro — ${month}`, 40, footerY, {
      align: 'center',
      width: doc.page.width - 80,
    });
    doc.text(`Page ${i + 1} / ${pages}`, 40, footerY + 12, {
      align: 'center',
      width: doc.page.width - 80,
    });
  }
}

/**
 * Convertit un stream PDF en Buffer (utile pour upload ou test).
 */
export async function pdfToBuffer(pdfStream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    pdfStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    pdfStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    pdfStream.on('error', reject);
  });
}
