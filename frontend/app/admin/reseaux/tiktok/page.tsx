import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { creatorInfoTikTok, jetonTikTok } from '@/lib/server/social';
import PublierTikTok from '@/components/admin/PublierTikTok';
import type { CreatorInfo, TypeContenu } from '@/lib/social/tiktokRegles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Publier sur TikTok — Administration' };

interface Ligne {
  cible: string;
  cible_id: string;
  statut: string;
  erreur: string | null;
  lance_le: string;
  contenu: { type: TypeContenu; titre: string; description?: string; media: string[]; duree_s?: number | null } | null;
}

/**
 * Publications TikTok préparées par les workers (vidéo de séance, articles),
 * à valider une par une : TikTok exige ce geste explicite pour la publication
 * directe (Content Sharing Guidelines).
 */
export default async function PublierTikTokPage() {
  await requirePermission('content.publish');
  const db = getServiceClient();
  const { data, error } = await db
    .from('publications_sociales')
    .select('cible, cible_id, statut, erreur, lance_le, contenu')
    .eq('reseau', 'tiktok')
    .in('statut', ['a_valider', 'echec'])
    .order('lance_le', { ascending: false })
    .limit(20);
  const lignes = ((data ?? []) as Ligne[]).filter((l) => l.contenu?.media?.length);

  // Règle 1 : informations du compte relues à chaque affichage.
  let info: CreatorInfo | null = null;
  let probleme: string | null = null;
  const jeton = await jetonTikTok();
  if (!jeton.ok) probleme = jeton.raison;
  else {
    try {
      info = await creatorInfoTikTok(jeton.token);
    } catch (e) {
      probleme = `Le compte TikTok ne peut pas publier pour l’instant (${(e as Error).message}). Réessayez plus tard.`;
    }
  }

  return (
    <div className="max-w-5xl space-y-5 p-6">
      <div>
        <Link href="/admin/reseaux" className="text-xs text-faint hover:text-accent">
          ← Réseaux sociaux
        </Link>
        <h1 className="mt-1 font-display text-xl text-white">Publier sur TikTok</h1>
        <p className="mt-1 text-sm text-muted">
          Les vidéos de séance et les articles publiés arrivent ici, prêts. Chaque publication part après votre choix : visibilité,
          interactions, déclaration commerciale.
        </p>
      </div>
      {error && <p className="rounded-lg border border-down/40 p-3 text-sm text-down">Migration 0171 non appliquée.</p>}
      {probleme && <p className="rounded-lg border border-down/40 p-3 text-sm text-down">{probleme}</p>}
      {lignes.length === 0 ? (
        <p className="text-sm text-faint">Aucune publication en attente.</p>
      ) : (
        info &&
        lignes.map((l) => (
          <div key={`${l.cible}-${l.cible_id}`} className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-faint">
              {l.cible === 'video' ? `Vidéo de séance du ${l.cible_id}` : 'Article'}
              {l.statut === 'echec' && l.erreur ? <span className="ml-2 normal-case text-down">Échec précédent : {l.erreur}</span> : null}
            </p>
            <PublierTikTok
              cible={l.cible}
              cibleId={l.cible_id}
              type={l.contenu!.type}
              media={l.contenu!.media}
              titre={l.contenu!.titre}
              description={l.contenu!.description ?? ''}
              dureeS={l.contenu!.duree_s ?? null}
              info={info}
            />
          </div>
        ))
      )}
    </div>
  );
}
