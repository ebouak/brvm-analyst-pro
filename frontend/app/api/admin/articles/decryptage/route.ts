import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { chargerContexteQuant } from '@/lib/diagnostic/contexteQuant';
import { buildDossier } from '@/lib/dossier/build';
import { construireNarratif } from '@/lib/dossier/narratif';
import { composerDecryptage, type FaitRecent } from '@/lib/articles/decryptage';
import { nomDit } from '@/lib/articles/noms';

export const dynamic = 'force-dynamic';

/**
 * Génère le décryptage d'une valeur (skill thesis-tracker) depuis le dossier
 * valeur. Toujours en statut `a_valider` : c'est un article d'analyse, il ne
 * part qu'après validation humaine dans /admin/articles.
 */
export async function POST(req: NextRequest) {
  await requirePermission('content.publish');
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3,6}$/.test(code)) return NextResponse.json({ error: 'Code de valeur invalide.' }, { status: 400 });

  const sb = getServiceClient();
  const medianes = (await chargerContexteQuant(sb, code).catch(() => null))?.medianes ?? null;
  const dossier = await buildDossier(sb, code, { medianes });
  if (!dossier) return NextResponse.json({ error: 'Valeur inconnue.' }, { status: 404 });

  const [{ data: faits }, { data: instruments }] = await Promise.all([
    sb.from('articles').select('slug,titre,type,date_fait').eq('code', code).eq('statut', 'publie')
      .neq('type', 'decryptage').order('date_fait', { ascending: false }).limit(5),
    sb.from('brvm_instruments').select('designation').eq('type', 'action'),
  ]);
  const toutes = ((instruments ?? []) as { designation: string }[]).map((i) => i.designation);
  const nom = nomDit(dossier.identite.designation ?? code, toutes);
  const a = composerDecryptage(dossier, construireNarratif(dossier), (faits ?? []) as FaitRecent[], nom, new Date().toISOString());

  // Un décryptage déjà publié ce jour n'est pas remplacé en silence.
  const { data: existant } = await sb.from('articles').select('statut').eq('fait', a.fait).maybeSingle();
  if (existant?.statut === 'publie') {
    return NextResponse.json({ error: 'Un décryptage de cette valeur est déjà publié aujourd’hui.' }, { status: 409 });
  }
  const { error } = await sb.from('articles').upsert(
    {
      slug: a.slug,
      type: 'decryptage',
      code,
      fait: a.fait,
      statut: 'a_valider',
      titre: a.titre,
      chapo: a.chapo,
      corps_md: a.corps_md,
      chiffres: a.chiffres,
      sources: a.sources,
      raison_blocage: null,
      date_fait: a.date_fait,
      publie_le: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'fait' },
  );
  if (error) return NextResponse.json({ error: `Échec : ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, slug: a.slug, titre: a.titre });
}
