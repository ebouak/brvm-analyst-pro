import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerIntermediaire } from '@/lib/financials/interimServer';
import PublicShell from '@/components/public/PublicShell';
import Sparkline from '@/components/public/Sparkline';
import RatingBadge from '@/components/RatingBadge';
import CarnetOrdres, { dateSeanceLongue, type CarnetRow } from '@/components/CarnetOrdres';
import BulletinSociete from '@/components/BulletinSociete';
import { COLONNES_AG, type BocAssemblee } from '@/lib/boc/assemblees';
import { COLONNES_AVIS, COLONNES_OPERATION, type BocAvis, type BocOperation } from '@/lib/boc/informations';
import CarnetCommentaire from '@/components/CarnetCommentaire';
import { ecartTypeVariations } from '@/lib/carnet/commentaire';
import { computeRatios, pickBestFundamental } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa, fmtPctSigne } from '@/lib/format';
import { jsonLdScript } from '@/lib/jsonLd';
import { requiredAccess } from '@/lib/server/featureAccess';

// ISR : aligné sur la fréquence intraday (15 min)
export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

/** « 2025-11-07 » → « 7 nov. 2025 » (UTC : une date seule ne doit pas glisser d'un jour). */
function dateCourte(iso: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * AG, opérations et avis de la société lus au Bulletin officiel, et la date du
 * dernier bulletin lu (le plus récent des deux tables : le calendrier des AG
 * peut être vide en début d'année). Une table illisible rend des listes vides :
 * le bloc disparaît, la fiche reste servie.
 */
async function getBulletin(supabase: ReturnType<typeof createPublicClient>, code: string) {
  const [ag, ops, avis, derAg, derOp] = await Promise.all([
    supabase.from('boc_assemblees').select(COLONNES_AG).eq('code', code).order('date_ag', { ascending: false }).limit(20),
    supabase.from('boc_operations').select(COLONNES_OPERATION).eq('code', code).order('dernier_bulletin', { ascending: false }).limit(10),
    supabase.from('boc_avis').select(COLONNES_AVIS).eq('code', code).order('date_bulletin', { ascending: false }).limit(10),
    supabase.from('boc_assemblees').select('dernier_bulletin').order('dernier_bulletin', { ascending: false }).limit(1),
    supabase.from('boc_operations').select('dernier_bulletin').order('dernier_bulletin', { ascending: false }).limit(1),
  ]);
  const dates = [derAg.data?.[0], derOp.data?.[0]]
    .map((r) => (r as { dernier_bulletin?: string } | undefined)?.dernier_bulletin)
    .filter((d): d is string => typeof d === 'string');
  return {
    assemblees: (ag.data ?? []) as BocAssemblee[],
    operations: (ops.data ?? []) as BocOperation[],
    avis: (avis.data ?? []) as BocAvis[],
    dernierBulletin: dates.length ? dates.sort().at(-1)! : null,
  };
}

async function getCompany(code: string) {
  const supabase = createPublicClient();
  const bulletinP = getBulletin(supabase, code); // en parallèle du reste

  const [{ data: instrument }, { data: hist }, { data: sig }, { data: funds }, { data: divs }, { data: news }, { data: diag }, { data: carnet }] =
    await Promise.all([
      supabase.from('brvm_instruments').select('*').eq('code', code).eq('type', 'action').maybeSingle(),
      supabase
        .from('brvm_actions_daily')
        .select('date_marche, cours_jour, variation_pct, volume, valeur_echangee, cours_bas_52s, cours_haut_52s')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(260),
      supabase
        .from('signals_daily')
        .select('score_total, confiance, signal, date_marche')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1),
      supabase
        .from('fundamentals')
        .select('year, revenue, net_income, equity, cash, debt, bfr, is_manual, source_file')
        .eq('code', code)
        .order('year', { ascending: false })
        .limit(4),
      supabase
        .from('dividends')
        .select('exercice, montant, ex_date, payment_date')
        .eq('code', code)
        .order('exercice', { ascending: false })
        .limit(5),
      supabase
        .from('brvm_news')
        .select('titre, date_publication, source, source_url')
        .not('hidden', 'is', true) // modération rédactionnelle
        .eq('instrument_code', code)
        .lte('date_publication', new Date().toISOString().slice(0, 10)) // jamais d'actu datée dans le futur
        .order('date_publication', { ascending: false })
        .limit(5),
      supabase
        .from('diagnostic_reports')
        .select('markdown_content, generated_at')
        .eq('code', code)
        .maybeSingle(),
      // Carnet d'ordres de la dernière séance PUBLIÉE au bulletin : celui-ci
      // paraît après la clôture, parfois le lendemain, donc sa date diffère de
      // celle des cours. On prend la plus récente disponible pour cette valeur.
      supabase
        .from('brvm_carnet_daily')
        .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, cours_reference')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    bulletin: await bulletinP,
    carnet: (carnet ?? null) as CarnetRow | null,
    instrument: instrument as {
      code: string; designation: string; secteur: string | null; pays: string | null;
      shares?: number | null;
    } | null,
    hist: (hist ?? []) as Array<{
      date_marche: string; cours_jour: number | null; variation_pct: number | null;
      volume: number | null; valeur_echangee: number | null;
      cours_bas_52s: number | null; cours_haut_52s: number | null;
    }>,
    signal: sig?.[0] ?? null,
    fundamentals: funds ?? [],
    dividends: (divs ?? []) as Array<{ exercice: number | null; montant: number; ex_date: string | null; payment_date: string | null }>,
    news: (news ?? []) as Array<{ titre: string; date_publication: string; source: string; source_url: string | null }>,
    diagnostic: diag as { markdown_content: string; generated_at: string } | null,
  };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const supabase = createPublicClient();
  const { data: instr } = await supabase
    .from('brvm_instruments')
    .select('designation')
    .eq('code', code)
    .maybeSingle();

  if (!instr) return { title: 'Société introuvable' };

  const title = `Action ${instr.designation} (${code}) · Cours, dividendes, analyse`;
  const description = `Cours en quasi temps réel, note BRVM, fondamentaux, dividendes et actualités de ${instr.designation} (${code}) cotée à la BRVM. Analyse gratuite et données vérifiées.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/societes/${code}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/societes/${code}`,
      type: 'website',
      images: [{ url: `${SITE_URL}/api/og/societe?code=${code}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function CompanyPage(props: PageProps) {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  // `requiredAccess`, PAS `canAccess` : cette page est la seule à porter
  // `revalidate = 900` (ISR) plutôt que `force-dynamic`. `canAccess` résout les
  // droits de L'UTILISATEUR via `getEntitlements()` → `createClient()` (lecture
  // de session/cookies), ce qui bascule silencieusement la route en rendu
  // dynamique — huit requêtes Supabase par visite au lieu d'un cache de 15 min.
  // `requiredAccess` ne lit que le niveau déclaré en base (`feature_flags`, via
  // service_role, sans session) : on sait QUOI est requis, jamais QUI regarde.
  // Conséquence assumée : cette page publique et indexée ne montre JAMAIS
  // l'analyse, même à un abonné connecté — la lecture complète reste sur
  // /actions/[code], qui peut se permettre d'être dynamique.
  const [{ instrument, hist, signal, fundamentals, dividends, news, diagnostic, carnet, bulletin }, { required: accesLectureSeance }] =
    await Promise.all([getCompany(code), requiredAccess('lecture_seance')]);

  if (!instrument) notFound();

  const series = [...hist].reverse();
  const closes = series.map((r) => r.cours_jour).filter((v): v is number => v != null);
  const last = hist[0] ?? null;
  const cours = last?.cours_jour ?? null;
  const variation = last?.variation_pct ?? null;

  const bestFund = pickBestFundamental(fundamentals);
  // Dividende VÉRIFIÉ (détachement daté) pour le rendement : les valeurs société
  // sans ex_date sont biaisées (~12 %). Cohérent avec le reste du site.
  const lastDividend =
    (dividends as { montant: number; ex_date: string | null }[]).find((d) => d.ex_date && d.montant > 0)
    ?? dividends[0]
    ?? null;
  const ratios = bestFund
    ? computeRatios({
        cours,
        shares: instrument.shares ?? null,
        revenue: bestFund.revenue,
        net_income: bestFund.net_income,
        equity: bestFund.equity,
        debt: bestFund.debt ?? null,
        dividende: lastDividend?.montant ?? null,
      })
    : null;

  // ── « Ce que dit la séance » (verrou premium `lecture_seance`) ──────────
  // Repris de /actions/[code], réduit à ce que CETTE page charge déjà — pas
  // de requête liquidity_daily supplémentaire pour situer la fourchette parmi
  // les autres valeurs du marché : sur une page publique en ISR, ce n'est
  // qu'une nuance de phrase (`situerFourchette` dégrade proprement sans elle)
  // pour un aller-retour de plus à chaque régénération. `valeurEchangee` seul
  // suffit à donner une échelle au carnet.
  const contexteCarnet = { valeurEchangee: last?.valeur_echangee ?? null };

  // Agitation ordinaire du titre. Sous 20 séances, `ecartTypeVariations` rend
  // `null` et le mouvement du jour est cité sans être qualifié.
  const { ecartTypePct, seances } = ecartTypeVariations(hist.slice(0, 31).map((r) => r.variation_pct));
  const bruitSeance = {
    variationPct: last?.variation_pct ?? null,
    ecartTypePct,
    seancesObservees: seances,
    // Pas de `volume_ratio` ici : cette page ne charge pas `signals_daily.inputs`.
  };

  // Comptes du dernier exercice publié, et celui d'avant pour l'évolution —
  // même logique que /actions/[code], à partir de `bestFund` déjà calculé.
  const exCourant = bestFund && bestFund.year != null ? bestFund : null;
  const exPrecedent = exCourant ? fundamentals.find((f) => f.year === exCourant.year - 1) ?? null : null;
  // Trimestre / semestre de l'année en cours, tant que l'exercice n'est pas publié.
  const intermediaire = exCourant ? await chargerIntermediaire(createPublicClient(), code, fundamentals) : null;
  const economieSociete = exCourant
    ? {
        intermediaire,
        exercice: exCourant.year,
        resultatNet: exCourant.net_income ?? null,
        resultatNetPrecedent: exPrecedent?.net_income ?? null,
        chiffreAffaires: exCourant.revenue ?? null,
        chiffreAffairesPrecedent: exPrecedent?.revenue ?? null,
        capitauxPropres: exCourant.equity ?? null,
        actions: instrument.shares ?? null,
        coursJour: cours ?? null,
        source: exCourant.is_manual ? 'pdf-verified' : null,
      }
    : null;

  // Signal réduit aux colonnes chargées par cette page (pas d'`explication` ni
  // de sous-scores ici) : `sousScores` omis plutôt que deviné — le module ne
  // parlera pas de facteurs qui se contredisent sans eux.
  const signalSeance = signal
    ? {
        date_marche: signal.date_marche,
        signal: signal.signal,
        confiance: signal.confiance ?? null,
        score_total: signal.score_total ?? null,
      }
    : null;

  // Teaser diagnostic : 3 premières lignes non vides du markdown
  const teaserLines = diagnostic
    ? diagnostic.markdown_content
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').trim())
        .filter((l) => l.length > 20)
        .slice(0, 3)
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Corporation',
    name: instrument.designation,
    tickerSymbol: code,
    address: instrument.pays ? { '@type': 'PostalAddress', addressCountry: instrument.pays } : undefined,
    url: `${SITE_URL}/societes/${code}`,
  };

  // ── Étendue réelle du graphique ──────────────────────────────────────────
  // Dérivée des points tracés : l'historique peut être plus court qu'un an,
  // on écrit donc les dates, pas « 12 derniers mois ». Les bornes sont celles
  // de la SÉRIE tracée, distinctes de cours_haut_52s / cours_bas_52s.
  const pointsTraces = series.filter((r) => r.cours_jour != null);
  const debutSerie = pointsTraces[0]?.date_marche ?? null;
  const finSerie = pointsTraces[pointsTraces.length - 1]?.date_marche ?? null;
  const etendue =
    debutSerie && finSerie && closes.length >= 2
      ? `Du ${dateCourte(debutSerie)} au ${dateCourte(finSerie)} · ${fmtNumber(closes.length)} séances`
      : null;
  const plusHautSerie = closes.length >= 2 ? Math.max(...closes) : null;
  const plusBasSerie = closes.length >= 2 ? Math.min(...closes) : null;

  const avecUnite = (valeur: string, unite: string) => (valeur === '—' ? valeur : `${valeur} ${unite}`);
  const titreSection = 'font-display text-lg text-ivory';

  const chiffresCles = [
    { label: 'Capitalisation (FCFA)', value: fmtFcfa(ratios?.capitalisation ?? null) },
    { label: 'Volume de la séance (titres)', value: fmtNumber(last?.volume) },
    { label: 'Plus haut 52 semaines (FCFA)', value: fmtNumber(last?.cours_haut_52s) },
    { label: 'Plus bas 52 semaines (FCFA)', value: fmtNumber(last?.cours_bas_52s) },
  ];

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      {/* ── En-tête : une ligne de la cote ───────────────────────────────── */}
      <header className="mb-8 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-medium text-ivory">{code}</span>
              <span className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">{instrument.designation}</span>
            </h1>
            <p className="mt-1 text-sm text-faint">
              {instrument.secteur ?? 'BRVM'} · {instrument.pays ?? 'UEMOA'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <RatingBadge scoreTotal={signal?.score_total} confiance={signal?.confiance} size="lg" />
            <div className="text-right">
              <p className="tabular text-2xl text-ivory">
                {fmtNumber(cours)} <span className="text-sm text-muted">FCFA</span>
              </p>
              <p className="text-sm text-faint">
                {variation != null && (
                  <span
                    className={`tabular ${
                      Number(variation.toFixed(2)) > 0 ? 'text-up' : Number(variation.toFixed(2)) < 0 ? 'text-down' : 'text-muted'
                    }`}
                  >
                    {fmtPctSigne(variation)}
                  </span>
                )}
                {variation != null && last && ' · '}
                {last && <>séance du {dateSeanceLongue(last.date_marche)}</>}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Cours de clôture ─────────────────────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className={titreSection}>Cours de clôture</h2>
          {etendue && <p className="text-xs text-faint">{etendue}</p>}
        </div>
        {closes.length >= 2 ? (
          <>
            <Sparkline values={closes} positive={closes[closes.length - 1]! >= closes[0]!} />
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="text-faint">Plus haut de la période</dt>
                <dd className="tabular text-muted">{avecUnite(fmtNumber(plusHautSerie), 'FCFA')}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-faint">Plus bas de la période</dt>
                <dd className="tabular text-muted">{avecUnite(fmtNumber(plusBasSerie), 'FCFA')}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="py-8 text-sm text-faint">Pas encore assez de séances pour tracer l&apos;historique des cours.</p>
        )}
      </section>

      <CarnetOrdres carnet={carnet} />

      <BulletinSociete
        assemblees={bulletin.assemblees}
        operations={bulletin.operations}
        avis={bulletin.avis}
        dernierBulletin={bulletin.dernierBulletin}
        aujourdhui={new Date().toISOString().slice(0, 10)}
      />

      {/* ── Ce que dit la séance ─────────────────────────────────────────────
          `accesLectureSeance === 'free'` est le SEUL cas où ce bloc s'adresse à
          tout le monde — puisqu'on ne sait pas QUI regarde (voir plus haut, pas
          de lecture de session ici). Dans tous les autres cas, y compris pour
          un abonné qui lirait cette page publique, on NE REND PAS le composant :
          page indexée par Google, servie depuis le cache ISR, aucune phrase ni
          chiffre du commentaire ne doit atteindre ce HTML. Pas de `SectionLock`
          ici : il pointe en dur vers /account/plan et proposerait à un abonné
          de se réabonner — un bloc neutre renvoie simplement vers la fiche où
          l'analyse existe déjà, pour les deux publics. */}
      {accesLectureSeance === 'free' ? (
        <CarnetCommentaire
          carnet={carnet}
          signal={signalSeance}
          actualites={news}
          contexte={contexteCarnet}
          bruit={bruitSeance}
          economie={economieSociete}
        />
      ) : (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className={titreSection}>Ce que dit la séance</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            La fiche détaillée met le carnet d&apos;ordres à l&apos;échelle, place le
            score technique face à ses seuils et rapporte les comptes au cours.
          </p>
          <Link
            href={`/actions/${code}`}
            className="mt-3 inline-block text-sm font-medium text-accent-ink underline-offset-4 transition-colors hover:underline"
          >
            Voir l&apos;analyse de la séance
          </Link>
        </section>
      )}

      {/* ── Chiffres clés : une bande, pas quatre cartes ─────────────────── */}
      <dl className="mb-6 grid grid-cols-2 gap-y-4 rounded-xl border border-border bg-surface py-4 md:grid-cols-4 md:gap-y-0 md:divide-x md:divide-border">
        {chiffresCles.map((m, i) => (
          <div
            key={m.label}
            className={`px-5 ${i >= 2 ? 'border-t border-border pt-4 md:border-t-0 md:pt-0' : ''}`}
          >
            <dt className="text-xs text-faint">{m.label}</dt>
            <dd className="tabular mt-1 text-lg text-ivory">{m.value}</dd>
          </div>
        ))}
      </dl>

      {/* ── Fondamentaux ─────────────────────────────────────────────────── */}
      {bestFund && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={titreSection}>Fondamentaux</h2>
            <p className="text-xs text-faint">Exercice <span className="tabular">{bestFund.year ?? '—'}</span></p>
          </div>
          <dl className="grid gap-x-8 md:grid-cols-2">
            {[
              { label: "Chiffre d'affaires", value: avecUnite(fmtFcfa(bestFund.revenue), 'FCFA') },
              { label: 'Résultat net', value: avecUnite(fmtFcfa(bestFund.net_income), 'FCFA') },
              { label: 'Capitaux propres', value: avecUnite(fmtFcfa(bestFund.equity), 'FCFA') },
              { label: 'BPA', value: ratios?.bpa != null ? fmtNumber(ratios.bpa, 0) + ' FCFA' : '—' },
              { label: 'PER', value: ratios?.per != null ? fmtNumber(ratios.per, 1) + '×' : '—' },
              { label: 'ROE', value: ratios?.roe != null ? fmtNumber(ratios.roe * 100, 1) + ' %' : '—' },
              { label: 'Marge nette', value: ratios?.margeNette != null ? fmtNumber(ratios.margeNette * 100, 1) + ' %' : '—' },
              { label: 'Rendement dividende', value: ratios?.rendementDiv != null ? fmtNumber(ratios.rendementDiv * 100, 2) + ' %' : '—' },
            ].map((m) => (
              <div key={m.label} className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2">
                <dt className="text-sm text-muted">{m.label}</dt>
                <dd className="tabular text-sm text-ivory">{m.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* ── Dividendes ──────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className={`${titreSection} mb-3`}>Historique des dividendes</h2>
          {dividends.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2 font-normal">Exercice</th>
                  <th className="pb-2 text-right font-normal">Dividende par action</th>
                  <th className="pb-2 text-right font-normal">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="tabular py-2 text-ivory">{d.exercice ?? '—'}</td>
                    <td className="tabular py-2 text-right text-ivory">{fmtNumber(d.montant)} FCFA</td>
                    <td className="py-2 text-right text-muted">{d.payment_date ? dateCourte(d.payment_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-sm text-faint">Aucun dividende enregistré.</p>
          )}
        </section>

        {/* ── Actualités ──────────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className={`${titreSection} mb-3`}>Dernières actualités</h2>
          {news.length > 0 ? (
            <ul>
              {news.map((n, i) => (
                <li key={i} className="border-t border-border/60 py-3 first:border-0 first:pt-0 last:pb-0">
                  {n.source_url ? (
                    <a href={n.source_url} target="_blank" rel="noopener noreferrer"
                       className="block text-sm leading-snug text-ivory transition-colors hover:text-accent-ink">
                      {n.titre}
                    </a>
                  ) : (
                    <p className="text-sm leading-snug text-ivory">{n.titre}</p>
                  )}
                  <p className="mt-1 text-xs text-faint">
                    <span>{n.date_publication ? dateCourte(n.date_publication) : '—'}</span> · {n.source}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-faint">Aucune actualité récente.</p>
          )}
        </section>
      </div>

      {/* ── Extrait du dossier d’analyse (convertisseur) ─────────────────────
          Plus de faux paragraphes floutés derrière le bouton : on dit en
          clair ce qui est réservé, et où le lire. */}
      {teaserLines.length > 0 && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className={titreSection}>Dossier d’analyse</h2>
            <p className="text-xs text-faint">Extrait</p>
          </div>
          <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-muted">
            {teaserLines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/60 pt-4">
            <p className="max-w-xl text-sm text-faint">
              La suite (valorisation détaillée, forces, risques relevés et conclusion) est
              réservée aux membres.
            </p>
            <Link
              href="/signup"
              className="rounded-lg bg-accent-ink px-4 py-2 text-sm font-medium text-bg transition-[background-color,transform] hover:bg-gold-2 active:scale-[0.98]"
            >
              Lire la suite avec un compte gratuit
            </Link>
          </div>
        </section>
      )}

      {/* ── Suites ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={`/simulateur/${code}`}
          className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-ivory transition-colors hover:border-accent/60 hover:text-accent-ink"
        >
          Simuler un investissement dans {code}
        </Link>
        <Link
          href="/signup"
          className="text-sm text-muted underline-offset-4 transition-colors hover:text-ivory hover:underline"
        >
          Suivre {code} dans ma watchlist
        </Link>
        <Link
          href="/societes"
          className="text-sm text-muted underline-offset-4 transition-colors hover:text-ivory hover:underline"
        >
          Toutes les sociétés BRVM
        </Link>
      </div>
    </PublicShell>
  );
}
