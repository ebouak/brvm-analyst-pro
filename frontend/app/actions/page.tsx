import { createPublicClient } from '@/lib/supabase/public';
import { fetchAllRows } from '@/lib/supabase/paginate';
import ActionsTable from '@/components/ActionsTable';
import brvmSectors from '@/lib/brvmSectors.json';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { EmptyStatePremium, PremiumPanel, PremiumCTA } from '@/components/ui/premium';
import { canAccess } from '@/lib/server/featureAccess';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';
import { Chapitre } from '@/components/fiche/Chapitre';

// Les COURS restent publics. Seules les colonnes CALCULÉES (Tendance 30 j, Signal)
// sont soumises au flag `actions_metrics`. Rendu dynamique : le contenu dépend
// désormais de l'utilisateur, un cache partagé servirait la version premium à tous.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marché actions' };

/**
 * `withMetrics` : charge-t-on les colonnes CALCULÉES (signaux, tendance 30 j) ?
 *
 * Quand l'accès est refusé, on ne les interroge même PAS. Le verrou n'est donc pas
 * un masque visuel : la donnée n'existe nulle part dans la page envoyée au
 * navigateur. Effet de bord bienvenu : deux requêtes de moins pour un visiteur
 * gratuit — dont l'historique complet des cours, qui est la plus lourde.
 */
async function getData(withMetrics: boolean) {
  const supabase = createPublicClient();
  // Une panne de lecture n'est PAS une base vide : sans cette distinction,
  // l'état vide promettrait des cours « dès la prochaine séance » alors que
  // la séance est en base et simplement illisible.
  const vide = { lastDate: null, actions: [] as ActionDaily[], signals: {} as Record<string, SignalDaily>, sparklines: {} as Record<string, number[]> };
  const { data: lastRow, error: lastError } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  if (lastError) return { ...vide, erreur: true };
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { ...vide, erreur: false };

  const [{ data: actions, error: actionsError }, { data: signals }, { data: instruments }] = await Promise.all([
    supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
    withMetrics
      ? supabase.from('signals_daily').select('*').eq('date_marche', lastDate)
      : Promise.resolve({ data: null }),
    supabase.from('brvm_instruments').select('code, secteur, pays').eq('type', 'action'),
  ]);
  // La séance existe mais ses lignes sont illisibles : afficher un tableau
  // vide sous « 0 valeurs » serait une affirmation fausse.
  if (actionsError) return { ...vide, erreur: true };

  // Secteur : classification fiable brvmSectors.json (GICS par ticker, comme la
  // heatmap) en priorité, car brvm_instruments.secteur est quasi vide (1/48).
  const sectorByCode = brvmSectors as Record<string, string>;
  const instrMap: Record<string, { secteur: string | null; pays: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur: string | null; pays: string | null }[]) {
    instrMap[i.code] = { secteur: i.secteur, pays: i.pays };
  }
  const enrichedActions = ((actions ?? []) as ActionDaily[]).map((a) => ({
    ...a,
    secteur: sectorByCode[a.code] ?? instrMap[a.code]?.secteur ?? a.secteur ?? null,
    pays: instrMap[a.code]?.pays ?? a.pays ?? null,
  }));

  const sigMap: Record<string, SignalDaily> = {};
  for (const s of (signals ?? []) as SignalDaily[]) sigMap[s.code] = s;

  // ── Sparklines : ~30 dernières séances de cours par titre (colonne Tendance 30j) ──
  // Non chargées sans droit : c'est la requête la plus lourde de la page.
  const sparklines: Record<string, number[]> = {};
  if (withMetrics) {
    const since = new Date(lastDate);
    since.setDate(since.getDate() - 50);
    const sinceIso = since.toISOString().slice(0, 10);
    // Paginé : 50 j × ~48 titres ≈ 2 400 lignes. Le tri ascendant tronquait aux
    // ~20 séances les plus vieilles, et la « tendance 30 j » montrait le début de
    // la fenêtre en ratant les séances récentes — l'inverse de son intitulé.
    const hist = await fetchAllRows<{ code: string; date_marche: string; cours_jour: number | null }>(
      (from, to) => supabase
        .from('brvm_actions_daily')
        .select('code, date_marche, cours_jour')
        .gte('date_marche', sinceIso)
        .lte('date_marche', lastDate)
        .order('date_marche', { ascending: true })
        .range(from, to),
    );
    for (const r of hist as { code: string; cours_jour: number | null }[]) {
      if (r.cours_jour == null) continue;
      (sparklines[r.code] ??= []).push(r.cours_jour);
    }
    for (const k of Object.keys(sparklines)) sparklines[k] = sparklines[k]!.slice(-30);
  }

  return {
    lastDate,
    actions: enrichedActions,
    signals: sigMap,
    sparklines,
    erreur: false,
  };
}

/**
 * « 2026-11-03 » → « 3 nov. 2026 ». Affichage seulement : la donnée reste l'ISO
 * (portée par `dateTime`). En UTC : une date seule interprétée en heure locale
 * reculerait d'un jour à l'ouest de Greenwich.
 */
function fmtSeance(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default async function ActionsPage({ searchParams }: { searchParams?: { secteur?: string } }) {
  // Niveau requis LU EN BASE (feature_flags → `actions_metrics`, éditable dans
  // /admin/features). Les cours restent publics ; seules les colonnes calculées
  // sont soumises au flag.
  const gate = await canAccess('actions_metrics');
  const { lastDate, actions, signals, sparklines, erreur } = await getData(gate.allowed);
  const initialSecteur = searchParams?.secteur ?? '';

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <EnTeteCote
          titre="Marché actions"
          description="Cours, variation, volume et valeur échangée de chaque action cotée à la BRVM."
          source={null}
        />
        <div className="mt-8">
          {erreur ? (
            <EmptyStatePremium
              title="Les cours n'ont pas pu être chargés"
              hint="Réessayez dans un instant."
            />
          ) : (
            <EmptyStatePremium
              title="Aucune séance disponible"
              hint="Les cours apparaîtront ici dès la publication de la prochaine séance."
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Date et compte tirés de la donnée : `date_marche` de la dernière
          séance et nombre de lignes de cette séance (avant filtre). */}
      <EnTeteCote
        titre="Marché actions"
        description="Cours, variation, volume et valeur échangée de chaque action cotée à la BRVM."
        seance={lastDate}
        compte={{ n: actions.length, libelle: 'valeurs' }}
        actions={
          <PremiumCTA href="/actions/compare" variant="ghost">
            Comparer des titres
          </PremiumCTA>
        }
      />

      <Chapitre
        id="cote"
        numero="01"
        titre="La cote du jour"
        sousTitre="Filtrez par secteur, triez par colonne ; le code d'une valeur ouvre sa fiche."
        premier
      />
      <div className="mt-6">
        <PremiumPanel>
          <ActionsTable
            actions={actions}
            signals={signals}
            sparklines={sparklines}
            initialSecteur={initialSecteur}
            showMetrics={gate.allowed}
          />
        </PremiumPanel>
        {/* Pied de cote : d'où viennent les chiffres et ce qu'ils mesurent.
            Pas « cours de clôture » : en séance, la ligne du jour est mise à
            jour par la collecte intraday et n'est pas encore une clôture. */}
        <LigneSource>
          Cours publiés par la BRVM, séance du{' '}
          <time dateTime={lastDate}>{fmtSeance(lastDate)}</time>
          {' '}· variation par rapport au cours précédent · volume en titres, valeur échangée en FCFA
        </LigneSource>
      </div>
    </div>
  );
}
