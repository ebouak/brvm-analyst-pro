import Link from 'next/link';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import { createClient } from '@/lib/supabase/server';
import FreshnessBadge from '@/components/FreshnessBadge';
import { computeFreshness } from '@/lib/freshness';
import { loadFreshnessInputs } from '@/lib/freshness/queries';
import DashboardTicker, { type TickerLine } from '@/components/dashboard/DashboardTicker';
import FavoriteSectors from '@/components/dashboard/FavoriteSectors';
import { chargerProfil } from '@/lib/dashboard/profil';
import { resolveLayout, grouperEnRangees, classeRangee, classeCellule, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';
import type { PortfolioState } from '@/lib/portfolio/derive';
import { construireAgenda, plusJours, HORIZON_JOURS } from '@/lib/dashboard/agenda';
import { performanceJour } from '@/lib/dashboard/performanceJour';
import { metriquesDepuisSeance, estSeanceClose, INDICES_SECTORIELS } from '@/lib/dashboard/metriquesSeance';
import { preparerPublications } from '@/lib/dashboard/publications';
import { detaillerAlertes, depuisAlertesRecentes, ALERTES_RECENTES_JOURS, type AlerteDeclenchee } from '@/lib/dashboard/alertes';
import { lignesPerfDepuis, variationsDuJour } from '@/lib/dashboard/portefeuilleBloc';
import { chargerPortefeuille, chargerDividendes, chargerFermetures, chargerPublications, chargerLiquidite, chargerTrajectoires, chargerCompteSignaux, chargerActualites, chargerAfrique, chargerCompteMotifs } from '@/lib/dashboard/chargement';
import { titreSeance, chapoSeance } from '@/lib/dashboard/recit';
import Ouverture, { fmtIndice, fmtMd, type Chiffre } from '@/components/dashboard/surface/Ouverture';
import { GrilleInterne, Cellule, Bloc, TeteBloc } from '@/components/dashboard/surface/Grille';
import Trajectoire from '@/components/dashboard/surface/Trajectoire';
import LargeurMoteur from '@/components/dashboard/surface/LargeurMoteur';
import Mouvements from '@/components/dashboard/surface/Mouvements';
import Secteurs from '@/components/dashboard/surface/Secteurs';
import SignauxRecents from '@/components/dashboard/surface/SignauxRecents';
import Actualites from '@/components/dashboard/surface/Actualites';
import Motifs from '@/components/dashboard/surface/Motifs';
import Afrique from '@/components/dashboard/surface/Afrique';
import PastilleSeance from '@/components/dashboard/surface/PastilleSeance';
import BlocComprendre from '@/components/dashboard/blocs/BlocComprendre';
import BlocAgenda from '@/components/dashboard/blocs/BlocAgenda';
import BlocPublications from '@/components/dashboard/blocs/BlocPublications';
import BlocLiquidite from '@/components/dashboard/blocs/BlocLiquidite';
import BlocPortefeuille from '@/components/dashboard/blocs/BlocPortefeuille';
import { PremiumLock } from '@/components/dashboard/PremiumLock';
import { MacroBanner } from '@/components/MacroBanner';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import type { ActionDaily, IndiceDaily, SignalDaily } from '@/lib/types';
import CarnetCommentaire from '@/components/CarnetCommentaire';
import type { CarnetSeance as CarnetVedette } from '@/lib/carnet/commentaire';
import { canAccess } from '@/lib/server/featureAccess';
import {
  SectionHeader,
  EmptyStatePremium,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

async function getData() {
  const supabase = createClient();

  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [], indices: [], signals: [], sparklines: {} as Record<string, number[]>, summary: null as MarketSummaryRow | null, summaryPrev: null as MarketSummaryRow | null, ticker: [] as TickerLine[] };

  // Date précédente pour le delta volume
  const { data: prevDateRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .lt('date_marche', lastDate)
    .order('date_marche', { ascending: false })
    .limit(1);
  const prevDate = prevDateRow?.[0]?.date_marche ?? null;

  // Les indices ne sont pas toujours scrapés à la même date que les cours.
  const { data: lastIdxRow } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .not('valeur', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastIdxDate = lastIdxRow?.[0]?.date_marche ?? lastDate;

  const [{ data: actions }, { data: indices }, { data: signals }, { data: summaryRows }] =
    await Promise.all([
      supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
      supabase.from('brvm_indices_daily').select('*').eq('date_marche', lastIdxDate),
      supabase
        .from('signals_daily')
        .select('code, signal, confiance, explication, score_total, date_marche')
        .eq('date_marche', lastDate)
        .neq('signal', 'HOLD')
        .order('confiance', { ascending: false })
        .limit(6),
      // Résumés de CES deux séances (et non « les deux derniers ») : un résumé
      // d'une autre séance comparé aux cours du jour serait incohérent.
      supabase
        .from('brvm_market_summary')
        .select('date_marche, valeur_transactions, capitalisation_actions, capitalisation_obligations')
        .in('date_marche', prevDate ? [lastDate, prevDate] : [lastDate]),
    ]);
  const resumes = (summaryRows ?? []) as MarketSummaryRow[];
  const summary = resumes.find((r) => r.date_marche === lastDate) ?? null;
  const summaryPrev = prevDate ? resumes.find((r) => r.date_marche === prevDate) ?? null : null;

  const typedActions = (actions ?? []) as ActionDaily[];
  const typedIndices = (indices ?? []) as IndiceDaily[];
  const typedSignals = (signals ?? []) as SignalDaily[];

  // Valeur commentée du jour : celle qui porte le signal le plus assuré, à
  // défaut la plus échangée de la séance. Aucune des deux n'est un conseil —
  // c'est simplement la valeur dont il y a le plus à dire.
  const vedetteCode =
    typedSignals[0]?.code ??
    [...typedActions].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0))[0]?.code ??
    null;

  const [{ data: carnetVedette }, { data: actusVedette }] = vedetteCode
    ? await Promise.all([
        supabase
          .from('brvm_carnet_daily')
          .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, cours_reference')
          .eq('code', vedetteCode)
          .order('date_marche', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('brvm_news')
          .select('titre, date_publication')
          .not('hidden', 'is', true) // modération rédactionnelle
          .eq('instrument_code', vedetteCode)
          .lte('date_publication', new Date().toISOString().slice(0, 10))
          .order('date_publication', { ascending: false })
          .limit(2),
      ])
    : [{ data: null }, { data: null }];

  const vedette = vedetteCode
    ? {
        code: vedetteCode,
        carnet: (carnetVedette ?? null) as CarnetVedette | null,
        signal: typedSignals[0]
          ? {
              date_marche: typedSignals[0].date_marche,
              signal: typedSignals[0].signal,
              confiance: typedSignals[0].confiance ?? null,
              score_total: (typedSignals[0] as { score_total?: number | null }).score_total ?? null,
              explication: (typedSignals[0] as { explication?: string | null }).explication ?? null,
              sousScores: (() => {
                const s = typedSignals[0] as unknown as Record<string, unknown>;
                const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null);
                return { variation: n('score_variation'), volume: n('score_volume'), rsi: n('score_rsi'), macd: n('score_macd'), tendance: n('bonus_tendance') };
              })(),
            }
          : null,
        // Les capitaux de la séance : l'étalon qui empêche de lire un reliquat
        // de carnet comme un rapport de force.
        valeurEchangee: typedActions.find((a) => a.code === vedetteCode)?.valeur_echangee ?? null,
        actualites: (actusVedette ?? []) as { titre: string; date_publication: string }[],
      }
    : null;

  // Historique cours (20 dernières séances) pour tous les codes — sparklines des mouvements
  const { data: histRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false })
    // PostgREST tronque en silence à 1000 lignes : on plafonne explicitement.
    .limit(Math.min(1000, 20 * (typedActions.length || NB_SOCIETES_COTEES))); // 20 séances × le nombre réel de valeurs cotées

  const sparklines: Record<string, number[]> = {};
  for (const row of (histRows ?? []) as { code: string; cours_jour: number; date_marche: string }[]) {
    (sparklines[row.code] ??= []).push(row.cours_jour);
  }
  // reverse: on a trié desc → on remet chronologique
  for (const k of Object.keys(sparklines)) sparklines[k]!.reverse();

  // Ticker permanent : actions + obligations de la dernière séance disponible
  const { data: oblRows } = await supabase
    .from('brvm_obligations_daily')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(80);
  const oblLatest = oblRows && oblRows.length > 0 ? (oblRows[0] as Record<string, unknown>).date_marche : null;
  const obligations = ((oblRows ?? []) as Record<string, unknown>[]).filter((o) => o.date_marche === oblLatest);

  const nfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  const ticker: TickerLine[] = [
    ...typedActions
      .filter((a) => a.cours_jour != null)
      .map((a) => ({ code: a.code, value: nfmt(a.cours_jour as number), variation: a.variation_pct ?? null, kind: 'action' as const, spark: sparklines[a.code]?.slice(-7), cours: a.cours_jour as number })),
    ...obligations
      .filter((o) => o.cours_jour != null)
      .map((o) => {
        const cours = o.cours_jour as number;
        const prev = (o.cours_precedent ?? null) as number | null;
        const variation =
          (o.variation_pct as number | null) ?? (prev != null && prev > 0 ? ((cours - prev) / prev) * 100 : null);
        return { code: String(o.code), value: nfmt(cours), variation, kind: 'obligation' as const };
      }),
  ];

  return {
    vedette,
    lastDate,
    actions: typedActions,
    indices: typedIndices,
    signals: typedSignals,
    sparklines,
    summary,
    summaryPrev,
    ticker,
  };
}

