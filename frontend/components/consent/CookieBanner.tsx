'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';
import { CookiePreferences } from './CookiePreferences';
import { defaultDenied, acceptAll } from '@/lib/consent/state';

export function CookieBanner() {
  const { needsChoice, open, save } = useConsent();

  return (
    <>
      <CookiePreferences />
      {needsChoice && (
        // Bandeau à fond FIXE sombre (tous thèmes) → blancs littéraux, pas de
        // tokens (`text-white` = ivoire réactif au thème, illisible en clair).
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(255,255,255,0.1)] bg-[#0a1417]/95 px-4 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#fff]/80">
              Nous utilisons des cookies strictement nécessaires au fonctionnement du site.
              Vous pouvez accepter la mesure d&apos;audience pour nous aider à l&apos;améliorer.{' '}
              <Link href="/confidentialite" className="underline hover:text-[#fff]">En savoir plus</Link>.
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => save(defaultDenied())} className="rounded-full border border-[rgba(255,255,255,0.15)] px-4 py-2 text-sm text-[#fff]/80 hover:text-[#fff]">Refuser</button>
              <button type="button" onClick={open} className="rounded-full border border-[rgba(255,255,255,0.15)] px-4 py-2 text-sm text-[#fff]/80 hover:text-[#fff]">Personnaliser</button>
              <button type="button" onClick={() => save(acceptAll())} className="rounded-full bg-[#56d7fd] px-5 py-2 text-sm font-semibold text-[#03222b] hover:bg-[#8fe6ff]">Tout accepter</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
