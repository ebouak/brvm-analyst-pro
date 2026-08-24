// frontend/components/landing/HeroDeviceMockup.tsx
import Link from 'next/link';
import { sparklinePath } from '@/lib/landing/sparkline';
import { fmtNumber } from '@/lib/format';
import { SubscoreBars, type SubscoreCouleurs } from '@/components/landing/SubscoreBars';
import type { TickItem } from '@/components/landing/taste/types';
import type { SignalDaily } from '@/lib/types';

interface Rated {
  code: string;
  score: number | null;
  confiance: number | null;
}

interface Props {
  dateLabel: string | null;
  ticks: TickItem[];
  brvmC: number | null;
  brvmCVar: number | null;
  /** Clôtures récentes du BRVM-C. La BRVM ne publie pas d'intraday : jamais de courbe simulée. */
  brvmcSerie: number[];
  topRated: Rated[];
  diagnostic: (SignalDaily & { code: string }) | null;
  nbHausses: number;
  nbBaisses: number;
  volumeTotal: number;
  nbTransactions: number;
}

/**
 * Hero : terminal de marché WESTBOURSE.
 *
 * Le panneau de droite n'est pas une illustration, c'est le produit avec ses
 * vraies données : indice et sa courbe, variations de la séance, notes A–F et
 * sous-scores du signal. Quatre panneaux séparés par des filets de 1 px, à la
 * manière d'un terminal financier.
 *
 * ⚠️ Couleurs de texte et de fond VOLONTAIREMENT FIXES dans toute la section :
 * le hero reste sombre quel que soit le thème du site. Un texte piloté par
 * token deviendrait illisible en mode clair (ivory clair → quasi noir sur un
 * fond qui, lui, ne change jamais). Même parti pris que le Footer.
 */

const BG = '#04070d';
const LIGNE = 'rgba(255,255,255,0.09)';
const CYAN = '#56d7fd';
const VERT = '#3fe18b';
const ROUGE = '#ff6b6b';
const GRIS = '#7d8a90';

/** Le terminal reste sombre quel que soit le thème : couleurs fixes, pas de tokens. */
const COULEURS_TERMINAL: SubscoreCouleurs = {
  label: GRIS,
  piste: 'rgba(255,255,255,0.08)',
  favorable: CYAN,
  defavorable: ROUGE,
  repere: 'rgba(255,255,255,0.22)',
};

/** Lettre A–F à partir du score total, même échelle que RatingBadge. */
function lettre(score: number | null): string {
  if (score == null) return '—';
  if (score >= 0.6) return 'A';
  if (score >= 0.35) return 'B+';
  if (score >= 0.15) return 'B';
  if (score >= 0) return 'C';
  if (score >= -0.25) return 'D';
  return 'E';
}


