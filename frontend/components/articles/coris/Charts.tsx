import {
  BRIDGE_EVENTS,
  CORIS_IPOS,
  CORIS_RATIOS,
  DIVIDENDE_WINDOW,
  DIVIDENDE_STATS,
} from '@/lib/articles/corisIpo';

const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

export function HeroLiquidityVisual() {
  return (
    <figure className="coris-hero-visual" role="img" aria-labelledby="coris-hero-title coris-hero-desc">
      <svg viewBox="0 0 720 680" aria-hidden="true">
        <defs>
          <pattern id="coris-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(23,22,18,.09)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="720" height="680" rx="4" fill="#e9e3d5" />
        <rect width="720" height="680" rx="4" fill="url(#coris-grid)" />
        <circle cx="420" cy="312" r="206" fill="#171612" />
        <circle cx="420" cy="312" r="152" fill="none" stroke="#76d3dc" strokeWidth="1.5" strokeDasharray="4 7" />
        <circle cx="420" cy="312" r="105" fill="#e9e3d5" />
        <text x="420" y="285" textAnchor="middle" fill="#171612" className="coris-svg-kicker">MONTANT ANNONCÉ</text>
        <text x="420" y="361" textAnchor="middle" fill="#171612" className="coris-svg-big">81 Md</text>
        <text x="420" y="395" textAnchor="middle" fill="#625e54" className="coris-svg-small">FCFA · deux opérations</text>
        <path d="M92 94 H250 V128 H92 Z" fill="none" stroke="#171612" />
        <text x="106" y="116" fill="#171612" className="coris-svg-kicker">SEANCE</text>
        <text x="92" y="176" fill="#171612" className="coris-svg-mid">{number(CORIS_RATIOS.foisSeance, 1)}×</text>
        <text x="92" y="203" fill="#625e54" className="coris-svg-small">la valeur observée le 19/11</text>
        <path d="M92 454 H274 V488 H92 Z" fill="none" stroke="#171612" />
        <text x="106" y="476" fill="#171612" className="coris-svg-kicker">CAPITALISATION</text>
        <text x="92" y="536" fill="#171612" className="coris-svg-mid">{number(CORIS_RATIOS.capitalisationPct, 2)} %</text>
        <text x="92" y="563" fill="#625e54" className="coris-svg-small">du marché actions</text>
        <path d="M420 518 V632 H626" fill="none" stroke="#171612" strokeWidth="2" />
        <circle cx="626" cy="632" r="7" fill="#076880" />
        <text x="420" y="604" fill="#076880" className="coris-svg-kicker">MOUVEMENT DE CASH</text>
      </svg>
      <figcaption>
        <strong id="coris-hero-title">Grand pour les flux, petit pour la capitalisation.</strong>
        <span id="coris-hero-desc">
          Les 81 Md annoncés pèsent près de 7,3 fois une séance observée, mais seulement 0,42 % de la capitalisation actions.
        </span>
      </figcaption>
    </figure>
  );
}

export function IpoAmountChart() {
  const max = Math.max(...CORIS_IPOS.map((ipo) => ipo.montantMd));
  return (
    <figure className="coris-chart" role="img" aria-labelledby="ipo-chart-title ipo-chart-desc">
      <div className="coris-chart__head">
        <div>
          <span>01 · OPÉRATIONS ANNONCÉES</span>
          <h3 id="ipo-chart-title">La Côte d’Ivoire concentre trois quarts de la levée.</h3>
        </div>
        <strong>81 Md</strong>
      </div>
      <div className="coris-ipo-bars">
        {CORIS_IPOS.map((ipo) => (
          <div key={ipo.code} className="coris-ipo-row">
            <div>
              <span>{ipo.code}</span>
              <strong>{ipo.nom}</strong>
            </div>
            <div className="coris-ipo-track" aria-hidden="true">
              <i style={{ width: `${ipo.montantMd / max * 100}%` }} />
            </div>
            <p><strong>{ipo.montantMd} Md</strong><span>{number(ipo.partAnnoncedPct, 0)} % du total</span></p>
          </div>
        ))}
      </div>
      <figcaption id="ipo-chart-desc">
        Montants annoncés au 19 novembre 2026. Prix par action, nombre de titres et structure de l’offre non publiés.
      </figcaption>
    </figure>
  );
}

