import { createPublicClient } from '@/lib/supabase/public';

interface NewsRow {
  id: string;
  titre: string;
  date_publication: string;
  source: string;
  source_url: string | null;
}

interface Props {
  className?: string;
}

export default async function NewsTicker({ className = '' }: Props) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source, source_url')
    .order('date_publication', { ascending: false })
    .limit(20);

  const items = (data ?? []) as NewsRow[];
  if (items.length === 0) return null;

  // Duplicated for seamless loop
  const all = [...items, ...items];

  return (
    <div
      className={`flex items-center overflow-hidden bg-surface/80 border-y border-border/50 backdrop-blur-sm ${className}`}
      style={{ height: '36px' }}
    >
      {/* Label fixe */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-border/60 h-full bg-gold/10">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold whitespace-nowrap">
          Actualités
        </span>
      </div>

      {/* Défilement CSS */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex whitespace-nowrap animate-ticker" style={{ animationDuration: `${Math.max(15, items.length * 2)}s` }}>
          {all.map((item, i) => (
            <span key={`${item.id}-${i}`} className="inline-flex items-center gap-3 px-5">
              {item.source_url ? (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted hover:text-ivory transition-colors"
                >
                  {item.titre}
                </a>
              ) : (
                <span className="text-xs text-muted">{item.titre}</span>
              )}
              <span className="text-faint/50 text-xs">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
