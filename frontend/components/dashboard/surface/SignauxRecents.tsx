import Link from 'next/link';
import type { SignalDaily } from '@/lib/types';
import { TeteBloc } from './Grille';

const LIB: Record<string, string> = { BUY: 'Achat', SELL: 'Vente', HOLD: 'Attente' };

/** Signaux récents (premium) au style de la surface ; un libellé et un lien vers l'explication, pas d'incitation. */
export default function SignauxRecents({ signaux }: { signaux: SignalDaily[] }) {
  const actionnables = signaux.filter((s) => s.signal !== 'HOLD').slice(0, 4);
  return (
    <section aria-labelledby="t-signaux" className="py-5 lg:px-5">
      <TeteBloc id="t-signaux" titre="Signaux d'opportunité" droite={<Link href="/signaux" className="text-xs text-accent-ink hover:underline">Tous les signaux</Link>} />
      {actionnables.length === 0 ? <p className="text-sm text-muted">Aucun signal d&apos;achat ni de vente sur cette séance : le moteur s&apos;abstient.</p> : (
        <ul>
          {actionnables.map((s, i) => (
            <li key={`${s.code}-${i}`} className="flex items-baseline gap-3 border-t border-border py-2 text-sm first:border-t-0">
              <Link href={`/actions/${s.code}`} className="tabular font-semibold text-ivory hover:text-accent-ink">{s.code}</Link>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${s.signal === 'BUY' ? 'border-up/40 text-up' : 'border-down/40 text-down'}`}>{LIB[s.signal] ?? s.signal}</span>
              <span className="tabular ml-auto text-xs text-muted">Conf : {s.confiance != null ? `${Math.round(s.confiance * 100)} %` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-faint">Signaux calculés et expliqués sur chaque fiche ; ce ne sont pas des conseils en investissement.</p>
    </section>
  );
}
