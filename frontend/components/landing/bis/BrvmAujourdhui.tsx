import Link from 'next/link';
import type { LandingBisData, Mover } from '@/lib/landing/bisData';
import type { Fraicheur } from '@/lib/freshness';
import { seanceNarrative } from '@/lib/landing/seanceNarrative';
import { fmtNumber } from '@/lib/format';
import { IndexChart } from './IndexChart';

/**
 * « La BRVM aujourd'hui » — aperçu de séance, charte claire, structure en
 * quatre rangées : indice + courbe + jauge + flash ; tuiles hausses / stables
 * / baisses + chiffres clés ; top 5 + « ce que dit la séance » ; performance
 * des secteurs. Tout vient de `getLandingBisData` ; les textes sont dérivés
 * (lib/landing/seanceNarrative, testé). Pas de plus-haut / plus-bas d'indice :
 * la BRVM ne les publie pas (CLAUDE.md §9) ; on montre veille et clôture.
 */

const pct = (v: number | null, d = 2) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const tone = (v: number | null) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
const fmtMd = (v: number) => v >= 1e9 ? `${(v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md` : v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : fmtNumber(v);
const fmtM = (v: number | null) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M` : v >= 1e3 ? `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k` : fmtNumber(v);
const fmt2 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Jauge en demi-cercle : arc rouge → ambre → vert, aiguille sur le score. */
function Gauge({ score }: { score: number }) {
  const cx = 100, cy = 96, r = 78;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const a = Math.max(0, Math.min(100, score)) / 100;
  const nx = cx + (r - 14) * Math.cos(Math.PI * (1 - a)), ny = cy - (r - 14) * Math.sin(Math.PI * (1 - a));
  return (
    <svg viewBox="0 0 200 104" className="gauge-svg" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(score)} aria-label="Sentiment de séance">
      <path d={arc(0, 0.4)} fill="none" stroke="#c4423f" strokeWidth="14" strokeLinecap="butt" />
      <path d={arc(0.4, 0.6)} fill="none" stroke="#e0b64a" strokeWidth="14" />
      <path d={arc(0.6, 1)} fill="none" stroke="#1f8f5a" strokeWidth="14" />
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#10203a" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#10203a" />
    </svg>
  );
}

function Row({ m, i }: { m: Mover; i: number }) {
  return (
    <tr>
      <td className="num rk">{i + 1}</td>
      <td><Link href={`/societes/${m.code}`} className="code num">{m.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.logo} alt="" width={22} height={22} className="logo-soc" loading="lazy" />}{m.code}</Link></td>
      <td className="num">{fmtNumber(m.cours)}</td>
      <td><span className={`chip num ${tone(m.variation)}`}>{pct(m.variation)}</span></td>
      <td className="num vol">{fmtM(m.valeur ?? null)}</td>
      <td>{m.spark ? <svg viewBox="0 0 44 16" width="56" height="18" aria-hidden="true"><path d={m.spark} fill="none" stroke={m.variation >= 0 ? '#1f8f5a' : '#c4423f'} strokeWidth="1.6" /></svg> : <span className="empty-spark" aria-hidden="true">—</span>}</td>
    </tr>
  );
}

function Table({ titre, rows, tone: t, href, vide }: { titre: string; rows: Mover[]; tone: 'up' | 'down'; href: string; vide: string }) {
  return (
    <div className="card top">
      <div className="top-head">
        <h3 className={t}><span className="badge" aria-hidden="true">{t === 'up' ? '↑' : '↓'}</span>{titre}</h3>
        <Link href={href} className={`more ${t}`}>Voir les 47 sociétés →</Link>
      </div>
      {rows.length ? (
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Valeur</th><th scope="col">Cours (FCFA)</th><th scope="col">Variation</th><th scope="col" title="Valeur échangée, en FCFA">Échangé</th><th scope="col">Graphique</th></tr></thead>
          <tbody>{rows.map((m, i) => <Row key={m.code} m={m} i={i} />)}</tbody>
        </table>
      ) : <p className="empty">{vide}</p>}
    </div>
  );
}

export function BrvmAujourdhui({ d, fraicheur, dateLabel }: { d: LandingBisData; fraicheur: Fraicheur; dateLabel: string | null }) {
  const n = seanceNarrative({
    nbActions: d.nbActions, hausses: d.hausses, baisses: d.baisses, inchangees: d.inchangees, brvmCVar: d.brvmC?.variation ?? null,
    secteurs: d.secteurs, topHausse: d.topHausses[0] ?? null, topBaisse: d.topBaisses[0] ?? null, plusEchangee: d.plusEchangee,
  });
  const total = Math.max(d.nbActions, 1);
  const p = (x: number) => Math.round((x / total) * 100);
  const points = d.brvmC && d.brvmC.veille != null ? d.brvmC.valeur - d.brvmC.veille : null;
  const score = Math.round(d.etat.sentimentScore);
  const libelle = score >= 60 ? 'Positif' : score <= 40 ? 'Négatif' : 'Neutre';
  const enSeance = fraicheur.etat === 'frais';
  const age = fraicheur.ageMinutes;
  const secteurs = [...d.secteurs].sort((a, b) => b.variation_pct - a.variation_pct);

  return (
    <section className="today" aria-labelledby="h-today">
      {/* Rangée 0 — en-tête */}
      <div className="today-head">
        <div>
          <p className="over">Aperçu du marché</p>
          <h2 id="h-today">La BRVM aujourd&apos;hui</h2>
          <p className="lead">{n.sousTitre}</p>
        </div>
        <div className="head-right">
          <div className="status">
            <span className={`live ${enSeance ? 'on' : ''}`}><i aria-hidden="true" />{enSeance ? 'Marché en cours' : 'Marché fermé'}</span>
            {age != null && fraicheur.etat !== 'inconnu' && <small>Dernière mise à jour : il y a {age < 60 ? `${age} min` : `${Math.round(age / 60)} h`}</small>}
          </div>
          <div className="pills num" aria-label="Résumé">
            <span className="pill"><b className="up">{d.hausses}</b> hausses</span>
            <span className="pill"><b>{d.inchangees}</b> stables</span>
            <span className="pill"><b>{d.nbActions}</b> suivies</span>
            {dateLabel && <span className="pill date">{dateLabel}</span>}
          </div>
        </div>
      </div>

      <div className="today-grid">
        {/* Rangée 1 */}
        <div className="card idx r1a">
          <p className="over">BRVM Composite</p>
          {d.brvmC ? (
            <>
              <p className="big num">{fmt2(d.brvmC.valeur)}</p>
              <p className="delta"><span className={`chip num ${tone(d.brvmC.variation)}`}>{d.brvmC.variation != null && d.brvmC.variation >= 0 ? '↑ ' : '↓ '}{pct(d.brvmC.variation)}</span>{points != null && <span className="num pts">{points >= 0 ? '+' : '−'}{fmt2(Math.abs(points))} points</span>}</p>
              <dl className="kv num">
                <div><dt>Veille</dt><dd>{d.brvmC.veille != null ? fmt2(d.brvmC.veille) : '—'}</dd></div>
                <div><dt>Clôture</dt><dd>{fmt2(d.brvmC.valeur)}</dd></div>
              </dl>
            </>
          ) : <p className="empty">Indice non disponible pour cette séance.</p>}
        </div>
        <div className="card r1b"><IndexChart serie={d.brvmCSerie} /></div>
        <div className="card senti r1c">
          <p className="over">Sentiment de séance <span className="info" title="Part des valeurs en hausse parmi celles qui ont varié, sur 100.">ⓘ</span></p>
          <Gauge score={score} />
          <p className={`word ${score >= 60 ? 'up' : score <= 40 ? 'down' : ''}`}>{libelle} <span className="num">({score}/100)</span></p>
          <p className="senti-foot"><b className="down">{d.baisses}</b> baisse{d.baisses > 1 ? 's' : ''} sur {d.nbActions} titres suivis{d.etat.sentimentDelta != null && <small className={`num ${tone(d.etat.sentimentDelta)}`}> · {d.etat.sentimentDelta >= 0 ? '+' : '−'}{Math.abs(Math.round(d.etat.sentimentDelta))} pts vs veille</small>}</p>
        </div>
        <div className="card flash r1d">
          <p className="over">BRVM Flash info</p>
          <ul>{n.flash.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="flash-foot">Dérivé des chiffres de la séance — aucune phrase rédigée.</p>
        </div>

        {/* Rangée 2 */}
        <div className="card tile r2a"><span className="ico up">↑</span><div><b className="num up">{d.hausses}</b><span>hausses<small className="num">{p(d.hausses)} %</small></span></div><i className="bar up" style={{ width: `${p(d.hausses)}%` }} aria-hidden="true" /></div>
        <div className="card tile r2b"><span className="ico">−</span><div><b className="num">{d.inchangees}</b><span>stables<small className="num">{p(d.inchangees)} %</small></span></div><i className="bar" style={{ width: `${p(d.inchangees)}%` }} aria-hidden="true" /></div>
        <div className="card tile r2c"><span className="ico down">↓</span><div><b className="num down">{d.baisses}</b><span>baisses<small className="num">{p(d.baisses)} %</small></span></div><i className="bar down" style={{ width: `${p(d.baisses)}%` }} aria-hidden="true" /></div>
        <div className="card keys r2d">
          <ul className="keys-l num">
            <li><b>{d.etat.valeurEchangee != null ? `${fmtMd(d.etat.valeurEchangee)} FCFA` : '—'}</b><span>Valeur échangée</span>{d.etat.valeurVsVeille != null && <small><i className={`chip ${tone(d.etat.valeurVsVeille)}`}>{pct(d.etat.valeurVsVeille, 1)}</i> vs veille</small>}</li>
            <li><b>{d.etat.titresEchanges != null ? fmtNumber(d.etat.titresEchanges) : '—'}</b><span>Titres échangés</span>{d.etat.titresVsVeille != null && <small><i className={`chip ${tone(d.etat.titresVsVeille)}`}>{pct(d.etat.titresVsVeille, 1)}</i> vs veille</small>}</li>
            <li><b>{d.etat.transactions != null ? fmtNumber(d.etat.transactions) : '—'}</b><span>Transactions</span>{d.etat.transactionsVsVeille != null && <small><i className={`chip ${tone(d.etat.transactionsVsVeille)}`}>{pct(d.etat.transactionsVsVeille, 1)}</i> vs veille</small>}</li>
          </ul>
        </div>

        {/* Rangée 3 */}
        <div className="r3a"><Table titre="Top 5 hausses" rows={d.topHausses} tone="up" href="/societes" vide="Aucune hausse sur cette séance." /></div>
        <div className="r3b"><Table titre="Top 5 baisses" rows={d.topBaisses} tone="down" href="/societes" vide="Aucune baisse sur cette séance." /></div>
        <div className="card dit r3c">
          <h3><span className="badge" aria-hidden="true">≡</span>Ce que dit la séance</h3>
          <ul className="dit-l">{n.flash.slice(0, 2).map((f) => <li key={f}><b>{f}</b></li>)}</ul>
          <p className="corps">{n.corps}</p>
          {n.surveiller.length > 0 && (
            <div className="watch">
              <b>À surveiller <span>Faits mesurés</span></b>
              <ul>{n.surveiller.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
        </div>

        {/* Rangée 4 — secteurs */}
        {secteurs.length > 0 && (
          <div className="card sect r4">
            <p className="over">Performance des secteurs <span className="sub">variation pondérée par la capitalisation</span></p>
            <ul>
              {secteurs.map((s) => (
                <li key={s.secteur}>
                  <span className="name">{s.secteur}</span>
                  <b className={`num ${tone(s.variation_pct)}`}>{pct(s.variation_pct)}</b>
                  <small className="num">{s.nb} valeur{s.nb > 1 ? 's' : ''}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="today-foot">
        <p className="stamp">Source brvm.org · actualisé toutes les 15 min en séance · « vs veille » compare à la séance précédente en base.</p>
        <Link href="/societes" className="btn btn-gold">Explorer les sociétés <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
