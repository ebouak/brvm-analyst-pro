'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { envoyerArticleParEmail } from '@/app/admin/articles/actions';

/**
 * Envoie un article publié aux abonnés confirmés de la newsletter. Une seule
 * fois par article : une fois parti, le bouton laisse place à la trace d'envoi
 * (le verrou réel est côté serveur, ce masquage n'est qu'un confort).
 */
export default function EnvoyerArticleEmail({
  id,
  titre,
  abonnes,
  trace,
  relancable,
}: {
  id: string;
  titre: string;
  abonnes: number;
  trace: string | null;
  relancable: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  if (!relancable) return <span className="text-xs text-muted">{trace}</span>;

  return (
    <div className="space-y-1">
      {trace && <p className="text-xs text-down">{trace}</p>}
      <button
        type="button"
        disabled={pending || abonnes === 0}
        onClick={() => {
          if (!window.confirm(`Envoyer « ${titre} » à ${abonnes} abonné(s) confirmé(s) ? L'envoi est définitif.`)) return;
          start(async () => {
            const r = await envoyerArticleParEmail(id);
            setMsg(r.message);
            router.refresh();
          });
        }}
        className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10 disabled:opacity-40"
      >
        {pending ? 'Envoi…' : abonnes === 0 ? 'Aucun abonné confirmé' : `Envoyer par email (${abonnes})`}
      </button>
      {msg && (
        <p role="status" className="text-xs text-muted">
          {msg}
        </p>
      )}
    </div>
  );
}
