'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { fmtNumber, fmtDateFR } from '@/lib/format';
import { pctTexte } from '@/lib/vitrine/seance';
import {
  FILTRES_SCREENER, LIBELLE_ACCES, apresTic, doitTourner, filtrerScreener, ongletVoisin,
  type Acces, type FiltreScreener, type Outil, type OutilId,
} from '@/lib/vitrine/outilsPur';
import type { DemosOutils } from '@/lib/vitrine/outils';
import { BarreQuiPousse } from './mouvement/BarreQuiPousse';
import { TraceCourbe } from './mouvement/TraceCourbe';

export type OutilAffiche = Outil & { acces: Acces; rubrique: string | null };

const ROTATION_MS = 6000;
const PAS_CONSEIL = 'Pas un conseil en investissement.';
const PERF_PASSEES = 'Les performances passées ne préjugent pas des performances futures.';

/**
 * Explorateur « Quatorze outils. Un seul compte. » (§3.8).
 * - liste d'onglets (`role="tablist"`), flèches gauche/droite, Début, Fin ;
 * - le panneau avance seul toutes les 6 s tant que la section est à l'écran,
 *   deux tours au plus, et s'arrête DÉFINITIVEMENT à la première interaction
 *   (clic, clavier, survol) ; jamais sous mouvement réduit ;
 * - le panneau n'est annoncé (aria-live) qu'après un choix de l'utilisateur :
 *   une annonce toutes les 6 s serait un bruit continu pour un lecteur d'écran.
 */
export function ExplorateurOutils({ outils, demos }: { outils: OutilAffiche[]; demos: DemosOutils }) {
  const id = useId();
  const zone = useRef<HTMLDivElement>(null);
  const onglets = useRef<(HTMLButtonElement | null)[]>([]);
  const calme = useReducedMotion();
  const visible = useInView(zone, { amount: 0.25 });
  const [sel, setSel] = useState(0);
  // Le premier panneau est dans le HTML serveur, visible : seuls les changements d'onglet s'animent.
  const [aChange, setAChange] = useState(false);
  useEffect(() => { if (sel !== 0) setAChange(true); }, [sel]);
  const [rotations, setRotations] = useState(0);
  const [arrete, setArrete] = useState(false);
  const [touche, setTouche] = useState(false);

  const stop = useCallback(() => { setArrete(true); setTouche(true); }, []);
  const tourne = doitTourner({ visible, arrete, calme: !!calme });

  useEffect(() => {
    if (!tourne) return;
    const t = setTimeout(() => {
      const r = apresTic(sel, rotations, outils.length);
      setSel(r.index);
      setRotations(r.rotations);
      if (r.arrete) setArrete(true);
    }, ROTATION_MS);
    return () => clearTimeout(t);
  }, [tourne, sel, rotations, outils.length]);

  const choisir = (i: number, focus = false) => {
    stop();
    setSel(i);
    if (focus) onglets.current[i]?.focus();
  };

  const o = outils[sel];
  return (
    <div ref={zone} onPointerEnter={stop} onFocusCapture={stop}>
      <div
        className="v-onglets"
        role="tablist"
        aria-label="Les outils de Westbourse"
        onKeyDown={(e) => {
          const n = ongletVoisin(sel, e.key, outils.length);
          if (n != null) { e.preventDefault(); choisir(n, true); }
        }}
      >
        {outils.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => { onglets.current[i] = el; }}
            type="button"
            role="tab"
            id={`${id}-o-${i}`}
            aria-selected={i === sel}
            aria-controls={`${id}-panneau`}
            tabIndex={i === sel ? 0 : -1}
            className="v-onglet"
            onClick={() => choisir(i)}
          >
            {x.nom}
            {x.acces === 'premium' && <span className="v-onglet-pro">PRO</span>}
            {i === sel && tourne && <span key={`p-${sel}-${rotations}`} className="v-onglet-prog" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div
        id={`${id}-panneau`}
        role="tabpanel"
        aria-labelledby={`${id}-o-${sel}`}
        aria-live={touche ? 'polite' : 'off'}
        className="v-panneau"
        tabIndex={0}
      >
        <motion.div
          key={`t-${o.id}`}
          className="v-panneau-texte"
          initial={calme || !aChange ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0, 1] }}
        >
          <span className="v-panneau-meta">
            {o.rubrique && <span>{o.rubrique}</span>}
            <span className={`v-acces${o.acces === 'premium' ? ' v-acces--premium' : ''}`}>{LIBELLE_ACCES[o.acces]}</span>
          </span>
          <h3 className="v-carte-titre">{o.titre} <span className="vitrine-accent">{o.accent}</span></h3>
          <p className="v-accroche" style={{ fontSize: 17 }}>{o.description}</p>
          <Link href={o.route} className="v-lien">{o.lien} ›</Link>
        </motion.div>
        <motion.div
          key={`d-${o.id}`}
          className="v-demo"
          initial={calme || !aChange ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.2, 0.7, 0, 1] }}
        >
          <Demo id={o.id} d={demos} onInteraction={stop} />
        </motion.div>
      </div>
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="v-note">{children}</p>;
const SansDonnee = () => <Note>Démonstration non disponible pour cette séance : la donnée n&apos;est pas lisible publiquement ou pas encore en base. La page de l&apos;outil reste accessible.</Note>;
const Coche = () => <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const sens = (v: number) => (v > 0 ? 'v-up' : v < 0 ? 'v-down' : 'v-plat');
const n2 = (v: number | null, d = 2) => (v == null ? 'non disponible' : fmtNumber(v, d));

