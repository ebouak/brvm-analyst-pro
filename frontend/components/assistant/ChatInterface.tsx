'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PROMPTS_TEMPLATES } from '@/lib/ai/prompts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const NO_ARG_IDS = new Set(['screener', 'rapport-hebdo', 'anomalies', 'backtesting-div']);

export function ChatInterface({ symbolePreselect }: { symbolePreselect?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(symbolePreselect ? `Analyse complète de ${symbolePreselect}` : '');
  const [loading, setLoading] = useState(false);
  const [symbole, setSymbole] = useState(symbolePreselect ?? '');
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [
        ...prev,
        { role: 'user', content },
        { role: 'assistant', content: '', loading: true },
      ]);
      setInput('');
      setLoading(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...history, { role: 'user', content }] }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error('Erreur serveur');

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = { ...updated[updated.length - 1] };
                  last.content += parsed.text;
                  last.loading = false;
                  updated[updated.length - 1] = last;
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: '❌ Erreur de connexion. Vérifiez votre clé API Anthropic dans /admin/cles-api.',
              loading: false,
            };
            return updated;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, loading],
  );

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], loading: false };
      return updated;
    });
  };

  const handleTemplate = (t: typeof PROMPTS_TEMPLATES[number]) => {
    const prompt = NO_ARG_IDS.has(t.id)
      ? (t.prompt as () => string)()
      : (t.prompt as (s: string) => string)(symbole || 'PALC');
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface rounded-t-xl">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
          <span className="text-accent text-sm font-bold">IA</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Analyste BRVM IA</h2>
          <p className="text-[11px] text-faint">Analyse technique · Fondamentale · Macro UEMOA</p>
        </div>
        {symbole && (
          <span className="ml-auto px-2.5 py-1 bg-accent/10 text-accent rounded-chip text-xs font-mono font-semibold">
            {symbole}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-bg">
        {messages.length === 0 && (
          <div className="py-6">
            <p className="text-center text-faint text-xs mb-5 uppercase tracking-widest">Posez une question ou choisissez un template</p>
            {/* Raccourcis symboles */}
            <div className="flex gap-2 mb-5 flex-wrap justify-center">
              {['PALC', 'SNTS', 'BOAC', 'ORAC', 'SGBC', 'CIEC'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSymbole(s); sendMessage(`Analyse complète de ${s} sur la BRVM.`); }}
                  className="px-3 py-1.5 text-xs font-mono rounded-chip border border-border text-muted hover:text-accent hover:border-accent/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Templates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
              {PROMPTS_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplate(t)}
                  className="text-left p-3 rounded-card border border-border bg-surface hover:border-accent/30 hover:bg-elevated transition-all active:scale-[0.98]"
                >
                  <span className="font-medium text-sm block text-white">{t.titre}</span>
                  <span className="text-xs text-muted">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-surface border border-border text-white rounded-bl-sm'
              }`}
            >
              {msg.loading && !msg.content ? (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-surface rounded-b-xl">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={symbole ? `Question sur ${symbole}…` : 'Analysez PALC, screener opportunités, rapport hebdo…'}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-bg text-white text-sm placeholder:text-faint focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          />
          {loading ? (
            <button type="button" onClick={stop} className="px-4 py-2.5 bg-down/20 text-down border border-down/30 rounded-xl text-sm font-medium hover:bg-down/30 transition-colors">
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-accent-dim transition-colors active:scale-95"
            >
              Envoyer
            </button>
          )}
        </form>
        <p className="text-[10px] text-faint mt-1.5 px-1">
          ⚠️ Outil d'aide à l'analyse. Pas un conseil en investissement.
        </p>
      </div>
    </div>
  );
}