interface MarketSummaryRow {
  date_marche: string;
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
}

export default async function Dashboard() {
  const { lastDate, actions, indices, signals, sparklines, summary, summaryPrev, ticker, vedette } = await getData();

  // Fraîcheur des cours — affichée au-dessus du ticker permanent.
  // `lecture_seance` verrouille l'encart « Ce que dit la séance · CODE » plus bas :
  // vérifié ici, en parallèle, pour ne pas ajouter d'aller-retour dédié.
  const [fIn, gateLectureSeance] = await Promise.all([
    loadFreshnessInputs(),
    canAccess('lecture_seance'),
  ]);
  const fraicheurCours = computeFreshness(fIn.derniereCollecte, fIn.derniereSeance, new Date());

  // Secteurs favoris de l'utilisateur (paramétrage intelligent).
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  let favoriteSectors: string[] = [];
  let dashboardLayout: DashboardLayout | null = null;
  let triggeredAlerts = 0;
  let alertesBrutes: AlerteDeclenchee[] = [];
  let profil: Profil = 'debutant';
  // Un visiteur non connecté est traité comme non-premium. Les sections premium
  // sont montrées mais verrouillées : on donne envie plutôt que de cacher.
  let isPremium = false;
  if (user) {
    const [{ data: prof }, { data: alertesDeclenchees, count }, profilCharge] = await Promise.all([
      supa.from('profiles').select('favorite_sectors, preferences, is_premium').eq('id', user.id).maybeSingle(),
      supa
        .from('alerts')
        .select('code, type, seuil, declenchee_le', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('actif', true)
        .gte('declenchee_le', depuisAlertesRecentes(new Date()))
        .order('declenchee_le', { ascending: false })
        .limit(10),
      chargerProfil(supa, user.id),
    ]);
    favoriteSectors = (prof?.favorite_sectors as string[] | null) ?? [];
    dashboardLayout = ((prof?.preferences as Record<string, unknown> | null)?.dashboard as DashboardLayout) ?? null;
    isPremium = Boolean(prof?.is_premium);

    triggeredAlerts = count ?? 0;
    alertesBrutes = (alertesDeclenchees as AlerteDeclenchee[] | null) ?? [];
    profil = profilCharge;
  }
  const layout = resolveLayout(dashboardLayout, profil);

  /* ── État vide premium ──────────────────────────────────────────────────── */
  if (!lastDate) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <SectionHeader
            kicker="Tableau de bord"
            title="Marché BRVM"
            subtitle="Bourse Régionale des Valeurs Mobilières · UEMOA"
          />
          <EmptyStatePremium
            icon="◈"
            title="Aucune donnée de séance"
            hint="Lancez le scraper pour alimenter la base de données de marché."
            action={{ href: '/actions', label: 'Actualiser' }}
          />
        </div>
      </div>
    );
  }

  const withVar = actions.filter((a) => a.variation_pct != null);
  const gainers = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 5);
  const losers  = [...withVar].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 5);

  const dateLabel = new Date(lastDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Blocs adaptatifs : on ne lit que ce que le layout affiche ──────────────
  const aujourdhui = new Date().toISOString().slice(0, 10); // Abidjan = UTC+0
  const veut = (k: WidgetKey) => layout.includes(k);
  const besoinPortefeuille = veut('portefeuille') || veut('agenda') || veut('publications') || veut('liquidite');
  const finAgenda = plusJours(aujourdhui, HORIZON_JOURS);
  const depuisPublications = plusJours(aujourdhui, -7);
  const [resultatPortefeuille, dividendes, fermetures, publicationsBrutes, liquidite, trajectoires, compteSignaux, actualites, afrique, compteMotifs] = await Promise.all([
    user && besoinPortefeuille
      ? chargerPortefeuille(supa, user.id, aujourdhui)
      : Promise.resolve<{ etat: PortfolioState; depuis: string } | null | undefined>(undefined),
    veut('agenda') ? chargerDividendes(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('agenda') ? chargerFermetures(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('publications') ? chargerPublications(supa, depuisPublications) : Promise.resolve([]),
    veut('liquidite') ? chargerLiquidite(supa) : Promise.resolve(null),
    veut('seance') ? chargerTrajectoires(supa, indices[0]?.date_marche ?? lastDate) : Promise.resolve(null),
    veut('seance') ? chargerCompteSignaux(supa, lastDate) : Promise.resolve(null),
    veut('actus') ? chargerActualites(supa, aujourdhui) : Promise.resolve(null),
    veut('actus') ? chargerAfrique(supa) : Promise.resolve(null),
    veut('actus') ? chargerCompteMotifs(supa, lastDate) : Promise.resolve(null),
  ]);
  // `undefined` = visiteur, `null` = lecture en erreur.
  const etatPortefeuille: PortfolioState | null | undefined = resultatPortefeuille ? resultatPortefeuille.etat : resultatPortefeuille;
  const portefeuilleIndisponible = !!user && besoinPortefeuille && resultatPortefeuille === null;
  const debutCourbe = resultatPortefeuille?.depuis ?? null;
  const titresDetenus = (etatPortefeuille?.positions ?? []).filter((p) => !p.isLiquidites);
  // Plusieurs lots d'un même titre : quantités ADDITIONNÉES par code.
  const quantites = new Map<string, number>();
  for (const p of titresDetenus) {
    const c = p.code.trim().toUpperCase();
    quantites.set(c, (quantites.get(c) ?? 0) + p.quantite);
  }
  const agenda = dividendes === null || fermetures === null
    ? null
    : construireAgenda({
        aujourdhui,
        dividendes,
        assemblees: [], // spec §4.1 : vide tant qu'aucune date de RÉUNION n'est collectée
        fermetures,
        positions: titresDetenus.map((p) => ({ code: p.code, quantite: p.quantite })),
      });
  const publications = publicationsBrutes === null ? null : preparerPublications(publicationsBrutes, new Set(quantites.keys()));
  const coursSeance = actions.map((a) => ({ code: a.code, cours_jour: a.cours_jour, variation_pct: a.variation_pct, date_marche: a.date_marche }));
  const variationsJour = variationsDuJour(coursSeance, lastDate);
  const detailAlertes = detaillerAlertes(alertesBrutes);
  const brvmc = indices.find((i) => i.code === 'BRVMC');
  const perf = etatPortefeuille
    ? performanceJour(
        lignesPerfDepuis(etatPortefeuille.positions, coursSeance, lastDate),
        brvmc ? { variationPct: brvmc.variation_pct, dateMarche: brvmc.date_marche } : null,
      )
    : null;
  const metriques = metriquesDepuisSeance({
    dateMarche: lastDate,
    actions,
    indices,
    valeurTransactions: summary?.valeur_transactions ?? null,
    valeurTransactionsVeille: summaryPrev?.valeur_transactions ?? null,
  });
  const seanceClose = estSeanceClose(lastDate, new Date());

  const secteursJour = indices
    .filter((i) => i.date_marche === lastDate && INDICES_SECTORIELS.includes(i.code) && i.variation_pct != null)
    .map((i) => ({ code: i.code, nom: (i.libelle ?? i.code).replace(/^BRVM\s*-\s*/i, ''), variation: Number(i.variation_pct) }));
  const meneurSecteur = [...secteursJour].sort((a, b) => b.variation - a.variation)[0] ?? null;
  const versLigne = (a: ActionDaily) => ({ code: a.code, nom: a.designation?.trim() || a.code, cours: a.cours_jour, variation: a.variation_pct, serie: sparklines[a.code] ?? [] });
  // Indices publiés à une autre séance que les cours : ignorés (affichés « — »).
  const memeSeance = (c: string) => indices.find((i) => i.code === c && i.date_marche === lastDate);
  const brvmcJour = memeSeance('BRVMC');
  const prestige = memeSeance('BRVMPRES');
  const b30 = memeSeance('BRVM30');
  const varCap = summary?.capitalisation_actions != null && summaryPrev?.capitalisation_actions ? (summary.capitalisation_actions / summaryPrev.capitalisation_actions - 1) * 100 : null;
  const varValeur = summary?.valeur_transactions != null && summaryPrev?.valeur_transactions ? (summary.valeur_transactions / summaryPrev.valeur_transactions - 1) * 100 : null;
  const titresEchanges = actions.reduce((t, a) => t + (a.volume ?? 0), 0);
  const chiffres: Chiffre[] = [
    { libelle: 'BRVM Composite', valeur: fmtIndice(brvmcJour?.valeur ?? null), variation: brvmcJour?.variation_pct ?? null },
    { libelle: 'BRVM 30', valeur: fmtIndice(b30?.valeur ?? null), variation: b30?.variation_pct ?? null },
    { libelle: 'BRVM Prestige', valeur: fmtIndice(prestige?.valeur ?? null), variation: prestige?.variation_pct ?? null },
    { libelle: 'Valeur échangée', valeur: fmtMd(summary?.valeur_transactions ?? null), variation: varValeur, note: 'vs veille' },
    { libelle: 'Capitalisation actions', valeur: fmtMd(summary?.capitalisation_actions ?? null), variation: varCap, note: 'vs veille' },
    { libelle: 'Titres échangés', valeur: actions.some((a) => a.volume != null) ? fmtNumber(titresEchanges, 0) : '—', variation: null, note: `${actions.length} valeurs cotées` },
  ];

  // Widgets configurables (ordre + visibilité pilotés par le layout utilisateur).
  const sections: Record<WidgetKey, React.ReactNode> = {
    secteurs: user ? (
      <Bloc id="t-favoris">
        <TeteBloc id="t-favoris" titre="Vos secteurs" droite={<Link href="/profil" className="text-xs text-accent-ink hover:underline">Choisir</Link>} />
        <FavoriteSectors favorites={favoriteSectors} />
      </Bloc>
    ) : null,
    etat: (
      <Ouverture
        dateMarche={lastDate}
        titre={titreSeance(metriques.hausses, metriques.baisses)}
        chapo={chapoSeance({
          composite: metriques.composite,
          meneur: meneurSecteur ? { code: meneurSecteur.code, variationPct: meneurSecteur.variation } : null,
          valeurEchangee: summary?.valeur_transactions ?? null,
          valeurEchangeeVeille: summaryPrev?.valeur_transactions ?? null,
        })}
        chiffres={chiffres}
      />
    ),
    seance: (
      <GrilleInterne>
        <Cellule span={8}>{trajectoires
          ? <Trajectoire series={trajectoires} jour={{ BRVMC: brvmcJour?.variation_pct ?? null, BRVM30: b30?.variation_pct ?? null }} />
          : <Bloc id="t-traj"><TeteBloc id="t-traj" titre="Trajectoire des indices" /><p className="text-sm text-muted">Trajectoire momentanément indisponible.</p></Bloc>}</Cellule>
        <Cellule span={4}><LargeurMoteur hausses={metriques.hausses} baisses={metriques.baisses} stables={metriques.stables} signaux={compteSignaux} /></Cellule>
      </GrilleInterne>
    ),
    indices: (
      <GrilleInterne>
        <Cellule span={4}><Mouvements id="t-hausses" titre="Plus fortes hausses" lignes={gainers.map(versLigne)} /></Cellule>
        <Cellule span={4}><Mouvements id="t-baisses" titre="Plus fortes baisses" lignes={losers.map(versLigne)} /></Cellule>
        <Cellule span={4}><Secteurs secteurs={secteursJour} /></Cellule>
      </GrilleInterne>
    ),
    signaux: (() => {
      // Verrou `lecture_seance` fermé : le bloc « Ce que dit la séance » est
      // absent (aucun cadenas de plus) et les signaux prennent toute la largeur,
      // pour ne jamais laisser de cellule vide.
      const carnet = vedette && gateLectureSeance.allowed ? vedette : null;
      const signauxBloc = isPremium ? <SignauxRecents signaux={signals as SignalDaily[]} /> : (
        <Bloc id="t-signaux-lock">
          <TeteBloc id="t-signaux-lock" titre="Signaux d'opportunité" />
          <PremiumLock title="Signaux d'achat et de vente réservés au Premium" pitch="Les signaux notés A–F, avec leur explication, sont inclus dans l'abonnement Premium." rows={3} />
        </Bloc>
      );
      return (
        <GrilleInterne>
          {carnet && (
            <Cellule span={6}>
              <Bloc id="t-carnet">
                <TeteBloc id="t-carnet" titre={`Ce que dit la séance · ${carnet.code}`} droite={<Link href={`/actions/${carnet.code}`} className="text-xs text-accent-ink hover:underline">Voir la fiche</Link>} />
                <CarnetCommentaire carnet={carnet.carnet} signal={carnet.signal} actualites={carnet.actualites} contexte={{ valeurEchangee: carnet.valeurEchangee }} compact />
              </Bloc>
            </Cellule>
          )}
          <Cellule span={carnet ? 6 : 12}>{signauxBloc}</Cellule>
        </GrilleInterne>
      );
    })(),
    actus: (
      <GrilleInterne>
        <Cellule span={4}><Actualites items={actualites} /></Cellule>
        <Cellule span={4}><Motifs premium={isPremium} compte={compteMotifs} date={lastDate} /></Cellule>
        <Cellule span={4}><Afrique indices={afrique} composite={{ valeur: brvmcJour?.valeur ?? null, variation: brvmcJour?.variation_pct ?? null }} dateSeance={lastDate} /></Cellule>
      </GrilleInterne>
    ),
    portefeuille: (
      <BlocPortefeuille etat={etatPortefeuille} debutCourbe={debutCourbe} perf={perf} variations={variationsJour} />
    ),
    comprendre: <BlocComprendre metriques={metriques} close={seanceClose} />,
    agenda: <BlocAgenda items={agenda} aujourdhui={aujourdhui} quantites={Object.fromEntries(quantites)} portefeuilleIndisponible={portefeuilleIndisponible} />,
    publications: <BlocPublications items={publications} depuis={depuisPublications} portefeuilleIndisponible={portefeuilleIndisponible} />,
    liquidite: (
      <BlocLiquidite
        donnees={liquidite}
        positions={titresDetenus.map((p) => ({ code: p.code, valeur: p.cours > 0 ? p.valeur : null }))}
        dateSeance={lastDate}
        portefeuilleIndisponible={portefeuilleIndisponible}
      />
    ),
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Halo atmosphérique ────────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-obsidian-glow"
        aria-hidden
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-4">

        {/* ── Barre de tête : titre, séance, fraîcheur, liens ───────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-2xl text-ivory">Tableau de bord</h1>
            <p className="text-xs text-muted">Séance du {dateLabel}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Navigation rapide">
            <PastilleSeance />
            <FreshnessBadge fraicheur={fraicheurCours} />
            {user && (
              <Link href="/dashboard/personnaliser" className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors" title={dashboardLayout ? 'Ordre personnalisé enregistré : il remplace l’ordre automatique de votre profil' : 'Personnaliser le tableau de bord'}>
                {dashboardLayout ? '⚙︎ Ordre personnalisé' : '⚙︎ Personnaliser'}
              </Link>
            )}
            {/* Passage vers la seconde version du tableau de bord. Les deux
                cohabitent : sans ce lien, /dashboard/v2 n'est atteignable qu'en
                connaissant l'URL par cœur. */}
            <Link
              href="/dashboard/v2"
              className="rounded-full border border-accent/30 px-3 py-1.5 text-xs text-accent transition-colors hover:border-accent/60 hover:bg-accent/[0.06]"
              title="Essayer la nouvelle version du tableau de bord"
            >
              Version v2 →
            </Link>
          </nav>
        </header>

        {/* ── Bandeau alertes déclenchées ──────────────────────────────────── */}
        {triggeredAlerts > 0 && (
          <Link
            href="/parametres/alertes"
            className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down transition-colors hover:bg-down/20"
          >
            <span className="animate-pulse" aria-hidden>●</span>
            <span className="font-semibold">
              {triggeredAlerts} alerte{triggeredAlerts > 1 ? 's' : ''} déclenchée{triggeredAlerts > 1 ? 's' : ''} ces {ALERTES_RECENTES_JOURS} derniers jours
            </span>
            {detailAlertes.map((d, i) => (
              <span key={`${d.code}-${i}`} className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                <span aria-hidden className="text-muted">·</span>
                <span className="font-bold">{d.code}</span>
                <span className="min-w-0 break-words text-muted">{d.motif}</span>
                {d.le && <span className="tabular whitespace-nowrap text-muted">· le {fmtDateFR(d.le).slice(0, 5)}</span>}
              </span>
            ))}
            {triggeredAlerts > detailAlertes.length && (
              <span className="text-muted">
                · + {triggeredAlerts - detailAlertes.length} autre{triggeredAlerts - detailAlertes.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="ml-auto whitespace-nowrap">Voir les alertes →</span>
          </Link>
        )}

        {/* ── Ticker permanent : cours actions + obligations ──────────────── */}
        <DashboardTicker items={ticker} dateMarche={lastDate} />

        <MacroBanner />

        {/* ── Widgets configurables, par rangées (spec §4.0) ── */}
        <div className="border-t border-border">
          {grouperEnRangees(layout.filter((k) => sections[k] != null)).map((r) => (
            <div key={r.cles.join('-')} className={classeRangee(r)}>
              {r.cles.map((k) => (
                <div key={k} className={classeCellule(r.largeur, r.cles.length === 1)}>{sections[k]}</div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Pied de page premium ───────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6">
          <p className="text-xs text-faint">
            Dernière mise à jour :{' '}
            <span className="tabular text-muted">{dateLabel}</span>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-faint hover:text-gold transition-colors duration-200"
            >
              Actualiser
            </Link>
            <Link
              href="/parametres/compte"
              className="text-xs text-faint hover:text-gold transition-colors duration-200"
            >
              Paramètres
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
