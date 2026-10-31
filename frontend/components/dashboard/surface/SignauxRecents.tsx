import Link from 'next/link';
import type { SignalDaily } from '@/lib/types';
import { notesProches, SEUIL_SIGNAL, type NoteSeance } from '@/lib/dashboard/signauxProches';
import { TeteBloc } from './Grille';

const note = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

const LIB: Record<string, string> = { BUY: 'Achat', SELL: 'Vente', HOLD: 'Attente' };

/** Signaux récents (premium) au style de la surface ; un libellé et un lien vers l'explication, pas d'incitation. */
export default function SignauxRecents({ signaux, notes = [] }: { signaux: SignalDaily[]; notes?: NoteSeance[] }) {
  const actionnables = signaux.filter((s) => s.signal !== 'HOLD').slice(0, 4);
  // Quand le moteur s'abstient : les notes extrêmes de la séance, nommées pour
  // ce qu'elles sont (des notes), jamais « achat » ni « vente ».
  const proches = actionnables.length === 0 ? notesProches(notes) : null;
  return (
    <section aria-labelledby="t-signaux" className="py-5 lg:px-5">
      <TeteBloc id="t-signaux" titre="Signaux d'opportunité" droite={<Link href="/signaux" className="text-xs text-accent-ink hover:underline">Tous les signaux</Link>} />
      {actionnables.length === 0 ? (
        <>
          <p className="text-sm text-muted">Aucun signal d&apos;achat ni de vente sur cette séance : le moteur s&apos;abstient.</p>
          {proches && (proches.hautes.length > 0 || proches.basses.length > 0) && (
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              {([['Notes les plus hautes', proches.hautes], ['Notes les plus basses', proches.basses]] as const).map(([titre, liste]) => (
                <div key={titre}>
                  <p className="overline mb-1 text-faint">{titre}</p>
                  {liste.length === 0 ? <p className="text-xs text-faint">—</p> : (
                    <ul>
                      {liste.map((x) => (
                        <li key={x.code} className="flex items-baseline gap-2 py-0.5">
                          <Link href={`/actions/${x.code}`} className="tabular font-semibold text-ivory hover:text-accent-ink">{x.code}</Link>
                          <span className="tabular ml-auto text-xs text-muted">{note(x.score)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <p className="col-span-2 text-xs text-faint">
                Un signal naît au-delà de {note(SEUIL_SIGNAL)} ou en deçà de {note(-SEUIL_SIGNAL)}. Être proche de ce seuil n&apos;est pas un signal.
              </p>
            </div>
          )}
        </>
      ) : (
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