function LigneBarre({ libelle, part, valeur }: { libelle: string; part: number; valeur: string }) {
  return (
    <div className="v-ligne-barre">
      <span>{libelle}</span>
      <span className="v-piste"><BarreQuiPousse axe="x" className="v-plein" style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%` }} /></span>
      <span>{valeur}</span>
    </div>
  );
}

function Demo({ id, d, onInteraction }: { id: OutilId; d: DemosOutils; onInteraction: () => void }) {
  switch (id) {
    case 'screener': return <DemoScreener d={d} onInteraction={onInteraction} />;
    case 'scanner': {
      const s = d.scanner;
      return (
        <>
          <div className="v-puces">{['RSI 30 à 50', 'Cours au-dessus de MA20 et MA50', 'MACD au-dessus du signal', 'Volume supérieur à 2 fois la moyenne'].map((c) => <span key={c} className="v-puce">{c}</span>)}</div>
          {s ? (
            <>
              <div className="v-trio">
                <div><b>{n2(s.rsi, 1)}</b>RSI 14 · {s.code}</div>
                <div><b>{n2(s.macd, 2)}</b>MACD · {s.code}</div>
                <div><b>{n2(s.signal, 2)}</b>Ligne de signal</div>
              </div>
              <Note>Calculés sur les clôtures réelles jusqu&apos;à la séance du {fmtDateFR(s.date)}. Source BRVM. {PAS_CONSEIL}</Note>
            </>
          ) : <SansDonnee />}
        </>
      );
    }
    case 'signaux': {
      const s = d.signaux;
      if (!s) return <SansDonnee />;
      const total = s.haussier + s.neutre + s.baissier;
      return (
        <>
          <div className="v-trio">
            <div><b className="v-up">{s.haussier}</b>haussier{s.haussier > 1 ? 's' : ''}</div>
            <div><b>{s.neutre}</b>neutre{s.neutre > 1 ? 's' : ''}</div>
            <div><b className="v-down">{s.baissier}</b>baissier{s.baissier > 1 ? 's' : ''}</div>
          </div>
          {s.haussier === 0 && total > 0 && <p className="v-carte-pied">Aucun titre ne réunit les conditions d&apos;un signal haussier sur cette séance : le moteur s&apos;abstient.</p>}
          <Note>Séance du {fmtDateFR(s.date)}, {total} valeurs notées. {PAS_CONSEIL}</Note>
        </>
      );
    }
    case 'saison': {
      const s = d.saison;
      if (!s) return <SansDonnee />;
      return (
        <>
          <p className="v-etiquette" style={{ margin: 0 }}>{s.code}{s.nom ? ` · ${s.nom}` : ''} · {s.annees} années observées</p>
          <div className="v-mois">
            {s.cellules.map((c) => (
              <div key={c.mois} style={{ opacity: c.verdict === 'hasard' ? 0.62 : 1 }}>
                <span>{c.mois}</span>
                <b className={c.mediane == null ? 'v-plat' : sens(c.mediane)}>{c.mediane == null ? '—' : pctTexte(c.mediane, 1)}</b>
                <span>{c.part == null ? 'non disponible' : `${fmtNumber(c.part, 0)} % des années`}</span>
              </div>
            ))}
          </div>
          <Note>Médiane du rendement mensuel, dividende inclus. Les cases atténuées ne se distinguent pas du hasard. {PERF_PASSEES} {PAS_CONSEIL}</Note>
        </>
      );
    }
    case 'alpha': {
      const a = d.alpha;
      if (!a) return <SansDonnee />;
      return (
        <>
          <span className="v-gros">{fmtNumber(a.score, 0)}<small>/ 100</small></span>
          <p className="v-carte-pied">{a.code}{a.nom ? ` · ${a.nom}` : ''}, premier score des {a.nbNotes} titres notés.</p>
          {a.piliers.map((p) => <LigneBarre key={p.libelle} libelle={p.libelle} part={(p.valeur ?? 0) / 100} valeur={p.valeur == null ? '—' : fmtNumber(p.valeur, 0)} />)}
          <Note>Classement du {fmtDateFR(a.date)}. Score quantitatif, {PAS_CONSEIL.toLowerCase()}</Note>
        </>
      );
    }
    case 'backtest': return <DemoBacktest d={d} onInteraction={onInteraction} />;
    case 'liquidite': {
      const l = d.liquidite;
      if (!l) return <SansDonnee />;
      return (
        <>
          {l.lignes.map((x) => <LigneBarre key={x.code} libelle={x.code} part={x.score / 100} valeur={`${fmtNumber(x.score, 0)} · ${x.classe}`} />)}
          <Note>Les cinq meilleurs scores de liquidité (0 à 100, classe A à D), séance du {fmtDateFR(l.date)}.</Note>
        </>
      );
    }
    case 'dividendes': {
      const v = d.dividendes;
      if (!v) return <SansDonnee />;
      const max = Math.max(...v.lignes.map((x) => x.rendement), 0);
      return (
        <>
          <span className="v-gros">{v.nbSocietes}<small>sociétés</small></span>
          <p className="v-carte-pied">ont distribué un dividende au titre de {v.exercice}. Les cinq meilleurs rendements :</p>
          {v.lignes.map((x) => <LigneBarre key={x.code} libelle={x.code} part={max > 0 ? x.rendement / max : 0} valeur={pctTexte(x.rendement).replace('+', '')} />)}
          <Note>Dividende de l&apos;exercice {v.exercice} rapporté au dernier cours. {PERF_PASSEES}</Note>
        </>
      );
    }
    case 'fiscalite': return <DemoFiscalite d={d} onInteraction={onInteraction} />;
    case 'simulateur': {
      const s = d.simulateur;
      return (
        <>
          {s && (
            <>
              <span className={`v-gros ${sens(s.variation)}`}>{pctTexte(s.variation)}</span>
              <p className="v-carte-pied">BRVM Composite du {fmtDateFR(s.debut)} au {fmtDateFR(s.fin)}, sur {s.seances} séances, hors dividendes.</p>
            </>
          )}
          <p className="v-carte-pied">Choisissez une société, un montant et une date : le simulateur rejoue l&apos;historique réel, dividendes inclus.</p>
          <Note>{PERF_PASSEES} {PAS_CONSEIL}</Note>
        </>
      );
    }
    case 'virtuel':
      return (
        <>
          <ul className="v-coches">{['Capital fictif, aucun franc engagé', 'Cours réels de la séance', 'Classement sous alias'].map((c) => <li key={c}><Coche />{c}</li>)}</ul>
          <Note>À but pédagogique. Les résultats d&apos;un portefeuille virtuel ne sont pas des performances réelles.</Note>
        </>
      );
    case 'valorisation': {
      const v = d.valorisation;
      if (!v) return <SansDonnee />;
      const e = v.exemple;
      return (
        <>
          <span className="v-gros">{v.nbEstimables}<small>/ {v.nbTotal}</small></span>
          <p className="v-carte-pied">sociétés dont la valeur est estimable à partir des comptes publiés.</p>
          {e && (
            <div className="v-puces">
              <span className="v-puce">{e.code}</span>
              <span className="v-puce">PER {n2(e.per, 1)}</span>
              <span className="v-puce">P/B {n2(e.pbr, 2)}</span>
              <span className="v-puce">ROE {e.roe == null ? 'non disponible' : `${fmtNumber(e.roe * 100, 1)} %`}</span>
            </div>
          )}
          <Note>Multiples calculés sur les derniers comptes publiés et le dernier cours. Estimation, pas un objectif de cours. {PAS_CONSEIL}</Note>
        </>
      );
    }
    case 'diagnostic':
      return (
        <>
          <ul className="v-coches">{['États financiers publiés, lus à la source', 'Ratios recalculés et comparés au secteur', 'Forces, vigilances et réserves rédigées', 'Contrôle des chiffres avant publication'].map((c) => <li key={c}><Coche />{c}</li>)}</ul>
          {d.diagnostic ? <p className="v-carte-pied">Dernier diagnostic généré : {d.diagnostic.code}{d.diagnostic.date ? `, le ${fmtDateFR(d.diagnostic.date)}` : ''}.</p> : <Note>Date du dernier diagnostic non disponible.</Note>}
          <Note>Contenu généré par intelligence artificielle. {PAS_CONSEIL}</Note>
        </>
      );
    case 'question':
      return (
        <>
          <div className="v-puces" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            {d.questions.map((q) => <span key={q.titre} className="v-puce">{q.titre} : {q.description.toLowerCase()}</span>)}
          </div>
          <Note>Vous échangez avec une IA. Ses réponses partent des données de la plateforme, peuvent contenir des erreurs et ne constituent pas un conseil en investissement.</Note>
        </>
      );
  }
}

function DemoScreener({ d, onInteraction }: { d: DemosOutils; onInteraction: () => void }) {
  const [actifs, setActifs] = useState<FiltreScreener[]>([]);
  const s = d.screener;
  if (!s) return <SansDonnee />;
  const lignes = filtrerScreener(s.lignes, actifs);
  return (
    <>
      <div className="v-puces">
        {FILTRES_SCREENER.map((f) => {
          const on = actifs.includes(f.id);
          return (
            <button key={f.id} type="button" className="v-puce" aria-pressed={on} onClick={() => { onInteraction(); setActifs(on ? actifs.filter((x) => x !== f.id) : [...actifs, f.id]); }}>
              {f.libelle}
            </button>
          );
        })}
      </div>
      <p className="v-etiquette" aria-live="polite" style={{ margin: 0 }}>
        {lignes.length} action{lignes.length > 1 ? 's' : ''} sur {s.lignes.length}{lignes.length > 6 ? ' · 6 affichées' : ''}
      </p>
      <div className="v-table-zone">
        <table className="v-table">
          <thead><tr><th scope="col">Code</th><th scope="col">Cours</th><th scope="col">RSI</th><th scope="col">Div.</th><th scope="col">Liq.</th></tr></thead>
          <tbody>
            {lignes.slice(0, 6).map((l) => (
              <tr key={l.code}>
                <td>{l.code}</td>
                <td>{l.cours == null ? '—' : fmtNumber(l.cours, 0)}</td>
                <td>{l.rsi == null ? '—' : fmtNumber(l.rsi, 0)}</td>
                <td>{l.rendement == null ? '—' : `${fmtNumber(l.rendement, 2)} %`}</td>
                <td>{l.classe ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>Extrait réel : les {s.lignes.length} premières valeurs par score, séance du {fmtDateFR(s.date)}{s.exercice != null ? `, dividende de l'exercice ${s.exercice}` : ''}. Un tiret : donnée non disponible. {PAS_CONSEIL}</Note>
    </>
  );
}

