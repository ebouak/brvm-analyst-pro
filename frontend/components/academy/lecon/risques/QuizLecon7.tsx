'use client';

import { useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { Qcm, Section } from '@/lib/academy/types';
import { melangerQcm } from '@/lib/academy/melange';
import { ETAPES, NOTION_ETAPE } from './contenu';

const SEUIL_VALIDATION = 0.7;

export default function QuizLecon7({
  sectionChecklist,
  questions: brutes,
  alreadyPassed,
  onAnswer,
}: {
  sectionChecklist?: Section;
  questions: Qcm[];
  alreadyPassed: boolean | null;
  onAnswer: (passed: boolean) => void;
}) {
  const questions = useMemo(() => brutes.map((q) => melangerQcm(q)), [brutes]);
  const total = questions.length;
  const requis = Math.ceil(total * SEUIL_VALIDATION);

  // Check-list interactive avant le 1er achat
  const [cochesChecklist, setCochesChecklist] = useState<boolean[]>(() =>
    (sectionChecklist?.points ?? []).map(() => false),
  );

  // Quiz : une question par écran, choix puis validation explicite
  const [indexCourant, setIndexCourant] = useState<number>(0);
  const [selectionTemp, setSelectionTemp] = useState<number | null>(null);
  const [reponsesValidees, setReponsesValidees] = useState<(number | null)[]>(() => questions.map(() => null));
  const [termine, setTermine] = useState<boolean>(false);

  const qCourante = questions[indexCourant];
  const reponseCourante = reponsesValidees[indexCourant] ?? null;
  const estValidee = reponseCourante !== null;
  const estBonne = estValidee && qCourante ? reponseCourante === qCourante.correct : false;

  const scoreFinal = reponsesValidees.filter((r, i) => r !== null && r === questions[i]?.correct).length;
  const reussi = scoreFinal >= requis;

  // Regrouper les notions à retravailler à partir des questions manquées
  const notionsARetravailler = useMemo(() => {
    const map = new Map<string, { notion: string; nbErreurs: number; ancre: string; labelEtape: string }>();
    reponsesValidees.forEach((rep, idx) => {
      const q = questions[idx];
      if (!q || rep === null || rep === q.correct) return;
      const notion = q.notion ?? 'Mécanismes fondamentaux du risque';
      const idEtape = NOTION_ETAPE[notion] ?? 'risques';
      const etapeInfo = ETAPES.find((e) => e.id === idEtape);
      const existant = map.get(notion);
      if (existant) {
        existant.nbErreurs += 1;
      } else {
        map.set(notion, {
          notion,
          nbErreurs: 1,
          ancre: `#l7-etape-${idEtape}`,
          labelEtape: etapeInfo?.court ?? 'Revoir la section',
        });
      }
    });
    return [...map.values()];
  }, [reponsesValidees, questions]);

  function validerQuestionCourante() {
    if (selectionTemp === null || estValidee) return;
    const prochaines = reponsesValidees.map((r, i) => (i === indexCourant ? selectionTemp : r));
    setReponsesValidees(prochaines);
    if (prochaines.every((r) => r !== null)) {
      const nbJustes = prochaines.filter((r, i) => r === questions[i]?.correct).length;
      onAnswer(nbJustes >= requis);
    }
  }

  function passerSuivante() {
    if (!estValidee) return;
    if (indexCourant + 1 < total) {
      const prochainIdx = indexCourant + 1;
      setIndexCourant(prochainIdx);
      setSelectionTemp(reponsesValidees[prochainIdx] ?? null);
    } else {
      setTermine(true);
    }
  }

  function recommencerQuiz() {
    setReponsesValidees(questions.map(() => null));
    setSelectionTemp(null);
    setIndexCourant(0);
    setTermine(false);
  }

  return (
    <div className="l7-validation-stack">
      {/* Check-list interactive avant le premier achat */}
      {sectionChecklist && sectionChecklist.points.length > 0 && (
        <div className="l7-checklist-card">
          <div className="l7-sim-header">
            <div>
              <span className="l7-eyebrow">Auto-diagnostic · Avant de transmettre un premier ordre</span>
              <h3 className="l7-sim-title">{sectionChecklist.titre}</h3>
            </div>
            <span className="l7-checklist-count">
              {cochesChecklist.filter(Boolean).length} / {sectionChecklist.points.length} validés
            </span>
          </div>
          <p className="l7-body-note">{sectionChecklist.contenu}</p>

          <div className="l7-checklist-grid">
            {sectionChecklist.points.map((pt, i) => {
              const coche = Boolean(cochesChecklist[i]);
              return (
                <label key={pt.titre} className={`l7-checklist-item${coche ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={coche}
                    onChange={() => setCochesChecklist((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                  />
                  <div>
                    <strong>{pt.titre}</strong>
                    {pt.detail && <p>{pt.detail}</p>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiz reconçu : 11 questions, 1 par écran, validation immédiate sans réponse dévoilée avant validation */}
      <section className="l7-quiz-shell" aria-labelledby="lp-quiz-titre">
        <div className="l7-quiz-top">
          <div>
            <span className="l7-eyebrow" id="lp-quiz-titre">
              Évaluation finale · {total} questions
              {alreadyPassed && !termine && <span className="l7-passed-pill"> · Déjà validé ✓</span>}
            </span>
            <h3 className="l7-quiz-heading">
              {termine ? 'Bilan de votre évaluation' : `Question ${indexCourant + 1} sur ${total}`}
            </h3>
          </div>
          {!termine && qCourante?.notion && <span className="l7-notion-tag">{qCourante.notion}</span>}
        </div>

        {/* Barre de progression segmentée */}
        <div className="l7-quiz-progress" aria-label={`Progression : ${reponsesValidees.filter((r) => r !== null).length} sur ${total} réponses validées`}>
          {questions.map((_, i) => {
            const rep = reponsesValidees[i];
            const etat =
              rep === null
                ? i === indexCourant && !termine
                  ? 'is-current'
                  : ''
                : rep === questions[i]?.correct
                  ? 'is-correct'
                  : 'is-wrong';
            return <span key={i} className={`l7-quiz-seg ${etat}`} />;
          })}
        </div>

        {!termine && qCourante && (
          <div className="l7-quiz-screen">
            <p className="l7-quiz-question" id={`l7-q-${indexCourant}`}>
              {qCourante.question}
            </p>

            <div className="l7-quiz-options" role="radiogroup" aria-labelledby={`l7-q-${indexCourant}`}>
              {qCourante.options.map((opt, i) => {
                const selectionnee = (estValidee ? reponseCourante : selectionTemp) === i;
                const afficherJuste = estValidee && i === qCourante.correct;
                const afficherFaux = estValidee && i === reponseCourante && !estBonne;

                let cls = 'l7-quiz-opt';
                if (!estValidee && selectionnee) cls += ' is-selected';
                if (afficherJuste) cls += ' is-correct';
                if (afficherFaux) cls += ' is-wrong';

                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={selectionnee}
                    disabled={estValidee}
                    className={cls}
                    onClick={() => setSelectionTemp(i)}
                  >
                    <span className="l7-opt-letter" aria-hidden="true">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="l7-opt-text">{opt}</span>
                    {afficherJuste && <Check size={18} strokeWidth={2.2} aria-label="Bonne réponse" />}
                    {afficherFaux && <X size={18} strokeWidth={2.2} aria-label="Réponse incorrecte" />}
                  </button>
                );
              })}
            </div>

            {!estValidee ? (
              <div className="l7-quiz-actions">
                <button
                  type="button"
                  className="l7-primary-btn"
                  disabled={selectionTemp === null}
                  onClick={validerQuestionCourante}
                >
                  <span>Valider ma réponse</span>
                  <span className="l7-btn-icon" aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            ) : (
              <div className={`l7-quiz-explain${estBonne ? ' is-correct' : ' is-wrong'}`} aria-live="polite">
                <p className="l7-explain-title">
                  {estBonne ? 'Exact.' : 'Réponse inexacte — la bonne proposition est signalée en vert.'}
                </p>
                <p className="l7-explain-body">{qCourante.explication}</p>
                <div className="l7-quiz-actions">
                  <button type="button" className="l7-primary-btn" onClick={passerSuivante}>
                    <span>
                      {indexCourant + 1 < total ? 'Question suivante' : 'Voir mon score et ma synthèse'}
                    </span>
                    <span className="l7-btn-icon" aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {termine && (
          <div className="l7-quiz-summary" role="status" aria-live="polite">
            <div className={`l7-score-banner${reussi ? ' is-passed' : ' is-retry'}`}>
              <div className="l7-score-figure">
                <strong>
                  {scoreFinal} / {total}
                </strong>
                <span>Seuil de maîtrise : {requis} / {total}</span>
              </div>
              <div className="l7-score-copy">
                <h4>
                  {reussi
                    ? 'Félicitations — vous maîtrisez les fondamentaux de la gestion du risque à la BRVM.'
                    : 'Encore un effort — consolidez les points signalés ci-dessous avant de retenter.'}
                </h4>
                <p>
                  {scoreFinal === total
                    ? 'Score parfait : toutes les notions réglementaires, mathématiques et comportementales ont été validées.'
                    : `${total - scoreFinal} question${total - scoreFinal > 1 ? 's méritent' : ' mérite'} une relecture ciblée.`}
                </p>
              </div>
            </div>

            {notionsARetravailler.length > 0 ? (
              <div className="l7-review-box">
                <h4>Synthèse des notions à retravailler</h4>
                <ul className="l7-review-list">
                  {notionsARetravailler.map((item) => (
                    <li key={item.notion}>
                      <div>
                        <strong>{item.notion}</strong>
                        <span>
                          {' '}
                          ({item.nbErreurs} question{item.nbErreurs > 1 ? 's' : ''} à revoir)
                        </span>
                      </div>
                      <a href={item.ancre} className="l7-review-link">
                        Revoir « {item.labelEtape} » ↑
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="l7-ok-note">Aucune notion en difficulté : votre parcours sur la Leçon 7 est complet.</p>
            )}

            <div className="l7-quiz-actions">
              <button type="button" className="l7-secondary-btn" onClick={recommencerQuiz}>
                <RotateCcw size={16} aria-hidden="true" />
                <span>Recommencer le quiz</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
