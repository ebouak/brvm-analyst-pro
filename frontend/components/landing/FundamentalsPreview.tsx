import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import type { FundamentalsRatios } from '@/lib/landing/fundamentals';

/**
 * Section 10 — les fondamentaux, en aperçu d'analyse financière.
 *
 * Les montants viennent de la table `fundamentals`, alimentée par extraction
 * des PDF de publications officielles ; les ratios sont dérivés par
 * `lib/landing/fundamentals.ts` et valent `null` dès qu'un opérande manque.
 * Rien n'est estimé ni extrapolé.
 *
 * Les mini-graphiques tracent les exercices RÉELLEMENT présents en base. Une
 * année sans montant est écartée en amont : une barre à zéro se lirait comme
 * « chiffre d'affaires nul », ce qui serait faux. Sous deux exercices,
 * aucun graphique n'est rendu.
 */

export interface FundamentalsYear {
  year: number;
  revenue: number | null;
  net_income: number | null;
  ratios: FundamentalsRatios;
}

export interface FundamentalsPreviewData {
  code: string;
  nom: string | null;
  year: number;
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt: number | null;
  ratios: FundamentalsRatios;
  historique: FundamentalsYear[];
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

/**
 * Barres verticales d'un agrégat sur les exercices disponibles.
 * L'échelle part de zéro, sinon une progression de 5 % paraîtrait spectaculaire.
 * Les valeurs négatives (une perte) sont tracées vers le bas, en rouge.
 */
function MiniBarres({
  titre,
  valeurs,
  format,
}: {
  titre: string;
  valeurs: { year: number; v: number | null }[];
  format: (v: number | null) => string;
}) {
  const dispo = valeurs.filter((x) => x.v != null) as { year: number; v: number }[];
  if (dispo.length < 2) return null;

  const max = Math.max(...dispo.map((x) => Math.abs(x.v)));
  const dernier = dispo[dispo.length - 1]!;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-muted">{titre}</p>
        <p className="tabular text-[13px] font-semibold text-ivory">{format(dernier.v)}</p>
      </div>

      <div className="mt-3 flex h-[52px] items-end gap-1.5" role="img"
           aria-label={`${titre} de ${dispo[0]!.year} à ${dernier.year}`}>
        {dispo.map((x) => {
          const h = max === 0 ? 2 : Math.max(2, (Math.abs(x.v) / max) * 100);
          const negatif = x.v < 0;
          return (
            <span key={x.year} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`w-full rounded-sm ${negatif ? 'bg-down/70' : 'bg-accent/70'}`}
                style={{ height: `${h}%` }}
              />
            </span>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {dispo.map((x) => (
          <span key={x.year} className="tabular flex-1 text-center text-[9px] text-faint">
            {String(x.year).slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FundamentalsPreview({ data }: { data: FundamentalsPreviewData | null }) {
  if (!data) return null;

  const h = data.historique;
  const lignes: { label: string; value: string; tone?: string }[] = [
    { label: 'Capitaux propres', value: `${montant(data.equity)} FCFA` },
    { label: 'Dettes', value: `${montant(data.debt)} FCFA` },
    {
      label: 'Dette / capitaux propres',
      value: data.ratios.gearing == null ? '—' : `${data.ratios.gearing.toFixed(2)}×`,
    },
  ];

  return (
    <section aria-labelledby="fonda-titre" className="mt-24">
      <div className="mb-8 max-w-[52ch]">
        <p className="overline mb-3 text-gold-2">Fondamentaux</p>
        <h2 id="fonda-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          Nous ne nous contentons pas d&apos;afficher les cours.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Les états financiers sont extraits des publications officielles des émetteurs, puis
          recoupés : bilan équilibré, cohérence résultat/BPA, ordre de grandeur. Un chiffre qui
          ne passe pas ces contrôles n&apos;est pas publié.
        </p>
      </div>

      <div className="rounded-panel border border-border bg-surface p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
          <span className="min-w-0">
            <span className="font-mono text-lg font-bold text-ivory">{data.code}</span>
            {data.nom && (
              <span className="ml-2 text-[11px] uppercase tracking-wide text-faint">{data.nom}</span>
            )}
          </span>
          <span className="tabular shrink-0 text-xs text-muted">
            {h.length > 1 ? `Exercices ${h[0]!.year} – ${data.year}` : `Exercice ${data.year}`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniBarres
            titre="Chiffre d'affaires"
            valeurs={h.map((x) => ({ year: x.year, v: x.revenue }))}
            format={(v) => `${montant(v)} FCFA`}
          />
          <MiniBarres
            titre="Résultat net"
            valeurs={h.map((x) => ({ year: x.year, v: x.net_income }))}
            format={(v) => `${montant(v)} FCFA`}
          />
          <MiniBarres
            titre="Marge nette"
            valeurs={h.map((x) => ({ year: x.year, v: x.ratios.margeNettePct }))}
            format={pct}
          />
          <MiniBarres
            titre="ROE"
            valeurs={h.map((x) => ({ year: x.year, v: x.ratios.roePct }))}
            format={pct}
          />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-border pt-4 sm:grid-cols-3">
          {lignes.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[12px] text-muted">{l.label}</dt>
              <dd className={`tabular text-[13px] font-medium ${l.tone ?? 'text-ivory'}`}>{l.value}</dd>
            </div>
          ))}
        </dl>

        <Link
          href="/methodologie"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
        >
          Notre méthodologie <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
