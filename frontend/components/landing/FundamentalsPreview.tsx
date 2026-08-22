import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import type { FundamentalsRatios } from '@/lib/landing/fundamentals';

/**
 * Section 10 — les fondamentaux.
 *
 * Montre que WESTBOURSE ne se limite pas aux cours. Les montants viennent de
 * la table `fundamentals`, alimentée par extraction des PDF de publications
 * officielles ; les ratios sont dérivés par `lib/landing/fundamentals.ts` et
 * valent `null` dès qu'un opérande manque. Rien n'est estimé ni extrapolé.
 */

export interface FundamentalsPreviewData {
  code: string;
  nom: string | null;
  year: number;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt: number | null;
  ratios: FundamentalsRatios;
}

/** Montants en FCFA, souvent en milliards : on abrège pour rester lisible. */
function montant(v: number | null): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${fmtNumber(v / 1e9, 1)} Md`;
  if (abs >= 1e6) return `${fmtNumber(v / 1e6, 1)} M`;
  return fmtNumber(v);
}

function pct(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)} %`;
}

export function FundamentalsPreview({ data }: { data: FundamentalsPreviewData | null }) {
  if (!data) return null;

  const lignes: { label: string; value: string; tone?: string }[] = [
    { label: "Chiffre d'affaires", value: `${montant(data.revenue)} FCFA` },
    {
      label: 'Résultat net',
      value: `${montant(data.net_income)} FCFA`,
      tone: data.net_income == null ? undefined : data.net_income >= 0 ? 'text-up' : 'text-down',
    },
    {
      label: 'Marge nette',
      value: pct(data.ratios.margeNettePct),
      tone:
        data.ratios.margeNettePct == null ? undefined : data.ratios.margeNettePct >= 0 ? 'text-up' : 'text-down',
    },
    { label: 'Capitaux propres', value: `${montant(data.equity)} FCFA` },
    { label: 'Dettes', value: `${montant(data.debt)} FCFA` },
    { label: 'ROE', value: pct(data.ratios.roePct) },
    {
      label: 'Dette / capitaux propres',
      value: data.ratios.gearing == null ? '—' : `${data.ratios.gearing.toFixed(2)}×`,
    },
  ];

  return (
    <section aria-labelledby="fonda-titre" className="mt-14">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="max-w-[50ch]">
          <p className="overline mb-3 text-gold-2">Fondamentaux</p>
          <h2 id="fonda-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
            Nous ne nous contentons pas d&apos;afficher les cours.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Les états financiers sont extraits des publications officielles des émetteurs, puis
            recoupés : bilan équilibré, cohérence résultat/BPA, ordre de grandeur. Un chiffre qui
            ne passe pas ces contrôles n&apos;est pas publié.
          </p>
          <Link
            href="/methodologie"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
          >
            Notre méthodologie <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rounded-panel border border-border bg-surface p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <span className="min-w-0">
              <span className="font-mono text-base font-bold text-ivory">{data.code}</span>
              {data.nom && <span className="ml-2 truncate text-[11px] uppercase tracking-wide text-faint">{data.nom}</span>}
            </span>
            <span className="tabular shrink-0 text-xs text-muted">Exercice {data.year}</span>
          </div>

          <dl className="space-y-2.5">
            {lignes.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-[12px] text-muted">{l.label}</dt>
                <dd className={`tabular text-[13px] font-medium ${l.tone ?? 'text-ivory'}`}>{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
