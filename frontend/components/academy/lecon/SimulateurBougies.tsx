'use client';

import { useEffect, useId, useState } from 'react';
import type { Simulation } from '@/lib/academy/types';
import type { PointSerie } from '@/lib/academy/simTechnique';
import {
  FIGURES,
  bougieExploitable,
  lireFigureFictive,
  lireSeances,
  type BougieSeance,
  type FigureReperee,
  type PrixBougie,
} from '@/lib/academy/figuresBougies';
import { dateSeanceLongue } from '@/components/CarnetOrdres';

/**
 * Bougies sur plusieurs séances (2026-11-24) :
 *  - `bougies` : les VRAIES bougies des dernières séances d’une valeur
 *    (/api/academy/serie), figures repérées par lib/academy/figuresBougies.ts ;
 *  - `figure_bougies` : atelier de bougies FICTIVES modifiables, la figure
 *    formée est nommée en direct.
 * Une description, jamais une recommandation ; date et source toujours écrites.
 */

type SimReel = Extract<Simulation, { type: 'bougies' }>;
type SimAtelier = Extract<Simulation, { type: 'figure_bougies' }>;
type Etat = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; nom: string | null; points: PointSerie[] };

const COULEUR = { hausse: '#1d7a46', fondHausse: '#fbf8f3', baisse: '#a3401f', plat: '#8a94a3', axe: '#5d6b7d', trame: '#e6dfd3', marque: '#0b7d93' };
const nombre = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
const jourCourt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Dessin SVG d’une suite de bougies ; les figures repérées sont numérotées au-dessus. */
function Chandeliers({ bougies, figures, etiquettes }: { bougies: BougieSeance[]; figures: FigureReperee[]; etiquettes?: string[] }) {
  const n = bougies.length;
  const L = Math.max(320, n * 22 + 60);
  const H = 240;
  const haut = 26;
  const bas = 30;
  const prix = bougies.flatMap((x) => [x.haut ?? x.cloture, x.bas ?? x.cloture, x.cloture]);
  const max = Math.max(...prix);
  const min = Math.min(...prix);
  const y = (v: number) => haut + ((max - v) / (max - min || 1)) * (H - haut - bas);
  const pas = (L - 60) / Math.max(n, 1);
  const x = (i: number) => 50 + pas * i + pas / 2;
  const largeur = Math.max(4, Math.min(16, pas * 0.6));
  const finDeFigure = new Map(figures.map((f, k) => [f.fin, k + 1]));
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="lp-chandeliers" role="img" aria-label={`${n} bougies, ${figures.length} figure(s) repérée(s).`}>
      {[0, 0.5, 1].map((t) => {
        const v = max - t * (max - min);
        return (
          <g key={t}>
            <line x1="46" x2={L - 6} y1={y(v)} y2={y(v)} stroke={COULEUR.trame} />
            <text x="42" y={y(v) + 4} fontSize="10" fill={COULEUR.axe} textAnchor="end">{nombre(v)}</text>
          </g>
        );
      })}
      {figures.map((f, k) => (
        <rect key={`z${k}`} x={x(f.debut) - pas / 2} y={haut - 6} width={pas * (f.fin - f.debut + 1)} height={H - haut - bas + 6} fill={COULEUR.marque} opacity={0.07} />
      ))}
      {bougies.map((b, i) => {
        const ok = bougieExploitable(b);
        const cx = x(i);
        if (!ok) {
          return <line key={i} x1={cx - largeur / 2} x2={cx + largeur / 2} y1={y(b.cloture)} y2={y(b.cloture)} stroke={COULEUR.plat} strokeWidth="2" strokeDasharray="2 2" />;
        }
        const o = b.ouverture!;
        const c = b.cloture;
        const monte = c >= o;
        const couleur = monte ? COULEUR.hausse : COULEUR.baisse;
        const top = Math.min(y(o), y(c));
        const h = Math.max(1.5, Math.abs(y(o) - y(c)));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(b.haut!)} y2={y(b.bas!)} stroke={couleur} strokeWidth="1.4" />
            <rect x={cx - largeur / 2} y={top} width={largeur} height={h} fill={monte ? COULEUR.fondHausse : couleur} stroke={couleur} strokeWidth="1.6" rx="1" />
            {finDeFigure.has(i) && (
              <text x={cx} y={haut - 10} fontSize="11" fontWeight="700" fill={COULEUR.marque} textAnchor="middle">{finDeFigure.get(i)}</text>
            )}
          </g>
        );
      })}
      {bougies.map((b, i) => {
        const etiquette = etiquettes?.[i] ?? (i % Math.ceil(n / 6) === 0 || i === n - 1 ? jourCourt(b.date) : null);
        return etiquette ? <text key={`d${i}`} x={x(i)} y={H - 10} fontSize="10" fill={COULEUR.axe} textAnchor="middle">{etiquette}</text> : null;
      })}
    </svg>
  );
}

