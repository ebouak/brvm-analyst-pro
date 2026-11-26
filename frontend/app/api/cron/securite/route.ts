/**
 * Sécurité des comptes — tâches planifiées (.github/workflows/securite.yml).
 *
 *   POST ?tache=horaire     instantané des sessions + plafond d'appareils Premium
 *   POST ?tache=quotidien   signaux du jour + rapport Telegram à l'exploitant
 *   &simulation=1           (horaire) calcule les fermetures sans RIEN écrire
 *   &forcer=1               (quotidien) renvoie le rapport même s'il est parti
 *
 * Auth : Authorization: Bearer $CRON_SECRET uniquement (temps constant).
 * `ok` est faux — et le workflow rouge — dès qu'une étape échoue ou qu'un
 * rapport ne part pas : un passage vert doit prouver que le travail est fait.
 */
import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { appliquerPlafond, instantane, rapportQuotidien } from '@/lib/securite/serveur';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!cronAutorise(req)) return NextResponse.json({ ok: false, erreur: 'non autorisé' }, { status: 401 });
  const url = new URL(req.url);
  const tache = url.searchParams.get('tache');

  try {
    if (tache === 'horaire') {
      const vues = await instantane();
      const plafond = await appliquerPlafond({ simulation: url.searchParams.get('simulation') === '1' });
      const ok = !plafond.refus && plafond.emails.echecs === 0 && plafond.emails.incertains === 0;
      return NextResponse.json({ ok, tache, instantane: vues, plafond }, { status: ok ? 200 : 500 });
    }
    if (tache === 'quotidien') {
      const r = await rapportQuotidien({ forcer: url.searchParams.get('forcer') === '1' });
      return NextResponse.json({ tache, ...r }, { status: r.ok ? 200 : 500 });
    }
    return NextResponse.json({ ok: false, erreur: 'tache attendue : horaire ou quotidien' }, { status: 400 });
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    console.error(`[cron securite] ${tache} :`, erreur);
    return NextResponse.json({ ok: false, tache, erreur }, { status: 500 });
  }
}
