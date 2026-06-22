import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface NewsRow {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_url: string | null;
}

export default async function NewsFeed() {
  const supabase = createClient();
  const { data } = await supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source, source_url')
    .lte('date_publication', new Date().toISOString().slice(0, 10)) // jamais d'actu datée dans le futur
    .order('date_publication', { ascending: false })
    .limit(5);

  const news = (data ?? []) as NewsRow[];

  if (news.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted uppercase tracking-wide">Actualités</span>
        <Link href="/actualites" className="text-[10px] text-cyan hover:underline">Tout voir →</Link>
      </div>
      <div className="space-y-2">
        {news.map((n) => (
          <div key={n.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] text-cyan uppercase font-bold">{n.source}</span>
              <span className="text-[9px] text-faint">{n.date_publication}</span>
            </div>
            {n.source_url ? (
              <a href={n.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-ivory hover:text-cyan transition line-clamp-2 leading-tight">
                {n.titre}
              </a>
            ) : (
              <p className="text-xs text-ivory line-clamp-2 leading-tight">{n.titre}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
