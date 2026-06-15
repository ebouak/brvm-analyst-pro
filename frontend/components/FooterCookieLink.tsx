'use client';

import { useConsent } from '@/components/consent/ConsentProvider';

export function FooterCookieLink() {
  const { open } = useConsent();
  return (
    <button type="button" onClick={open} className="text-left text-white/55 transition-colors hover:text-white">
      Gérer mes cookies
    </button>
  );
}
