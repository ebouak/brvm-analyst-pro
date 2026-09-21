import Link from 'next/link';
import RatingBadge from '@/components/RatingBadge';
import { SubscoreBars, COULEURS_TOKEN } from '@/components/landing/SubscoreBars';
import { excerpt } from '@/lib/landing/excerpt';
import { fmtNumber } from '@/lib/format';
import type { LandingBisData } from '@/lib/landing/bisData';
import { RATING_DISCLAIMER } from '@/lib/rating';

/**
 * Un seul panneau sombre, trois rangées serrées : la séance en vidéo et ses
 * chiffres · la note quantitative et ses barres · le diagnostic IA en une
 * ligne. Fusion des trois écrans du terminal pour tenir dans un écran.
 *
 * Mêmes garde-fous que les composants d'origine : pas de vidéo publiée →
 * rangée absente (jamais un habillage recyclé) ; note et barres = signal réel
 * de la séance ; rapport = diagnostic effectivement généré, sinon on le dit.
 * La liste « ce qu'elle lit / ne fait pas » est vérifiée dans lib/diagnostic.
 */

const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fmtMd = (v: number) => v >= 1e9 ? `${(v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Md` : v >= 1e6 ? `${(v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : fmtNumber(v);
const SOURCES = [
  { src: '/brand/brvm-logo.png', alt: 'BRVM' },
  { src: '/brand/bceao-logo.png', alt: 'BCEAO' },
  { src: '/brand/bloomfield-logo.png', alt: 'Bloomfield Investment' },
];

export function Terminal({ d, dateMarche }: { d: LandingBisData; dateMarche: string | null }) {
  const v = d.videoSeance;
  const s = d.spotlightSignal;
  const r = d.latestDiagnostic;
  const videoPrecedente = !!(v && dateMarche && v.seance < dateMarche);

  return (
    <section className="etat termc" aria-label="La séance, la note, le diagnostic">
      {/* Rangée 1 — la séance en vidéo */}
      {v && (
        <div className="tc-row tc-video">
          <div className="tc-head">
            <div>
              <p className="o">La séance en {Math.round(v.duree_s)} secondes</p>
              <h2>La séance du {v.date_fr}{videoPrecedente && <span className="tag">séance précédente</span>}</h2>
              <p className="tc-sub">Produite automatiquement chaque soir après la clôture, à partir des mêmes chiffres que cette page. Aucune séance exploitable, aucune vidéo — jamais un habillage recyclé.</p>
            </div>
            <span className="hand-dark" aria-hidden="true">Des données<br />pour de meilleures<br />décisions.</span>
          </div>
          <div className="tc-grid">
            <div className="tc-player">
              <video controls preload="none" poster={v.affiche ?? undefined} playsInline aria-label={`Vidéo de la séance du ${v.date_fr}`}>
                <source src={v.url} type="video/mp4" />
              </video>
              <ul className="tc-logos" aria-label="Sources">
                {SOURCES.map((x) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <li key={x.alt}><img src={x.src} alt={x.alt} height={18} loading="lazy" /></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="tc-lead">Chaque soir, la séance est résumée en vidéo : indice, largeur du marché, capitaux échangés, et les sociétés qui ont porté les échanges. <b>Les images et la voix sont composées des mêmes chiffres</b>, lus une seule fois dans nos données de séance.</p>
              <dl className="tc-kpis num">
                <div><dt>BRVM Composite</dt><dd>{v.composite ? v.composite.valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}{v.composite && <small className={v.composite.variation_pct >= 0 ? 'up' : 'down'}>{pct(v.composite.variation_pct)}</small>}</dd></div>
                <div><dt>Hausses</dt><dd className="up">{v.hausses}<small>sur {v.valeurs} titres</small></dd></div>
                <div><dt>Baisses</dt><dd className="down">{v.baisses}<small>sur {v.valeurs} titres</small></dd></div>
                <div><dt>Capitaux échangés</dt><dd>{fmtMd(v.capitaux_fcfa)} <span className="unit">FCFA</span><small>{v.capitaux_estimes ? 'estimés' : 'clôture'}</small></dd></div>
              </dl>
              <div className="tc-links">
                <details><summary>Lire la transcription</summary><p>{v.texte}</p></details>
                <Link href={`/brief`}>Voir le détail de la séance →</Link>
                <a href="https://t.me/westbourse7" rel="noopener" target="_blank">Recevoir la vidéo chaque soir sur Telegram ↗</a>
                <Link href="/signup" className="tc-btn">Suivre les prochaines séances</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rangée 2 — la note quantitative */}
      <div className="tc-row tc-note">
        <div>
          <p className="o">Note quantitative</p>
          <h2>Chaque action. Une note.</h2>
          <p className="tc-sub">Chaque note A–F est calculée à partir de signaux quantitatifs explicables — variation, volume, RSI, tendance et liquidité — jamais d&apos;opinion inventée.</p>
          <dl className="tc-legende">
            <div><dt><span className="g">A</span> à <span className="g">F</span></dt><dd>Une note recalculée à chaque séance à partir de signaux vérifiables. A = bien orientés ; F = mal orientés. Ce n&apos;est pas un avis.</dd></div>
            <div><dt><span className="g up">BUY</span> · <span className="g">HOLD</span> · <span className="g down">SELL</span></dt><dd>Quand rien n&apos;est net, le moteur affiche HOLD et s&apos;abstient. C&apos;est un choix de rigueur, pas un manque d&apos;avis — et cela arrive souvent.</dd></div>
          </dl>
          <Link href="/societes" className="tc-link">Voir les {d.nbActions || 47} sociétés →</Link>
        </div>
        <div className="tc-card">
          {s ? (
            <>
              <div className="tc-card-head"><b className="num">{s.code}</b><RatingBadge scoreTotal={s.score_total} confiance={s.confiance} neutre /></div>
              <SubscoreBars signal={s} compact couleurs={{ ...COULEURS_TOKEN, label: '#a3afb4' }} />
              <p className="tc-foot">Signal {s.signal} · confiance {s.confiance != null ? `${(s.confiance * 100).toFixed(0)} %` : '—'} · exemple réel de la séance en cours</p>
              <p className="tc-disc">{RATING_DISCLAIMER}</p>
            </>
          ) : <p className="tc-foot">Aucun signal publié pour cette séance.</p>}
        </div>
      </div>

      {/* Rangée 3 — le diagnostic IA, sur une ligne */}
      <div className="tc-row tc-diag">
        <div className="tc-head compact">
          <div><p className="o">Diagnostic IA</p><h2>Votre analyste BRVM en quelques secondes.</h2></div>
          {r?.generated_at && <span className="tc-date num">{new Date(r.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
        </div>
        <div className="tc-report">
          {r && r.markdown_content ? (
            <>
              <b className="num">{r.code}</b>
              <p>{excerpt(r.markdown_content, 220)}</p>
              <Link href="/premium/diagnostic" className="tc-btn ghost">Voir l&apos;analyse complète →</Link>
            </>
          ) : (
            <>
              <p className="tc-vide">Un exemple de diagnostic s&apos;affichera ici dès qu&apos;un rapport aura été généré.</p>
              <Link href="/premium/diagnostic" className="tc-btn ghost">Découvrir le Diagnostic IA →</Link>
            </>
          )}
        </div>
        <div className="tc-lit">
          <div><p className="o">Ce qu&apos;elle lit</p><ul><li>Cotations et plage 52 semaines</li><li>Deux exercices : résultat, bilan, trésorerie</li><li>Ratios calculés en amont (ROE DuPont, marges)</li><li>Presse — avec sa source, sa date et son lien</li></ul></div>
          <p className="tc-mid">Analyse façon sell-side générée à partir des données réelles de la plateforme — un outil d&apos;analyse, jamais une recommandation d&apos;achat ou de vente.</p>
          <div><p className="o">Ce qu&apos;elle ne fait pas</p><ul><li>Calculer les chiffres — ils le sont avant, par du code testé</li><li>Recommander d&apos;acheter ou de vendre</li><li>Prédire un cours</li><li>Inventer une source : sans presse trouvée, elle écrit « non évaluable »</li></ul></div>
          <blockquote>Une analyse structurée pour aller plus loin, avec méthode.</blockquote>
        </div>
      </div>
    </section>
  );
}
