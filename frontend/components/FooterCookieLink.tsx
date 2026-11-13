'use client';

import { useConsent } from '@/components/consent/ConsentProvider';

export function FooterCookieLink() {
  const { open } = useConsent();
  return (
    <button type="button" onClick={open} className="min-h-[44px] text-left text-[#fff]/75 md:min-h-0 transition-colors hover:text-[#fff]">
      Gérer mes cookies
    </button>
  );
}
