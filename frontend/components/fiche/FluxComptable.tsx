'use client';

import { useState } from 'react';
import { fmtFcfa } from '@/lib/format';
import type { FluxCR, FluxBilan, Noeud } from '@/lib/fiche/flux';

interface Props {
  /** Flux calculés côté serveur par `fluxCompteResultat` ; null = poste manquant. */
  parExercice: Record<number, FluxCR | null>;
  exercices: number[];
  /** Flux du bilan par exercice (`fluxBilan`) ; null = terme manquant. */
  bilanParExercice?: Record<number, FluxBilan | null>;
}

type Onglet = 'cr' | 'bilan' | 'flux';
type Vue = 'barres' | 'flux';

const COULEUR: Record<string, string> = {
  chiffreAffaires: 'rgb(var(--color-accent))',
  horsExploitation: 'rgb(var(--color-up))',
  perte: 'rgb(var(--color-down))',
  impot: 'rgb(var(--color-down))',
  chargesExploitation: 'rgb(var(--color-purple))',
  benefice: 'rgb(var(--color-up))',
  actif: 'rgb(var(--color-accent))',
  capitauxPropres: 'rgb(var(--color-up))',
  detteFinanciere: 'rgb(var(--color-down))',
  autresPassifs: 'rgb(var(--color-purple))',
};
const coul = (cle: string) => COULEUR[cle] ?? 'rgb(var(--color-muted))';

const H_TOTAL = 260;
const ECART = 10;
const W = 760;
const XG = 200, XC = 372, XD = 556, LN = 14; // colonnes : gauche, centre, droite, largeur d'un nœud

interface Place { n: Noeud; y: number; h: number; c: number }

/** Empile les nœuds d'une colonne ; `c` = position cumulée sur le nœud central. */
function empiler(noeuds: Noeud[], total: number, yDebut: number): Place[] {
  let cum = 0;
  return noeuds.map((n, i) => {
    const h = (n.valeur / total) * H_TOTAL;
    const p = { n, y: yDebut + sommeAvant(noeuds, i, total), h, c: cum };
    cum += h;
    return p;
  });
}
function sommeAvant(noeuds: Noeud[], i: number, total: number): number {
  let s = 0;
  for (let k = 0; k < i; k++) s += (noeuds[k]!.valeur / total) * H_TOTAL + ECART;
  return s;
}

function bande(x1: number, ya: number, yb: number, x2: number, yc: number, yd: number): string {
  const xm = (x1 + x2) / 2;
  return `M ${x1} ${ya} C ${xm} ${ya}, ${xm} ${yc}, ${x2} ${yc} L ${x2} ${yd} C ${xm} ${yd}, ${xm} ${yb}, ${x1} ${yb} Z`;
}

function VueFlux({ f, titreCentre = 'Ressources', ariaLabel }: { f: FluxCR; titreCentre?: string; ariaLabel?: string }) {
  const nMax = Math.max(f.ressources.length, f.emplois.length);
  const hCol = (n: number) => H_TOTAL + ECART * (n - 1);
  const H = hCol(nMax) + 24;
  const yc = (H - H_TOTAL) / 2;
  const g = empiler(f.ressources, f.total, (H - hCol(f.ressources.length)) / 2);
  const d = empiler(f.emplois, f.total, (H - hCol(f.emplois.length)) / 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={ariaLabel ?? `Flux du compte de résultat : ressources ${fmtFcfa(f.total)} réparties en emplois`}>
      {g.map((p) => (
        <g key={`g-${p.n.cle}`}>
          <path d={bande(XG + LN, p.y, p.y + p.h, XC, yc + p.c, yc + p.c + p.h)} fill={coul(p.n.cle)} opacity={0.28} />
          <rect x={XG} y={p.y} width={LN} height={Math.max(p.h, 1)} fill={coul(p.n.cle)} rx={2} />
          <text x={XG - 8} y={p.y + p.h / 2} textAnchor="end" dominantBaseline="middle" fontSize={11.5} fill="rgb(var(--color-ivory))">
            {p.n.libelle} <tspan className="tabular" fill="rgb(var(--color-muted))">{fmtFcfa(p.n.valeur)}</tspan>
          </text>
        </g>
      ))}
      {d.map((p) => (
        <g key={`d-${p.n.cle}`}>
          <path d={bande(XC + LN, yc + p.c, yc + p.c + p.h, XD, p.y, p.y + p.h)} fill={coul(p.n.cle)} opacity={0.28} />
          <rect x={XD} y={p.y} width={LN} height={Math.max(p.h, 1)} fill={coul(p.n.cle)} rx={2} />
          <text x={XD + LN + 8} y={p.y + p.h / 2} dominantBaseline="middle" fontSize={11.5} fill="rgb(var(--color-ivory))">
            {p.n.libelle} <tspan className="tabular" fill="rgb(var(--color-muted))">{fmtFcfa(p.n.valeur)}</tspan>
          </text>
        </g>
      ))}
      <rect x={XC} y={yc} width={LN} height={H_TOTAL} fill="rgb(var(--color-border-strong))" rx={2} />
      <text x={XC + LN / 2} y={yc - 8} textAnchor="middle" fontSize={11.5} fill="rgb(var(--color-ivory))">
        {titreCentre} <tspan className="tabular" fill="rgb(var(--color-muted))">{fmtFcfa(f.total)}</tspan>
      </text>
    </svg>
  );
}

