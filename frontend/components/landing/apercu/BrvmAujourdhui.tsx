import Link from 'next/link';
import { EtatSeanceLive } from './EtatSeanceLive';
import { pct, tone } from '@/lib/landing/formats';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import type { LandingBisData, Mover } from '@/lib/landing/bisData';
import type { Fraicheur } from '@/lib/freshness';
import { seanceNarrative } from '@/lib/landing/seanceNarrative';
import { fmtNumber } from '@/lib/format';
import { IndexChart } from './IndexChart';
import { JaugeSentiment } from './JaugeSentiment';
import { Apparition, MouvementSobre } from './Apparition';

/**
 * « La BRVM aujourd'hui » — aperçu de séance, charte claire, structure en
 * quatre rangées : indice + courbe + jauge + flash ; tuiles hausses / stables
 * / baisses + chiffres clés ; top 5 + « ce que dit la séance » ; performance
 * des secteurs. Tout vient de `getLandingBisData` ; les textes sont dérivés
 * (lib/landing/seanceNarrative, testé). Pas de plus-haut / plus-bas d'indice :
 * la BRVM ne les publie pas (CLAUDE.md §9) ; on montre veille et clôture.
 */

const fmtM = (v: number | null) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M` : v >= 1e3 ? `${(v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k` : fmtNumber(v);
const fmt2 = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ m, i }: { m: Mover; i: number }) {
  return (
    <tr>
      <td className="num rk">{i + 1}</td>
      <td><Link href={`/societes/${m.code}`} className="code num">{m.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.logo} alt="" width={22} height={22} className="logo-soc" loading="lazy" />}{m.code}</Link></td>
      <td className="num">{fmtNumber(m.cours)}</td>
      <td><span className={`chip num ${tone(m.variation)}`}>{pct(m.variation)}</span></td>
      <td className="num vol">{fmtM(m.valeur ?? null)}</td>
      <td className="col-graph">{m.spark ? <svg viewBox="0 0 44 16" width="56" height="18" aria-hidden="true"><path d={m.spark} fill="none" stroke={m.variation >= 0 ? 'rgb(var(--color-up))' : 'rgb(var(--color-down))'} strokeWidth="1.6" /></svg> : <span className="empty-spark" aria-hidden="true">—</span>}</td>
    </tr>
  );
}

function Table({ titre, rows, tone: t, href, vide }: { titre: string; rows: Mover[]; tone: 'up' | 'down'; href: string; vide: string }) {
  return (
    <div className="card top">
      <div className="top-head">
        <h3 className={t}><span className="badge" aria-hidden="true">{t === 'up' ? '↑' : '↓'}</span>{titre}</h3>
        <Link href={href} className={`more ${t}`}>Voir les {NB_SOCIETES_COTEES} sociétés →</Link>
      </div>
      {rows.length ? (
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Valeur</th><th scope="col">Cours (FCFA)</th><th scope="col">Variation</th><th scope="col" title="Valeur échangée, en FCFA">Échangé</th><th scope="col" className="col-graph">Graphique</th></tr></thead>
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
  const enSeance = fraicheur.etat === 'frais';
  const age = fraicheur.ageMinutes;
  const secteurs = [...d.secteurs].sort((a, b) => b.variation_pct - a.variation_pct);

  return (
    <section className="today" aria-labelledby="h-today">
      <MouvementSobre>
      {/* Rangée 0 — en-tête. Les enveloppes Apparition sont de minces
          composants clients : le contenu reste rendu ici, côté serveur. */}
      <Apparition className="today-head" variante="entete" survol={false}>
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
      </Apparition>

      <div className="today-grid">
        {/* Rangée 1 */}
        <Apparition className="card idx r1a" rang={0}>
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
        </Apparition>
        <Apparition className="card r1b" rang={1}><IndexChart serie={d.brvmCSerie} /></Apparition>
        <Apparition className="card senti r1c" rang={2}>
          <p className="over">Sentiment de séance <span className="info" title="Part des valeurs en hausse parmi celles qui ont varié, sur 100.">ⓘ</span></p>
          <JaugeSentiment score={score} />
          <p className="senti-foot"><b className="down">{d.baisses}</b> baisse{d.baisses > 1 ? 's' : ''} sur {d.nbActions} titres suivis{d.etat.sentimentDelta != null && <small className={`num ${tone(d.etat.sentimentDelta)}`}> · {d.etat.sentimentDelta >= 0 ? '+' : '−'}{Math.abs(Math.round(d.etat.sentimentDelta))} pts vs veille</small>}</p>
        </Apparition>
        <Apparition className="card flash r1d" rang={3}>
          <p className="over">BRVM Flash info</p>
          <ul>{n.flash.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="flash-foot">Dérivé des chiffres de la séance, aucune phrase rédigée.</p>
        </Apparition>

        {/* Rangée 2 */}
        {/* Compteurs ET capitaux passent en DIRECT après hydratation, rendus
            par un SEUL composant — donc un seul abonnement Supabase, là où
            deux composants auraient ouvert deux canaux sur le même sujet.
            Le serveur rend déjà les chiffres : ils sont dans le HTML servi, le
            LCP est intact, et le client ne fait que les corriger. */}
        <EtatSeanceLive
          seed={d.coursSeed} dateMarche={d.dateMarche}
          hausses={d.hausses} inchangees={d.inchangees} baisses={d.baisses} nbActions={d.nbActions}
          valeurEchangee={d.etat.valeurEchangee} titresEchanges={d.etat.titresEchanges} transactions={d.etat.transactions}
          veilleValeur={d.etat.veilleValeur} veilleTitres={d.etat.veilleTitres} veilleTransactions={d.etat.veilleTransactions}
        />

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
      </MouvementSobre>
    </section>
  );
}
