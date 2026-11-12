import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { exportBodySchema, nomFichierSur } from '@/lib/server/exportGuard';
import { parseReponseIA } from '@/lib/export/parseAnalyse';
import { detecterRecommandation } from '@/lib/ai/filtreRecommandation';
import { PdfAnalyseDocument } from '@/lib/export/pdfTemplate';

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const access = await canAccess('assistant_ia');
    if (!access.allowed) return NextResponse.json({ error: 'Fonctionnalité réservée' }, { status: 403 });

    const parsed = exportBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    const { texte, symbole } = parsed.data;
    // Le texte vient du navigateur : un ancien texte (ou un texte modifié)
    // portant une recommandation n'est pas mis en forme (audit lot B).
    if (detecterRecommandation(texte).recommandation) {
      return NextResponse.json({ error: 'Ce texte contient une recommandation d’investissement : il ne peut pas être exporté.' }, { status: 422 });
    }

    const data = parseReponseIA(texte, symbole);
    const pdfBuffer = await renderToBuffer(React.createElement(PdfAnalyseDocument, { data }) as any);
    const filename = nomFichierSur(data.symbole, new Date().toISOString().split('T')[0], 'pdf');

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