export function BridgeEventChart() {
  const width = 920;
  const height = 430;
  const left = 58;
  const top = 52;
  const plotWidth = 810;
  const plotHeight = 210;
  const volumeTop = 286;
  const volumeHeight = 74;
  const y = (value: number) => top + (3 - value) / 9 * plotHeight;
  const volumeY = (value: number) => volumeTop + volumeHeight - value / 100 * volumeHeight;
  const baseline = y(0);
  const centers = BRIDGE_EVENTS.map((_, index) => left + plotWidth / BRIDGE_EVENTS.length * (index + 0.5));
  const ligne = (key: 'brvmcPct' | 'financePct') =>
    BRIDGE_EVENTS.map((event, index) => `${centers[index]},${y(event[key])}`).join(' ');

  return (
    <figure className="coris-chart coris-chart--wide" role="img" aria-labelledby="bridge-chart-title bridge-chart-desc">
      <div className="coris-chart__head">
        <div>
          <span>02 · PRÉCÉDENT BRIDGE 2026</span>
          <h3 id="bridge-chart-title">La tension est apparue à l’ouverture, pas à la cotation.</h3>
        </div>
        <div className="coris-bridge-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bridge-bank-group-logo.svg" alt="Bridge Bank Group Côte d’Ivoire" width="164" height="28" />
          <span>Cas comparable · 2026</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="coris-svg-chart" aria-hidden="true">
        {[-6, -3, 0, 3].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={left + plotWidth} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#171612' : '#c9c1b3'} strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={left - 12} y={y(tick) + 5} textAnchor="end" className="coris-axis">{tick > 0 ? `+${tick}` : tick}%</text>
          </g>
        ))}
        <polyline points={ligne('brvmcPct')} fill="none" stroke="#171612" strokeWidth="3" />
        <polyline points={ligne('financePct')} fill="none" stroke="#076880" strokeWidth="3" />
        <line x1={left} x2={left + plotWidth} y1={volumeTop} y2={volumeTop} stroke="#bdb6a8" />
        {BRIDGE_EVENTS.map((event, index) => {
          const center = centers[index]!;
          const barWidth = 62;
          return (
            <g key={event.date}>
              <rect
                x={center - barWidth / 2}
                y={volumeY(event.valeurVsRefPct)}
                width={barWidth}
                height={Math.max(volumeTop + volumeHeight - volumeY(event.valeurVsRefPct), 1)}
                rx="2"
                fill="#c2b9a8"
              ><title>{`${event.phase} — valeur ${number(event.valeurVsRefPct, 1)} % de la référence 5 séances`}</title></rect>
              <circle cx={center} cy={y(event.brvmcPct)} r="6" fill="#171612">
                <title>{`BRVM-C ${event.date} : ${number(event.brvmcPct, 2)} %`}</title>
              </circle>
              <circle cx={center} cy={y(event.financePct)} r="6" fill="#076880">
                <title>{`Services financiers ${event.date} : ${number(event.financePct, 2)} %`}</title>
              </circle>
              <text x={center} y={volumeY(event.valeurVsRefPct) - 7} textAnchor="middle" className="coris-axis-value">
                {number(event.valeurVsRefPct, 0)} %
              </text>
              <text x={center} y={height - 70} textAnchor="middle" className="coris-axis-strong">{event.date}</text>
              <text x={center} y={height - 48} textAnchor="middle" className="coris-axis">{event.phase}</text>
              <text x={center} y={height - 20} textAnchor="middle" className="coris-axis">valeur / réf. 5 séances</text>
            </g>
          );
        })}
        <line x1={left} x2={left + plotWidth} y1={baseline} y2={baseline} stroke="#171612" strokeWidth="1.5" />
      </svg>
      <div className="coris-bridge-mobile">
        {BRIDGE_EVENTS.map((event) => (
          <article key={event.date}>
            <div><span>{event.date}</span><strong>{event.phase}</strong></div>
            <dl>
              <div><dt>BRVM-C</dt><dd>{event.brvmcPct > 0 ? '+' : ''}{number(event.brvmcPct, 2)} %</dd></div>
              <div><dt>Finance</dt><dd>{event.financePct > 0 ? '+' : ''}{number(event.financePct, 2)} %</dd></div>
              <div><dt>Valeur</dt><dd>{number(event.valeurVsRefPct, 0)} % de réf.</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className="coris-legend">
        <span><i className="coris-legend__composite" /> BRVM-C</span>
        <span><i className="coris-legend__finance" /> Services financiers</span>
        <span><i className="coris-legend__value" /> Valeur échangée / moyenne 5 séances</span>
      </div>
      <figcaption id="bridge-chart-desc">
        L’ouverture de l’OPV Bridge coïncide avec une séance bancaire plus faible et une valeur divisée par deux. La première cotation, deux mois plus tard, se produit dans un marché largement haussier.
      </figcaption>
    </figure>
  );
}

export function DividendWindowChart() {
  const points = DIVIDENDE_WINDOW.map((point, index) => ({
    ...point,
    x: 74 + index * 226,
    y: 92 + (-point.variationPct) * 30,
  }));
  return (
    <figure className="coris-chart" role="img" aria-labelledby="dividend-chart-title dividend-chart-desc">
      <div className="coris-chart__head">
        <div>
          <span>03 · 26 DÉTACHEMENTS</span>
          <h3 id="dividend-chart-title">Le réinvestissement ne garantit aucun rattrapage.</h3>
        </div>
      </div>
      <div className="coris-dividend-chart">
        <svg viewBox="0 0 600 205" role="img" aria-label="Performance médiane ajustée avant, au détachement et cinq séances après">
          <line x1="48" x2="552" y1="92" y2="92" stroke="#bdb6a8" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#171612" strokeWidth="3" />
          {points.map((point) => (
            <g key={point.phase}>
              <line x1={point.x} x2={point.x} y1="45" y2="158" stroke="#d8d1c5" />
              <circle cx={point.x} cy={point.y} r="8" fill={point.variationPct >= 0 ? '#087f8c' : '#7e3d31'}>
                <title>{`${point.phase} : ${number(point.variationPct, 2)} %`}</title>
              </circle>
              <text x={point.x} y={point.y - 15} textAnchor="middle" className="coris-event-value">
                {point.variationPct > 0 ? '+' : ''}{number(point.variationPct, 2)} %
              </text>
              <text x={point.x} y="182" textAnchor="middle" className="coris-event-label">{point.phase}</text>
            </g>
          ))}
          <text x="48" y="88" textAnchor="start" className="coris-axis">0 %</text>
        </svg>
      </div>
      <div className="coris-dividend-stats">
        <div><strong>{DIVIDENDE_STATS.partHausseAvantPct}%</strong><span>de séances en hausse avant</span></div>
        <div><strong>{DIVIDENDE_STATS.partHausseExDatePct}%</strong><span>positives à l’ex-date</span></div>
        <div><strong>{number(DIVIDENDE_STATS.volumeExDateVsAvant, 2)}×</strong><span>valeur échangée / avant</span></div>
      </div>
      <figcaption id="dividend-chart-desc">
        Médianes ajustées de la médiane marché sur cinq séances avant/après. Le comportement est compatible avec une capture de dividende, sans prouver le motif des investisseurs.
      </figcaption>
    </figure>
  );
}
