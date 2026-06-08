import { NextRequest, NextResponse } from 'next/server';
import { parseReponseIA } from '@/lib/export/parseAnalyse';
import { genererDocx } from '@/lib/export/docxTemplate';

export async function POST(req: NextRequest) {
  try {
    const { texte, symbole } = await req.json();
    if (!texte) return NextResponse.json({ error: 'Texte manquant' }, { status: 400 });

    const data = parseReponseIA(texte, symbole);
    const docxBuffer = await genererDocx(data);
    const filename = `BRVM_Analyse_${data.symbole}_${new Date().toISOString().split('T')[0]}.docx`;

    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: `Erreur Word: ${(err as Error).message}` }, { status: 500 });
  }
}
