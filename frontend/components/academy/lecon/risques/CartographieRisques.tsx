'use client';

import { useState } from 'react';
import type { Section } from '@/lib/academy/types';
import type { DonneesSection } from '@/lib/academy/donneesServer';
import { liquiditeBrvm, nombre, pct } from '@/lib/academy/risques';
import { FICHES, type CleRisque } from './contenu';

const CODES_LIQUIDITE = ['SNTS', 'PALC', 'NTLC', 'SPHC'];

export default function CartographieRisques({
  section,
  donneesDividendes,
}: {
  section: Section;
  donneesDividendes?: DonneesSection | null;
}) {
  const [actif, setActif] = useState<CleRisque>('marche');
  const liq = liquiditeBrvm(CODES_LIQUIDITE);

  const fiche = FICHES.find((f) => f.cle === actif) ?? FICHES[0]!;
  const pointSource = section.points.find((p) => fiche.motifPoint.test(p.titre)) ?? section.points[0];

  // Exemple concret BRVM construit uniquement sur faits documentés et données réelles chargées
  let exempleBrvm = '';
  if (actif === 'marche') {
    exempleBrvm =
      'Lors d’une hausse des taux sur le marché régional UEMOA ou d’un repli général de la cote, les indices BRVM Composite et BRVM 30 entraînent la majorité des valeurs à la baisse, même lorsque leurs activités restent bénéficiaires.';
  } else if (actif === 'entreprise') {
    const reculs52 =
      'Sur les 52 semaines arrêtées au 23/11/2026, plusieurs valeurs ont fortement reculé depuis leur plus-haut annuel : SCRC (−68,6 %, de 3 920 à 1 230 FCFA), SAFC (−53,4 %), UNLC (−50,9 %) et SIVC (−50,2 %).';
    if (donneesDividendes && donneesDividendes.vue === 'historique' && donneesDividendes.lignes.length > 0) {
      const avecBaisse = donneesDividendes.lignes.filter((l) => l.baisses > 0);
      exempleBrvm =
        avecBaisse.length > 0
          ? `${reculs52} Côté dividendes, ${avecBaisse.map((l) => `${l.nom} (${l.baisses} baisse${l.baisses > 1 ? 's' : ''})`).join(' et ')} illustrent aussi la variabilité propre à chaque société.`
          : reculs52;
    } else {
      exempleBrvm = reculs52;
    }
  } else {
    exempleBrvm = `Au 23/11/2026, seules 4 valeurs sur 48 sont en classe A de liquidité (SNTS 92/100, SGBC 80, BBGC 79, BOAC 75), contre 20 en classe B, 18 en classe C et 6 en classe D. Sur un titre étroit de classe D comme PRSC (17/100), l’écart achat/vente atteint 8,99 %, contre 0,36 % sur BOAC ou 0,75 % sur SNTS.`;
  }

  return (
    <div className="l7-risk-map">
      {/* Sélecteur des 3 cartes de risques */}
      <div className="l7-risk-cards" role="tablist" aria-label="Cartographie des trois risques boursiers">
        {FICHES.map((f, idx) => {
          const pt = section.points.find((p) => f.motifPoint.test(p.titre));
          const selectionnee = f.cle === actif;
          return (
            <button
              key={f.cle}
              type="button"
              role="tab"
              id={`l7-tab-${f.cle}`}
              aria-selected={selectionnee}
              aria-controls={`l7-panel-${f.cle}`}
              className={`l7-risk-card${selectionnee ? ' is-active' : ''}`}
              onClick={() => setActif(f.cle)}
            >
              <span className="l7-risk-index">0{idx + 1}</span>
              <strong className="l7-risk-title">{pt?.titre ?? f.cle}</strong>
              <span className="l7-risk-hook">{f.accroche}</span>
              <span className="l7-risk-cta">{selectionnee ? 'Fiche ouverte' : 'Explorer ce risque →'}</span>
            </button>
          );
        })}
      </div>

      {/* Panneau détaillé de la carte sélectionnée */}
      <div
        id={`l7-panel-${fiche.cle}`}
        role="tabpanel"
        aria-labelledby={`l7-tab-${fiche.cle}`}
        className="l7-risk-detail"
      >
        <div className="l7-risk-detail-top">
          <div>
            <span className="l7-eyebrow">Analyse détaillée du risque</span>
            <h3>{pointSource?.titre}</h3>
            <p className="l7-risk-def">{pointSource?.detail}</p>
          </div>
          {pointSource?.verifier && (
            <div className="l7-key-question">
              <span>Question réflexe</span>
              <p>{pointSource.verifier}</p>
            </div>
          )}
        </div>

        <div className="l7-brvm-case">
          <span className="l7-brvm-tag">Exemple concret BRVM</span>
          <p>{exempleBrvm}</p>
        </div>

        <div className="l7-risk-columns">
          <div className="l7-risk-col">
            <h4>Indicateurs à surveiller</h4>
            <ul>
              {fiche.indicateurs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="l7-risk-col">
            <h4>Conséquences possibles</h4>
            <ul>
              {fiche.consequences.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="l7-risk-col l7-risk-col--shield">
            <h4>Mesures de protection</h4>
            <ul>
              {fiche.protections.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Focus données réelles de liquidité BRVM */}
      <figure className="l7-liquidity-panel">
        <div className="l7-sim-header">
          <div>
            <span className="l7-eyebrow">Repère de marché · Concentration des échanges sur la BRVM</span>
            <h4 className="l7-sim-title">
              Capitaux échangés sur {liq.periode.seances} séances ({liq.periode.debut} → {liq.periode.fin})
            </h4>
          </div>
          <span className="lp-badge lp-badge--reel">Données réelles</span>
        </div>

        <div className="l7-liq-highlights">
          <div>
            <strong>{pct(liq.partTop10Pct)}</strong>
            <span>des capitaux concentrés sur les 10 titres les plus actifs (sur {liq.nbValeurs} valeurs)</span>
          </div>
          <div>
            <strong>{pct(liq.plusEchangee.partPct)}</strong>
            <span>pour {liq.plusEchangee.nom} seule ({nombre(liq.plusEchangee.capitauxMd, 2)} Md FCFA)</span>
          </div>
          {liq.moinsEchangees[0] && (
            <div>
              <strong>
                {liq.moinsEchangees[0].seancesSansEchange} / {liq.moinsEchangees[0].seancesCotees}
              </strong>
              <span>séances sans aucun échange pour {liq.moinsEchangees[0].nom}</span>
            </div>
          )}
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <caption className="sr-only">
              Capitaux échangés et fréquence de cotation de valeurs de la BRVM sur 65 séances
            </caption>
            <thead>
              <tr>
                <th scope="col">Valeur</th>
                <th scope="col" className="lp-num">
                  Capitaux échangés (Md FCFA)
                </th>
                <th scope="col" className="lp-num">
                  Part du marché
                </th>
                <th scope="col" className="lp-num">
                  Séances sans échange
                </th>
              </tr>
            </thead>
            <tbody>
              {[...liq.lignes, ...liq.moinsEchangees.slice(0, 1)].map((v) => (
                <tr key={v.code}>
                  <th scope="row" className="lp-ligne-tete">
                    {v.nom} <span className="lp-cellule-detail">{v.code}</span>
                  </th>
                  <td className="lp-num">{nombre(v.capitauxMd, 2)}</td>
                  <td className="lp-num">{pct(v.partPct, 1)}</td>
                  <td className={`lp-num${v.seancesSansEchange > 10 ? ' lp-alerte' : ''}`}>
                    {v.seancesSansEchange} sur {v.seancesCotees}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lp-note">
          Source : BRVM via la base WestBourse (relevé du 24/11/2026 sur les séances du 24/08/2026 au 23/11/2026). Plus
          une valeur compte de séances sans échange, plus un ordre « au mieux » expose à un écart de prix défavorable.
        </p>
      </figure>
    </div>
  );
}
