// POST /api/api-access/request
// Demande d'accès à l'API publique BRVM. Crée une ligne `pending` que l'admin
// approuve ou refuse. Aucune clé n'est délivrée ici.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

const MAX_LEN = { nom: 120, email: 160, organisation: 160, motif: 1000, site_url: 300 };

/** Champs requis + garde-fous de taille (pas de payload géant). */
function validate(body: Record<string, unknown>): { ok: true; data: Record<string, string | null> } | { ok: false; error: string } {
  const nom = String(body.nom ?? '').trim();
  const email = String(body.email ?? '').trim();
  const motif = String(body.motif ?? '').trim();
  const organisation = String(body.organisation ?? '').trim();
  const site_url = String(body.site_url ?? '').trim();

  if (!nom || !email || !motif) {
    return { ok: false, error: 'Nom, email et usage prévu sont obligatoires.' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Adresse email invalide.' };
  }
  if (
    nom.length > MAX_LEN.nom ||
    email.length > MAX_LEN.email ||
    motif.length > MAX_LEN.motif ||
    organisation.length > MAX_LEN.organisation ||
    site_url.length > MAX_LEN.site_url
  ) {
    return { ok: false, error: 'Un des champs dépasse la longueur autorisée.' };
  }

  return {
    ok: true,
    data: {
      nom,
      email,
      motif,
      organisation: organisation || null,
      site_url: site_url || null,
    },
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = getServiceClient();

  // Anti-abus : une seule demande en attente par email (évite le spam de la
  // file de modération ; une demande refusée ou révoquée peut être renouvelée).
  const { data: existing } = await db
    .from('api_clients')
    .select('id, statut')
    .eq('email', v.data.email as string)
    .in('statut', ['pending', 'active'])
    .maybeSingle();

  if (existing) {
    const statut = (existing as { statut: string }).statut;
    return NextResponse.json(
      {
        error:
          statut === 'active'
            ? 'Un accès est déjà actif pour cette adresse.'
            : 'Une demande est déjà en cours d’examen pour cette adresse.',
      },
      { status: 409 },
    );
  }

  const { error } = await db.from('api_clients').insert({ ...v.data, statut: 'pending' });
  if (error) {
    console.error('api-access/request :', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      'Demande enregistrée. Nous revenons vers vous par email après examen (généralement sous 48 h ouvrées).',
  });
}
