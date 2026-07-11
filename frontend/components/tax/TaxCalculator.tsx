'use client';

import { useState } from 'react';
import { BAREME, PAYS_LABELS, type PaysUemoa, type TypeRevenu } from '@/lib/tax/rates';
import { dividendeNet, couponNet } from '@/lib/tax/compute';

const TYPES: { key: TypeRevenu; label: string }[] = [
  { key: 'dividende_cote', label: 'Dividende (société cotée)' },
  { key: 'obligation_etat', label: "Coupon — obligation d'État" },
  { key: 'obligation_privee', label: 'Coupon — obligation privée' },
];

const fcfa = (v: number) => v.toLocaleString('fr-FR') + ' FCFA';
const fmtPct = (t: number) => `${(t * 100) % 1 ? (t * 100).toFixed(1) : (t * 100).toFixed(0)} %`;

/** Calculateur net d'impôt (IRVM/IRC) — stateless, aucune donnée stockée. */
export default function TaxCalculator() {
  const [brut, setBrut] = useState('100000');
  const [pays, setPays] = useState<PaysUemoa>('CI');
  const [type, setType] = useState<TypeRevenu>('dividende_cote');

  const montant = Number(brut.replace(/[^\d]/g, '')) || 0;
  const res =
    type === 'dividende_cote' ? dividendeNet(montant, pays) : couponNet(montant, pays, type);
  const regle = BAREME[pays][type];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted">Montant brut (FCFA)</span>
          <input
            inputMode="numeric"
            value={brut}
            onChange={(e) => setBrut(e.target.value)}
            aria-label="Montant brut en FCFA"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 tabular text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Pays de l&apos;émetteur</span>
          <select
            value={pays}
            onChange={(e) => setPays(e.target.value as PaysUemoa)}
            aria-label="Pays de l'émetteur"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {(Object.keys(PAYS_LABELS) as PaysUemoa[]).map((p) => (
              <option key={p} value={p}>{PAYS_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Type de revenu</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeRevenu)}
            aria-label="Type de revenu"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {res.indisponible ? (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Taux non confirmé pour ce pays et ce type de revenu — consultez votre SGI.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 text-center">
          <div className="rounded-lg border border-border bg-bg/40 p-3">
            <p className="text-xs text-muted">Retenue ({fmtPct(res.taux)})</p>
            <p className="tabular mt-1 text-lg text-down">−{fcfa(res.impot)}</p>
          </div>
          <div className="rounded-lg border border-up/30 bg-up/5 p-3 sm:col-span-2">
            <p className="text-xs text-muted">Net perçu</p>
            <p className="tabular mt-1 text-2xl font-semibold text-up">{fcfa(res.net)}</p>
          </div>
        </div>
      )}
      <p className="text-[11px] text-faint">
        Base : {regle.source}
        {regle.note ? ` — ${regle.note}` : ''} (vérifié le {regle.verifieLe}).
      </p>
    </div>
  );
}
