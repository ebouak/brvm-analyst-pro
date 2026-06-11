'use client';

import { useBeginnerMode } from '@/lib/beginner-mode';

export default function BeginnerToggle() {
  const { beginner, toggle } = useBeginnerMode();
  return (
    <button
      type="button"
      onClick={toggle}
      title={beginner ? 'Passer en mode expert' : 'Passer en mode débutant'}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
        beginner
          ? 'border-cyan/40 text-cyan bg-cyan/10'
          : 'border-border text-faint hover:border-cyan/30 hover:text-muted'
      }`}
    >
      {beginner ? '🎓 Débutant' : '◈ Expert'}
    </button>
  );
}
