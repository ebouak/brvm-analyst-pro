import Link from 'next/link';
import type { LandingBisData, Mover } from '@/lib/landing/bisData';
import type { Fraicheur } from '@/lib/freshness';
import { seanceNarrative } from '@/lib/landing/seanceNarrative';
import { fmtNumber } from '@/lib/format';
import { IndexChart } from './IndexChart';

/**
 * « La BRVM aujourd'hui » — aperçu de séance en clair. Tout vient de
 * `getLandingBisData` ; le texte de droite est dérivé des chiffres
 * (lib/landing/seanceNarrative, testé). Pas de plus-haut / plus-bas d'indice :
 * la BRVM ne les publie pas (CLAUDE.md §9), on montre veille et clôture.
 */

const pct = (v: number | null, d = 2) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const tone = (v: number | null) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
const fmtMd = (v: number) => v >= 1e9 ? `${(v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md` : v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : fmtNumber(v);

function Row({ m, i }: { m: Mover; i: number }) {
  return (
    <tr>
      <td className="num rk">{i + 1}</td>
      <td><Link href={`/societes/${m.code}`} className="code num">{m.code}</Link></td>
      <td className="num">{fmtNumber(m.cours)}</td>
      <td><span className={`chip num ${tone(m.variation)}`}>{pct(m.variation)}</span></td>
      <td>{m.spark ? <svg viewBox="0 0 44 16" width="64" height="18" aria-hidden="true"><path d={m.spark} fill="none" stroke={m.variation >= 0 ? '#1f8f5a' : '#c4423f'} strokeWidth="1.6" /></svg> : <span className="empty-spark" aria-hidden="true">—</span>}</td>
    </tr>
  );
}

