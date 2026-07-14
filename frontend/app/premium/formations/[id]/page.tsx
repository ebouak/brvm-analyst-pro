import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormationFull } from '@/lib/formations/server';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formation' };

const TYPE_LABEL: Record<string, string> = { cours: 'Cours', conference: 'Conférence', webinaire: 'Webinaire' };

/** Convertit une URL YouTube/Vimeo en URL d'intégration, sinon null. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default async function FormationDetailPage({ params }: { params: { id: string } }) {
  // L'accès Premium est déjà garanti par le middleware (/premium/*).
  const f = await getFormationFull(params.id).catch(() => null);
  if (!f) notFound();

  const embed = f.replay_url ? embedUrl(f.replay_url) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link href="/formations" className="text-xs text-faint hover:text-white">← Toutes les formations</Link>
      <SectionHeader
        kicker={TYPE_LABEL[f.type] ?? 'Formation'}
        title={f.titre}
        subtitle={f.description ?? undefined}
      />

      {/* Replay */}
      {f.replay_url ? (
        embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border">
            <iframe src={embed} title={f.titre} className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        ) : (
          <a href={f.replay_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-bg">
            ▶ Regarder le replay
          </a>
        )
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Le replay sera disponible ici après la session.
        </div>
      )}

      {/* Support */}
      {f.support_url && (
        <a href={f.support_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-white hover:border-info/40">
          📄 Télécharger le support
        </a>
      )}

      <p className="text-[11px] text-faint border-t border-border pt-3">
        Contenu réservé aux membres Premium · WESTBOURSE. Reproduction interdite.
      </p>
    </div>
  );
}
