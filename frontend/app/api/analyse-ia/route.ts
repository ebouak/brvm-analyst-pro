import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/server/featureGate';
import { canAccess } from '@/lib/server/featureAccess';
import { redacteursDisponibles } from '@/lib/server/redacteur';
import { encoderEvenement } from '@/lib/analyseIA/flux';
import { repondreAnalyse } from '@/lib/analyseIA/orchestrer';
import type { CodeErreur, EvenementFlux, MessageConversation } from '@/lib/analyseIA/types';
import { depsAnalyse } from '@/lib/server/analyseIA/service';

/**
 * « Analyse par IA » de la fiche action. POST { code, messages, exercice? } →
 * flux SSE d'événements (lib/analyseIA/types.ts) : étapes, texte, puis `meta`
 * (provenance jev | ia, sources datées, relances).
 *
 * Mêmes plafonds de saisie et même garde (`assistant_ia`, accès + quota
 * journalier) que /api/ai/chat. Le texte des questions n'est jamais journalisé.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGES = 20;
const MAX_CHARS_MESSAGE = 4000;
const MAX_CHARS_TOTAL = 20000;

const refus = (code: CodeErreur, message: string, status: number) => Response.json({ code, error: message }, { status });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refus('connexion', 'Connectez-vous pour interroger l’analyse par IA.', 401);

  const body = (await req.json().catch(() => null)) as { code?: unknown; messages?: unknown; exercice?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{2,12}$/.test(code)) return refus('saisie', 'Valeur invalide.', 400);

  const brut = body?.messages;
  if (!Array.isArray(brut) || brut.length === 0) return refus('saisie', 'Question requise.', 400);
  if (brut.length > MAX_MESSAGES) return refus('saisie', `Trop de messages (maximum ${MAX_MESSAGES}).`, 400);
  const messages: MessageConversation[] = [];
  let total = 0;
  for (const m of brut as Array<{ role?: unknown; content?: unknown }>) {
    // Le rôle « system » n'est jamais accepté du client (injection de consignes).
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string') return refus('saisie', 'Message invalide.', 400);
    if (m.content.length > MAX_CHARS_MESSAGE) return refus('saisie', `Message trop long (maximum ${MAX_CHARS_MESSAGE} caractères).`, 400);
    total += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_CHARS_TOTAL) return refus('saisie', 'Conversation trop longue.', 400);
  const derniere = messages[messages.length - 1]!;
  if (derniere.role !== 'user' || !derniere.content.trim()) return refus('saisie', 'Le dernier message doit être une question.', 400);

  const { data: instrument } = await supabase.from('brvm_instruments').select('code, designation').eq('code', code).maybeSingle();
  if (!instrument) return refus('saisie', 'Valeur inconnue.', 404);

  if ((await redacteursDisponibles()).length === 0) return refus('indisponible', 'L’analyse par IA est momentanément indisponible.', 503);

  // Garde décomptée AVANT tout appel payant (Jev ou LLM), comme /api/ai/chat.
  const { data: profile } = await supabase.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  const gate = await checkFeature('assistant_ia', { id: user.id, email: user.email, isPremium: Boolean(profile?.is_premium) });
  if (!gate.allowed) return refus(gate.status === 429 ? 'quota' : 'acces', gate.reason, gate.status);

  // Mêmes droits que les sections de la fiche : l'assistant ne contourne aucun verrou.
  const [ind, sig, fonda] = await Promise.all([canAccess('indicateurs_techniques'), canAccess('signaux'), canAccess('fondamentaux')]);
  const droits = { indicateurs: ind.allowed, signaux: sig.allowed, fondamentaux: fonda.allowed };

  const ex = Number(body?.exercice);
  const valeur = {
    code,
    nom: (instrument.designation as string | null) ?? null,
    exerciceComptes: Number.isInteger(ex) && ex >= 1990 && ex <= 2100 ? ex : null,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emettre = (e: EvenementFlux) => controller.enqueue(encoder.encode(encoderEvenement(e)));
      try {
        await repondreAnalyse(
          { question: derniere.content, historique: messages.slice(0, -1), valeur },
          depsAnalyse(supabase, { code, nom: valeur.nom }, droits, emettre),
        );
      } catch (e) {
        console.error('[analyse-ia] non traité :', (e as Error).message);
        emettre({ type: 'erreur', code: 'interne', message: 'L’analyse n’a pas pu aboutir. Réessayez dans un instant.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
