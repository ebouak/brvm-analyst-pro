// frontend/lib/whatsappAgent/callAgentLlm.ts
import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Cascade DeepSeek → Mistral, même pattern que callLlm dans
 * app/api/import-batch/route.ts — adapté à une conversation multi-tour
 * (liste de messages) plutôt qu'à une extraction JSON à un tour.
 */
export async function callAgentLlm(messages: ChatMessage[]): Promise<string | null> {
  const providers = [
    { key: await resolveApiKey('deepseek'), url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { key: await resolveApiKey('mistral'), url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  ].filter((p) => p.key);

  for (const p of providers) {
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          temperature: 0.3,
          messages,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = j.choices?.[0]?.message?.content;
      if (content) return content;
    } catch {
      /* provider suivant */
    }
  }
  return null;
}
