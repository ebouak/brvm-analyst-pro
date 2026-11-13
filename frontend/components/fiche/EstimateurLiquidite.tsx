'use client';

import { useState } from 'react';
import { estimerSeances, PART_DE_MARCHE } from '@/lib/liquidite/estimateur';
import { fmtNumber, fmtFcfa } from '@/lib/format';

/**
 * « Pour X FCFA, combien de séances ? » Ordre de grandeur sous une hypothèse
 * écrite (20 % de la valeur échangée moyenne par séance), pas une promesse
 * d'exécution.
 */
const MONTANTS = [500_000, 2_000_000, 10_000_000, 50_000_000];

export default function EstimateurLiquidite({ code, valeurMoyenne, classe }: { code: string; valeurMoyenne: number | null; classe: string | null }) {
  const [montant, setMontant] = useState(2_000_000);
  const e = estimerSeances(montant, valeurMoyenne);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg text-ivory">Combien de séances pour investir ?</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Montant à investir">
        {MONTANTS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMontant(m)}
            aria-pressed={montant === m}
            className={`tabular rounded-lg border px-3 py-1 text-sm ${montant === m ? 'border-accent bg-accent text-bg' : 'border-border text-muted hover:text-ivory'}`}
          >
            {fmtFcfa(m)} FCFA
          </button>
        ))}
      </div>
      {e ? (
        <p className="mt-4 text-sm text-ivory">
          Pour <span className="tabular">{fmtFcfa(montant)} FCFA</span> sur {code} : environ{' '}
          <span className="tabular font-medium">{e.seances} séance{e.seances > 1 ? 's' : ''}</span> de marché
          {classe && <> (liquidité classe {classe})</>}.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">Pas assez d&apos;échanges récents pour estimer un délai.</p>
      )}
      <p className="mt-2 text-xs text-faint">
        Hypothèse : ne pas dépasser {fmtNumber(PART_DE_MARCHE * 100, 0)} % de la valeur échangée moyenne par séance
        {valeurMoyenne != null && <> (<span className="tabular">{fmtFcfa(valeurMoyenne)} FCFA</span> sur les 30 dernières séances, jours sans échange compris)</>},
        au-delà de quoi un ordre pèse sur le cours. Ordre de grandeur, pas une garantie d&apos;exécution.
      </p>
    </section>
  );
}
