# WhatsApp chatbot — plan d'implémentation (2/2 : serveur, route, RGPD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher le cœur pur (partie 1) sur la base, les outils, la transcription et la route WAHA, drapeau `whatsapp_chatbot` coupé.

**Architecture:** voir partie 1. Les fichiers complets sont précédés de `<!-- fichier: chemin -->` ; les modifications de fichiers existants sont données en « remplacer → par ».

**Tech Stack:** idem partie 1.

---

### Task 6 : outils serveur du chatbot

**Files:** Create `frontend/lib/agent/outilsChatbot.ts` ; Modify `frontend/lib/agent/outils.ts` (`async function resoudreCode` → `export async function resoudreCode`).

<!-- fichier: frontend/lib/agent/outilsChatbot.ts -->
```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastMarketDate } from '@/lib/marketDate';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { chargerInstantane } from '@/lib/server/rechercheDonnees';
import { rechercheMotsCles } from '@/lib/recherche/motsCles';
import { OUTILS, executerOutil, resoudreCode, type DefinitionOutil } from './outils';
import { classerNotions, lireListeValeurs, sansSignal, type LeconIndex } from './chatbotPur';

/**
 * Outils de l'assistant WhatsApp ouvert à tous (spec 2026-11-04 §3).
 * LECTURE SEULE, comme lib/agent/outils.ts. Les outils personnels
 * (portefeuille, alertes) ne s'exécutent que pour un Premium lié ayant activé
 * l'assistant ; signal et confiance sont retirés de tout retour.
 */

const SITE = 'https://www.westbourse.com';
const PERSONNELS = new Set(['mon_portefeuille', 'mes_alertes']);

type Proprietes = DefinitionOutil['function']['parameters']['properties'];
const outil = (name: string, description: string, properties: Proprietes, required: string[]): DefinitionOutil => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const CODE = { code: { type: 'string', description: 'Code BRVM (ex. SNTS) ou nom de la société.' } };

export const OUTILS_CHATBOT: DefinitionOutil[] = [
  outil(
    'fiche_societe',
    "Fiche d'une société cotée : secteur, pays, cours et plage sur 52 semaines, derniers comptes annuels publiés (revenus et résultat net, en FCFA), rendement du dividende avec sa base fiscale, liquidité, performance sur 12 mois.",
    CODE,
    ['code'],
  ),
  outil('carnet_ordres', "Meilleure limite à l'achat et à la vente publiée par la BRVM pour une valeur, avec la date de la séance.", CODE, ['code']),
  outil(
    'comparer_valeurs',
    'Fiches de deux ou trois sociétés côte à côte, en un seul appel.',
    { codes: { type: 'string', description: 'Deux ou trois codes ou noms séparés par des virgules (ex. "SNTS, ORAC").' } },
    ['codes'],
  ),
  outil(
    'chercher_societes',
    'Trouve les sociétés cotées correspondant à une description (secteur, pays, dividende, liquidité, tendance), ex. « une banque sénégalaise qui verse un dividende ».',
    { description: { type: 'string', description: 'La description, telle que formulée.' } },
    ['description'],
  ),
  outil(
    'notion_bourse',
    "Leçons de la formation WESTBOURSE Academy qui traitent d'une notion boursière (PER, dividende, détachement, ouvrir un compte, SGI…), avec leur lien.",
    { sujet: { type: 'string', description: 'La notion, en quelques mots.' } },
    ['sujet'],
  ),
];

/** Outils proposés au modèle : les personnels seulement si `perso`. */
export function outilsChatbot(perso: boolean): DefinitionOutil[] {
  return [...OUTILS.filter((o) => perso || !PERSONNELS.has(o.function.name)), ...OUTILS_CHATBOT];
}

const leconsAcademy = unstable_cache(
  async (): Promise<LeconIndex[]> => {
    const { data, error } = await getServiceClient().from('academy_courses').select('slug, titre, content').eq('published', true);
    if (error) throw new Error('academy');
    const sortie: LeconIndex[] = [];
    for (const c of data ?? []) {
      const lecons = (c.content as { lessons?: { titre?: unknown }[] } | null)?.lessons ?? [];
      for (const l of lecons) {
        if (typeof l.titre === 'string') sortie.push({ cours: (c.titre as string | null) ?? (c.slug as string), slug: c.slug as string, titre: l.titre });
      }
    }
    return sortie;
  },
  ['whatsapp-lecons-academy-v1'],
  { revalidate: 6 * 3600 },
);

async function ficheSociete(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };
  const asOf = await getLastMarketDate(db);
  const [instrument, seance, comptes, instantane] = await Promise.all([
    db.from('brvm_instruments').select('designation, secteur, pays').eq('code', code).maybeSingle().then((r) => r.data),
    asOf
      ? db
          .from('brvm_actions_daily')
          .select('cours_jour, variation_pct, cours_haut_52s, cours_bas_52s')
          .eq('date_marche', asOf)
          .eq('code', code)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    db
      .from('income_statements')
      .select('periode, revenu_total, resultat_net')
      .eq('code', code)
      .in('type_periode', ['annuel', 'annual'])
      .order('periode', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    chargerInstantane().catch(() => null),
  ]);
  // BPA, dividende par action et PER volontairement absents (spec §3 : SNTS faux d'un facteur 10 en base).
  const faits = instantane?.fiches.find((f) => f.code === code)?.faits.filter((f) => f.cle !== 'secteur' && f.cle !== 'pays') ?? [];
  return {
    code,
    societe: instrument?.designation ?? null,
    secteur: instrument?.secteur ?? null,
    pays: instrument?.pays ?? null,
    seance: asOf,
    cours: seance?.cours_jour ?? null,
    variation_pct: seance?.variation_pct ?? null,
    plus_haut_52_semaines: seance?.cours_haut_52s ?? null,
    plus_bas_52_semaines: seance?.cours_bas_52s ?? null,
    derniers_comptes_annuels: comptes
      ? { exercice: comptes.periode, revenus_fcfa: comptes.revenu_total, resultat_net_fcfa: comptes.resultat_net }
      : null,
    faits: faits.map((f) => `${f.libelle} : ${f.valeur}`),
    lien: `${SITE}/societes/${code}`,
  };
}

async function carnetOrdres(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };
  const { data } = await db
    .from('brvm_carnet_daily')
    .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { code, erreur: `Aucun carnet d'ordres publié pour ${code}.` };
  const cote = (auMarche: boolean, cours: number | null, quantite: number | null) =>
    auMarche ? { au_marche: true, quantite } : cours != null ? { cours, quantite } : null;
  return {
    code,
    seance: data.date_marche,
    achat: cote(Boolean(data.achat_au_marche), data.cours_achat as number | null, data.qte_achat as number | null),
    vente: cote(Boolean(data.vente_au_marche), data.cours_vente as number | null, data.qte_vente as number | null),
    note: "Meilleure limite de chaque côté seulement, publiée par la BRVM après la clôture (Bulletin officiel de la cote) : ni la profondeur complète du carnet, ni l'état du marché à cet instant. null = aucun ordre de ce côté.",
  };
}

