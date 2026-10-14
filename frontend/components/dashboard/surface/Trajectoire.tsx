'use client';

import { useState } from 'react';
import { useJetons } from '@/lib/theme/jetons';
import { fmtNumber, fmtPctSigne, fmtDateFR } from '@/lib/format';
import { echelle, indexMinInterieur } from '@/lib/dashboard/graphe';
import { TeteBloc } from './Grille';

type Code = 'BRVMC' | 'BRVM30';
const LIB: Record<Code, string> = { BRVMC: 'BRVM Composite', BRVM30: 'BRVM 30' };
const JETONS = ['accent', 'up', 'down', 'border', 'faint', 'muted', 'bg'] as const;
const W = 760, H = 230, G = { l: 46, r: 14, t: 12, b: 26 };
const court = (iso: string) => fmtDateFR(iso).slice(0, 5);

/** Spec §12 — trajectoire sur 30 séances, une seule échelle, point bas annoté. */
export default function Trajectoire({ series, jour }: { series: Record<Code, { date: string; valeur: number }[]>; jour: Record<Code, number | null> }) {
  const [code, setCode] = useState<Code>('BRVMC');
  const c = useJetons(JETONS);
  const s = series[code];
  const e = echelle(s.map((p) => p.valeur));
  const bascule = (
    <div role="group" aria-label="Indice affiché" className="inline-flex overflow-hidden rounded-md border border-border">
      {(['BRVMC', 'BRVM30'] as Code[]).map((k) => (
        <button key={k} type="button" aria-pressed={k === code} onClick={() => setCode(k)}
          className={`px-3 py-1.5 text-xs ${k === code ? 'bg-surface text-ivory' : 'text-muted hover:text-ivory'}`}>{LIB[k]}</button>
      ))}
    </div>
  );
  if (!e || s.length < 2) {
    return <section aria-labelledby="t-traj" className="py-5 lg:px-5"><TeteBloc id="t-traj" titre="Trajectoire des indices" droite={bascule} /><p className="text-sm text-muted">Historique insuffisant pour tracer la trajectoire.</p></section>;
  }
  const x = (i: number) => G.l + (i / (s.length - 1)) * (W - G.l - G.r);
  const y = (v: number) => G.t + (1 - (v - e.bas) / (e.haut - e.bas)) * (H - G.t - G.b);
  const pts = s.map((p, i) => `${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`);
  const debut = s[0]!.valeur, fin = s[s.length - 1]!.valeur, v30 = (fin / debut - 1) * 100;
  const iMin = indexMinInterieur(s.map((p) => p.valeur));
  const finCouleur = fin >= debut ? c.up : c.down;
  return (
    <section aria-labelledby="t-traj" className="py-5 lg:px-5">
      <TeteBloc id="t-traj" titre="Trajectoire des indices" droite={bascule} />
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="tabular text-[26px] leading-none text-ivory">{fmtNumber(fin, 2)}</span>
        <span className={`tabular text-sm ${v30 >= 0 ? 'text-up' : 'text-down'}`}>{fmtPctSigne(v30)}</span>
        <span className="tabular text-sm text-muted">sur {s.length} séances{jour[code] != null ? ` · jour ${fmtPctSigne(jour[code]!)}` : ''}</span>
        <span className="overline text-faint">du {court(s[0]!.date)} au {court(s[s.length - 1]!.date)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${LIB[code]} : ${fmtNumber(debut, 2)} le ${fmtDateFR(s[0]!.date)}, ${fmtNumber(fin, 2)} le ${fmtDateFR(s[s.length - 1]!.date)}`}>
        <defs>
          <linearGradient id="aire-traj" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
            <stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        {e.graduations.map((v) => (
          <g key={v}>
            <line x1={G.l} x2={W - G.r} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            <text x={G.l - 8} y={y(v) + 3.5} textAnchor="end" fill={c.faint} fontSize={10.5}>{fmtNumber(v, 0)}</text>
          </g>
        ))}
        {[0, Math.floor((s.length - 1) / 2), s.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === s.length - 1 ? 'end' : 'middle'} fill={c.faint} fontSize={10.5}>{court(s[i]!.date)}</text>
        ))}
        <path d={`M${pts[0]} L${pts.join(' L')} L${x(s.length - 1)},${H - G.b} L${G.l},${H - G.b} Z`} fill="url(#aire-traj)" />
        <polyline points={pts.join(' ')} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(s.length - 1)} cy={y(fin)} r={4} fill={finCouleur} stroke={c.bg} strokeWidth={2} />
        {iMin != null && (
          <g>
            <circle cx={x(iMin)} cy={y(s[iMin]!.valeur)} r={3} fill={c.down} />
            <text x={x(iMin) + (x(iMin) > W / 2 ? -8 : 8)} y={y(s[iMin]!.valeur) + 4} textAnchor={x(iMin) > W / 2 ? 'end' : 'start'} fill={c.muted} fontSize={10.5}>
              plus bas {fmtNumber(s[iMin]!.valeur, 2)} le {court(s[iMin]!.date)}
            </text>
          </g>
        )}
      </svg>
    </section>
  );
}
