import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import Sparkline from '@/components/public/Sparkline';
import RatingBadge from '@/components/RatingBadge';
import CarnetOrdres, { type CarnetRow } from '@/components/CarnetOrdres';
import CarnetCommentaire from '@/components/CarnetCommentaire';
import { ecartTypeVariations } from '@/lib/carnet/commentaire';
import { computeRatios, pickBestFundamental } from '@/lib/fundamentals';
import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';
import { jsonLdScript } from '@/lib/jsonLd';
import { requiredAccess } from '@/lib/server/featureAccess';

// ISR : aligné sur la fréquence intraday (15 min)
export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

interface PageProps {
  params: { code: string };
}

async function getCompany(code: string) {
  const supabase = createPublicClient();

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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

export default async function CompanyPage({ params }: PageProps) {
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
  const [{ instrument, hist, signal, fundamentals, dividends, news, diagnostic, carnet }, { required: accesLectureSeance }] =
    await Promise.all([getCompany(code), requiredAccess('lecture_seance')]);

  if (!instrument) notFound();

  const series = [...hist].reverse();
  const closes = series.map((r) => r.cours_jour).filter((v): v is number => v != null);
  const last = hist[0] ?? null;
  const cours = last?.cours_jour ?? null;
  const variation = last?.variation_pct ?? null;
  const positive = (variation ?? 0) >= 0;

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
  const economieSociete = exCourant
    ? {
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

  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] text-accent/70 uppercase tracking-[0.18em] mb-1">
            {instrument.secteur ?? 'BRVM'} · {instrument.pays ?? 'UEMOA'}
          </p>
          <h1 className="font-display text-2xl md:text-3xl text-white">
            {instrument.designation} <span className="text-muted text-xl">({code})</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end">
            <RatingBadge scoreTotal={signal?.score_total} confiance={signal?.confiance} size="lg" />
            <div>
              <p className="tabular text-3xl text-white font-semibold">{fmtNumber(cours)} <span className="text-sm text-muted">FCFA</span></p>
              {variation != null && (
                <p className={`tabular text-sm font-medium ${positive ? 'text-up' : 'text-down'}`}>
                  {positive ? '+' : ''}{fmtNumber(variation, 2)} % aujourd&apos;hui
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Graphique 1 an ───────────────────────────────────────────────── */}
      <section className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm text-muted mb-3">Cours de clôture · 12 derniers mois</h2>
        {closes.length >= 2 ? (
          <Sparkline values={closes} positive={closes[closes.length - 1]! >= closes[0]!} />
        ) : (
          <p className="text-faint text-sm py-8 text-center">Historique de cours en cours de constitution.</p>
        )}
      </section>

      <CarnetOrdres carnet={carnet} />

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
        <div className="mb-6 rounded-xl border border-border bg-surface p-5 text-center">
          <h2 className="text-sm text-muted mb-1.5">Ce que dit la séance</h2>
          <p className="text-faint text-sm">
            Le carnet d&apos;ordres mis à l&apos;échelle, le score technique face à ses
            seuils et les comptes rapportés au cours : cette lecture de la séance
            est sur la fiche détaillée.
          </p>
          <Link
            href={`/actions/${code}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Voir l&apos;analyse de la séance →
          </Link>
        </div>
      )}

      {/* ── Chiffres clés ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Capitalisation', value: ratios?.capitalisation != null ? fmtFcfa(ratios.capitalisation) + ' FCFA' : '—' },
          { label: 'Volume (dernière séance)', value: fmtNumber(last?.volume) },
          { label: 'Plus haut 52 sem.', value: fmtNumber(last?.cours_haut_52s) },
          { label: 'Plus bas 52 sem.', value: fmtNumber(last?.cours_bas_52s) },
        ].map((m) => (
          <div key={m.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[11px] text-faint mb-1">{m.label}</p>
            <p className="tabular text-lg text-white">{m.value}</p>
          </div>
        ))}
      </section>

      {/* ── Fondamentaux ─────────────────────────────────────────────────── */}
      {bestFund && (
        <section className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm text-muted mb-4">
            Fondamentaux · exercice {bestFund.year ?? '—'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            {[
              { label: "Chiffre d'affaires", value: fmtFcfa(bestFund.revenue) + ' FCFA' },
              { label: 'Résultat net', value: fmtFcfa(bestFund.net_income) + ' FCFA' },
              { label: 'Capitaux propres', value: fmtFcfa(bestFund.equity) + ' FCFA' },
              { label: 'BPA', value: ratios?.bpa != null ? fmtNumber(ratios.bpa, 0) + ' FCFA' : '—' },
              { label: 'PER', value: ratios?.per != null ? fmtNumber(ratios.per, 1) + '×' : '—' },
              { label: 'ROE', value: ratios?.roe != null ? fmtNumber(ratios.roe * 100, 1) + ' %' : '—' },
              { label: 'Marge nette', value: ratios?.margeNette != null ? fmtNumber(ratios.margeNette * 100, 1) + ' %' : '—' },
              { label: 'Rendement dividende', value: ratios?.rendementDiv != null ? fmtNumber(ratios.rendementDiv * 100, 2) + ' %' : '—' },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 md:border-0">
                <span className="text-xs text-muted">{m.label}</span>
                <span className="tabular text-sm text-white font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* ── Dividendes ──────────────────────────────────────────────────── */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm text-muted mb-3">Historique des dividendes</h2>
          {dividends.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-faint text-left">
                  <th className="pb-2 font-normal">Exercice</th>
                  <th className="pb-2 font-normal text-right">Dividende / action</th>
                  <th className="pb-2 font-normal text-right">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-2 text-white">{d.exercice ?? '—'}</td>
                    <td className="py-2 tabular text-right text-up">{fmtNumber(d.montant)} FCFA</td>
                    <td className="py-2 tabular text-right text-muted">{fmtDateFR(d.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-faint text-sm py-6 text-center">Aucun dividende enregistré.</p>
          )}
        </section>

        {/* ── Actualités ──────────────────────────────────────────────────── */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm text-muted mb-3">Dernières actualités</h2>
          {news.length > 0 ? (
            <ul className="space-y-3">
              {news.map((n, i) => (
                <li key={i} className="border-t border-border/40 first:border-0 pt-3 first:pt-0">
                  {n.source_url ? (
                    <a href={n.source_url} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-white hover:text-accent transition-colors leading-snug block">
                      {n.titre}
                    </a>
                  ) : (
                    <p className="text-sm text-white leading-snug">{n.titre}</p>
                  )}
                  <p className="text-[11px] text-faint mt-1">{fmtDateFR(n.date_publication)} · {n.source}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-faint text-sm py-6 text-center">Aucune actualité récente.</p>
          )}
        </section>
      </div>

      {/* ── Teaser dossier d’analyse (convertisseur) ─────────────────────────── */}
      {teaserLines.length > 0 && (
        <section className="bg-surface border border-accent/30 rounded-xl p-5 mb-6 relative overflow-hidden">
          <p className="text-[11px] text-accent/80 uppercase tracking-[0.18em] mb-2">Dossier d’analyse · extrait</p>
          <div className="space-y-2 text-sm text-muted leading-relaxed">
            {teaserLines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          <div className="relative mt-2">
            <div className="space-y-2 select-none blur-sm" aria-hidden="true">
              <p className="text-sm text-muted">Le détail de la valorisation, les forces et risques identifiés, et la conclusion de l&apos;analyse sont réservés aux membres.</p>
              <p className="text-sm text-muted">Créez un compte gratuit pour accéder à l&apos;analyse complète et aux signaux quotidiens.</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Link href="/signup"
                className="px-5 py-2.5 rounded-lg bg-accent text-bg font-semibold hover:bg-gold-2 transition-colors active:scale-95">
                Lire l&apos;analyse complète · gratuit
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA secondaires ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/simulateur/${code}`}
          className="px-4 py-2 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors text-sm font-medium">
          Simuler un investissement dans {code}
        </Link>
        <Link href="/signup"
          className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white hover:border-border-strong transition-colors text-sm">
          Suivre {code} dans ma watchlist
        </Link>
        <Link href="/societes"
          className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white hover:border-border-strong transition-colors text-sm">
          Toutes les sociétés BRVM
        </Link>
      </div>
    </PublicShell>
  );
}
