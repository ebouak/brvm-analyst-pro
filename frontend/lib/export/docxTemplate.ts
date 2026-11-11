import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, BorderStyle, ShadingType,
  WidthType, TableLayoutType, PageNumber, Footer, Header,
} from 'docx';
import type { AnalyseStructuree } from './parseAnalyse';

const CL = {
  vert: '3FB950', rouge: 'F85149', or: 'D29922',
  gris: '8D96A0', fond: '0F1117', surface: '161B22',
  texte: 'E6EDF3', blanc: 'FFFFFF', border: '30363D',
};

function cel(
  texte: string,
  opts: { bold?: boolean; bg?: string; color?: string } = {},
) {
  return new TableCell({
    shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg, fill: opts.bg } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text: texte, bold: opts.bold, color: opts.color ?? CL.texte, font: 'Calibri', size: 18 })],
    })],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

const BORDERS = {
  top:     { style: BorderStyle.SINGLE, size: 1, color: CL.border },
  bottom:  { style: BorderStyle.SINGLE, size: 1, color: CL.border },
  left:    { style: BorderStyle.SINGLE, size: 1, color: CL.border },
  right:   { style: BorderStyle.SINGLE, size: 1, color: CL.border },
  insideH: { style: BorderStyle.SINGLE, size: 1, color: CL.border },
  insideV: { style: BorderStyle.SINGLE, size: 1, color: CL.border },
};

export async function genererDocx(data: AnalyseStructuree): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // ── Titre ──
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'WESTBOURSE', size: 18, color: CL.vert, font: 'Calibri' })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `${data.nomComplet} (${data.symbole})`, bold: true, size: 36, color: CL.fond, font: 'Calibri' })], heading: HeadingLevel.HEADING_1, spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `Lecture des données · ${data.date}`, size: 20, color: CL.gris, font: 'Calibri' })], spacing: { after: 300 } }),
  );

  // Plus de tableau récapitulatif (signal, conviction, entrée, objectifs,
  // stop, ratio rendement/risque) : il mettait en forme une recommandation
  // d'investissement (audit lot B, 2026-11-11).

  // ── Sections analyse ──
  for (const section of data.sections) {
    children.push(
      new Paragraph({ text: section.titre, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: section.contenu, size: 20, color: '1A1A1A', font: 'Calibri' })], spacing: { after: 100 } }),
    );
    for (const tableau of section.tableaux ?? []) {
      children.push(
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: BORDERS,
          rows: [
            new TableRow({ tableHeader: true, children: tableau.headers.map((h) => cel(h, { bold: true, bg: CL.fond, color: CL.blanc })) }),
            ...tableau.rows.map((row, ri) => new TableRow({ children: row.map((cell) => cel(cell, { bg: ri % 2 === 0 ? undefined : CL.surface })) })),
          ],
        }),
        new Paragraph({ text: '', spacing: { after: 140 } }),
      );
    }
  }

  // ── Risques ──
  if (data.risques.length > 0) {
    children.push(
      new Paragraph({ text: 'Points de vigilance', heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 } }),
      ...data.risques.map((r) => new Paragraph({ children: [new TextRun({ text: r, size: 20, color: '5C3D00', font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: 60 } })),
      new Paragraph({ text: '', spacing: { after: 160 } }),
    );
  }

  // ── Disclaimer ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.disclaimer, size: 16, color: CL.gris, italics: true, font: 'Calibri' })],
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: CL.border, space: 10 } },
    }),
  );

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({ children: [new TextRun({ text: `WESTBOURSE — ${data.symbole} · ${data.date}`, size: 16, color: CL.gris, font: 'Calibri' })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ children: [new TextRun({ text: "Information générale, pas un conseil en investissement.  Page ", size: 14, italics: true, color: CL.gris, font: 'Calibri' }), new TextRun({ children: [PageNumber.CURRENT], size: 14, color: CL.gris })] })],
        }),
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