function VueBarres({ f }: { f: FluxCR }) {
  const max = Math.max(...f.ressources.map((n) => n.valeur), ...f.emplois.map((n) => n.valeur));
  const Col = ({ titre, noeuds }: { titre: string; noeuds: Noeud[] }) => (
    <div className="space-y-2">
      <p className="text-xs text-muted">{titre}</p>
      {noeuds.map((n) => (
        <div key={n.cle}>
          <div className="flex justify-between text-xs">
            <span className="text-ivory">{n.libelle}</span>
            <span className="tabular text-muted">{fmtFcfa(n.valeur)}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-border">
            <div className="h-2 rounded" style={{ width: `${Math.max(1, (n.valeur / max) * 100)}%`, background: coul(n.cle) }} />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Col titre={`Ressources · ${fmtFcfa(f.total)}`} noeuds={f.ressources} />
      <Col titre="Emplois" noeuds={f.emplois} />
    </div>
  );
}

const bouton = (actif: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${actif ? 'border-accent text-accent-ink bg-accent/10' : 'border-border text-muted hover:text-ivory'}`;

export default function FluxComptable({ parExercice, exercices, bilanParExercice = {} }: Props) {
  const tries = [...exercices].sort((a, b) => b - a);
  const [exercice, setExercice] = useState<number | null>(tries[0] ?? null);
  const [onglet, setOnglet] = useState<Onglet>('cr');
  const [vue, setVue] = useState<Vue>('flux');
  if (tries.length === 0) return null;
  const f = exercice != null ? parExercice[exercice] ?? null : null;
  const b = exercice != null ? bilanParExercice[exercice] ?? null : null;

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-2">
          {([['cr', 'Compte de résultat'], ['bilan', 'Bilan'], ['flux', 'Flux de trésorerie']] as [Onglet, string][]).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)} className={bouton(onglet === id)}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Exercice
            <select value={exercice ?? ''} onChange={(e) => setExercice(Number(e.target.value))}
              className="rounded border border-border bg-bg px-2 py-1 text-xs text-ivory">
              {tries.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {onglet === 'cr' && (
            <div className="flex gap-1">
              <button onClick={() => setVue('barres')} className={bouton(vue === 'barres')}>Barres</button>
              <button onClick={() => setVue('flux')} className={bouton(vue === 'flux')}>Flux</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        {onglet === 'cr' ? (
          f ? (vue === 'flux' ? <VueFlux f={f} /> : <VueBarres f={f} />)
            : <p className="text-sm text-muted">Flux non disponible pour cet exercice : un des quatre postes publiés (chiffre d&apos;affaires, résultat d&apos;exploitation, avant impôt, net) manque ou n&apos;est pas comparable.</p>
        ) : onglet === 'bilan' ? (
          b ? (
            <VueFlux f={{ ressources: [b.actif], emplois: b.passifs, total: b.actif.valeur }} titreCentre="Total actif"
              ariaLabel={`Flux du bilan : total actif ${fmtFcfa(b.actif.valeur)} réparti entre capitaux propres, dette financière et autres passifs`} />
          ) : (
            <p className="text-sm text-muted">Vue en flux non disponible pour le bilan de cet exercice : total actif, capitaux propres ou dette financière manque. Consulter le tableau sur cinq ans ci-dessus.</p>
          )
        ) : (
          <p className="text-sm text-muted">Vue en flux non disponible pour les flux de trésorerie : consulter le tableau sur cinq ans ci-dessus.</p>
        )}
      </div>
      {onglet === 'bilan' && b && (
        <p className="mt-3 text-xs text-faint">Autres passifs = total actif − capitaux propres − dette financière.</p>
      )}
      {onglet === 'cr' && f && (
        <p className="mt-3 text-xs text-faint">
          Les ressources égalent les emplois : une perte figure parmi les ressources pour équilibrer les charges.
        </p>
      )}
    </div>
  );
}
