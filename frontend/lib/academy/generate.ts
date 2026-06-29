import 'server-only';
import { resolveApiKey, type LlmProvider } from '@/lib/server/apiKeys';
import { courseContentSchema, type CourseContent, type Niveau, NIVEAU_LABEL } from './types';

const ORDER: { provider: LlmProvider; url: string; model: string }[] = [
  { provider: 'deepseek', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
  { provider: 'xai', url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
];

export interface GenerateParams {
  sujet: string;
  niveau: Niveau;
  nbLessons: number;
}

const SYSTEM = `Tu es un formateur expert de la BRVM (Bourse Régionale des Valeurs Mobilières, UEMOA) et concepteur pédagogique.
Tu produis des cours structurés, rigoureux et exclusivement factuels pour des investisseurs ouest-africains.
Règles absolues :
- Rédige en français professionnel et accessible.
- Base-toi sur des réalités du marché BRVM/UEMOA (FCFA, SYSCOA/OHADA, CREPMF, secteurs réels).
- Jamais d'invention de chiffres précis non vérifiables ; reste sur des concepts, mécanismes et ordres de grandeur.
- Aucun conseil d'investissement personnalisé ; uniquement de l'éducation financière.
- Tu réponds STRICTEMENT en JSON valide, sans texte autour, sans bloc markdown.`;

function buildPrompt(p: GenerateParams): string {
  return `Génère un cours complet pour la WestBourse Academy.

Sujet : « ${p.sujet} »
Niveau : ${NIVEAU_LABEL[p.niveau]}
Nombre de leçons : ${p.nbLessons}

Réponds avec CE schéma JSON exact (et rien d'autre) :
{
  "titre": "titre du cours (max 200 car.)",
  "niveau": "${p.niveau}",
  "intro": "introduction du cours, 2-3 paragraphes (max 1200 car.)",
  "lessons": [
    {
      "titre": "titre de la leçon",
      "categorie": "general|income|fundamental|technical|regulatory|evaluation",
      "resume": "résumé en 1-2 phrases (max 600 car.)",
      "sections": [
        { "type": "definition", "titre": "Définition", "contenu": "..." },
        { "type": "importance", "titre": "Pourquoi c'est important", "contenu": "..." },
        { "type": "cas", "titre": "Cas réel BRVM", "contenu": "..." },
        { "type": "piege", "titre": "Pièges fréquents", "contenu": "..." },
        { "type": "retenir", "titre": "À retenir", "contenu": "..." }
      ],
      "qcm": {
        "question": "question de compréhension",
        "options": ["option A", "option B", "option C", "option D"],
        "correct": 0,
        "explication": "pourquoi cette réponse est correcte"
      }
    }
  ],
  "glossaire": [ { "terme": "...", "definition": "..." } ]
}

Contraintes :
- Exactement ${p.nbLessons} leçon(s).
- Chaque leçon : 3 à 5 sections parmi (definition, importance, cas, piege, lexique, retenir).
- Chaque leçon a un qcm (4 options, "correct" = index 0-based de la bonne réponse).
- "categorie" choisie selon le contenu (general par défaut).
- glossaire : 4 à 10 termes-clés du sujet.
- Adapte la profondeur au niveau ${NIVEAU_LABEL[p.niveau]}.`;
}

/** Extrait le 1er objet JSON d'une réponse LLM (tolère ```json … ``` ou texte autour). */
function extractJson(raw: string): unknown {
  let s = raw.trim();
  // retirer un éventuel fence markdown
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // sinon, isoler du premier { au dernier }
  if (!s.startsWith('{')) {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
  }
  return JSON.parse(s);
}

async function callLLM(cfg: { url: string; model: string }, key: string, prompt: string): Promise<string> {
  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(110000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

export interface GenerateResult {
  content: CourseContent;
  provider: string;
}

/**
 * Génère le contenu structuré d'un cours via la cascade LLM.
 * Essaie chaque provider disponible jusqu'à obtenir un JSON valide.
 * @throws si aucune clé configurée ou si aucun provider ne renvoie un JSON valide.
 */
export async function generateCourse(p: GenerateParams): Promise<GenerateResult> {
  const prompt = buildPrompt(p);
  const errors: string[] = [];
  let anyKey = false;

  for (const cfg of ORDER) {
    const key = await resolveApiKey(cfg.provider);
    if (!key) continue;
    anyKey = true;
    try {
      const raw = await callLLM(cfg, key, prompt);
      const parsed = courseContentSchema.parse(extractJson(raw));
      return { content: parsed, provider: cfg.model };
    } catch (e) {
      errors.push(`${cfg.provider}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!anyKey) throw new Error('Aucune clé IA configurée (page Clés API).');
  throw new Error(`Génération échouée. ${errors.join(' | ')}`);
}
