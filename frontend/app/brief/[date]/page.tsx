import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import PrintButton from '@/components/public/PrintButton';
import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

interface BriefData {
  date_marche: string;
  tendance: 'haussiere' | 'baissiere' | 'mitigee';
  breadth: { hausses: number; baisses: number; stables: number };
  indices: { code: string; valeur: number | null; variation_pct: number | null }[];
  top_hausses: { code: string; variation_pct: number }[];
  top_baisses: { code: string; variation_pct: number }[];
  volume_total: number;
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
  actualites: { titre: string; source: string | null; source_url: string | null }[];
}

interface PageProps {
  params: { date: string };
}

const TENDANCE = {
  haussiere: { label: 'Tendance haussière', tone: 'text-up', dot: '#3fe18b' },
  baissiere: { label: 'Tendance baissière', tone: 'text-down', dot: '#ff6b6b' },
  mitigee: { label: 'Séance mitigée', tone: 'text-white', dot: '#56d7fd' },
} as const;

async function getBrief(date: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('brief_daily')
    .select('date_marche, contenu, data, sent_at, audio_url')
    .eq('date_marche', date)
    .maybeSingle();
  return data as { date_marche: string; contenu: string; data: BriefData | null; sent_at: string | null; audio_url: string | null } | null;
}

/** 5 briefs les plus récents (hors date courante) — maillage interne SEO. */
async function getRecentBriefs(exclude: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('brief_daily')
    .select('date_marche')
    .neq('date_marche', exclude)
    .order('date_marche', { ascending: false })
    .limit(5);
  return (data ?? []) as { date_marche: string }[];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const title = `Note de conjoncture BRVM — séance du ${fmtDateFR(params.date)} | WESTBOURSE`;
  const description =
    'Tendance du marché, hausses et baisses, valeur des transactions, capitalisations et actualités de la séance BRVM.';
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/brief/${params.date}` },
    openGraph: {
      title,
      description,
      images: [{ url: `${SITE_URL}/api/og/brief?date=${params.date}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

function MoverBar({
  code,
  pct,
  maxAbs,
  up,
}: {
  code: string;
  pct: number;
  maxAbs: number;
  up: boolean;
}) {
  const width = Math.max(8, Math.round((Math.abs(pct) / maxAbs) * 100));
  return (
    <Link href={`/societes/${code}`} className="group flex items-center gap-3">
      <span className="w-14 shrink-0 font-mono text-xs font-bold text-white group-hover:text-accent transition-colors">
        {code}
      </span>
      <span className="flex-1 h-6 rounded-md bg-elevated/60 overflow-hidden">
        <span
          className={`block h-full rounded-md ${up ? 'bg-up/70' : 'bg-down/70'} transition-all`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className={`tabular w-20 shrink-0 text-right text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>
        {pct >= 0 ? '+' : ''}
        {fmtNumber(pct, 2)} %
      </span>
    </Link>
  );
}

export default async function BriefDatePage({ params }: PageProps) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();
  const brief = await getBrief(params.date);
  if (!brief) notFound();
  const recent = await getRecentBriefs(params.date);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `Note de conjoncture BRVM — séance du ${fmtDateFR(brief.date_marche)}`,
    datePublished: brief.sent_at ?? `${brief.date_marche}T18:00:00+00:00`,
    dateModified: brief.sent_at ?? `${brief.date_marche}T18:00:00+00:00`,
    inLanguage: 'fr',
    articleSection: 'Marché BRVM',
    author: { '@type': 'Organization', name: 'WESTBOURSE' },
    publisher: { '@type': 'Organization', name: 'WESTBOURSE' },
    mainEntityOfPage: `${SITE_URL}/brief/${brief.date_marche}`,
    image: `${SITE_URL}/api/og/brief?date=${brief.date_marche}`,
  };

  const d = brief.data;
  const t = d ? TENDANCE[d.tendance] : null;
  const total = d ? d.breadth.hausses + d.breadth.baisses + d.breadth.stables : 0;
  const maxAbs = d
    ? Math.max(
        ...d.top_hausses.map((m) => Math.abs(m.variation_pct)),
        ...d.top_baisses.map((m) => Math.abs(m.variation_pct)),
        0.01,
      )
    : 1;

  return (
    <PublicShell>
      <article className="max-w-3xl mx-auto print:max-w-none">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
        />

        {/* ── Fil d'Ariane ───────────────────────────────────────────── */}
        <nav aria-label="Fil d'Ariane" className="mb-4 flex items-center gap-2 text-xs text-muted print:hidden">
          <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
          <span className="text-faint">/</span>
          <Link href="/brief" className="hover:text-white transition-colors">Brief</Link>
          <span className="text-faint">/</span>
          <span className="text-white">{fmtDateFR(brief.date_marche)}</span>
        </nav>

        {/* ── En-tête de note ─────────────────────────────────────────── */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-accent/70 uppercase tracking-[0.18em] mb-1">
              Note de conjoncture · BRVM
            </p>
            <h1 className="font-display text-2xl md:text-3xl text-white">
              Séance du {fmtDateFR(brief.date_marche)}
            </h1>
            {t && (
              <p className={`mt-2 inline-flex items-center gap-2 text-sm font-semibold ${t.tone}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
                {t.label}
              </p>
            )}
          </div>
          <PrintButton />
        </header>

        {d ? (
          <>
            {/* ── Respiration du marché (breadth) ─────────────────────── */}
            <section className="bg-surface border border-border rounded-xl p-5 mb-6">
              <h2 className="text-sm text-muted mb-3">Respiration du marché</h2>
              <div className="flex h-4 w-full overflow-hidden rounded-full" role="img"
                aria-label={`${d.breadth.hausses} hausses, ${d.breadth.baisses} baisses, ${d.breadth.stables} stables`}>
                {d.breadth.hausses > 0 && (
                  <span className="bg-up/80" style={{ width: `${(d.breadth.hausses / total) * 100}%` }} />
                )}
                {d.breadth.stables > 0 && (
                  <span className="bg-elevated" style={{ width: `${(d.breadth.stables / total) * 100}%` }} />
                )}
                {d.breadth.baisses > 0 && (
                  <span className="bg-down/80" style={{ width: `${(d.breadth.baisses / total) * 100}%` }} />
                )}
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-up tabular">{d.breadth.hausses} hausses</span>
                <span className="text-muted tabular">{d.breadth.stables} stables</span>
                <span className="text-down tabular">{d.breadth.baisses} baisses</span>
              </div>
            </section>

            {/* ── Indices + chiffres de séance ─────────────────────────── */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {d.indices
                .filter((i) => i.valeur != null)
                .map((i) => (
                  <div key={i.code} className="bg-surface border border-border rounded-xl p-4">
                    <p className="text-[11px] text-faint mb-1">{i.code}</p>
                    <p className="tabular text-lg text-white">{fmtNumber(i.valeur, 2)}</p>
                    {i.variation_pct != null && (
                      <p className={`tabular text-xs font-medium ${i.variation_pct >= 0 ? 'text-up' : 'text-down'}`}>
                        {i.variation_pct >= 0 ? '+' : ''}
                        {fmtNumber(i.variation_pct, 2)} %
                      </p>
                    )}
                  </div>
                ))}
              {d.valeur_transactions != null && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-[11px] text-faint mb-1">Transactions</p>
                  <p className="tabular text-lg text-white">{fmtFcfa(d.valeur_transactions)}</p>
                  <p className="text-xs text-muted">FCFA échangés</p>
                </div>
              )}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[11px] text-faint mb-1">Volume</p>
                <p className="tabular text-lg text-white">{fmtNumber(d.volume_total)}</p>
                <p className="text-xs text-muted">titres</p>
              </div>
            </section>

            {/* ── Top movers (graphique barres) ────────────────────────── */}
            <section className="bg-surface border border-border rounded-xl p-5 mb-6">
              <h2 className="text-sm text-muted mb-4">Mouvements marquants</h2>
              <div className="space-y-2.5">
                {d.top_hausses.map((m) => (
                  <MoverBar key={m.code} code={m.code} pct={m.variation_pct} maxAbs={maxAbs} up />
                ))}
                {d.top_hausses.length > 0 && d.top_baisses.length > 0 && (
                  <div className="border-t border-border/40 my-3" aria-hidden />
                )}
                {d.top_baisses.map((m) => (
                  <MoverBar key={m.code} code={m.code} pct={m.variation_pct} maxAbs={maxAbs} up={false} />
                ))}
              </div>
            </section>

            {/* ── Capitalisations ──────────────────────────────────────── */}
            {(d.capitalisation_actions != null || d.capitalisation_obligations != null) && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {d.capitalisation_actions != null && (
                  <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                    <span className="text-xs text-muted">Capitalisation actions</span>
                    <span className="tabular text-white font-medium">{fmtFcfa(d.capitalisation_actions)} FCFA</span>
                  </div>
                )}
                {d.capitalisation_obligations != null && (
                  <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                    <span className="text-xs text-muted">Capitalisation obligations</span>
                    <span className="tabular text-white font-medium">{fmtFcfa(d.capitalisation_obligations)} FCFA</span>
                  </div>
                )}
              </section>
            )}

            {/* ── Actualités & annonces ────────────────────────────────── */}
            {d.actualites.length > 0 && (
              <section className="bg-surface border border-border rounded-xl p-5 mb-6">
                <h2 className="text-sm text-muted mb-3">Actualités & annonces</h2>
                <ul className="space-y-3">
                  {d.actualites.map((n, i) => (
                    <li key={i} className="border-t border-border/40 first:border-0 pt-3 first:pt-0">
                      {n.source_url ? (
                        <a href={n.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-white hover:text-accent transition-colors leading-snug block">
                          {n.titre}
                        </a>
                      ) : (
                        <p className="text-sm text-white leading-snug">{n.titre}</p>
                      )}
                      {n.source && <p className="text-[11px] text-faint mt-1">{n.source}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          /* Brief ancien format (texte seul) */
          <section className="bg-surface border border-border rounded-xl p-5 mb-6">
            {brief.audio_url && (
              <div className="mb-4 rounded-xl border border-accent/25 bg-accent/[0.06] p-3">
                <p className="overline mb-2 text-gold-2">🎧 Écouter le brief (1 min)</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- transcription complète juste en dessous */}
                <audio controls preload="none" src={brief.audio_url} className="w-full">
                  Votre navigateur ne lit pas l&apos;audio — le texte complet est ci-dessous.
                </audio>
              </div>
            )}
            <pre className="whitespace-pre-wrap text-sm text-white/90 leading-relaxed font-sans">{brief.contenu}</pre>
          </section>
        )}

        {/* ── CTA conversion ─────────────────────────────────────────── */}
        <section className="mb-6 rounded-xl border border-accent/20 bg-accent/[0.04] p-5 text-center print:hidden">
          <p className="text-sm font-medium text-white">Recevez ce brief chaque soir après la clôture.</p>
          <p className="mt-1 text-xs text-muted">Compte gratuit · aucune carte bancaire · 1 minute.</p>
          <Link
            href="/signup"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-bold text-bg transition-transform active:scale-95"
          >
            Créer un compte gratuit
          </Link>
        </section>

        {/* ── Briefs récents (maillage interne) ──────────────────────── */}
        {recent.length > 0 && (
          <section className="mb-6 border-t border-border/40 pt-6 print:hidden">
            <h2 className="mb-3 text-sm text-muted">Briefs récents</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recent.map((r) => (
                <li key={r.date_marche}>
                  <Link
                    href={`/brief/${r.date_marche}`}
                    className="text-sm text-accent transition-colors hover:text-gold-2"
                  >
                    Séance du {fmtDateFR(r.date_marche)} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Pied de note ───────────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/brief" className="text-sm text-muted hover:text-white transition-colors">
            ← Toutes les notes
          </Link>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(brief.contenu)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white hover:border-border-strong transition-colors text-sm"
          >
            Partager sur WhatsApp
          </a>
        </footer>
        <p className="mt-6 text-[10px] text-faint leading-relaxed">
          Note générée automatiquement depuis les données de séance (brvm.org). La tendance est dérivée du
          rapport hausses/baisses — aucun commentaire inventé. Pas un conseil en investissement.
        </p>
      </article>
    </PublicShell>
  );
}
