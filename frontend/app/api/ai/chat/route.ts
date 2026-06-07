import { NextRequest } from 'next/server';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { SYSTEM_PROMPT_ANALYSTE } from '@/lib/ai/prompts';

export const maxDuration = 60;

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions',      model: 'deepseek-chat' },
  { provider: 'mistral',  url: 'https://api.mistral.ai/v1/chat/completions',     model: 'mistral-large-latest' },
  { provider: 'xai',      url: 'https://api.x.ai/v1/chat/completions',           model: 'grok-2-latest' },
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.messages?.length) {
    return Response.json({ error: 'messages requis' }, { status: 400 });
  }

  // Choisir le premier provider disponible
  let chosen: { url: string; model: string; key: string } | null = null;
  for (const c of ORDER) {
    const key = await resolveApiKey(c.provider);
    if (key) { chosen = { url: c.url, model: c.model, key }; break; }
  }

  if (!chosen) {
    return Response.json(
      { error: 'Aucune clé IA configurée. Ajoutez DeepSeek, Mistral ou Grok dans /admin/cles-api.' },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const { url, model, key } = chosen;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: 0.15,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_ANALYSTE },
              ...body.messages,
            ],
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`));
          controller.close();
          return;
        }

        const reader = resp.body!.getReader();
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
              const evt = JSON.parse(raw);
              const text = evt?.choices?.[0]?.delta?.content;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch { /* skip malformed */ }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
