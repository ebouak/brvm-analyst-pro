// POST /api/qa/ingest/fin — la CI publie le rapport Playwright, MÊME en cas
// d'échec des tests (étape `if: always()`). Le serveur valide, nettoie et
// importe en une transaction (qa_importer_run, idempotente), puis renvoie une
// URL de dépôt signée par pièce jointe attendue.
// Une erreur d'import répond 500 : la CI échoue bruyamment, l'exécution reste
// « en cours » et apparaîtra « incomplète » — jamais un faux succès.
// Auth : bearer QA_INGEST_SECRET (≥ 32 caractères), comparé à temps constant.
import { NextResponse } from 'next/server';
import { autoriseIngestion, corpsFin, lireCorps, traiterFin } from '@/lib/qa/ingestion';
import { depsIngestionSupabase } from '@/lib/qa/depsSupabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ error: 'Méthode non autorisée' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(req: Request) {
  if (!autoriseIngestion(process.env.QA_INGEST_SECRET, req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const lu = lireCorps(await req.text(), corpsFin);
  if (!lu.ok) return NextResponse.json(lu.reponse.corps, { status: lu.reponse.status });
  try {
    const r = await traiterFin(lu.valeur, depsIngestionSupabase());
    return NextResponse.json(r.corps, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'Import refusé par la base' }, { status: 500 });
  }
}
