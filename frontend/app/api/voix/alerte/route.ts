import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { estTypeAlerte } from '@/lib/voix/fenetre';
import { declencherAlerteVocale } from '@/lib/voix/appel';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voix/alerte — appel vocal à l'exploitant pour une alerte CRITIQUE
 * venue du scraper (GitHub Actions). Spec : appels vocaux, usage 4.
 *
 * Protégée par VOIX_ALERTE_SECRET (`Authorization: Bearer`, temps constant,
 * 32 caractères minimum — même règle que les crons). Corps {type, resume} ;
 * `type` dans une liste FERMÉE, `resume` nettoyé avant lecture (aucune donnée
 * personnelle, aucune URL). Un appel au plus par type et par fenêtre de 6 h :
 * le verrou est la ligne insérée AVANT l'appel (conflit → 200 « déjà appelé »).
 * Plafond VOIX_MAX_JOUR (défaut 10) tous motifs ; au-delà, refus + Telegram.
 */
export async function POST(req: Request) {
  if (!cronAutorise(req, process.env.VOIX_ALERTE_SECRET)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }
  let corps: { type?: unknown; resume?: unknown };
  try {
    corps = (await req.json()) as typeof corps;
  } catch {
    return NextResponse.json({ error: 'corps illisible' }, { status: 400 });
  }
  if (!estTypeAlerte(corps.type)) return NextResponse.json({ error: 'type inconnu' }, { status: 400 });
  const resume = typeof corps.resume === 'string' ? corps.resume.slice(0, 1000) : '';

  const r = await declencherAlerteVocale(corps.type, resume);
  switch (r.issue) {
    case 'appele':
      return NextResponse.json({ ok: true, issue: r.issue });
    case 'deja':
      return NextResponse.json({ ok: true, issue: r.issue, message: 'déjà appelé' });
    case 'plafond':
      return NextResponse.json({ ok: false, issue: r.issue, message: r.detail }, { status: 429 });
    case 'non_configure':
      return NextResponse.json({ ok: false, issue: r.issue, message: r.detail }, { status: 503 });
    default:
      return NextResponse.json({ ok: false, issue: r.issue, message: r.detail }, { status: 502 });
  }
}