async function chercherSocietes(description: string) {
  if (description.trim().length < 3) return { erreur: 'Décrivez la société cherchée.' };
  const inst = await chargerInstantane();
  const r = rechercheMotsCles(description, inst.fiches);
  return {
    seance: inst.actualiseLe,
    statut: r.statut,
    societes: r.resultats.slice(0, 5).map((x) => ({
      code: x.code,
      nom: x.nom,
      faits: x.faits.map((f) => `${f.libelle} : ${f.valeur}`),
      lien: `${SITE}/societes/${x.code}`,
    })),
  };
}

function notionBourse(sujet: string, lecons: LeconIndex[]) {
  const trouvees = classerNotions(sujet, lecons);
  if (trouvees.length === 0) return { lecons: [], message: 'Aucune leçon Academy ne traite précisément ce sujet.' };
  return {
    lecons: trouvees.map((l) => ({ cours: l.cours, lecon: l.titre, lien: `${SITE}/formations/academy/${l.slug}` })),
    note: 'Contenu réservé à la formation : explique la notion en quelques mots, sans chiffre, puis renvoie à la leçon.',
  };
}

/** Ne lève jamais : une erreur devient un objet `erreur`, comme executerOutil. */
export async function executerOutilChatbot(
  db: SupabaseClient,
  userId: string | null,
  perso: boolean,
  nom: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (PERSONNELS.has(nom) && (!perso || !userId)) {
    return { erreur: 'Réservé aux abonnés Premium dont le WhatsApp est lié et l’assistant activé.' };
  }
  try {
    switch (nom) {
      case 'fiche_societe':
        return await ficheSociete(db, String(args.code ?? ''));
      case 'carnet_ordres':
        return await carnetOrdres(db, String(args.code ?? ''));
      case 'comparer_valeurs': {
        const liste = lireListeValeurs(String(args.codes ?? ''));
        if (!liste) return { erreur: 'Indiquez deux ou trois valeurs à comparer.' };
        return { valeurs: await Promise.all(liste.map((c) => ficheSociete(db, c))) };
      }
      case 'chercher_societes':
        return await chercherSocietes(String(args.description ?? ''));
      case 'notion_bourse':
        return notionBourse(String(args.sujet ?? ''), await leconsAcademy());
    }
  } catch (e) {
    console.error('[chatbot/outils]', nom, (e as Error).message);
    return { erreur: 'Donnée temporairement indisponible.' };
  }
  return sansSignal(await executerOutil(db, userId ?? '', nom, args));
}
```

### Task 7 : transcription des notes vocales

<!-- fichier: frontend/lib/server/transcription.ts -->
```ts
import 'server-only';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { MODELE_LLM } from '@/lib/server/llmModels';

