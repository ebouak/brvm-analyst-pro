// frontend/components/landing/DiagnosticSpotlight.tsx
import Link from 'next/link';

interface Props {
  report: { code: string; generated_at: string; markdown_content: string } | null;
}

function excerpt(markdown: string, maxLen = 280): string {
  const plain = markdown.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  const cut = plain.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace)}…`;
}

export function DiagnosticSpotlight({ report }: Props) {
  return (
    <section className="mt-10 rounded-panel border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-6 md:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div>
          <p className="overline mb-3 text-gold-2">Diagnostic IA · Premium</p>
          <h2 className="mb-3 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
            Votre analyste BRVM en quelques secondes.
          </h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
            Une analyse façon sell-side sur chaque société — valorisation, forces, risques — générée à
            partir des données réelles de la plateforme. Un outil d&apos;analyse complémentaire, jamais
            une recommandation d&apos;achat ou de vente.
          </p>
          <Link
            href="/premium/diagnostic"
            className="landing-hero-cta mt-5 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full px-5 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
          >
            Découvrir Premium <span aria-hidden>→</span>
          </Link>
        </div>

        {report ? (
          <div className="rounded-panel border border-white/10 bg-surface p-5 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-ivory">{report.code}</span>
              <span className="text-[10px] text-faint">
                {new Date(report.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ivory/85">{excerpt(report.markdown_content)}</p>
            <p className="mt-4 text-[10px] text-faint">
              Exemple réel effectivement généré. Votre analyse sera personnalisée à chaque société.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-sunken/30 p-6 text-center">
            <p className="text-sm text-faint">Un exemple de diagnostic s&apos;affichera ici dès qu&apos;un rapport aura été généré.</p>
          </div>
        )}
      </div>
    </section>
  );
}
