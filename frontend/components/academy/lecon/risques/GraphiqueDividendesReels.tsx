'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DonneesSection } from '@/lib/academy/donneesServer';
import {
  base100,
  commenterDividendes,
  libelleBase,
  nombre,
  pctSigne,
  pointsDividende,
  type NaturePoint,
} from '@/lib/academy/risques';

const COULEURS_SERIES = ['#0b192c', '#0b7d93', '#b8892a', '#1d7a46'];

function couleurNature(n: NaturePoint): string {
  if (n === 'baisse') return '#a3401f';
  if (n === 'reprise') return '#b8892a';
  if (n === 'hausse') return '#1d7a46';
  return '#0b7d93';
}

function etiquetteNature(n: NaturePoint): string {
  if (n === 'baisse') return 'Baisse';
  if (n === 'reprise') return 'Reprise';
  if (n === 'hausse') return 'Hausse';
  if (n === 'stable') return 'Stable';
  if (n === 'absent') return 'Non enregistré';
  return '1er exercice affiché';
}

export default function GraphiqueDividendesReels({
  donnees,
}: {
  donnees: DonneesSection | null | undefined;
}) {
  const [mode, setMode] = useState<'societe' | 'comparer'>('societe');
  const [codeChoisi, setCodeChoisi] = useState<string>('SNTS');
  const [afficherTableau, setAfficherTableau] = useState<boolean>(false);

  if (!donnees || donnees.vue !== 'historique') {
    return (
      <div className="l7-sim-shell">
        <div className="l7-sim-inner">
          <div className="l7-sim-header">
            <h3 className="l7-sim-title">Historique des dividendes sur cinq exercices</h3>
            <span className="lp-badge lp-badge--reel">Données réelles</span>
          </div>
          <p className="l7-state-msg" role="status">
            Les historiques de dividendes en base sont momentanément indisponibles. Aucune donnée fictive n’est affichée
            à leur place ; la suite de la leçon reste intégralement accessible.
          </p>
        </div>
      </div>
    );
  }

  const { exercices, lignes, manquants } = donnees;

  if (lignes.length === 0) {
    return (
      <div className="l7-sim-shell">
        <div className="l7-sim-inner">
          <p className="l7-state-msg" role="status">
            Aucune série exploitable aujourd’hui pour : {manquants.join(', ')}.
          </p>
        </div>
      </div>
    );
  }

  const societeActive = lignes.find((l) => l.code === codeChoisi) ?? lignes[0]!;
  const points = pointsDividende(societeActive);
  const commentaires = commenterDividendes(societeActive);

  const donneesSociete = points.map((p) => ({
    exercice: String(p.exercice),
    montant: p.montant,
    base: p.base,
    nature: p.nature,
    variationPct: p.variationPct,
  }));

  // Données Base 100 pour comparer les trajectoires des 4 sociétés sans écraser les petits montants nominaux
  const seriesBase100 = lignes.map((l) => ({ code: l.code, nom: l.nom, valeurs: base100(l) }));
  const donneesComparaison = exercices.map((ex, idx) => {
    const row: Record<string, string | number | null> = { exercice: String(ex) };
    for (const s of seriesBase100) {
      row[s.code] = s.valeurs[idx] ?? null;
    }
    return row;
  });

  const auMoinsUneNonVerifiee = lignes.some((l) =>
    pointsDividende(l).some((p) => p.montant != null && p.base === 'non_verifiee'),
  );

  return (
    <div className="l7-sim-shell">
      <div className="l7-sim-inner">
        <div className="l7-sim-header">
          <div>
            <span className="l7-eyebrow">
              Données réelles WestBourse · Exercices {exercices[0]} à {exercices[exercices.length - 1]}
            </span>
            <h3 className="l7-sim-title">Évolution des dividendes : SONATEL, PALMCI, NESTLÉ CI et SAPH CI</h3>
          </div>
          <span className="lp-badge lp-badge--reel">Données réelles</span>
        </div>

        {/* Barre de sélection société / comparaison */}
        <div className="l7-toolbar">
          <div className="l7-seg-group" role="group" aria-label="Mode de lecture des dividendes">
            <button
              type="button"
              className={`l7-seg-btn${mode === 'societe' ? ' is-active' : ''}`}
              onClick={() => setMode('societe')}
            >
              Par société (FCFA / action)
            </button>
            <button
              type="button"
              className={`l7-seg-btn${mode === 'comparer' ? ' is-active' : ''}`}
              onClick={() => setMode('comparer')}
            >
              Comparer les évolutions (base 100)
            </button>
          </div>

          <button
            type="button"
            className="l7-link-btn"
            onClick={() => setAfficherTableau((v) => !v)}
          >
            {afficherTableau ? 'Masquer le tableau complet' : 'Afficher le tableau complet'}
          </button>
        </div>

        {mode === 'societe' && (
          <>
            <div className="l7-company-tabs" role="tablist" aria-label="Choisir une société cotée">
              {lignes.map((l) => {
                const sel = l.code === societeActive.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="tab"
                    aria-selected={sel}
                    className={`l7-company-tab${sel ? ' is-active' : ''}`}
                    onClick={() => setCodeChoisi(l.code)}
                  >
                    <strong>{l.nom}</strong>
                    <small>
                      {l.code} · {l.baisses === 0 ? '0 baisse' : `${l.baisses} baisse${l.baisses > 1 ? 's' : ''}`}
                    </small>
                  </button>
                );
              })}
            </div>

            {/* Légende visuelle des natures */}
            <div className="l7-div-legend" aria-hidden="true">
              <span>
                <i style={{ background: '#0b7d93' }} /> 1er exercice / stable
              </span>
              <span>
                <i style={{ background: '#1d7a46' }} /> Hausse
              </span>
              <span>
                <i style={{ background: '#a3401f' }} /> Baisse
              </span>
              <span>
                <i style={{ background: '#b8892a' }} /> Reprise après baisse
              </span>
            </div>

            <div
              className="l7-chart-box"
              role="img"
              aria-label={`Dividende par action de ${societeActive.nom} sur les exercices ${exercices[0]} à ${exercices[exercices.length - 1]}`}
            >
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={donneesSociete} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e6dfd3" vertical={false} />
                  <XAxis
                    dataKey="exercice"
                    tick={{ fill: '#2b3a4d', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#e6dfd3' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#5d6b7d', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tickFormatter={(v: number) => nombre(v, 0)}
                  />
                  <Tooltip
                    formatter={(val: unknown, _name: string, item: { payload?: (typeof donneesSociete)[number] }) => {
                      if (val == null || typeof val !== 'number') return ['Aucun dividende enregistré', 'Montant'];
                      const p = item.payload;
                      const detailBase = p ? ` (${libelleBase(p.base)})` : '';
                      return [`${nombre(val)} FCFA${detailBase}`, p ? etiquetteNature(p.nature) : 'Dividende'];
                    }}
                    labelFormatter={(lbl: string) => `Exercice ${lbl}`}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e6dfd3',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="montant" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {donneesSociete.map((entry) => (
                      <Cell key={entry.exercice} fill={couleurNature(entry.nature)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Vignettes exercice par exercice avec distinction explicite net / brut / non vérifiée */}
            <div className="l7-year-strip">
              {points.map((p) => (
                <div key={p.exercice} className={`l7-year-pill l7-year-pill--${p.nature}`}>
                  <span className="l7-year-num">Ex. {p.exercice}</span>
                  <strong className="l7-year-val">
                    {p.montant != null ? `${nombre(p.montant)} FCFA` : '—'}
                  </strong>
                  <span className="l7-year-tag">
                    {p.montant == null
                      ? 'Non enregistré'
                      : p.variationPct != null
                        ? `${etiquetteNature(p.nature)} (${pctSigne(p.variationPct)})`
                        : etiquetteNature(p.nature)}
                  </span>
                  {p.montant != null && (
                    <small className={`l7-fiscal-badge l7-fiscal-badge--${p.base}`}>
                      {p.base === 'net' ? 'Montant net' : p.base === 'brut' ? 'Montant brut' : 'Base non vérifiée *'}
                    </small>
                  )}
                </div>
              ))}
            </div>

            {/* Commentaire pédagogique automatique strictement fondé sur les données affichées */}
            <div className="l7-auto-comment" aria-live="polite">
              <span className="l7-eyebrow">Lecture pédagogique automatique · Données affichées uniquement</span>
              <ul>
                {commentaires.map((phrase, idx) => (
                  <li key={idx}>{phrase}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {mode === 'comparer' && (
          <>
            <p className="l7-body-note">
              Chaque série part de <strong>100</strong> lors de son premier exercice versé sur la période : vous comparez
              ainsi l’amplitude des hausses, des baisses et des reprises indépendamment du prix nominal de l’action. Les
              exercices sans dividende enregistré restent interrompus (jamais remplacés par zéro).
            </p>
            <div className="l7-div-legend" aria-hidden="true">
              {lignes.map((l, idx) => (
                <span key={l.code}>
                  <i style={{ background: COULEURS_SERIES[idx % COULEURS_SERIES.length] }} /> {l.nom} ({l.code})
                </span>
              ))}
            </div>
            <div
              className="l7-chart-box"
              role="img"
              aria-label="Comparaison en base 100 de l'évolution des dividendes des quatre sociétés"
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={donneesComparaison} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e6dfd3" vertical={false} />
                  <XAxis
                    dataKey="exercice"
                    tick={{ fill: '#2b3a4d', fontSize: 12 }}
                    axisLine={{ stroke: '#e6dfd3' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#5d6b7d', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(val: unknown, codeSerie: string) => {
                      const nomSoc = lignes.find((x) => x.code === codeSerie)?.nom ?? codeSerie;
                      if (val == null || typeof val !== 'number') return ['Non enregistré', nomSoc];
                      return [`Indice ${nombre(val, 1)} (base 100)`, nomSoc];
                    }}
                    labelFormatter={(lbl: string) => `Exercice ${lbl}`}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e6dfd3',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  {lignes.map((l, idx) => (
                    <Line
                      key={l.code}
                      type="monotone"
                      dataKey={l.code}
                      stroke={COULEURS_SERIES[idx % COULEURS_SERIES.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Tableau complet vérifiable */}
        {afficherTableau && (
          <div className="lp-table-wrap lp-bloc">
            <table className="lp-table">
              <caption className="sr-only">Historique complet des dividendes par action en FCFA</caption>
              <thead>
                <tr>
                  <th scope="col">Société</th>
                  {exercices.map((e) => (
                    <th key={e} scope="col" className="lp-num">
                      {e}
                    </th>
                  ))}
                  <th scope="col" className="lp-num">
                    Baisses constatées
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.code}>
                    <th scope="row" className="lp-ligne-tete">
                      {l.nom} <span className="lp-cellule-detail">{l.code}</span>
                    </th>
                    {pointsDividende(l).map((m) => (
                      <td key={m.exercice} className="lp-num">
                        {m.montant != null ? (
                          <>
                            {nombre(m.montant)}
                            {m.base === 'non_verifiee' ? ' *' : ''}
                            <span className="lp-cellule-detail">{libelleBase(m.base)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    ))}
                    <td className={`lp-num${l.baisses > 0 ? ' lp-alerte' : ''}`}>{l.baisses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ul className="lp-hypotheses">
          <li>
            Source : table des dividendes de la base WestBourse (calendriers de paiement et Bulletins officiels de la
            cote BRVM). « — » signale l’absence de dividende enregistré dans la base.
          </li>
          {auMoinsUneNonVerifiee && (
            <li>
              * Montant publié dont la nature fiscale exacte (brut ou net d’IRVM) n’est pas vérifiée dans la base
              historique.
            </li>
          )}
        </ul>
        {manquants.length > 0 && <p className="lp-note">Sans donnée exploitable aujourd’hui : {manquants.join(', ')}.</p>}
      </div>
    </div>
  );
}
