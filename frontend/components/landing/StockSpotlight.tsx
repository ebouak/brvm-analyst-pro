import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import { sparklinePath } from '@/lib/landing/sparkline';
import { fmtNumber } from '@/lib/format';

/**
 * Section 09 — « Comprendre une action ».
 *
 * Montre sur la landing une fraction réelle de la profondeur d'une fiche
 * société : données de séance complètes, capitalisation, bêta, note A–F,
 * signal et courbe de tendance. Toutes les valeurs viennent de
 * `brvm_actions_daily`, `brvm_instruments`, `signals_daily` et `dividends`
 * pour une valeur réellement cotée à la dernière séance.
 *
 * Aucune métrique n'est fabriquée : une donnée absente s'affiche « — ».
 */

export interface StockDetail {
  code: string;
  nom: string | null;
  cours: number | null;
  variation_pct: number | null;
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  cours_precedent: number | null;
  volume: number | null;
  valeur_echangee: number | null;
  nb_transactions: number | null;
  beta_1an: number | null;
  /** Capitalisation boursière (brvm_actions_daily.valorisation). */
  valorisation: number | null;
  /** Nombre de titres (brvm_instruments.shares). */
  titres: number | null;
  rendementDividendePct: number | null;
  score: number | null;
  confiance: number | null;
  signal: string | null;
  /** Clôtures réelles récentes, pour la courbe de tendance. */
  serie: number[];
}

const W = 520;
const H = 132;

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border/50 pt-2">
      <dt className="text-[10px] leading-tight text-faint">{label}</dt>
      <dd className="tabular mt-0.5 text-[13px] font-medium text-ivory">{value}</dd>
    </div>
  );
}

const n0 = (v: number | null) => (v == null ? '—' : fmtNumber(v));
const n2 = (v: number | null) => (v == null ? '—' : fmtNumber(v, 2));

export function StockSpotlight({ stock, dateLabel }: { stock: StockDetail | null; dateLabel: string | null }) {
  if (!stock) return null;

  const v = stock.variation_pct ?? 0;
  const up = v > 0;
  const down = v < 0;
  const tone = up ? 'text-up' : down ? 'text-down' : 'text-muted';
  const geo = sparklinePath(stock.serie, W, H);

  return (
    <section aria-labelledby="action-titre" className="mt-14">
      <div className="mb-8 max-w-[52ch]">
        <p className="overline mb-3 text-gold-2">Comprendre une action</p>
        <h2 id="action-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          Tout ce qu&apos;il faut savoir, sur un seul écran.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Voici ce que vous trouvez sur chacune des fiches société — celle-ci est réelle et date
          {dateLabel ? ` de la séance du ${dateLabel}` : ' de la dernière séance'}.
        </p>
      </div>

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Colonne gauche : identité, cours, note, signal */}
          <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-bold text-ivory">{stock.code}</span>
              <RatingBadge scoreTotal={stock.score} confiance={stock.confiance} />
            </div>
            {stock.nom && <p className="mt-1 text-xs uppercase tracking-wide text-faint">{stock.nom}</p>}

            <p className="tabular mt-5 font-display text-[clamp(32px,5vw,44px)] leading-none text-ivory">
              {n0(stock.cours)} <span className="text-base font-normal text-faint">FCFA</span>
            </p>
            <p className={`tabular mt-2 text-lg font-bold ${tone}`}>
              {up ? '+' : ''}
              {v.toFixed(2)}&nbsp;%
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {stock.signal && (
                <span className="rounded-full border border-accent/30 bg-accent/[0.07] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                  Signal {stock.signal}
                </span>
              )}
              {stock.confiance != null && (
                <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted">
                  Confiance {(stock.confiance * 100).toFixed(0)}&nbsp;%
                </span>
              )}
            </div>

            <Link
              href={`/societes/${stock.code}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2"
            >
              Voir la fiche complète <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Colonne droite : courbe + données de séance */}
          <div className="p-6">
            {geo ? (
              <div className={`${tone} -mx-1`}>
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" fill="none" role="img"
                     aria-label={`Tendance récente de ${stock.code}`}>
                  <path d={geo.area} fill="currentColor" opacity={0.1} />
                  <path d={geo.line} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </svg>
                <p className="mt-1 text-[10px] text-faint">
                  Clôtures des {stock.serie.length} dernières séances cotées.
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-faint">Historique insuffisant pour tracer une tendance.</p>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
              <Cell label="Ouverture" value={n0(stock.ouverture)} />
              <Cell label="Plus haut" value={n0(stock.plus_haut)} />
              <Cell label="Plus bas" value={n0(stock.plus_bas)} />
              <Cell label="Clôture précédente" value={n0(stock.cours_precedent)} />
              <Cell label="Volume" value={n0(stock.volume)} />
              <Cell label="Valeur échangée" value={stock.valeur_echangee == null ? '—' : `${fmtNumber(stock.valeur_echangee)} FCFA`} />
              <Cell label="Transactions" value={n0(stock.nb_transactions)} />
              <Cell label="Bêta 1 an" value={n2(stock.beta_1an)} />
              <Cell label="Capitalisation" value={stock.valorisation == null ? '—' : `${fmtNumber(stock.valorisation)} FCFA`} />
              <Cell label="Titres" value={n0(stock.titres)} />
              <Cell
                label="Rendement dividende"
                value={stock.rendementDividendePct == null ? '—' : `${stock.rendementDividendePct.toFixed(2)} %`}
              />
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
