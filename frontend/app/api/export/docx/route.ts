import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/server/featureAccess';
import { exportBodySchema, nomFichierSur } from '@/lib/server/exportGuard';
import { parseReponseIA } from '@/lib/export/parseAnalyse';
import { genererDocx } from '@/lib/export/docxTemplate';

export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const access = await canAccess('assistant_ia');
    if (!access.allowed) return NextResponse.json({ error: 'Fonctionnalité réservée' }, { status: 403 });

    const parsed = exportBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    const { texte, symbole } = parsed.data;

    const data = parseReponseIA(texte, symbole);
    const docxBuffer = await genererDocx(data);
    const filename = nomFichierSur(data.symbole, new Date().toISOString().split('T')[0], 'docx');

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