/**
 * Transcription d'une note vocale WhatsApp par Gemini (API native, audio en
 * ligne). L'audio n'est jamais stocké : il ne vit que le temps de cet appel.
 * null : sans clé, audio vide ou trop lourd, parole inaudible. Lève sur une
 * erreur HTTP — l'appelant répond alors « pas compris ».
 */
const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Une note vocale WhatsApp (Opus) d'environ une minute pèse moins d'un Mo. */
export const AUDIO_MAX_OCTETS = 1024 * 1024;
const INAUDIBLE = '[INAUDIBLE]';
const CONSIGNE = `Transcris mot à mot ce message vocal, en français, tel qu'il est prononcé. N'ajoute rien, ne réponds pas à la question, ne commente pas. Si la parole est inaudible ou absente, écris exactement : ${INAUDIBLE}`;

interface ReponseGemini {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

export async function transcrireAudio(octets: Buffer, mimetype: string): Promise<string | null> {
  if (octets.length === 0 || octets.length > AUDIO_MAX_OCTETS) return null;
  const cle = await resolveApiKey('gemini');
  if (!cle) return null;
  const r = await fetch(`${API}/models/${encodeURIComponent(MODELE_LLM.gemini)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': cle, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mimetype.split(';')[0]!.trim(), data: octets.toString('base64') } }, { text: CONSIGNE }],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`transcription HTTP ${r.status}`);
  const j = (await r.json()) as ReponseGemini;
  const texte = (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
  if (!texte || texte.includes(INAUDIBLE)) return null;
  return texte.slice(0, 1000);
}
```

### Task 8 : média WAHA

**Files:** Modify `frontend/lib/whatsapp/waha.ts`, `frontend/lib/whatsapp/waha.test.ts`.

- [ ] Ajouter avant `lireEvenementWaha` :

```ts
export interface FichierWaha {
  url: string;
  mimetype: string;
}

function lireFichier(m: unknown): FichierWaha | null {
  if (!m || typeof m !== 'object') return null;
  const { url, mimetype } = m as { url?: unknown; mimetype?: unknown };
  return typeof url === 'string' && url && typeof mimetype === 'string' && mimetype ? { url, mimetype } : null;
}

/**
 * WAHA forge l'URL d'un fichier sur son origine INTERNE (aucune URL publique
 * n'est configurée sur le serveur) : on garde le chemin, sur l'origine publique
 * `WAHA_URL`. Seul le préfixe /api/files/ est admis : la clé d'API qui
 * accompagne la requête ne doit servir à rien d'autre.
 */
export function urlFichierPublique(url: string, base: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith('/api/files/') || u.pathname.includes('..')) return null;
    return new URL(`${u.pathname}${u.search}`, base).toString();
  } catch {
    return null;
  }
}
```

- [ ] Type `EvenementWaha` (message) : ajouter `fichier: FichierWaha | null;` ; dans l'objet
  renvoyé : `fichier: lireFichier(p.media),` après `media: p.hasMedia === true,`.
- [ ] `waha.test.ts` : ajouter `fichier: null,` à l'attendu du test « message entrant », puis :

```ts
  it('note vocale : fichier lu, URL réécrite sur l’origine publique', () => {
    const e = lireEvenementWaha({
      event: 'message',
      payload: { id: 'x', from: '1@c.us', body: '', hasMedia: true, media: { url: 'http://localhost:3000/api/files/default/abc.oga', mimetype: 'audio/ogg; codecs=opus' } },
    });
    expect(e && e.type === 'message' ? e.fichier : null).toEqual({ url: 'http://localhost:3000/api/files/default/abc.oga', mimetype: 'audio/ogg; codecs=opus' });
    expect(urlFichierPublique('http://localhost:3000/api/files/default/abc.oga', 'https://wa.westbourse.com')).toBe('https://wa.westbourse.com/api/files/default/abc.oga');
    expect(urlFichierPublique('http://localhost:3000/api/sessions', 'https://wa.westbourse.com')).toBeNull();
    expect(urlFichierPublique('pas une url', 'https://wa.westbourse.com')).toBeNull();
  });
```

### Task 9 : dépendances serveur

<!-- fichier: frontend/lib/server/whatsappChatbot.ts -->
```ts
import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkFeature, getFlag } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { isAdminEmail } from '@/lib/server/admin-emails';
import { transcrireAudio, AUDIO_MAX_OCTETS } from '@/lib/server/transcription';
import { buildSystemPrompt } from '@/lib/whatsappAgent/systemPrompt';
import { getWatchlistContext } from '@/lib/whatsappAgent/watchlistContext';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import { executerOutilChatbot, outilsChatbot } from '@/lib/agent/outilsChatbot';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { userParChat } from '@/lib/whatsapp/liaisons';
import { urlFichierPublique, type FichierWaha } from '@/lib/whatsapp/waha';
import { masquerDonneesPersonnelles } from '@/lib/whatsapp/chatbot/chiffres';
import { repondreChatbot, type DepsChatbot, type IssueChatbot, type MessageLlm, type OptionsChatbot } from '@/lib/whatsapp/chatbot/repondre';
import { texteQuota, TEXTE_EFFACE, TEXTE_VOCAL_INCOMPRIS, TEXTE_VOCAL_TROP_LONG } from '@/lib/whatsapp/chatbot/textes';

/**
 * Branchement serveur de l'assistant WhatsApp ouvert à tous (spec 2026-11-04).
 * Le cœur (lib/whatsapp/chatbot/repondre.ts) est pur ; ici vivent la base, la
 * cascade LLM, la passerelle et la transcription. Rien ne lève vers la route.
 */

const HISTORIQUE = 10;
const FENETRE_MS = 72 * 3600 * 1000;
const entier = (v: string | undefined, defaut: number) => {
  const n = Number(v ?? defaut);
  return Number.isInteger(n) && n >= 0 ? n : defaut;
};

/** Pseudonyme de la conversation (HMAC) : la mémoire n'est jamais indexée par le numéro. */
export function hacherChat(chatId: string): string {
  return createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`conversation:${chatId}`).digest('hex');
}

/** Drapeau non déclaré ou illisible ⇒ coupé. */
export async function chatbotActif(): Promise<boolean> {
  const f = await getFlag('whatsapp_chatbot').catch(() => null);
  return !!f && f.acces !== 'disabled';
}

async function memoriser(db: SupabaseClient, chatHash: string, userId: string | null, lignes: MessageLlm[]): Promise<void> {
  const t0 = Date.now();
  // Horodatages distincts : l'ordre de relecture ne dépend pas d'une égalité.
  const { error } = await db.from('whatsapp_conversations').insert(
    lignes.map((l, i) => ({ user_id: userId, chat_hash: chatHash, role: l.role, contenu: l.content, created_at: new Date(t0 + i).toISOString() })),
  );
  if (error) throw new Error('memoire');
}

function depsChatbot(chatId: string): DepsChatbot {
  const db = getServiceClient();
  const h = hacherChat(chatId);
  let profil: { email: string | null; isPremium: boolean } | null = null;

  return {
    identifier: async () => {
      const userId = await userParChat(db, chatId).catch(() => null);
      if (!userId) return { palier: 'inconnu', userId: null, perso: false };
      const [{ data: p }, { data: prefs }] = await Promise.all([
        db.from('profiles').select('is_premium, email').eq('id', userId).maybeSingle(),
        db.from('notification_prefs').select('agent_optin').eq('user_id', userId).maybeSingle(),
      ]);
      profil = { email: (p?.email as string | null) ?? null, isPremium: Boolean(p?.is_premium) };
      const premium = profil.isPremium || isAdminEmail(profil.email);
      return { palier: premium ? 'premium' : 'lie', userId, perso: premium && Boolean(prefs?.agent_optin) };
    },
    quota: async (id) => {
      if (!id.userId) return (await checkRateLimit({ route: 'whatsapp-ia', ip: h, maxHits: 1, windowSeconds: 86_400 })).allowed;
      return (await checkFeature('whatsapp_agent', { id: id.userId, email: profil?.email ?? null, isPremium: profil?.isPremium ?? false })).allowed;
    },
    budget: async (id) => {
      const reserver = async (usage: string, plafond: number) => {
        const { data, error } = await db.rpc('jev_reserver_budget', { p_usage: usage, p_plafond: plafond });
        if (error) throw new Error('budget');
        return data === true;
      };
      try {
        if (id.palier === 'inconnu' && !(await reserver('whatsapp_ia_inconnu', entier(process.env.WHATSAPP_IA_PLAFOND_INCONNU_JOUR, 150)))) {
          return 'plafond_inconnu';
        }
        return (await reserver('whatsapp_ia', entier(process.env.WHATSAPP_IA_PLAFOND_JOUR, 300))) ? 'ok' : 'refuse';
      } catch {
        return 'erreur';
      }
    },
    historique: async () => {
      const { data, error } = await db
        .from('whatsapp_conversations')
        .select('role, contenu')
        .eq('chat_hash', h)
        .gte('created_at', new Date(Date.now() - FENETRE_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(HISTORIQUE);
      if (error) throw new Error('historique');
      return (data ?? []).reverse().map((r) => ({ role: r.role as 'user' | 'assistant', content: r.contenu as string }));
    },
    systeme: async (id) => {
      const watchlist = id.perso && id.userId ? await getWatchlistContext(db, id.userId).catch(() => []) : [];
      return buildSystemPrompt({ watchlist, canal: 'whatsapp', outils: true, premium: id.perso, chatbot: true });
    },
    llm: async (messages, id) => {
      const sources: string[] = [];
      const texte = await callAgentLlm(messages as ChatMessage[], {
        definitions: outilsChatbot(id.perso),
        executer: async (nom, args) => {
          const r = await executerOutilChatbot(db, id.userId, id.perso, nom, args);
          sources.push(JSON.stringify(r));
          return r;
        },
      });
      return { texte, sources };
    },
    enregistrer: (id, lignes) => memoriser(db, h, id.userId, lignes),
    envoyer: async (t) => (await passerelleWhatsapp().envoyerTexte(chatId, t)).ok,
    journal: (e) => console.warn('[whatsapp-chatbot]', e),
  };
}

export function repondreChatbotWhatsapp(chatId: string, texte: string, o?: OptionsChatbot): Promise<IssueChatbot> {
  return repondreChatbot(texte, depsChatbot(chatId), o).catch((e) => {
    console.error('[whatsapp-chatbot] non traité :', (e as Error).message);
    return 'console' as const;
  });
}

/** Réponse sans IA (commande, Jev) gardée en mémoire : l'assistant suit le fil. */
export async function memoriserEchange(chatId: string, question: string, reponse: string): Promise<void> {
  try {
    const db = getServiceClient();
    const userId = await userParChat(db, chatId).catch(() => null);
    await memoriser(db, hacherChat(chatId), userId, [
      { role: 'user', content: masquerDonneesPersonnelles(question) },
      { role: 'assistant', content: reponse },
    ]);
  } catch {
    console.warn('[whatsapp-chatbot] memoire_non_ecrite');
  }
}

/** Commande EFFACER : toute la mémoire de cette conversation. */
export async function effacerConversation(chatId: string): Promise<void> {
  const { error } = await getServiceClient().from('whatsapp_conversations').delete().eq('chat_hash', hacherChat(chatId));
  if (error) console.error('[whatsapp-chatbot] effacement impossible :', error.code ?? error.message);
  await passerelleWhatsapp()
    .envoyerTexte(chatId, error ? 'L’effacement a échoué. Réessayez dans un instant.' : TEXTE_EFFACE)
    .catch(() => null);
}

export type IssueVocal = { etat: 'texte'; texte: string } | { etat: 'repondu' };

/**
 * Note vocale : décompte d'UNE question IA, puis téléchargement immédiat (WAHA
 * garde le fichier 180 s) et transcription. L'audio n'est jamais stocké.
 */
export async function traiterVocal(chatId: string, fichier: FichierWaha): Promise<IssueVocal> {
  const deps = depsChatbot(chatId);
  const repondre = async (t: string): Promise<IssueVocal> => {
    await deps.envoyer(t).catch(() => false);
    return { etat: 'repondu' };
  };
  try {
    const id = await deps.identifier();
    if (!(await deps.quota(id).catch(() => true))) return repondre(texteQuota(id.palier));
    const url = urlFichierPublique(fichier.url, process.env.WAHA_URL ?? '');
    if (!url) return repondre(TEXTE_VOCAL_INCOMPRIS);
    const r = await fetch(url, { headers: { 'X-Api-Key': process.env.WAHA_API_KEY ?? '' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) {
      deps.journal(`vocal_http_${r.status}`);
      return repondre(TEXTE_VOCAL_INCOMPRIS);
    }
    if (Number(r.headers.get('content-length') ?? 0) > AUDIO_MAX_OCTETS) return repondre(TEXTE_VOCAL_TROP_LONG);
    const octets = Buffer.from(await r.arrayBuffer());
    if (octets.length > AUDIO_MAX_OCTETS) return repondre(TEXTE_VOCAL_TROP_LONG);
    const texte = await transcrireAudio(octets, fichier.mimetype).catch((e) => {
      deps.journal(`transcription_${(e as Error).message}`);
      return null;
    });
    return texte ? { etat: 'texte', texte } : repondre(TEXTE_VOCAL_INCOMPRIS);
  } catch (e) {
    deps.journal(`vocal_${(e as Error).message}`);
    return repondre(TEXTE_VOCAL_INCOMPRIS);
  }
}
```

### Task 10 : prompt, drapeau, retours de texte

- [ ] `frontend/lib/server/featureGate.ts` : `| 'whatsapp_jev';` → `| 'whatsapp_jev'\n  | 'whatsapp_chatbot';`
- [ ] `frontend/lib/whatsappAgent/systemPrompt.ts` : dans `SystemPromptContext`, après `premium?: boolean;` :
  `chatbot?: boolean;` (commenté), et `regleOutils` prend en tête la branche
  `ctx.chatbot && ctx.outils && !email ? regleChatbot(ctx.premium === true) : …`, avec la fonction :

```ts
function regleChatbot(perso: boolean): string[] {
  return [
    '',
    "OUTILS : tu consultes N'IMPORTE QUELLE valeur cotée à la BRVM : cours, historique, dividendes, actualités, liquidité, carnet d'ordres (meilleures limites publiées), fiche société (secteur, derniers comptes annuels), comparaison de deux ou trois valeurs, recherche de sociétés par description, palmarès de la séance, et les leçons WESTBOURSE Academy sur une notion. Appelle-les dès que la question porte sur ces sujets, AVANT de répondre que tu ne sais pas. Un outil qui renvoie une erreur ou une valeur nulle signifie que la donnée n'existe pas : dis-le, ne comble jamais le vide.",
    perso
      ? 'Tu peux aussi consulter le portefeuille et les alertes de cet utilisateur.'
      : "Tu n'as PAS accès au portefeuille ni aux alertes de cette personne (réservés aux abonnés Premium dont le WhatsApp est lié et l'assistant activé). Si elle les demande, dis-le en une phrase et donne ce lien : https://www.westbourse.com/pricing",
    "CONVERSATION : les messages précédents sont la conversation en cours. Une question courte (« et son dividende ? ») porte sur la dernière valeur évoquée. Si tu ne sais pas de quelle valeur il s'agit, demande-le en une phrase.",
    "NOTIONS : pour expliquer une notion (PER, dividende, détachement, SGI…), explique-la en deux ou trois phrases SANS AUCUN chiffre, puis cite la leçon Academy renvoyée par l'outil, avec son lien.",
    "CHIFFRES : n'écris QUE des nombres présents tels quels dans les retours d'outils ou dans la conversation. Aucun calcul, aucun pourcentage dérivé, aucun exemple chiffré : un contrôle automatique refuse tout autre nombre.",
    "Ne cite jamais de signal d'achat ou de vente, de score ni de note.",
    "Termine, si c'est utile, par UNE courte suggestion de question suivante.",
  ];
}
```

- [ ] `frontend/lib/whatsapp/repondreCommande.ts` : signature `Promise<string | null>` ; dans la branche limite `return null;` ;
  après le journal final `return envoi.ok ? texte : null;` ; dans le `catch` `return null;`.
- [ ] `frontend/lib/server/whatsappAiguillage.ts` : `appliquerDecision(...): Promise<string | null>`, texte envoyé ou null :

```ts
  const envoyer = async (texte: string) => ((await passerelleWhatsapp().envoyerTexte(chatId, texte)).ok ? texte : null);
  switch (d.type) {
    case 'commande':
      return repondreCommande(chatId, d.commande);
    case 'clarification':
      return envoyer(texteClarification(d.intention, d.codes));
    case 'refus_conseil':
      return envoyer(TEXTE_REFUS_CONSEIL);
    case 'salutation':
      return envoyer(TEXTE_SALUTATION);
    default:
      return null;
  }
```

### Task 11 : route WAHA

**Files:** Modify `frontend/app/api/whatsapp/waha/route.ts`.

- [ ] Imports : `chatbotActif, effacerConversation, memoriserEchange, repondreChatbotWhatsapp, traiterVocal` de
  `@/lib/server/whatsappChatbot` ; `estDemandeEffacer` de `@/lib/whatsapp/chatbot/textes`.
- [ ] Remplacer le bloc compris entre `dejaTraite` et `// Une note que l'exploitant s'écrit…` par :

```ts
  // Assistant ouvert à tous (drapeau whatsapp_chatbot, spec 2026-11-04). Coupé,
  // le parcours ci-dessous est exactement celui d'avant.
  const chatbot = !autoTest && (await chatbotActif());
  let texte = ev.texte;
  let quotaPris = false;
  let vocal = false;
  if (chatbot && !texte.trim() && ev.fichier?.mimetype.startsWith('audio/')) {
    const v = await traiterVocal(ev.de, ev.fichier);
    if (v.etat !== 'texte') return NextResponse.json({ ok: true, vocal: v.etat });
    texte = v.texte;
    quotaPris = true;
    vocal = true;
  }

  // Aiguillage (lots A et D) : code d'appairage → liaison du compte ;
  // commande rapide → réponse sans IA ; le reste → Jev, assistant, ou console.
  if (isPairingCode(texte)) {
    await appairerWhatsapp(ev.de, texte);
    return NextResponse.json({ ok: true, appairage: true });
  }
  // STOP : opposition au recontact commercial (RGPD art. 21). Jamais pour le
  // test de l'exploitant, jamais vers l'agent.
  const stop = !autoTest && estStop(texte);
  if (stop) {
    const enregistre = await traiterStop(ev.de).catch(() => false);
    if (enregistre) return NextResponse.json({ ok: true, stop: true });
    // Non rattaché : le message suit le chemin normal jusqu'à la console.
  }
  if (chatbot && estDemandeEffacer(texte)) {
    await effacerConversation(ev.de);
    return NextResponse.json({ ok: true, efface: true });
  }
  // RECAP : image du portefeuille de l'abonné lié (Premium) — avant les
  // commandes anonymes, car elle est personnelle.
  if (estDemandeRecap(texte)) {
    await traiterDemandeRecap('whatsapp', ev.de, new URL(req.url).origin);
    return NextResponse.json({ ok: true, recap: true });
  }
  const commande = lireCommande(texte);
  if (commande) {
    const envoye = await repondreCommande(ev.de, commande);
    if (chatbot && envoye) await memoriserEchange(ev.de, texte, envoye);
    return NextResponse.json({ ok: true, commande: commande.type });
  }
  if (texte.trim() && !estDemandeHumain(texte) && !estStop(texte)) {
    // Jev (si activé) : réponse exacte, refus de conseil, salutation. Avec l'assistant,
    // le doute, la clarification et l'analyse vont à l'assistant plutôt qu'à la console.
    const decision = autoTest ? ({ type: 'aiguillage_actuel' } as const) : await aiguillerParJev(texte, ev.de, depsAiguillageWhatsapp());
    const versAssistant = chatbot && (decision.type === 'aiguillage_actuel' || decision.type === 'clarification' || decision.type === 'agent');
    if (!versAssistant) {
      const envoye = await appliquerDecision(ev.de, decision);
      if (envoye) {
        if (chatbot) await memoriserEchange(ev.de, texte, envoye);
        return NextResponse.json({ ok: true, aiguillage: decision.type });
      }
    }
    if (chatbot && decision.type !== 'console') {
      const issue = await repondreChatbotWhatsapp(ev.de, texte, { quotaDejaPris: quotaPris });
      if (issue !== 'console') return NextResponse.json({ ok: true, assistant: issue });
    } else if (decision.type !== 'console') {
      const abonne = await abonneAvecAgent(ev.de);
      if (abonne) {
        await repondreAgent(ev.de, abonne, texte);
        return NextResponse.json({ ok: true, agent: true });
      }
    }
  }
```

- [ ] Plus bas : `recevoirMessageWhatsapp({ de: ev.de, texte: ev.texte, … })` → `texte: vocal ? `🎤 ${texte}` : ev.texte`.

### Task 12 : RGPD et documentation

- [ ] `frontend/app/confidentialite/page.tsx` : `updatedAt="2026-11-04"` ; puce « Messages WhatsApp » :
  contenu des messages et des notes vocales transcrites, audio non conservé ; finalité « Réponses de
  l'assistant WhatsApp » (mesures précontractuelles / intérêt légitime ; EFFACER) ; durée 30 j sans compte,
  90 j avec ; sous-traitants IA : rédaction des réponses de l'assistant (e-mails et numéros masqués),
  transcription des notes vocales par Google Gemini.
- [ ] `docs/RGPD.md` : entrée « Assistant WhatsApp ouvert à tous ».
- [ ] `CLAUDE.md` §8 : passage 2026-11-04.

### Task 13 : vérifications

- [ ] `npx vitest run lib/whatsapp lib/agent lib/recherche` → vert.
- [ ] `NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit -p .` → 0 erreur.
- [ ] Appliquer 0193 (Task 1) ; vérifier à la clé publique.
- [ ] PR ; drapeau laissé `disabled` ; activation = décision de l'exploitant après essai réel
  (un message libre, une suite de conversation, une note vocale, EFFACER).
