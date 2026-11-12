'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Vague, VagueElement } from './mouvement/Vague';
import type { CaseValeur } from '@/lib/vitrine/seance';

/**
 * Mosaïque « 48 valeurs. Une séance. » (spec §3.5). Une case par action cotée, de la
 * plus forte hausse à la plus forte baisse, entrée en vague. Survol, focus ou toucher :
 * la case grossit et la ligne de lecture (annoncée) donne code, cours et variation.
 */
export function Mosaique({ cases }: { cases: CaseValeur[] }) {
  const [lue, setLue] = useState<CaseValeur | null>(null);
  return (
    <>
      <p className="v-mosaique-lecture v-mono" aria-live="polite">
        {lue ? lue.lecture : 'Survolez une case pour lire le cours.'}
      </p>
      <Vague className="v-mosaique" as="ul">
        {cases.map((c) => (
          <VagueElement key={c.code} as="li">
            <Link
              href={`/societes/${c.code}`}
              className={`v-case v-case--${c.ton}`}
              aria-label={c.lecture}
              onMouseEnter={() => setLue(c)}
              onFocus={() => setLue(c)}
              onTouchStart={() => setLue(c)}
            >
              <span className="v-case-code">{c.code}</span>
              <span className="v-case-pct v-mono">{c.pct}</span>
            </Link>
          </VagueElement>
        ))}
      </Vague>
    </>
  );
}
