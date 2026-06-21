'use client';

import { useState } from 'react';

/** Bouton d'upvote optimiste. canVote=false (non connecté) → lecture seule. */
export function VoteButton({
  postId, initialCount, initialVoted, canVote,
}: {
  postId: string; initialCount: number; initialVoted: boolean; canVote: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!canVote || busy) return;
    setBusy(true);
    // Optimiste
    const nextVoted = !voted;
    setVoted(nextVoted); setCount((c) => c + (nextVoted ? 1 : -1));
    try {
      const r = await fetch('/api/forum/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (r.ok) { const j = await r.json(); setVoted(j.voted); setCount(j.count); }
      else { setVoted(voted); setCount((c) => c + (nextVoted ? -1 : 1)); } // rollback
    } catch {
      setVoted(voted); setCount((c) => c + (nextVoted ? -1 : 1));
    } finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canVote || busy}
      title={canVote ? (voted ? 'Retirer mon vote' : "Vote utile") : 'Connectez-vous pour voter'}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
        voted ? 'border-up/40 bg-up/10 text-up' : 'border-border text-faint hover:text-white hover:border-info/40'
      } ${canVote ? '' : 'cursor-default opacity-70'}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 4l8 10h-5v6h-6v-6H4z" />
      </svg>
      <span className="tabular">{count}</span>
    </button>
  );
}
