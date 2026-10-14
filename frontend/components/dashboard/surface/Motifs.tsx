import Link from 'next/link';
import { PremiumLock } from '@/components/dashboard/PremiumLock';
import { fmtDateFR } from '@/lib/format';
import { TeteBloc } from './Grille';

export default function Motifs({ premium, compte, date }: { premium: boolean; compte: number | null; date: string }) {
  return (
    <section aria-labelledby="t-motifs" className="py-5 lg:px-5">
      <TeteBloc id="t-motifs" titre="Motifs en séance" droite={premium && compte != null ? <span className="overline text-faint">{compte} détecté{compte > 1 ? 's' : ''}</span> : undefined} />
      {!premium ? (
        <PremiumLock title="Motifs intraday réservés au premium" pitch="Momentum et volumes anormaux détectés en séance, mis à jour toutes les 15 min." rows={2} />
      ) : (
        <>
          <p className="text-sm text-muted">{compte == null ? 'Motifs momentanément indisponibles.' : compte === 0 ? `Aucun motif détecté le ${fmtDateFR(date)}.` : `${compte} motif${compte > 1 ? 's' : ''} détecté${compte > 1 ? 's' : ''} le ${fmtDateFR(date)}.`}</p>
          <dl className="mt-2 text-[13.5px]">
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-t border-border py-2"><dt className="text-[10.5px] font-semibold tracking-widest text-accent-ink">MOMENTUM</dt><dd className="text-ivory">Tendance marquée au fil de la séance.</dd></div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-t border-border py-2"><dt className="text-[10.5px] font-semibold tracking-widest text-accent-ink">VOLUME</dt><dd className="text-ivory">Pic d&apos;échanges inhabituel pour la valeur.</dd></div>
          </dl>
          <p className="mt-2 text-xs text-faint">Adaptés au marché de fixing de la BRVM. <Link href="/signaux" className="text-accent-ink hover:underline">Tous les motifs →</Link></p>
        </>
      )}
    </section>
  );
}
