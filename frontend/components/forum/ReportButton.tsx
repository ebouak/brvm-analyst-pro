'use client';
import { useState } from 'react';
import { reportContent } from '@/lib/forum/actions';

export function ReportButton({ targetType, targetId }: { targetType: 'topic' | 'post'; targetId: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <span className="text-xs text-muted">Signalé ✓</span>;
  return (
    <button
      type="button" disabled={busy}
      onClick={async () => {
        setBusy(true);
        const reason = window.prompt('Raison du signalement (optionnel) :') ?? '';
        const r = await reportContent({ targetType, targetId, reason });
        setBusy(false);
        if (!('error' in r)) setDone(true);
      }}
      className="text-xs text-muted hover:text-down transition focus:outline-none focus:ring-2 focus:ring-down/40 rounded"
    >
      Signaler
    </button>
  );
}