function DemoBacktest({ d, onInteraction }: { d: DemosOutils; onInteraction: () => void }) {
  const [i, setI] = useState(Math.max(0, d.backtest.length - 1));
  const p = d.backtest[i];
  if (!p) return <SansDonnee />;
  return (
    <>
      <div className="v-puces">
        {d.backtest.map((x, k) => (
          <button key={x.libelle} type="button" className="v-puce" aria-pressed={k === i} onClick={() => { onInteraction(); setI(k); }}>{x.libelle}</button>
        ))}
      </div>
      <svg className="v-courbe-demo" viewBox="-4 0 568 184" role="img" aria-label={`BRVM Composite du ${fmtDateFR(p.debut)} au ${fmtDateFR(p.fin)} : ${pctTexte(p.variation)}`}>
        <TraceCourbe key={p.libelle} d={p.trace} stroke="rgb(var(--color-accent))" strokeWidth={2} duree={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="v-carte-pied">BRVM Composite, {p.libelle} : <span className={sens(p.variation)}>{pctTexte(p.variation)}</span>, du {fmtDateFR(p.debut)} au {fmtDateFR(p.fin)}.</p>
      <Note>Source BRVM. {PERF_PASSEES}</Note>
    </>
  );
}

function DemoFiscalite({ d, onInteraction }: { d: DemosOutils; onInteraction: () => void }) {
  const defaut = Math.max(0, d.fiscalite.findIndex((p) => p.pays === 'CI'));
  const [i, setI] = useState(defaut);
  const p = d.fiscalite[i];
  if (!p) return <SansDonnee />;
  const f = (v: number) => `${fmtNumber(v, 0)} FCFA`;
  return (
    <>
      <div className="v-puces">
        {d.fiscalite.map((x, k) => (
          <button key={x.pays} type="button" className="v-puce" aria-pressed={k === i} onClick={() => { onInteraction(); setI(k); }}>{x.nom}</button>
        ))}
      </div>
      <div className="v-fisc" aria-live="polite">
        <div><span>Dividende brut</span><b>{f(100_000)}</b></div>
        <div><span>Retenue à la source{p.taux != null ? ` (${fmtNumber(Math.round(p.taux * 1000) / 10, Number.isInteger(Math.round(p.taux * 1000) / 10) ? 0 : 1)} %)` : ''}</span><b>{p.retenue == null ? 'non confirmé' : `− ${f(p.retenue)}`}</b></div>
        <div><span>Net perçu</span><b>{p.net == null ? 'non confirmé' : f(p.net)}</b></div>
      </div>
      <Note>Taux des personnes physiques, selon le pays de l&apos;émetteur, issus du barème sourcé de la page Fiscalité. Un taux non vérifié reste non confirmé.</Note>
    </>
  );
}
