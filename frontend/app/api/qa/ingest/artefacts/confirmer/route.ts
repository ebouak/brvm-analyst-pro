// POST /api/qa/ingest/artefacts/confirmer — la CI signale les pièces jointes
// envoyées. Le serveur ne la croit pas sur parole : il vérifie la présence de
// chaque fichier dans le stockage avant de le marquer « téléversé ».
// Auth : bearer QA_INGEST_SECRET (≥ 32 caractères), comparé à temps constant.
import { NextResponse } from 'next/server';
import { autoriseIngestion, corpsConfirmer, lireCorps, traiterConfirmation } from '@/lib/qa/ingestion';
import { depsIngestionSupabase } from '@/lib/qa/depsSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!autoriseIngestion(process.env.QA_INGEST_SECRET, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const lu = lireCorps(await req.text(), corpsConfirmer);
  if (!lu.ok) return NextResponse.json(lu.reponse.corps, { status: lu.reponse.status });
  try {
    const r = await traiterConfirmation(lu.valeur, depsIngestionSupabase());
    return NextResponse.json(r.corps, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'Confirmation impossible' }, { status: 500 });
  }
}
