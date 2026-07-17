import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadCitablePage, type LoadedCitable } from '@/lib/citable/page';
import { SectionHeader } from '@/components/ui/premium';
import SignupCta from '@/components/public/SignupCta';

export const dynamic = 'force-dynamic';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';
const nf = new Intl.NumberFormat('fr-FR');

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const loaded = await loadCitablePage(params.slug);
  if (!loaded) return { title: 'Analyse introuvable' };
  const { page } = loaded;
  return {
    title: page.title,
    description: page.short_answer.slice(0, 155),
    alternates: { canonical: `${SITE}/analyses/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.short_answer.slice(0, 155),
      url: `${SITE}/analyses/${page.slug}`,
      type: 'article',
      ...(page.hero_image_url ? { images: [{ url: page.hero_image_url }] } : {}),
    },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const loaded = await loadCitablePage(params.slug);
  if (!loaded) notFound();

  const { page, dividend, perTrap } = loaded;
  const maj = fmtDate(page.updated_at);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="font-display tracking-tight text-white hover:text-accent">WESTBOURSE</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/analyses" className="hidden text-muted hover:text-white sm:block">← Analyses</Link>
            <Link href="/login" className="text-muted hover:text-white">Connexion</Link>
            <Link href="/signup" className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg transition-colors hover:bg-gold-2 active:scale-95">
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
        <SectionHeader kicker="Analyse BRVM" title={page.title} subtitle={page.question} />

        {/* Auteur + fraîcheur : les signaux de confiance que les moteurs valorisent. */}
        <p className="text-xs text-faint">
          Par <span className="text-muted">{page.author}</span>
          {page.author_role ? ` · ${page.author_role}` : ''}
          {maj ? <> · Mis à jour le <time dateTime={page.updated_at}>{maj}</time></> : null}
        </p>

        {/* LA RÉPONSE COURTE, en tête : c'est elle qui sera reprise dans une réponse générée. */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
          <p className="overline text-accent">Réponse</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ivory">{page.short_answer}</p>
        </div>

        {page.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.hero_image_url}
            alt={page.hero_image_alt ?? page.title}
            className="w-full rounded-xl border border-border"
            loading="lazy"
          />
        )}

        {page.intro_md && <Prose md={page.intro_md} />}

        {/* Le TABLEAU live — le cœur citable d'une page data. */}
        {dividend && <DividendTable data={dividend} />}
        {perTrap && <PerTrapTable data={perTrap} />}

        {page.commentary_md && <Prose md={page.commentary_md} />}

        {page.methodology_md && (
          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-ivory">Méthodologie</h2>
            <div className="mt-2"><Prose md={page.methodology_md} small /></div>
          </section>
        )}

        {page.sources.length > 0 && (
          <section>
            <h2 className="font-display text-lg text-white">Sources</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {page.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {page.faq.length > 0 && (
          <section>
            <h2 className="font-display text-lg text-white">Questions fréquentes</h2>
            <dl className="mt-3 space-y-4">
              {page.faq.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-4">
                  <dt className="text-sm font-semibold text-ivory">{f.q}</dt>
                  <dd className="mt-1 text-sm text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <SignupCta
          titre="Analysez la BRVM avec les bons outils"
          sousTitre="Cette analyse est publique. Le compte gratuit débloque les signaux, les fiches complètes et le simulateur."
        />

        <p className="border-t border-border/60 pt-4 text-[11px] text-faint">
          Information à but éducatif — ne constitue pas un conseil en investissement. Les cours et
          rendements passés ne préjugent pas des performances futures.
        </p>
      </main>

      <JsonLd loaded={loaded} />
    </div>
  );
}

/* ── Rendu markdown restreint ─────────────────────────────────────────────── */
function Prose({ md, small = false }: { md: string; small?: boolean }) {
  return (
    <div
      className={`space-y-3 leading-relaxed text-muted ${small ? 'text-xs' : 'text-sm'} [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-white [&_h3]:font-semibold [&_h3]:text-ivory [&_a]:text-accent [&_a]:underline [&_strong]:text-ivory [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_th]:text-left [&_th]:text-faint [&_td]:tabular`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
    </div>
  );
}

/* ── Tableau du rendement du dividende ────────────────────────────────────── */
function DividendTable({ data }: { data: NonNullable<LoadedCitable['dividend']> }) {
  if (data.rows.length === 0) {
    return <p className="text-sm text-muted">Données de rendement indisponibles pour le moment.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-left text-xs text-faint">
            {data.rows.length} actions ayant distribué au titre de l&apos;exercice{' '}
            <strong className="text-muted">{data.exerciceRef}</strong> · dividendes NETS ·
            cours de la séance du {fmtDate(data.asOf)}
          </caption>
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 text-right font-medium">Dividende net {data.exerciceRef}</th>
              <th className="px-4 py-3 text-right font-medium">Cours</th>
              <th className="px-4 py-3 text-right font-medium">Rendement net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.rows.map((r, i) => (
              <tr key={r.code}>
                <td className="px-4 py-2.5 text-faint">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/societes/${r.code}`} className="font-medium text-ivory hover:text-accent">
                    {r.nom}
                  </Link>{' '}
                  <span className="text-[11px] text-faint">({r.code})</span>
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted">{nf.format(r.dividende)}</td>
                <td className="tabular px-4 py-2.5 text-right text-muted">{nf.format(r.cours)}</td>
                <td className="tabular px-4 py-2.5 text-right font-semibold text-up">
                  {r.rendementPct.toFixed(2)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">
        Rendement NET = dividende net de l&apos;exercice {data.exerciceRef} (tel que publié par
        l&apos;émetteur) ÷ cours de clôture. Classement établi sur les seuls dividendes à{' '}
        <strong className="text-muted">détachement daté et vérifié</strong> (source primaire) —
        chaque montant affiché est confirmé. Les titres dont le détachement n&apos;est pas encore
        enregistré apparaîtront au fil du cycle de distribution.
      </p>
    </div>
  );
}

/* ── Tableau des pièges du PER ────────────────────────────────────────────── */
const TRAP_STYLE: Record<string, string> = {
  danger: 'text-down',
  warn: 'text-warn',
  good: 'text-up',
  neutral: 'text-muted',
};
function PerTrapTable({ data }: { data: NonNullable<LoadedCitable['perTrap']> }) {
  if (data.rows.length === 0) {
    return <p className="text-sm text-muted">Données de PER indisponibles pour le moment.</p>;
  }
  // On met en avant les pièges et pertes ; le détail complet suit.
  const pieges = data.rows.filter((r) => r.severity === 'danger');
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-left text-xs text-faint">
            {data.rows.length} actions · PER = cours de la séance du {fmtDate(data.asOf)} ÷ BPA du
            dernier exercice · <strong className="text-down">{pieges.length}</strong> signaux de
            piège ou de perte
          </caption>
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 text-right font-medium">PER</th>
              <th className="px-4 py-3 text-right font-medium">Résultat net (dern. ex.)</th>
              <th className="px-4 py-3 text-right font-medium">Tendance</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.rows.map((r) => (
              <tr key={r.code} className={r.severity === 'danger' ? 'bg-down/5' : undefined}>
                <td className="px-4 py-2.5">
                  <Link href={`/societes/${r.code}`} className="font-medium text-ivory hover:text-accent">
                    {r.nom}
                  </Link>{' '}
                  <span className="text-[11px] text-faint">({r.code})</span>
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted">
                  {r.per == null ? '—' : r.per.toFixed(1)}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted">
                  {r.netDernier == null ? '—' : `${nf.format(Math.round(r.netDernier / 1e9 * 10) / 10)} Md`}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-muted">
                  {r.cagr == null ? '—' : `${r.cagr > 0 ? '+' : ''}${r.cagr.toFixed(0)} %/an`}
                </td>
                <td className={`px-4 py-2.5 text-xs font-medium ${TRAP_STYLE[r.severity] ?? 'text-muted'}`}>
                  {r.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-faint">
        PER = cours ÷ bénéfice par action du dernier exercice publié (aligné sur les fiches sociétés
        Sika Finance). Le verdict croise le PER avec la <strong className="text-muted">trajectoire
        du résultat net</strong> : un PER bas n&apos;est une décote que si le bénéfice tient. Analyse
        automatique à but éducatif, recalculée à chaque séance.
      </p>
    </div>
  );
}

/* ── JSON-LD : Article + Dataset (si data) + FAQPage ──────────────────────── */
function JsonLd({ loaded }: { loaded: LoadedCitable }) {
  const { page, dividend, perTrap } = loaded;
  const url = `${SITE}/analyses/${page.slug}`;

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: page.title,
      description: page.short_answer,
      author: { '@type': 'Organization', name: page.author },
      publisher: { '@id': `${SITE}/#organization` },
      dateModified: page.updated_at,
      mainEntityOfPage: url,
      ...(page.hero_image_url ? { image: page.hero_image_url } : {}),
    },
  ];

  if (dividend && dividend.rows.length > 0) {
    graph.push({
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: page.title,
      description: page.short_answer,
      creator: { '@id': `${SITE}/#organization` },
      dateModified: dividend.asOf ?? page.updated_at,
      temporalCoverage: dividend.asOf ?? undefined,
      variableMeasured: 'Rendement du dividende (dividende brut / cours de clôture)',
    });
  }

  if (perTrap && perTrap.rows.length > 0) {
    graph.push({
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: page.title,
      description: page.short_answer,
      creator: { '@id': `${SITE}/#organization` },
      dateModified: perTrap.asOf ?? page.updated_at,
      temporalCoverage: perTrap.asOf ?? undefined,
      variableMeasured: 'PER (cours / BPA) et verdict value trap (croisement PER × trajectoire du résultat net)',
    });
  }

  if (page.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) }}
    />
  );
}
