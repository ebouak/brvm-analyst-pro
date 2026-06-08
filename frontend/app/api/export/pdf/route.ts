import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { parseReponseIA } from '@/lib/export/parseAnalyse';
import { PdfAnalyseDocument } from '@/lib/export/pdfTemplate';

export async function POST(req: NextRequest) {
  try {
    const { texte, symbole } = await req.json();
    if (!texte) return NextResponse.json({ error: 'Texte manquant' }, { status: 400 });

    const data = parseReponseIA(texte, symbole);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(React.createElement(PdfAnalyseDocument, { data }) as any);
    const filename = `BRVM_Analyse_${data.symbole}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: `Erreur PDF: ${(err as Error).message}` }, { status: 500 });
  }
}
