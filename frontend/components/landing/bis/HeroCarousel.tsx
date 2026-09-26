'use client';
import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import type { Slide } from '@/lib/landing/slides';
import type { TopNote } from '@/lib/landing/bisData';

/**
 * Carrousel du hero « À la une ».
 *
 * · défilement 7 s (temps de lecture d'un titre + sous-titre, Baymard), en pause au
 *   survol, au focus et quand l'onglet est caché ;
 * · bouton pause/lecture VISIBLE (WCAG 2.2.2 : la pause au survol ne suffit ni au
 *   clavier ni au tactile) ; le défilement s'arrête DÉFINITIVEMENT dès que
 *   l'utilisateur touche une commande (NN/g, Baymard) ;
 * · AUCUN défilement automatique sous prefers-reduced-motion ;
 * · flèches ←/→ au clavier, points cliquables (44 px de zone), annonces
 *   d'état par aria-live ;
 * · une vue `ad` porte toujours la mention « Publicité » et l'annonceur ; son
 *   lien sort en rel="sponsored noopener" ;
 * · les images admin sont des <img> natifs : `next/image` exigerait
 *   `images.remotePatterns`, interdit tant que Next < 15.5.24 (voir CLAUDE.md).
 */

const INTERVALLE_MS = 7000;
const fmtPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

interface Props {
  slides: Slide[];
  dateLabel: string | null;
  brvmCVar: number | null;
  hausses: number;
  nbActions: number;
  topNote: TopNote | null;
  topHausse: { code: string; variation: number } | null;
  topBaisse: { code: string; variation: number } | null;
  /** Compteurs réels du comparateur SGI — jamais de score affiché ici. */
  sgi: { nb: number; nbGrilles: number; pays: string[] };
}

