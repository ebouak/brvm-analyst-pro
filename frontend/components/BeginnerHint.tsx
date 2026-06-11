'use client';

import { useBeginnerMode } from '@/lib/beginner-mode';

export function BeginnerHint({ text }: { text: string }) {
  const { beginner } = useBeginnerMode();
  if (!beginner) return null;
  return (
    <p className="text-[10px] text-cyan/70 italic mt-0.5 leading-snug">{text}</p>
  );
}
