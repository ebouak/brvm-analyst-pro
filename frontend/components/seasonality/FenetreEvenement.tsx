'use client';
/**
 * F6 — Fenêtres d'événement : écart cumulé au marché (rendement total), de 20
 * séances avant à 40 séances après l'événement. Parcours de la valeur s'il
 * repose sur 4 événements au moins, sinon celui de l'ensemble du marché, dit
 * comme tel. Ne calcule rien : trace `FenetresValeur`.
 */
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FenetresValeur, PointFenetreLu } from '@/lib/seasonality/server';

type TypeF = 'detachement' | 'comptes_annuels' | 'comptes_semestriels' | 'convocation_ag';
const ONGLETS: { type: TypeF; libelle: string; pluriel: string }[] = [
  { type: 'detachement', libelle: 'Détachement', pluriel: 'détachements' },
  { type: 'comptes_annuels', libelle: 'Comptes annuels', pluriel: 'publications de comptes annuels' },
  { type: 'comptes_semestriels', libelle: 'Comptes semestriels', pluriel: 'publications de comptes semestriels' },
  { type: 'convocation_ag', libelle: 'Convocation à l’AG', pluriel: 'avis de convocation' },
];
const N_VALEUR = 4;
const NBSP = ' ';
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}${NBSP}%`;

interface Palette { accent: string; mediane: string; grille: string; texte: string; fond: string; fort: string }
const SOMBRE: Palette = { accent: '#56d7fd', mediane: '#9aa7b0', grille: '#1f2a31', texte: '#9aa7b0', fond: '#0d1114', fort: '#e5e7eb' };
function usePalette(): Palette {
  const [p, setP] = useState(SOMBRE);
  useEffect(() => {
    const lire = () => {
      const st = getComputedStyle(document.documentElement);
      const v = (nom: string, a = 1) => {
        const t = st.getPropertyValue(nom).trim().split(/\s+/).map(Number);
        return t.length === 3 && t.every(Number.isFinite) ? `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${a})` : null;
      };
      setP({
        accent: v('--color-accent') ?? SOMBRE.accent,
        mediane: v('--color-faint') ?? SOMBRE.mediane,
        grille: v('--color-border') ?? SOMBRE.grille,
        texte: v('--color-faint') ?? SOMBRE.texte,
        fond: v('--color-surface', 0.95) ?? SOMBRE.fond,
        fort: v('--color-ivory') ?? SOMBRE.fort,
      });
    };
    lire();
    const o = new MutationObserver(lire);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => o.disconnect();
  }, []);
  return p;
}

const au = (pts: PointFenetreLu[], rang: number) => pts.find((x) => x.rang === rang) ?? null;

export default function FenetreEvenement({ code, f }: { code: string; f: FenetresValeur }) {
  const p = usePalette();
  const disponibles = ONGLETS.filter((o) => (f.marche[o.type]?.length ?? 0) > 0);
  const [type, setType] = useState<TypeF>(disponibles[0]?.type ?? 'detachement');
  if (disponibles.length === 0) return null;

  const onglet = ONGLETS.find((o) => o.type === type)!;
  const propre = f.valeur[type] ?? [];
  const nPropre = au(propre, 0)?.n ?? 0;
  const parValeur = nPropre >= N_VALEUR;
  const pts = parValeur ? propre : f.marche[type] ?? [];
  const n = au(pts, 0)?.n ?? 0;
  const avant = au(pts, -1);
  const apres = au(pts, 40);
  const retour = (parValeur ? f.valeur.retour_coupon : f.marche.retour_coupon) ?? [];
  const data = pts.map((x) => ({ rang: x.rang, moyenne: x.moyenne != null ? x.moyenne * 100 : null, mediane: x.mediane != null ? x.mediane * 100 : null }));

  return (
    <section aria-labelledby="fenetre-h" className="space-y-3">
      <h3 id="fenetre-h" className="text-sm font-medium text-ivory">Autour des événements</h3>
      <div role="tablist" aria-label="Type d’événement" className="flex flex-wrap gap-2">
        {disponibles.map((o) => (
          <button key={o.type} type="button" role="tab" aria-selected={type === o.type} onClick={() => setType(o.type)}
            className={`text-xs px-2.5 py-1 rounded-md border ${type === o.type ? 'border-info text-accent-ink bg-info/10' : 'border-border text-muted'}`}>
            {o.libelle}
          </button>
        ))}
      </div>
      <p className="text-sm text-ivory">
        {parValeur
          ? <>Pour <span className="font-mono">{code}</span>, sur {n} {onglet.pluriel}</>
          : <>{nPropre > 0 ? <>Pour <span className="font-mono">{code}</span>, {nPropre} {onglet.pluriel} seulement : trop peu pour un parcours propre. Ensemble du marché</> : <>Ensemble du marché</>}, sur {n} {onglet.pluriel}</>}
        {avant?.moyenne != null && avant.mediane != null && avant.partPositifs != null && (
          <>
            , écart au marché sur les 20 séances qui précèdent : {pct(avant.moyenne)} en moyenne, {pct(avant.mediane)} en médiane,
            positif dans {Math.round(avant.partPositifs * 100)}&nbsp;% des cas
          </>
        )}
        {apres?.moyenne != null && apres.mediane != null && (
          <>. Jusqu’à 40 séances après : {pct(apres.moyenne)} en moyenne, {pct(apres.mediane)} en médiane</>
        )}
        .
      </p>
      <div className="h-56 w-full" role="img" aria-label={`Écart cumulé au marché autour d’un événement : ${onglet.libelle}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={p.grille} vertical={false} />
            <XAxis dataKey="rang" type="number" domain={[-20, 40]} ticks={[-20, -10, 0, 10, 20, 30, 40]}
              tick={{ fill: p.texte, fontSize: 12 }} tickLine={false} axisLine={{ stroke: p.grille }} />
            <YAxis tick={{ fill: p.texte, fontSize: 12 }} tickLine={false} axisLine={false} width={44}
              tickFormatter={(v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}${NBSP}%`} />
            <ReferenceLine x={0} stroke={p.mediane} strokeDasharray="2 3" />
            <ReferenceLine y={0} stroke={p.grille} />
            <Tooltip
              contentStyle={{ background: p.fond, border: `1px solid ${p.grille}`, borderRadius: 8, fontSize: 12, color: p.fort }}
              labelFormatter={(r) => (Number(r) === 0 ? 'jour de l’événement' : `${Number(r) > 0 ? '+' : '−'}${Math.abs(Number(r))} séance${Math.abs(Number(r)) > 1 ? 's' : ''}`)}
              formatter={(v: unknown, nom: string) => [pct(Number(v) / 100), nom === 'moyenne' ? 'moyenne' : 'médiane']}
            />
            <Line dataKey="moyenne" stroke={p.accent} dot={false} strokeWidth={2.25} isAnimationActive={false} />
            <Line dataKey="mediane" stroke={p.mediane} strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {type === 'detachement' && retour.length > 0 && (
        <p className="text-xs text-muted">
          Retour au cours de la veille du détachement :{' '}
          {retour.map((x, i) => (
            <span key={x.rang}>
              {i > 0 ? ' ; ' : ''}en {x.rang} séances, {Math.round((x.partPositifs ?? 0) * 100)}&nbsp;% des cas ({x.n})
            </span>
          ))}
          .
        </p>
      )}
      <p className="text-xs text-faint">
        Trait plein : moyenne ; pointillés : médiane. Écart cumulé entre le rendement de la valeur, dividende compris, et la
        moyenne équipondérée des valeurs cotées, depuis la clôture qui précède la fenêtre. Quand moyenne et médiane divergent,
        quelques cas extrêmes tirent la moyenne. Un parcours passé ne dit rien du prochain événement.
      </p>
    </section>
  );
}
