'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Lesson } from '@/lib/academy/types';
import { CATEGORIE_LABEL, type Categorie } from '@/lib/academy/types';
import type { DonneesSection } from '@/lib/academy/donneesServer';
import { badgeNouveaute } from '@/lib/academy/nouveaute';
import LessonChart from '../../LessonChart';
import { Formules, Frise, Points, Tableau, Texte } from '../Blocs';
import { ETAPES, type IdEtape } from './contenu';
import CartographieRisques from './CartographieRisques';
import GraphiqueDividendesReels from './GraphiqueDividendesReels';
import SimulateurDiversification from './SimulateurDiversification';
import AtelierOrdresBrvm from './AtelierOrdresBrvm';
import ParcoursBaisse20 from './ParcoursBaisse20';
import CalculateurPrecaution from './CalculateurPrecaution';
import QuizLecon7 from './QuizLecon7';
import '../lecon.css';
import './risques.css';

export default function Lecon7RisquesExperience({
  lesson,
  quizPassed,
  onQuizAnswer,
  exerciseSlot,
  donnees,
}: {
  lesson: Lesson;
  quizPassed: boolean | null;
  onQuizAnswer: (correct: boolean) => void;
  exerciseSlot?: ReactNode;
  donnees?: Record<number, DonneesSection | null>;
}) {
  const [etapeActive, setEtapeActive] = useState<IdEtape>('risques');
  const [etapesVisitees, setEtapesVisitees] = useState<Set<IdEtape>>(() => new Set(['risques']));

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cle = entry.target.getAttribute('data-etape') as IdEtape | null;
            if (cle) {
              setEtapeActive(cle);
              setEtapesVisitees((prev) => {
                if (prev.has(cle)) return prev;
                const next = new Set(prev);
                next.add(cle);
                return next;
              });
            }
          }
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: 0.05 },
    );
    for (const et of ETAPES) {
      const el = document.getElementById(`l7-etape-${et.id}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const badge = badgeNouveaute(lesson.nouveaute, new Date());
  const questions = lesson.quiz?.length ? lesson.quiz : lesson.qcm ? [lesson.qcm] : [];

  // Repérage sémantique des 8 sections existantes de la leçon
  const sRisques = lesson.sections[0];
  const sDividendes = lesson.sections[1];
  const sDiversif = lesson.sections[2];
  const sReglesOrdres = lesson.sections[3];
  const sAtelier5000 = lesson.sections[4];
  const sBaisse20 = lesson.sections[5];
  const sPrecaution = lesson.sections[6];
  const sChecklist = lesson.sections[7];

  const simAllocation = sDiversif?.simulations.find((sm) => sm.type === 'allocation');
  const simScenario = sDiversif?.simulations.find((sm) => sm.type === 'scenario_baisse');
  const simCarnet = sAtelier5000?.simulation?.type === 'carnet' ? sAtelier5000.simulation : null;

  return (
    <article className="lp l7">
      {/* ── INTRODUCTION ÉDITORIALE PREMIUM ──────────────────────────────── */}
      <header className="l7-hero lp-large">
        <div className="l7-hero-meta">
          <span className="l7-hero-pill">
            WestBourse Academy · {CATEGORIE_LABEL[lesson.categorie as Categorie] ?? 'Initiation BRVM'}
          </span>
          {lesson.duree_min && <span className="l7-hero-duration">{lesson.duree_min} min d’étude interactive</span>}
          {badge && <span className={`lp-nouveaute lp-nouveaute--${badge.type}`}>{badge.libelle}</span>}
        </div>

        <h1 className="l7-hero-title">{lesson.titre}</h1>
        {lesson.sous_titre && <p className="l7-hero-subtitle">{lesson.sous_titre}</p>}

        <blockquote className="l7-hero-quote">
          « En Bourse, protéger son capital est aussi important que le faire fructifier. »
        </blockquote>

        {lesson.image?.url && (
          <figure className="l7-hero-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lesson.image.url} alt={lesson.image.alt || ''} />
            {lesson.image.credit && <figcaption>{lesson.image.credit}</figcaption>}
          </figure>
        )}

        <div className="l7-hero-lead">
          <Texte contenu={lesson.resume} />
        </div>
      </header>

      {/* ── SOMMAIRE VISUEL DES 8 ÉTAPES (sans superposition au défilement) ─ */}
      <nav aria-label="Plan en huit étapes de la leçon" className="l7-stepper-nav lp-large">
        <p className="l7-stepper-heading">Parcours de la leçon · 8 étapes</p>
        <ol className="l7-stepper-list">
          {ETAPES.map((et, i) => {
            const actif = etapeActive === et.id;
            const visite = etapesVisitees.has(et.id);
            return (
              <li key={et.id}>
                <a
                  href={`#l7-etape-${et.id}`}
                  className={`l7-step-link${actif ? ' is-active' : ''}${visite ? ' is-visited' : ''}`}
                >
                  <span className="l7-step-num">0{i + 1}</span>
                  <span className="l7-step-label">{et.court}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── ÉTAPE 1 : CARTOGRAPHIE DES TROIS RISQUES & LIQUIDITÉ BRVM ───── */}
      {sRisques && (
        <section
          id="l7-etape-risques"
          data-etape="risques"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-risques"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 1 sur 8 · Comprendre ce qui fait varier un portefeuille</span>
            <h2 id="l7-h-risques" className="lp-h2">
              {sRisques.titre}
            </h2>
            <Texte contenu={sRisques.contenu} />
          </div>

          <CartographieRisques section={sRisques} donneesDividendes={donnees?.[1]} />

          {sRisques.graphiques.map((g, k) => (
            <div key={`gr0-${k}`} className="lp-bloc">
              <LessonChart chart={g} variant="slide" />
            </div>
          ))}
        </section>
      )}

      {/* ── ÉTAPE 2 : DIVIDENDES RÉELS SUR 5 EXERCICES ──────────────────── */}
      {sDividendes && (
        <section
          id="l7-etape-dividendes"
          data-etape="dividendes"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-dividendes"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 2 sur 8 · Cas réels de la cote régionale</span>
            <h2 id="l7-h-dividendes" className="lp-h2">
              {sDividendes.titre}
              <span className="lp-role">Cas réel BRVM</span>
            </h2>
            <Texte contenu={sDividendes.contenu} />
          </div>

          <GraphiqueDividendesReels donnees={donnees?.[1]} />

          {sDividendes.points.length > 0 && (
            <div className="lp-bloc lp-col">
              <Points points={sDividendes.points} />
            </div>
          )}
        </section>
      )}

      {/* ── ÉTAPE 3 : DIVERSIFICATION, CONCENTRATION & CHOCS ────────────── */}
      {sDiversif && (
        <section
          id="l7-etape-diversification"
          data-etape="diversification"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-diversif"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 3 sur 8 · Structurer et protéger le portefeuille</span>
            <h2 id="l7-h-diversif" className="lp-h2">
              {sDiversif.titre}
            </h2>
            <Texte contenu={sDiversif.contenu} />
          </div>

          {sDiversif.points.length > 0 && (
            <div className="lp-bloc lp-col">
              <Points points={sDiversif.points} />
            </div>
          )}

          {sDiversif.tableau && (
            <div className="lp-bloc lp-col">
              <Tableau tableau={sDiversif.tableau} />
            </div>
          )}

          <SimulateurDiversification
            capitalDefaut={simAllocation?.type === 'allocation' ? simAllocation.capital : 1_000_000}
            rendementDefaut={simScenario?.type === 'scenario_baisse' ? simScenario.rendement_pct : 8}
          />
        </section>
      )}

      {/* ── ÉTAPE 4 : RÈGLES DE PASSAGE DES ORDRES BRVM ─────────────────── */}
      {sReglesOrdres && (
        <section
          id="l7-etape-regles"
          data-etape="regles"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-regles"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 4 sur 8 · Cadre réglementaire BRVM</span>
            <h2 id="l7-h-regles" className="lp-h2">
              {sReglesOrdres.titre}
            </h2>
            <Texte contenu={sReglesOrdres.contenu} />
          </div>

          {/* Distinction claire Fixing vs Marché continu */}
          <div className="l7-modes-cotation">
            <div className="l7-mode-card">
              <span className="l7-eyebrow">Mécanisme 1 · Confrontation groupée</span>
              <h3>Le fixing (cours d’équilibre unique)</h3>
              <p>
                Les ordres d’achat et de vente s’accumulent dans le carnet sans s’exécuter immédiatement, puis sont
                confrontés ensemble à l’heure du fixing pour dégager un <strong>cours d’équilibre unique</strong> qui
                maximise le volume échangé.
              </p>
            </div>
            <div className="l7-mode-card">
              <span className="l7-eyebrow">Mécanisme 2 · Confrontation immédiate</span>
              <h3>Le marché continu</h3>
              <p>
                Dès sa transmission en séance, chaque ordre rencontre immédiatement les offres ou demandes présentes en
                face dans le carnet, palier de prix après palier, dans la limite de prix et de quantité que vous avez
                fixée.
              </p>
            </div>
          </div>

          {sReglesOrdres.tableau && (
            <div className="lp-bloc">
              <Tableau tableau={sReglesOrdres.tableau} />
            </div>
          )}
        </section>
      )}

      {/* ── ÉTAPE 5 : ATELIER D'ACHAT DE 5 000 ACTIONS & SIMULATEUR 3 COL ─ */}
      {sAtelier5000 && (
        <section
          id="l7-etape-atelier"
          data-etape="atelier"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-atelier"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 5 sur 8 · Pratique du carnet d’ordres</span>
            <h2 id="l7-h-atelier" className="lp-h2">
              {sAtelier5000.titre}
            </h2>
            <Texte contenu={sAtelier5000.contenu} />
          </div>

          {sAtelier5000.etapes.length > 0 && (
            <div className="lp-bloc">
              <Frise etapes={sAtelier5000.etapes} style={sAtelier5000.etapes_style} />
            </div>
          )}

          {sAtelier5000.formules.length > 0 && (
            <div className="lp-bloc">
              <Formules formules={sAtelier5000.formules} />
            </div>
          )}

          {simCarnet && <AtelierOrdresBrvm sim={simCarnet} />}
        </section>
      )}

      {/* ── ÉTAPE 6 : SCÉNARIO DE BAISSE DE 20 % & ASYMÉTRIE DES PERTES ─── */}
      {sBaisse20 && (
        <section
          id="l7-etape-baisse"
          data-etape="baisse"
          className="l7-chapter lp-large"
          aria-labelledby="l7-h-baisse"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 6 sur 8 · Psychologie et méthode face au repli</span>
            <h2 id="l7-h-baisse" className="lp-h2">
              {sBaisse20.titre}
            </h2>
            <Texte contenu={sBaisse20.contenu} />
          </div>

          <ParcoursBaisse20 etapesMethode={sBaisse20.etapes} />

          {sBaisse20.points.length > 0 && (
            <div className="lp-bloc lp-col">
              <Points points={sBaisse20.points} />
            </div>
          )}
        </section>
      )}

      {/* ── ÉTAPE 7 : ÉPARGNE DE PRÉCAUTION & PIÈGES COÛTEUX ────────────── */}
      {sPrecaution && (
        <section
          id="l7-etape-precaution"
          data-etape="precaution"
          className="l7-chapter lp-large lp-section--piege"
          aria-labelledby="l7-h-precaution"
        >
          <div className="l7-chapter-head">
            <span className="l7-step-kicker">Étape 7 sur 8 · Sécuriser sa trésorerie personnelle</span>
            <h2 id="l7-h-precaution" className="lp-h2">
              {sPrecaution.titre}
              <span className="lp-role">Piège fréquent</span>
            </h2>
            <Texte contenu={sPrecaution.contenu} />
          </div>

          {sPrecaution.formules.length > 0 && (
            <div className="lp-bloc lp-col">
              <Formules formules={sPrecaution.formules} />
            </div>
          )}

          <CalculateurPrecaution />

          {sPrecaution.points.length > 0 && (
            <div className="lp-bloc lp-col lp-corps">
              <Points points={sPrecaution.points} />
            </div>
          )}
        </section>
      )}

      {/* ── ÉTAPE 8 : CHECK-LIST AVANT PREMIER ACHAT & QUIZ 11 QUESTIONS ── */}
      <section
        id="l7-etape-valider"
        data-etape="valider"
        className="l7-chapter lp-large"
        aria-labelledby="l7-h-valider"
      >
        <div className="l7-chapter-head">
          <span className="l7-step-kicker">Étape 8 sur 8 · Synthèse et validation des acquis</span>
          <h2 id="l7-h-valider" className="lp-h2">
            Valider votre préparation avant d’investir
          </h2>
        </div>

        {exerciseSlot && (
          <div className="lp-exercice lp-col" style={{ marginBottom: '1.75rem' }}>
            {exerciseSlot}
          </div>
        )}

        <QuizLecon7
          sectionChecklist={sChecklist}
          questions={questions}
          alreadyPassed={quizPassed}
          onAnswer={onQuizAnswer}
        />
      </section>

      {lesson.avertissement && (
        <p className="l7-disclaimer lp-large" role="note">
          {lesson.avertissement}
        </p>
      )}
    </article>
  );
}
