// POST /api/qa/ingest/debut — la CI déclare le début d'une exécution e2e.
// Sans fin reçue, l'exécution restera « en cours » puis apparaîtra
// « incomplète » : c'est ce qui rend visible un runner tué net.
// Auth : bearer QA_INGEST_SECRET (≥ 32 caractères), comparé à temps constant.
import { NextResponse } from 'next/server';
import { autoriseIngestion, corpsDebut, lireCorps, traiterDebut } from '@/lib/qa/ingestion';
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
  const lu = lireCorps(await req.text(), corpsDebut);
  if (!lu.ok) return NextResponse.json(lu.reponse.corps, { status: lu.reponse.status });
  try {
    const r = await traiterDebut(lu.valeur, depsIngestionSupabase());
    return NextResponse.json(r.corps, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'Enregistrement du début impossible' }, { status: 500 });
  }
}
