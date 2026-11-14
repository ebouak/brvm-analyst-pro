// POST /api/cron/dossier-instantane?code=NEIC
//
// Fige les mesures de l'édition en cours du dossier valeur d'UNE société dans
// `dossier_instantanes` (migration 0231). Appelée par .github/workflows/dossier.yml
// pour chaque code, AVANT l'impression des PDF : l'encadré « Depuis la dernière
// édition » compare l'édition courante à la STRICTEMENT antérieure.
//
// INSERT SEUL. `ignoreDuplicates` sur (code, edition) : relancer le workflow à la
// main — ou deux fois dans la même semaine — ne réécrit JAMAIS une édition déjà
// figée. L'édition est la date de la dernière SÉANCE cotée, pas la date du
// calcul : deux passages entre deux séances décrivent la même édition.
//
// Auth : `Authorization: Bearer ${CRON_SECRET}`, comparé à temps constant
// (lib/server/cronAuth). Jamais en query string : une URL finit dans les
// journaux d'accès. Un code par appel, comme dossier-polish : un lot qui
// échoue à mi-course laisserait des codes sans instantané sans que le journal
// le dise.
import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { chargerContexteQuant } from '@/lib/diagnostic/contexteQuant';
import { buildDossier } from '@/lib/dossier/build';
import { mesuresDuDossier, VERSION_MESURES } from '@/lib/dossier/instantane';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!cronAutorise(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const code = new URL(req.url).searchParams.get('code')?.toUpperCase().trim();
  if (!code || !/^[A-Z0-9]{2,8}$/.test(code)) {
    return NextResponse.json({ error: 'Paramètre « code » absent ou invalide.' }, { status: 400 });
  }

  const admin = getServiceClient();
  /* Mêmes médianes que la page : sans elles le pilier « valorisation » serait
     non mesurable ici et mesurable à la lecture, et chaque édition afficherait
     un faux « pilier changé ». */
  const { medianes } = await chargerContexteQuant(admin, code);
  const dossier = await buildDossier(admin, code, { medianes });
  if (!dossier) return NextResponse.json({ code, error: 'Instrument inconnu.' }, { status: 404 });

  const edition = dossier.chiffres_cles.date_cours;
  if (!edition) {
    // Aucune cotation : il n'y a pas de séance de référence, donc pas d'édition à figer.
    return NextResponse.json({ code, statut: 'ignoré', raison: 'aucune séance cotée' });
  }

  const { data, error } = await admin
    .from('dossier_instantanes')
    .upsert(
      { code, edition, version: VERSION_MESURES, mesures: mesuresDuDossier(dossier) },
      { onConflict: 'code,edition', ignoreDuplicates: true },
    )
    .select('code');
  if (error) return NextResponse.json({ code, error: error.message }, { status: 500 });

  // `ignoreDuplicates` ne renvoie aucune ligne quand l'édition existe déjà.
  return NextResponse.json({ code, edition, statut: (data ?? []).length > 0 ? 'figé' : 'déjà figé' });
}
