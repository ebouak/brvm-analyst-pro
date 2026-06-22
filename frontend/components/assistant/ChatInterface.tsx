'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PROMPTS_TEMPLATES } from '@/lib/ai/prompts';
import { ExportButton } from './ExportButton';
import { MarkdownMessage } from './MarkdownMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const NO_ARG_IDS = new Set(['screener', 'rapport-hebdo', 'anomalies', 'backtesting-div']);

/** Ouvre un écran HTML propre et imprimable à partir du message déjà rendu. */
function printAnalyse(index: number, symbole?: string) {
  const src = document.getElementById(`assistant-msg-${index}`);
  if (!src) return;
  const node = src.cloneNode(true) as HTMLElement;
  node.querySelectorAll('button').forEach((b) => b.remove()); // retire boutons Export/Imprimer
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Analyse ${symbole ?? ''} — WESTBOURSE</title>
    <style>
      body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;max-width:760px;margin:24px auto;padding:0 20px;line-height:1.55}
      header{border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:16px}
      .kick{font-size:11px;letter-spacing:.5px;color:#777;text-transform:uppercase}
      h1{font-size:20px;margin:2px 0}
      table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13px}
      th,td{border:1px solid #ddd;padding:6px 9px;text-align:left}
      thead th{background:#f3f3f3}
      h2{font-size:15px;border-bottom:1px solid #ddd;padding-bottom:3px;margin-top:18px}
      .foot{margin-top:24px;border-top:1px solid #eee;padding-top:8px;font-size:11px;color:#888;font-style:italic}
      @media print{body{margin:0}}
    </style></head><body>
    <header><div class="kick">WESTBOURSE · Assistant IA${symbole ? ' · ' + symbole : ''}</div>
    <h1>Analyse${symbole ? ' — ' + symbole : ''}</h1><div class="kick">${date}</div></header>
    ${node.innerHTML}
    <div class="foot">Document généré par l'assistant WESTBOURSE — dérivé de données réelles. Ne constitue pas un conseil en investissement. Les performances passées ne préjugent pas des performances futures.</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export function ChatInterface({ symbolePreselect, questionPreset }: { symbolePreselect?: string; questionPreset?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(
    questionPreset
      ? (symbolePreselect ? `${questionPreset} (${symbolePreselect})` : questionPreset)
      : (symbolePreselect ? `Analyse complète de ${symbolePreselect}` : ''),
  );
  const [loading, setLoading] = useState(false);
  const [symbole, setSymbole] = useState(symbolePreselect ?? '');
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setActiveProvider(d.active);
          setNoKey(!d.active);
        }
      })
      .catch(() => {});
  }, []);

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

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

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
              if (parsed.error) throw new Error(parsed.error);
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
            } catch (streamErr: unknown) {
              if ((streamErr as Error).message) throw streamErr;
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          const msg = (err as Error).message || 'Erreur inconnue';
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `❌ ${msg}`,
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
      {/* Header — double-bezel inner strip */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-elevated/50">
        {/* Avatar double-bezel */}
        <div className="rounded-xl border border-gold/20 bg-gold/[0.06] p-0.5 shrink-0">
          <div className="w-8 h-8 rounded-[calc(0.75rem-2px)] bg-elevated flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <span className="text-gold text-xs font-bold font-display">IA</span>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ivory">Analyste BRVM IA</h2>
          <p className="text-[11px] text-faint">Analyse technique · Fondamentale · Macro UEMOA</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeProvider && (
            <span className="inline-flex items-center rounded-full border border-up/30 bg-up/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-up">
              {activeProvider}
            </span>
          )}
          {noKey && (
            <span className="inline-flex items-center rounded-full border border-down/30 bg-down/10 px-2.5 py-0.5 text-[10px] text-down">
              Aucune clé — <a href="/admin/cles-api" className="underline ml-1">configurer</a>
            </span>
          )}
          {symbole && (
            <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-gold">
              {symbole}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-bg/60">
        {messages.length === 0 && (
          <div className="py-8">
            <p className="text-center text-faint text-[10px] mb-6 uppercase tracking-widest">Posez une question ou choisissez un template</p>
            {/* Symbol shortcuts */}
            <div className="flex gap-2 mb-6 flex-wrap justify-center">
              {['PALC', 'SNTS', 'BOAC', 'ORAC', 'SGBC', 'CIEC'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSymbole(s); sendMessage(`Analyse complète de ${s} sur la BRVM.`); }}
                  className="px-3 py-1.5 text-xs font-mono rounded-full border border-border text-muted hover:text-gold hover:border-gold/40 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Questions portefeuille (contexte utilisateur injecté) */}
            <div className="flex gap-2 mb-6 flex-wrap justify-center">
              {[
                'Quelle est la plus-value de mon portefeuille ?',
                'Quelles positions renforcer ou alléger ?',
                'Mon portefeuille est-il bien diversifié ?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 text-xs rounded-full border border-gold/30 bg-gold/[0.05] text-gold/90 hover:bg-gold/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            {/* Templates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto">
              {PROMPTS_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplate(t)}
                  className="text-left p-4 rounded-card border border-border bg-elevated/60 hover:border-gold/30 hover:bg-elevated transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] shadow-card"
                >
                  <span className="font-semibold text-sm block text-ivory mb-0.5">{t.titre}</span>
                  <span className="text-xs text-muted">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              id={`assistant-msg-${i}`}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gold text-obsidian rounded-br-sm shadow-gold'
                  : 'bg-elevated border border-border/60 text-ivory rounded-bl-sm shadow-card'
              }`}
            >
              {msg.loading && !msg.content ? (
                <span className="inline-flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                <>
                  {msg.role === 'assistant'
                    ? <MarkdownMessage content={msg.content} />
                    : <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>}
                  {msg.role === 'assistant' && msg.content.length > 200 && (
                    <div className="mt-2 flex gap-2">
                      <ExportButton texteAnalyse={msg.content} symbole={symbole || symbolePreselect} />
                      <button
                        type="button"
                        onClick={() => printAnalyse(i, symbole || symbolePreselect)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted hover:text-white hover:border-gold/40"
                      >
                        🖨️ Imprimer
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 py-4 border-t border-border/60 bg-elevated/50">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={symbole ? `Question sur ${symbole}…` : 'Analysez PALC, screener opportunités, rapport hebdo…'}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-bg text-ivory text-sm placeholder:text-faint focus:outline-none focus:border-gold/40 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-50"
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2.5 bg-down/15 text-down border border-down/30 rounded-xl text-sm font-medium hover:bg-down/25 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="group px-4 py-2.5 bg-gold text-obsidian rounded-xl text-sm font-semibold shadow-gold disabled:opacity-40 hover:bg-gold-soft transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Envoyer
            </button>
          )}
        </form>
        <p className="text-[10px] text-faint mt-2 px-1">
          Outil d&apos;aide à l&apos;analyse. Ne constitue pas un conseil en investissement.
        </p>
      </div>
    </div>
  );
}