function Table({ titre, rows, tone: t, href, vide }: { titre: string; rows: Mover[]; tone: 'up' | 'down'; href: string; vide: string }) {
  return (
    <div className="card top">
      <div className="top-head">
        <h3 className={t}><span className="badge" aria-hidden="true">{t === 'up' ? '↑' : '↓'}</span>{titre}</h3>
        <Link href={href} className={`more ${t}`}>Voir toutes les {t === 'up' ? 'hausses' : 'baisses'} →</Link>
      </div>
      {rows.length ? (
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Valeur</th><th scope="col">Cours (FCFA)</th><th scope="col">Variation</th><th scope="col">Graphique</th></tr></thead>
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

  return (
    <section className="today" aria-labelledby="h-today">
      <div className="today-head">
        <div>
          <p className="over">Aperçu du marché</p>
          <h2 id="h-today">La BRVM aujourd&apos;hui</h2>
          <p className="lead">{n.sousTitre}</p>
        </div>
        <div className="status">
          <span className={`live ${enSeance ? 'on' : ''}`}><i aria-hidden="true" />{enSeance ? 'Marché en cours' : dateLabel ? `Clôture du ${dateLabel}` : 'Hors séance'}</span>
          {age != null && fraicheur.etat !== 'inconnu' && <small>Dernière mise à jour : il y a {age < 60 ? `${age} min` : `${Math.round(age / 60)} h`}</small>}
        </div>
      </div>

      <div className="today-grid">
        <div className="card idx">
          <p className="over">BRVM Composite</p>
          {d.brvmC ? (
            <>
              <p className="big num">{d.brvmC.valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="delta"><span className={`chip num ${tone(d.brvmC.variation)}`}>{d.brvmC.variation != null && d.brvmC.variation >= 0 ? '↑ ' : '↓ '}{pct(d.brvmC.variation)}</span>{points != null && <span className="num pts">{points >= 0 ? '+' : '−'}{Math.abs(points).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} points</span>}</p>
              <dl className="kv num">
                <div><dt>Veille</dt><dd>{d.brvmC.veille != null ? d.brvmC.veille.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</dd></div>
                <div><dt>Clôture</dt><dd>{d.brvmC.valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
                <div><dt>Séance</dt><dd>{dateLabel ?? '—'}</dd></div>
              </dl>
            </>
          ) : <p className="empty">Indice non disponible pour cette séance.</p>}
        </div>

        <div className="card"><IndexChart serie={d.brvmCSerie} /></div>

        <div className="card senti">
          <p className="over">Sentiment de séance <span className="info" title="Part des valeurs en hausse parmi celles qui ont varié, sur 100.">ⓘ</span></p>
          <p className={`big word ${score >= 60 ? 'up' : score <= 40 ? 'down' : ''}`}>{libelle}</p>
          <p className="num score"><b>{score}</b> / 100{d.etat.sentimentDelta != null && <small className={tone(d.etat.sentimentDelta)}> {d.etat.sentimentDelta >= 0 ? '+' : '−'}{Math.abs(Math.round(d.etat.sentimentDelta))} pts vs veille</small>}</p>
          <div className="gauge" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Sentiment de séance"><i style={{ width: `${score}%` }} className={score >= 60 ? 'up' : score <= 40 ? 'down' : ''} /></div>
          <div className="gauge-l num"><span>0</span><span>50</span><span>100</span></div>
          <p className="senti-foot"><b className="down">{d.baisses}</b> baisse{d.baisses > 1 ? 's' : ''} sur {d.nbActions} titres suivis</p>
        </div>

        <div className="card repart">
          <p className="over">Répartition des valeurs</p>
          <div className="breadth" aria-hidden="true"><i style={{ width: `${p(d.hausses)}%`, background: '#1f8f5a' }} /><i style={{ width: `${p(d.inchangees)}%`, background: '#cfd5dc' }} /><i style={{ width: `${p(d.baisses)}%`, background: '#c4423f' }} /></div>
          <ul className="repart-l num">
            <li><span className="ico up">↑</span><b className="up">{d.hausses}</b><span>en hausse<small>{p(d.hausses)} %</small></span></li>
            <li><span className="ico">−</span><b>{d.inchangees}</b><span>stables<small>{p(d.inchangees)} %</small></span></li>
            <li><span className="ico down">↓</span><b className="down">{d.baisses}</b><span>en baisse<small>{p(d.baisses)} %</small></span></li>
          </ul>
        </div>

        <div className="card keys">
          <p className="over">Chiffres clés de la séance</p>
          <ul className="keys-l num">
            <li><b>{d.etat.valeurEchangee != null ? `${fmtMd(d.etat.valeurEchangee)} FCFA` : '—'}</b><span>Valeur échangée</span>{d.etat.valeurVsVeille != null && <small><i className={`chip ${tone(d.etat.valeurVsVeille)}`}>{pct(d.etat.valeurVsVeille, 1)}</i> vs veille</small>}</li>
            <li><b>{d.etat.titresEchanges != null ? fmtNumber(d.etat.titresEchanges) : '—'}</b><span>Titres échangés</span>{d.etat.titresVsVeille != null && <small><i className={`chip ${tone(d.etat.titresVsVeille)}`}>{pct(d.etat.titresVsVeille, 1)}</i> vs veille</small>}</li>
            <li><b>{d.etat.transactions != null ? fmtNumber(d.etat.transactions) : '—'}</b><span>Transactions</span>{d.etat.transactionsVsVeille != null && <small><i className={`chip ${tone(d.etat.transactionsVsVeille)}`}>{pct(d.etat.transactionsVsVeille, 1)}</i> vs veille</small>}</li>
          </ul>
        </div>

        <Table titre="Top 5 hausses" rows={d.topHausses} tone="up" href="/signaux" vide="Aucune hausse sur cette séance." />
        <Table titre="Top 5 baisses" rows={d.topBaisses} tone="down" href="/signaux" vide="Aucune baisse sur cette séance." />

        <div className="card dit">
          <h3><span className="badge" aria-hidden="true">≡</span>Ce que dit la séance</h3>
          <p className="accroche">{n.accroche}</p>
          <p className="corps">{n.corps}</p>
          {n.surveiller.length > 0 && (
            <div className="watch">
              <b>À surveiller</b>
              <ul>{n.surveiller.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <div className="today-foot">
        <p className="stamp">Source brvm.org · actualisé toutes les 15 min en séance · les chiffres « vs veille » comparent à la séance précédente en base.</p>
        <Link href="/dashboard" className="btn btn-gold">Explorer le marché <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