function Panneau({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-3.5 ${className}`} style={{ background: BG }}>
      {children}
    </div>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8fe6ff' }}>
      {children}
    </p>
  );
}

export function HeroDeviceMockup({
  dateLabel,
  ticks,
  brvmC,
  brvmCVar,
  brvmcSerie,
  topRated,
  diagnostic,
  nbHausses,
  nbBaisses,
  volumeTotal,
  nbTransactions,
}: Props) {
  const top = ticks.slice(0, 5);
  const geo = sparklinePath(brvmcSerie, 300, 60);
  const indiceUp = (brvmCVar ?? 0) >= 0;

  return (
    <section
      className="relative mt-6 overflow-hidden rounded-panel"
      style={{ background: BG, border: `1px solid ${LIGNE}` }}
    >
      {/* Halo cyan discret + grille financière ténue : atmosphère, pas décoration. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(65% 65% at 6% 0%, rgba(86,215,253,.12), transparent 60%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(86,215,253,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(86,215,253,.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
        aria-hidden
      />

      <div className="relative grid grid-cols-1 items-center gap-8 p-6 sm:p-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10 lg:p-10">
        {/* ── Colonne discours ───────────────────────────────────────── */}
        <div>
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ border: '1px solid rgba(86,215,253,0.3)', color: '#8fe6ff' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: VERT }} />
            La plateforme de référence BRVM
          </span>

          <h1
            className="mt-5 font-display text-[clamp(30px,4.4vw,46px)] font-medium leading-[1.04] tracking-[-0.035em]"
            style={{ color: '#fcfcfc' }}
          >
            Décidez sur la BRVM avec des <span style={{ color: CYAN }}>données</span>, pas des rumeurs.
          </h1>

          <p className="mt-5 max-w-[48ch] text-[14.5px] leading-[1.7]" style={{ color: '#b5b5b5' }}>
            Cours, fondamentaux, dividendes, valorisation, signaux quantitatifs et analyse IA réunis
            dans une seule plateforme dédiée à la BRVM.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="landing-hero-cta inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-7 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
            >
              Créer mon compte gratuit <span aria-hidden>→</span>
            </Link>
            <Link
              href="/societes"
              className="inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-6 text-sm font-medium transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.16)', color: '#fcfcfc' }}
            >
              Explorer la BRVM <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* ── Terminal ───────────────────────────────────────────────── */}
        <div
          className="overflow-hidden rounded-2xl shadow-[0_28px_70px_-28px_rgba(0,0,0,0.9)]"
          style={{ border: `1px solid ${LIGNE}` }}
        >
          <div
            className="flex items-center justify-between px-3.5 py-2"
            style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${LIGNE}` }}
          >
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#8fe6ff' }}>
              Terminal WESTBOURSE
            </span>
            {dateLabel && (
              <span className="text-[9.5px]" style={{ color: GRIS }}>
                Séance du {dateLabel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-px sm:grid-cols-12" style={{ background: LIGNE }}>
            {/* Indice + courbe + statistiques de séance */}
            <Panneau className="sm:col-span-7">
              <Titre>BRVM-C</Titre>
              <div className="flex items-baseline gap-3">
                <span className="tabular font-display text-[clamp(26px,3.4vw,38px)] leading-none" style={{ color: '#fcfcfc' }}>
                  {brvmC != null ? brvmC.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
                </span>
                {brvmCVar != null && (
                  <span className="tabular text-sm font-bold" style={{ color: indiceUp ? VERT : ROUGE }}>
                    {indiceUp ? '+' : ''}
                    {brvmCVar.toFixed(2)}&nbsp;%
                  </span>
                )}
              </div>
              {geo ? (
                <svg viewBox="0 0 300 60" className="mt-2 h-auto w-full" fill="none" aria-hidden>
                  <path d={geo.area} fill={indiceUp ? VERT : ROUGE} opacity={0.12} />
                  <path d={geo.line} stroke={indiceUp ? VERT : ROUGE} strokeWidth={1.8} strokeLinejoin="round" />
                </svg>
              ) : (
                <p className="mt-3 text-[10px]" style={{ color: GRIS }}>Historique indisponible.</p>
              )}
              <dl className="mt-3 grid grid-cols-4 gap-2 border-t pt-2.5" style={{ borderColor: LIGNE }}>
                {[
                  { l: 'Volume', v: volumeTotal > 0 ? fmtNumber(volumeTotal) : '—' },
                  { l: 'Hausses', v: String(nbHausses) },
                  { l: 'Baisses', v: String(nbBaisses) },
                  { l: 'Transact.', v: nbTransactions > 0 ? fmtNumber(nbTransactions) : '—' },
                ].map((x) => (
                  <div key={x.l}>
                    <dt className="text-[8.5px] uppercase tracking-wide" style={{ color: GRIS }}>{x.l}</dt>
                    <dd className="tabular mt-0.5 text-[12.5px] font-medium" style={{ color: '#fcfcfc' }}>{x.v}</dd>
                  </div>
                ))}
              </dl>
            </Panneau>

            {/* Diagnostic : sous-scores réels du signal */}
            <Panneau className="sm:col-span-5">
              <Titre>Diagnostic WESTBOURSE</Titre>
              {diagnostic ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-bold" style={{ color: '#fcfcfc' }}>{diagnostic.code}</span>
                    <span className="font-display text-3xl leading-none" style={{ color: CYAN }}>
                      {lettre(diagnostic.score_total ?? null)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <SubscoreBars signal={diagnostic} couleurs={COULEURS_TERMINAL} compact />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: LIGNE }}>
                    <span className="text-[9px] uppercase tracking-wide" style={{ color: GRIS }}>Signal</span>
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[10px] font-bold"
                      style={{ background: 'rgba(63,225,139,0.14)', color: VERT }}
                    >
                      {diagnostic.signal ?? '—'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wide" style={{ color: GRIS }}>Confiance</span>
                    <span className="tabular text-[11px] font-bold" style={{ color: '#fcfcfc' }}>
                      {diagnostic.confiance != null ? `${(diagnostic.confiance * 100).toFixed(0)} %` : '—'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-[10px]" style={{ color: GRIS }}>Signal indisponible.</p>
              )}
            </Panneau>

            {/* Top variations de la séance */}
            <Panneau className="sm:col-span-7">
              <Titre>Top variations</Titre>
              {top.length > 0 ? (
                <ul className="space-y-1">
                  {top.map((t) => (
                    <li key={t.sym} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="font-mono text-[11.5px] font-bold" style={{ color: '#fcfcfc' }}>{t.sym}</span>
                      <span className="tabular text-[11.5px] font-bold" style={{ color: t.dir === 'up' ? VERT : ROUGE }}>
                        {t.pct}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-[10px]" style={{ color: GRIS }}>Séance indisponible.</p>
              )}
            </Panneau>

            {/* Meilleures notes A–F de la séance */}
            {topRated.length > 0 && (
              <Panneau className="sm:col-span-5">
                <Titre>Meilleures notes de la séance</Titre>
                <div className="grid grid-cols-3 gap-2">
                  {topRated.map((r) => (
                    <div
                      key={r.code}
                      className="rounded-lg px-2.5 py-2 text-center"
                      style={{ background: 'rgba(255,255,255,0.035)' }}
                    >
                      <p className="font-mono text-[10.5px]" style={{ color: GRIS }}>{r.code}</p>
                      <p className="font-display text-2xl leading-none" style={{ color: CYAN }}>{lettre(r.score)}</p>
                      <p className="tabular mt-0.5 text-[9px]" style={{ color: GRIS }}>
                        {r.confiance != null ? `conf. ${(r.confiance * 100).toFixed(0)} %` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </Panneau>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
