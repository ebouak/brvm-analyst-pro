import { NextRequest, NextResponse } from 'next/server';
import { parseReponseIA } from '@/lib/export/parseAnalyse';
import { detecterRecommandation } from '@/lib/ai/filtreRecommandation';
import { genererDocx } from '@/lib/export/docxTemplate';

export async function POST(req: NextRequest) {
  try {
    const { texte, symbole } = await req.json();
    if (!texte) return NextResponse.json({ error: 'Texte manquant' }, { status: 400 });
    // Le texte vient du navigateur : un ancien texte (ou un texte modifié)
    // portant une recommandation n'est pas mis en forme (audit lot B).
    if (detecterRecommandation(String(texte)).recommandation) {
      return NextResponse.json({ error: 'Ce texte contient une recommandation d’investissement : il ne peut pas être exporté.' }, { status: 422 });
    }

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
