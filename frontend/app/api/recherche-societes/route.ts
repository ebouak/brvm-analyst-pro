import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { chargerInstantane } from '@/lib/server/rechercheDonnees';
import { reserverBudgetRecherche, stockageSupabase } from '@/lib/server/rechercheSocietesStore';
import { classerParJev } from '@/lib/recherche/jev';
import { hacherIdentifiant, validerRequete } from '@/lib/recherche/normaliser';
import { rechercher, type DepsRecherche } from '@/lib/recherche/orchestrer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUOTA_HEURE = 20;
const plafondJour = () => {
  const n = Number(process.env.RECHERCHE_JEV_PLAFOND_JOUR ?? 300);
  return Number.isInteger(n) && n >= 0 ? n : 300;
};

/** POST { q } → ReponseRecherche. Le texte de la requête n'est jamais journalisé. */
export async function POST(req: NextRequest) {
  let corps: unknown = null;
  try {
    corps = await req.json();
  } catch {
    corps = null;
  }
  const v = validerRequete((corps as { q?: unknown } | null)?.q);
  if (!v.ok) return Response.json({ erreur: v.erreur }, { status: 400 });

  const supabase = createClient();
  const deps: DepsRecherche = {
    instantane: () => chargerInstantane(),
    utilisateur: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? { id: user.id, email: user.email ?? null } : null;
    },
    eligible: async (u) => {
      const { data: profil } = await supabase.from('profiles').select('is_premium').eq('id', u.id).maybeSingle();
      const gate = await checkFeature('recherche_ia', { id: u.id, email: u.email, isPremium: Boolean(profil?.is_premium) }, { consume: false });
      return gate.allowed;
    },
    quota: async (u) =>
      (await checkRateLimit({ route: 'recherche-societes', ip: hacherIdentifiant(u.id), maxHits: QUOTA_HEURE, windowSeconds: 3600, failClosed: true })).allowed,
    stockage: stockageSupabase(),
    // Sans clé TypeSafe, ne rien réserver : chaque recherche brûlerait une unité du plafond pour rien.
    reserverBudget: () => (process.env.TYPESAFE_API_KEY ? reserverBudgetRecherche(plafondJour()) : Promise.resolve('erreur' as const)),
    jev: (q, instantane, signal) => classerParJev(q, instantane.fiches, signal),
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    journal: (evenement, details) => console.warn('[recherche-societes]', evenement, details ?? {}),
  };

  try {
    return Response.json(await rechercher(v.q, deps));
  } catch {
    console.error('[recherche-societes] erreur_interne');
    return Response.json({ erreur: 'interne' }, { status: 500 });
  }
}
