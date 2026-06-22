'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Rend une réponse de l'assistant en HTML propre (titres, tableaux GFM, listes,
 * gras) sur le thème sombre — au lieu d'un bloc de texte brut. Imprimable tel quel.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-ivory [&_p]:my-2 first:[&>*]:mt-0 last:[&>*]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-3 mb-2 font-display text-base font-semibold text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-2 font-display text-sm font-semibold uppercase tracking-wide text-gold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold text-white">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          a: ({ children, href }) => <a href={href} className="text-info underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          code: ({ children }) => <code className="rounded bg-bg/60 px-1 py-0.5 font-mono text-[12px] text-gold">{children}</code>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full border-collapse text-[13px] tabular">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface text-xs uppercase tracking-wide text-muted">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border/70 px-3 py-2 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/40 px-3 py-1.5 text-ivory">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-surface/40">{children}</tr>,
          blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-gold/40 pl-3 text-muted italic">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
