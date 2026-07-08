'use client';

import { useState } from 'react';
import type { AwardType } from '@/lib/forum/types';

export interface AwardMenuProps {
  postId: string;
  onAward: (type: AwardType) => Promise<void>;
  disabled?: boolean;
}

const AWARDS: { emoji: AwardType; label: string }[] = [
  { emoji: '💡', label: 'Perspicace' },
  { emoji: '🔥', label: 'Tendance' },
  { emoji: '⭐', label: 'Étoile' },
];

/**
 * Award menu: 3 buttons (Insightful, Hot, Star) with hover/loading states
 */
export function AwardMenu({ postId, onAward, disabled }: AwardMenuProps) {
  const [loading, setLoading] = useState<AwardType | null>(null);

  async function handleAward(type: AwardType) {
    if (disabled || loading) return;
    setLoading(type);
    try {
      await onAward(type);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {AWARDS.map(({ emoji, label }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleAward(emoji)}
          disabled={disabled || loading !== null}
          title={label}
          className="px-2 py-1 rounded-full text-lg transition hover:bg-accent/15 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Attribuer: ${label}`}
        >
          <span className={loading === emoji ? 'animate-bounce' : ''}>{emoji}</span>
        </button>
      ))}
    </div>
  );
}