export function HeroCarousel({ slides, dateLabel, brvmCVar, hausses, nbActions, topNote, topHausse, topBaisse, sgi }: Props) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // Arrêt volontaire : bouton pause, ou première commande touchée. Ne repart jamais seul.
  const [stopped, setStopped] = useState(false);
  const reduce = useRef(false);
  const n = slides.length;

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (n < 2 || paused || stopped || reduce.current) return;
    const t = setInterval(() => setI((k) => (k + 1) % n), INTERVALLE_MS);
    return () => clearInterval(t);
  }, [n, paused, stopped]);

  const go = (k: number) => { setStopped(true); setI(((k % n) + n) % n); };
  const [autoOk, setAutoOk] = useState(false);
  useEffect(() => { setAutoOk(n > 1 && !reduce.current); }, [n]);

  return (
    <div
      className="car"
      role="region"
      aria-roledescription="carrousel"
      aria-label="À la une"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); }}
    >
      {slides.map((s, k) => {
        const active = k === i;
        const label = `${k + 1} sur ${n} : ${s.kind === 'ad' ? `Publicité, ${s.sponsorName}` : s.title}`;
        const cls = `slide${s.kind === 'ad' ? ' ad' : s.imageUrl ? '' : ' dark'}`;
        return (
          <div key={s.id} className={cls} aria-hidden={active ? 'false' : 'true'} role="group" aria-roledescription="diapositive" aria-label={label}>
            {s.kind === 'ad' && <span className="ad-tag">Publicité · {s.sponsorName}</span>}
            {s.imageUrl && s.kind !== 'permanent' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt="" width={900} height={672} loading={k === 0 ? 'eager' : 'lazy'} />
            )}
            {s.kind === 'permanent' ? (
              <Permanente s={s} dateLabel={dateLabel} brvmCVar={brvmCVar} hausses={hausses} nbActions={nbActions} topNote={topNote} topHausse={topHausse} topBaisse={topBaisse} sgi={sgi} active={active} />
            ) : (
              <div className="pv">
                <div className="box">
                  <span className="o">{s.kind === 'ad' ? `Publicité · ${s.sponsorName}` : 'WESTBOURSE'}</span>
                  <h3>{s.title}</h3>
                  {s.subtitle && <p>{s.subtitle}</p>}
                  {s.linkUrl && (
                    <a href={s.linkUrl} className="btn btn-gold btn-sm" style={{ marginTop: 12 }} rel={s.kind === 'ad' ? 'sponsored noopener' : undefined} target={s.kind === 'ad' ? '_blank' : undefined} tabIndex={active ? 0 : -1}>
                      {s.ctaLabel ?? 'En savoir plus'}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {n > 1 && (
        <div className="car-ctl">
          <button type="button" onClick={() => go(i - 1)} aria-label="Diapositive précédente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="dots" role="tablist" aria-label="Choisir une diapositive">
            {slides.map((s, k) => (
              <button key={s.id} type="button" role="tab" aria-current={k === i ? 'true' : undefined} aria-label={`${k + 1} · ${s.kind === 'ad' ? 'Publicité' : s.title}`} className={s.kind === 'ad' ? 'is-ad' : undefined} onClick={() => go(k)} />
            ))}
          </div>
          <button type="button" onClick={() => go(i + 1)} aria-label="Diapositive suivante">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          {autoOk && (
            <button type="button" className="pause" onClick={() => setStopped((v) => !v)} aria-pressed={stopped ? 'true' : 'false'} aria-label={stopped ? 'Reprendre le défilement automatique' : 'Arrêter le défilement automatique'}>
              {stopped
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>}
            </button>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">Diapositive {i + 1} sur {n}</p>
    </div>
  );
}

/** Vues permanentes : dessinées, alimentées par les VRAIS chiffres de la séance. */
function Permanente({ s, dateLabel, brvmCVar, hausses, nbActions, topNote, topHausse, topBaisse, sgi, active }: { s: Slide; active: boolean } & Omit<Props, 'slides'>) {
  if (s.render === 'photo') {
    return (
      <>
        {s.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt="Un investisseur consulte WESTBOURSE sur son ordinateur portable dans un bureau lumineux." width={900} height={672} loading="eager" />
        )}
        <div className="poster" aria-hidden="true">Mieux<br />informé,<br />plus serein.<i><svg viewBox="0 0 52 6" width="52" height="6"><path d="M1 4 C 15 1, 35 6, 51 2" fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2.5" strokeLinecap="round" /></svg></i></div>
        <figure className="quote"><span className="hand">« Je ne subis plus le marché, je le comprends. »</span><figcaption><small>La promesse WESTBOURSE</small></figcaption></figure>
      </>
    );
  }
  if (s.render === 'sgi') {
    // Annonce maison du comparateur : uniquement des compteurs lus en base
    // (annuaire, grilles tarifaires, pays). Aucun classement ni score n'est
    // montré ici — ils dépendent du profil saisi dans le moteur.
    const nb = sgi.nb > 0 ? sgi.nb : null;
    return (
      <div className="pv pv-sgi"><div className="box">
        <span className="o">Comparateur SGI · BRVM</span>
        <h3>Trouvez la SGI faite pour votre profil.</h3>
        <p>Cinq questions, et le moteur classe {nb ? `les ${nb} SGI agréées` : 'les SGI agréées'} selon vos critères{sgi.nbGrilles > 0 ? ` — sur ${sgi.nbGrilles} grilles tarifaires homologuées` : ''}. Chaque point du score est justifié.</p>
        {sgi.pays.length > 0 && <ul className="chips" aria-label="Pays couverts">{sgi.pays.map((n) => <li key={n}>{n}</li>)}</ul>}
        <Link href="/comparateur-sgi" className="btn btn-gold btn-sm" style={{ marginTop: 14 }} tabIndex={active ? 0 : -1}>Commencer maintenant →</Link>
      </div>
      <span className="hand hand-sgi" aria-hidden="true">Comparer. Comprendre.<br />Investir en confiance.</span></div>
    );
  }
  if (s.render === 'note') {
    return (
      <div className="pv"><div className="box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="g" aria-label={topNote?.grade ? `Note ${topNote.grade}` : 'Note'}>{topNote?.grade ?? '–'}</span>
          <div><span className="o">Meilleure note du jour</span><h3 style={{ margin: 0 }}>{topNote ? `${topNote.code}${topNote.nom ? ` · ${topNote.nom}` : ''}` : 'Aucun signal publié'}</h3></div>
        </div>
        <p>Tendance, momentum, liquidité, valorisation : chaque sous-score est affiché avec son poids. Quand rien n&apos;est net, le moteur s&apos;abstient.</p>
      </div></div>
    );
  }
  if (s.render === 'brief') {
    return (
      <div className="pv"><div className="box">
        <span className="o">Brief du soir{dateLabel ? ` · ${dateLabel}` : ''}</span>
        <h3>{nbActions > 0 ? `${hausses} valeur${hausses > 1 ? 's' : ''} en hausse sur ${nbActions}.` : 'La séance résumée chaque soir.'}</h3>
        <div className="lines num">
          {brvmCVar != null && <span>BRVM Composite<b className={brvmCVar >= 0 ? 'up' : 'down'} style={{ color: brvmCVar >= 0 ? 'rgb(var(--color-up))' : 'rgb(var(--color-down))' }}>{fmtPct(brvmCVar)}</b></span>}
          {topHausse && <span>Plus forte hausse · {topHausse.code}<b style={{ color: 'rgb(var(--color-up))' }}>{fmtPct(topHausse.variation)}</b></span>}
          {topBaisse && <span>Plus forte baisse · {topBaisse.code}<b style={{ color: 'rgb(var(--color-down))' }}>{fmtPct(topBaisse.variation)}</b></span>}
        </div>
        <p>Cinq lignes chaque jour de cotation à 18 h, par email ou Telegram.</p>
      </div></div>
    );
  }
  return (
    <div className="pv"><div className="box">
      <span className="o">Premium · chaque samedi</span>
      <h3>Votre portefeuille, en dossiers.</h3>
      <p>Douze panneaux par société sur sept feuilles A4, chiffres vérifiés, prose sans un seul nombre inventé, envoyés par email ou Telegram.</p>
    </div></div>
  );
}