function ListeFigures({ figures }: { figures: FigureReperee[] }) {
  if (figures.length === 0) return null;
  return (
    <ol className="lp-figures-reperees">
      {figures.map((f, k) => (
        <li key={`${f.date}-${f.figure}`}>
          <span className="lp-figures-num">{k + 1}</span>
          {FIGURES[f.figure].libelle} — séance du {dateSeanceLongue(f.date)}
          {f.nb > 1 ? ` (${f.nb} bougies)` : ''}
        </li>
      ))}
    </ol>
  );
}

function useSerie(code: string): Etat {
  const [e, setE] = useState<Etat>({ etat: 'chargement' });
  useEffect(() => {
    const ctrl = new AbortController();
    setE({ etat: 'chargement' });
    fetch(`/api/academy/serie?code=${encodeURIComponent(code)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { nom: string | null; points: PointSerie[] };
        setE({ etat: 'pret', nom: j.nom, points: j.points });
      })
      .catch((err: unknown) => { if ((err as { name?: string }).name !== 'AbortError') setE({ etat: 'erreur' }); });
    return () => ctrl.abort();
  }, [code]);
  return e;
}

function SeancesReelles({ sim }: { sim: SimReel }) {
  const id = useId();
  const [code, setCode] = useState(sim.codes[0]!);
  const [nbSeances, setNbSeances] = useState(sim.seances);
  const serie = useSerie(code);
  const points = serie.etat === 'pret' ? serie.points.slice(-nbSeances) : [];
  const bougies: BougieSeance[] = points.map((p) => ({
    date: p.date, ouverture: p.ouverture ?? null, haut: p.haut ?? null, bas: p.bas ?? null, cloture: p.cours, volume: p.volume ?? null,
  }));
  const lecture = serie.etat === 'pret' && bougies.length > 0 ? lireSeances(bougies) : null;
  const derniere = points.at(-1) ?? null;

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">Les bougies des dernières séances</p>
        <span className="lp-badge lp-badge--reel">Données réelles</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}
      <div className="lp-champs lp-bloc-court">
        <div className="lp-champ">
          <label htmlFor={`${id}-code`}>Valeur</label>
          <select id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)}>
            {sim.codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="lp-curseur">
          <label htmlFor={`${id}-n`}>Séances affichées</label>
          <input id={`${id}-n`} type="range" min={10} max={60} step={5} value={nbSeances} aria-valuetext={`${nbSeances} séances`} onChange={(e) => setNbSeances(Number(e.target.value))} />
          <output htmlFor={`${id}-n`}>{nbSeances} séances</output>
        </div>
      </div>

      {serie.etat === 'chargement' && <p className="lp-note" role="status">Lecture des séances…</p>}
      {serie.etat === 'erreur' && <p className="lp-alerte-texte" role="alert">Les cours sont indisponibles pour le moment. Réessayez plus tard.</p>}

      {lecture && (
        <>
          <div className="lp-chandeliers-cadre"><Chandeliers bougies={bougies} figures={lecture.figures} /></div>
          <div className="lp-legende" aria-hidden="true">
            <span><i style={{ background: COULEUR.hausse }} />Séance en hausse (corps clair)</span>
            <span><i style={{ background: COULEUR.baisse }} />Séance en baisse (corps plein)</span>
            <span><i style={{ background: COULEUR.plat }} />Séance sans bougie lisible</span>
          </div>
          <ListeFigures figures={lecture.figures} />
        </>
      )}

      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {lecture && (
          <>
            <p className="lp-verdict">{lecture.lecture}</p>
            {lecture.alertes.length > 0 && <ul className="lp-alertes">{lecture.alertes.map((a) => <li key={a}>{a}</li>)}</ul>}
          </>
        )}
      </div>

      <ul className="lp-hypotheses">
        {derniere && serie.etat === 'pret' && (
          <li>
            {serie.nom ?? code} ({code}) : {points.length} séances, dernière le {dateSeanceLongue(derniere.date)}. Source : ouverture, plus haut,
            plus bas et clôture publiés pour chaque séance, base WestBourse ; figures repérées à l’ouverture du simulateur.
          </li>
        )}
        <li>Règles : celles de la leçon (grande bougie : corps d’au moins 1 % du cours et de la moitié de l’amplitude ; petite : au plus 30 % de la grande). Aucun écart d’ouverture n’est exigé.</li>
        <li>Une figure décrit le passé. Ce n’est ni une prévision ni un conseil d’achat ou de vente.</li>
      </ul>
    </figure>
  );
}

function Atelier({ sim }: { sim: SimAtelier }) {
  const id = useId();
  const initial = sim.bougies.map((b) => ({ o: String(b.ouverture), h: String(b.haut), b: String(b.bas), c: String(b.cloture) }));
  const [v, setV] = useState(initial);
  const n = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
  const prix: PrixBougie[] = v.map((x) => ({ ouverture: n(x.o), haut: n(x.h), bas: n(x.b), cloture: n(x.c) }));
  let calc: { ok: true; r: ReturnType<typeof lireFigureFictive> } | { ok: false; message: string };
  try {
    calc = { ok: true, r: lireFigureFictive(prix) };
  } catch (e) {
    calc = { ok: false, message: e instanceof Error ? e.message : 'Calcul impossible.' };
  }
  const bougies: BougieSeance[] = prix.map((p, i) => ({ date: `S${i + 1}`, ouverture: p.ouverture, haut: p.haut, bas: p.bas, cloture: p.cloture, volume: null }));
  const derniereFigure: FigureReperee[] = calc.ok && calc.r.figure
    ? [{ figure: calc.r.figure, debut: prix.length - FIGURES[calc.r.figure].nb, fin: prix.length - 1, date: '', nb: FIGURES[calc.r.figure].nb, lecture: FIGURES[calc.r.figure].lecture }]
    : [];
  const champs: ['o' | 'h' | 'b' | 'c', string][] = [['o', 'Ouverture'], ['h', 'Plus haut'], ['b', 'Plus bas'], ['c', 'Clôture']];

  return (
    <figure className="lp-figure lp-large lp-atelier">
      <div className="lp-figure-tete">
        <p className="lp-figure-titre">Construire une figure sur plusieurs bougies</p>
        <span className="lp-badge">Simulation pédagogique</span>
      </div>
      {sim.consigne && <p className="lp-note lp-note--haut">{sim.consigne}</p>}
      <div className="lp-table-wrap">
        <table className="lp-table lp-saisie-bougies">
          <caption className="sr-only">Prix de chaque bougie, modifiables</caption>
          <thead>
            <tr><th scope="col">Séance</th>{champs.map(([, l]) => <th key={l} scope="col">{l}</th>)}</tr>
          </thead>
          <tbody>
            {v.map((ligne, i) => (
              <tr key={i}>
                <th scope="row">S{i + 1}</th>
                {champs.map(([k, l]) => (
                  <td key={k}>
                    <input
                      id={`${id}-${i}-${k}`}
                      aria-label={`${l}, séance ${i + 1}`}
                      inputMode="decimal"
                      value={ligne[k]}
                      onChange={(e) => setV((old) => old.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {calc.ok && (
        <div className="lp-chandeliers-cadre lp-chandeliers-cadre--court">
          <Chandeliers bougies={bougies} figures={derniereFigure} etiquettes={bougies.map((b) => b.date)} />
        </div>
      )}
      <div className="lp-resultat" aria-live="polite" aria-atomic="true">
        {calc.ok ? <p className="lp-verdict">{calc.r.lecture}</p> : <p className="lp-alerte-texte">{calc.message}</p>}
      </div>
      <button type="button" className="lp-bouton lp-bouton--discret" onClick={() => setV(initial)}>Revenir aux valeurs de la leçon</button>
      <ul className="lp-hypotheses">
        <li>Prix fictifs. Règles de la leçon : grande bougie, corps d’au moins 1 % du cours et de la moitié de l’amplitude ; petite, au plus 30 % de la grande.</li>
        <li>Une figure décrit ce qui s’est passé ; elle ne prédit pas la séance suivante.</li>
      </ul>
    </figure>
  );
}

export default function SimulateurBougies({ sim }: { sim: SimReel | SimAtelier }) {
  return sim.type === 'bougies' ? <SeancesReelles sim={sim} /> : <Atelier sim={sim} />;
}
