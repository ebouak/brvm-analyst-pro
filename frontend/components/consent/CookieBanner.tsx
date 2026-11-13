'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';
import { CookiePreferences } from './CookiePreferences';
import { defaultDenied, acceptAll } from '@/lib/consent/state';

// Style unique pour les deux choix : poids visuel strictement identique.
const CHOIX = 'flex min-h-[40px] flex-1 items-center justify-center whitespace-nowrap rounded-full border border-ivory/40 bg-ivory/5 px-3 py-2 text-[13px] font-semibold sm:text-sm text-ivory hover:bg-ivory/15 sm:flex-none sm:px-5';

export function CookieBanner() {
  const { needsChoice, open, save } = useConsent();

  return (
    <>
      <CookiePreferences />
      {needsChoice && (
        // Jetons du thème (suit clair/sombre). « Refuser » et « Tout accepter » :
        // même style, même taille (CNIL : refuser aussi simple qu'accepter).
        <div data-bandeau-cookies="" className="print:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur-md sm:py-4">
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-xs leading-snug text-ivory sm:text-sm">
              Nous utilisons des cookies strictement nécessaires au fonctionnement du site.
              Vous pouvez accepter la mesure d&apos;audience pour nous aider à l&apos;améliorer.{' '}
              <Link href="/confidentialite" className="-my-2 inline-block py-2 underline hover:text-ivory">En savoir plus</Link>.
            </p>
            <div className="flex w-full shrink-0 flex-wrap items-stretch gap-2 sm:w-auto">
              <button type="button" onClick={() => save(defaultDenied())} className={CHOIX}>Refuser</button>
              <button type="button" onClick={() => save(acceptAll())} className={CHOIX}>Tout accepter</button>
              <button type="button" onClick={open} className="px-2 py-2 text-sm text-ivory underline underline-offset-2 hover:text-ivory">Personnaliser</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
