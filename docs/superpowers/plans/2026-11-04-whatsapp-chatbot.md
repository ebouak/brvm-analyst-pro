# WhatsApp chatbot — plan d'implémentation (1/2 : cœur pur et base)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir l'agent IA WhatsApp à tout expéditeur (outils de marché, pédagogie, mémoire, notes vocales) derrière un drapeau coupé, avec quotas, plafonds et verrou des chiffres.

**Architecture:** Approche A de la spec `docs/superpowers/specs/2026-11-04-whatsapp-chatbot-design.md` : commandes et Jev d'abord (sans IA), agent pour le reste. Cœur pur testable (`lib/whatsapp/chatbot/`), dépendances serveur injectées (`lib/server/whatsappChatbot.ts`), route WAHA qui orchestre. Partie 2 : `2026-11-04-whatsapp-chatbot-2.md`.

**Tech Stack:** Next.js 14 (route handler Node), TypeScript strict, vitest, Supabase (service_role), WAHA, cascade LLM `callAgentLlm`, Gemini natif (transcription).

Les blocs précédés de `<!-- fichier: chemin -->` sont des fichiers COMPLETS, extraits tels quels.

---

### Task 1 : migration 0193

**Files:** Create `supabase/migrations/0193_whatsapp_chatbot.sql`

- [ ] Step 1 — écrire la migration :

<!-- fichier: supabase/migrations/0193_whatsapp_chatbot.sql -->
```sql
-- 0193 — WhatsApp : vrai chatbot (spec 2026-11-04-whatsapp-chatbot-design.md).
--
-- whatsapp_conversations devient la mémoire de TOUTE conversation, liée à un
-- compte ou non : user_id devient facultatif, chat_hash (HMAC du chatId,
-- pseudonyme) identifie la conversation. Drapeau livré COUPÉ. Rétention :
-- 30 jours sans compte, 90 jours avec (inchangé). RLS : inchangée, sans policy.

alter table public.whatsapp_conversations alter column user_id drop not null;

alter table public.whatsapp_conversations
  add column if not exists chat_hash text check (chat_hash is null or chat_hash ~ '^[0-9a-f]{64}$');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_conversations_proprietaire') then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_proprietaire check (user_id is not null or chat_hash is not null);
  end if;
end $$;

create index if not exists idx_whatsapp_conversations_chat
  on public.whatsapp_conversations (chat_hash, created_at desc)
  where chat_hash is not null;

comment on table public.whatsapp_conversations is
  'Mémoire des conversations WhatsApp avec l''assistant. user_id si la conversation est liée à un compte (export, cascade), chat_hash = HMAC du chatId (pseudonyme). Rétention 30 j sans compte, 90 j avec. Effaçable par la commande EFFACER.';

insert into public.feature_flags (code, label, acces, description) values
  ('whatsapp_chatbot', 'WhatsApp : assistant ouvert à tous', 'disabled',
   'Toute personne qui écrit discute avec l''assistant IA (données de marché, notions, mémoire, notes vocales). Livré coupé : activer après l''évaluation.')
on conflict (code) do nothing;

-- Rétention : reprise de 0192 + une ligne (conversations sans compte, 30 jours).
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_conversations where user_id is null and created_at < now() - interval '30 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
  delete from public.academy_exam_sessions  where created_at < now() - interval '7 days';
  delete from public.recherche_societes_cache  where cree_le < now() - interval '24 hours';
  delete from public.recherche_societes_budget where jour < current_date - 30;
  delete from public.whatsapp_aiguillages      where created_at < now() - interval '90 days';
  delete from public.jev_budget                where jour < current_date - 30;
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

- [ ] Step 2 — AVANT application, comparer avec la définition en production :
  `select pg_get_functiondef('public.purge_rgpd_retention()'::regprocedure);` doit
  contenir exactement les 18 `delete` de 0192 (historique de migrations non fiable).
- [ ] Step 3 — appliquer : `npx supabase db query --linked -f supabase/migrations/0193_whatsapp_chatbot.sql`.
- [ ] Step 4 — vérifier : colonne `chat_hash`, `user_id` nullable, drapeau `disabled`,
  lecture anonyme de `whatsapp_conversations` refusée (clé publique → `[]` ou 401).

### Task 2 : verrou des chiffres et masquage (purs)

**Files:** Create `frontend/lib/whatsapp/chatbot/chiffres.ts`, test `frontend/lib/whatsapp/chatbot/chiffres.test.ts`

- [ ] Step 1 — tests :

<!-- fichier: frontend/lib/whatsapp/chatbot/chiffres.test.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { chiffresEtrangers, extraireNombres, masquerDonneesPersonnelles } from './chiffres';

const source = JSON.stringify({
  code: 'SNTS',
  seance: '2026-11-04',
  cours: 39200,
  variation_pct: -1.53,
  valeur_echangee: 2_550_000_000,
  resultat_net_fcfa: 413_588_000_000,
  montant: '1 740 FCFA',
});

describe('extraction des nombres', () => {
  it('formats français : espaces (y compris insécables), virgule décimale, échelle', () => {
    const n = extraireNombres('39 200 FCFA, 1,5 %, 2,55 Md FCFA, 413,6 milliards');
    expect(n.map((x) => x.cible)).toEqual([39200, 1.5, 2.55e9, 413.6e9]);
  });
  it('ignore les liens et les noms d’indices', () => {
    expect(extraireNombres('voir https://www.westbourse.com/societes/SNTS2 et le BRVM-30')).toEqual([]);
  });
});

describe('verrou des chiffres', () => {
  it('accepte un chiffre présent dans les données, arrondi compris', () => {
    expect(chiffresEtrangers('Sonatel cote 39 200 FCFA (-1,5 %), 2,55 Md échangés.', [source])).toEqual([]);
    expect(chiffresEtrangers('Résultat net : 413,6 milliards de FCFA.', [source])).toEqual([]);
    expect(chiffresEtrangers('Dividende : 1 740 FCFA.', [source])).toEqual([]);
  });
  it('accepte dates, années et petits entiers', () => {
    expect(chiffresEtrangers('Séance du 04/11/2026, exercice 2024, 3 valeurs.', [source])).toEqual([]);
  });
  it('refuse un chiffre inventé ou calculé', () => {
    expect(chiffresEtrangers('Le PER est de 9,5 et le cours 41 000 FCFA.', [source])).toEqual(['9,5', '41 000']);
  });
  it('accepte un chiffre venu de la question de l’utilisateur', () => {
    expect(chiffresEtrangers('Pour 250 000 FCFA, voici les données.', ['j’ai 250 000 FCFA'])).toEqual([]);
  });
});

describe('masquage des données personnelles', () => {
  it('masque e-mail et téléphone, garde les montants', () => {
    expect(masquerDonneesPersonnelles('écrivez à a.b@c.com ou au +221 77 123 45 67, budget 1 000 000 FCFA')).toBe(
      'écrivez à [adresse masquée] ou au [numéro masqué], budget 1 000 000 FCFA',
    );
  });
});
```

- [ ] Step 2 — `npx vitest run lib/whatsapp/chatbot/chiffres.test.ts` → FAIL (module absent).
- [ ] Step 3 — implémentation :

<!-- fichier: frontend/lib/whatsapp/chatbot/chiffres.ts -->
```ts
/**
 * Verrou des chiffres de l'assistant WhatsApp (spec §4). Module PUR.
 *
 * Tout nombre d'une réponse doit figurer dans les retours d'outils, dans la
 * conversation ou dans la question. Même règle que les articles, l'hebdo et les
 * dossiers : un chiffre non vérifiable ne part pas. Tolérances : l'arrondi
 * affiché (« 1,5 % » pour -1,53), l'échelle écrite (« 2,55 Md » pour
 * 2 550 000 000), les dates, années et petits entiers.
 */

const LIENS = /https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|org|net)\b\S*/gi;
const INDICES = /\bBRVM[\s-]?(?:C|10|30)\b/gi;
const NOMBRE = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
const ECHELLE = /^\s*(milliards?|mds?|md|millions?|m(?![a-zé])|mille|k(?![a-z]))/i;

export interface NombreLu {
  brut: string;
  /** Valeur écrite (sans signe). */
  valeur: number;
  decimales: number;
  /** Valeur × échelle (« 2,55 Md » → 2,55e9). */
  cible: number;
  echelle: number;
}

function echelle(suite: string): number {
  const m = ECHELLE.exec(suite);
  if (!m) return 1;
  const mot = m[1]!.toLowerCase();
  if (mot.startsWith('md') || mot.startsWith('milliard')) return 1e9;
  if (mot === 'm' || mot.startsWith('million')) return 1e6;
  return 1e3;
}

export function extraireNombres(texte: string): NombreLu[] {
  const propre = texte.replace(LIENS, ' ').replace(INDICES, ' ');
  const sortie: NombreLu[] = [];
  for (const m of propre.matchAll(NOMBRE)) {
    const brut = m[0];
    // Collé à une lettre (« SNTS2 », « T3 », « S1 ») : un identifiant, pas un nombre.
    const avant = propre[m.index! - 1] ?? ' ';
    if (/[A-Za-z]/.test(avant)) continue;
    const net = brut.replace(/[   ]/g, '').replace(',', '.');
    const valeur = Number(net);
    if (!Number.isFinite(valeur)) continue;
    const decimales = net.includes('.') ? net.split('.')[1]!.length : 0;
    const e = echelle(propre.slice(m.index! + brut.length));
    sortie.push({ brut, valeur, decimales, cible: valeur * e, echelle: e });
  }
  return sortie;
}

function valeursSources(sources: string[]): number[] {
  const v: number[] = [];
  for (const s of sources) {
    for (const n of extraireNombres(s)) {
      v.push(n.valeur, n.cible);
    }
  }
  return v;
}

/** Nombres de `reponse` introuvables dans `sources` (texte brut tel qu'écrit). */
export function chiffresEtrangers(reponse: string, sources: string[]): string[] {
  const connus = valeursSources(sources);
  const refuses: string[] = [];
  for (const n of extraireNombres(reponse)) {
    if (n.echelle === 1 && Number.isInteger(n.valeur) && (n.valeur <= 12 || (n.valeur >= 1990 && n.valeur <= 2100))) continue;
    const tolerance = 0.5 * 10 ** -n.decimales * n.echelle + 1e-9;
    if (connus.some((s) => Math.abs(Math.abs(s) - n.cible) <= tolerance)) continue;
    refuses.push(n.brut);
  }
  return refuses;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const TELEPHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/g;
const MONTANT = /^\d{1,3}(?:[   ]\d{3})+$/;

/** Avant tout envoi à un fournisseur d'IA : ni adresse e-mail ni numéro de téléphone. */
export function masquerDonneesPersonnelles(texte: string): string {
  return texte
    .replace(EMAIL, '[adresse masquée]')
    .replace(TELEPHONE, (m) => (MONTANT.test(m.trim()) ? m : '[numéro masqué]'));
}
```

- [ ] Step 4 — relancer : PASS.
- [ ] Step 5 — commit `feat(whatsapp): verrou des chiffres et masquage des données personnelles`.

### Task 3 : textes fixes (purs)

**Files:** Create `frontend/lib/whatsapp/chatbot/textes.ts`, test dans `frontend/lib/whatsapp/chatbot/chatbot.test.ts` (Task 4).
Modify `frontend/lib/whatsapp/agent.ts` : `versWhatsapp` déplacé ici et réexporté.

<!-- fichier: frontend/lib/whatsapp/chatbot/textes.ts -->
```ts
/**
 * Textes FIXES de l'assistant WhatsApp : aucun chiffre de marché, rien de
 * généré. Les quotas ne citent pas leur valeur : elle vit dans les drapeaux
 * et la changer ne doit pas rendre un texte faux.
 */

export type Palier = 'inconnu' | 'lie' | 'premium';

const SITE = 'https://www.westbourse.com';
const LIEN_COMPTE = `${SITE}/signup?next=%2Fparametres%2Falertes`;
const ILLIMITE = 'Toujours sans limite : *COURS SNTS*, *DIV SNTS*, *PALMARES*, *AIDE*.';

/** Le modèle écrit parfois du Markdown (**gras**) : WhatsApp attend *gras*. */
export function versWhatsapp(texte: string): string {
  return texte.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s+/gm, '').slice(0, 4096);
}

export function texteQuota(palier: Palier): string {
  if (palier === 'inconnu') {
    return [
      'Vous avez utilisé votre question du jour à l’assistant.',
      ILLIMITE,
      '',
      `Pour davantage de questions chaque jour, créez un compte gratuit puis liez ce WhatsApp : ${LIEN_COMPTE}`,
    ].join('\n');
  }
  if (palier === 'lie') {
    return [
      'Vous avez utilisé vos questions du jour à l’assistant.',
      ILLIMITE,
      '',
      `*Premium* : davantage de questions, votre portefeuille et vos alertes ici même : ${SITE}/pricing`,
    ].join('\n');
  }
  return ['Vous avez atteint la limite quotidienne de questions à l’assistant. Elle se renouvelle demain.', ILLIMITE].join('\n');
}

export const TEXTE_PLAFOND_INCONNU = [
  'L’assistant est très sollicité aujourd’hui : réessayez demain.',
  ILLIMITE,
  '',
  `Les comptes inscrits restent prioritaires : ${LIEN_COMPTE}`,
].join('\n');

export const PIED_PREMIER =
  '\n\n_Réponse générée par IA à partir des données WESTBOURSE, pas un conseil en investissement. Tapez *EFFACER* pour effacer cet échange. Confidentialité : westbourse.com/confidentialite_';

export const TEXTE_EFFACE = 'C’est fait : l’historique de cette conversation est effacé.';

export const TEXTE_VOCAL_INCOMPRIS = 'Je n’ai pas pu comprendre cette note vocale. Pouvez-vous écrire votre question ?';

export const TEXTE_VOCAL_TROP_LONG = 'Cette note vocale est trop longue pour moi. Pouvez-vous la raccourcir ou écrire votre question ?';

export function texteSansChiffre(code: string | null): string {
  const lien = code ? `${SITE}/societes/${code}` : `${SITE}/actions`;
  return `Je préfère ne pas vous donner un chiffre que je ne peux pas vérifier. Les données à jour sont ici : ${lien}`;
}

export function consigneReecriture(refuses: string[]): string {
  return `[Contrôle automatique] Ta réponse contient des nombres absents des données des outils : ${refuses.join(', ')}. Réécris-la sans ces nombres et sans en ajouter d'autres.`;
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** EFFACER / OUBLIE / SUPPRIMER (éventuellement suivi de « mes messages », « historique »). */
export function estDemandeEffacer(texte: string): boolean {
  const t = sansAccent(texte.trim().replace(/^[/!]\s*/, '')).replace(/[.!]+$/, '');
  return /^(effacer|efface|oublie|oublier|supprimer)( (mes messages|l'historique|l’historique|historique|la conversation))?$/.test(t);
}

/** Premier code de valeur cité dans les retours d'outils, pour le lien de repli. */
export function codeCite(sources: string[]): string | null {
  for (const s of sources) {
    const m = /"code":"([A-Z]{3,6})"/.exec(s);
    if (m) return m[1]!;
  }
  return null;
}
```

- [ ] Modifier `frontend/lib/whatsapp/agent.ts` : supprimer la fonction `versWhatsapp`
  (lignes 35-38) et ajouter `export { versWhatsapp } from './chatbot/textes';` +
  `import { versWhatsapp } from './chatbot/textes';`.

### Task 4 : orchestrateur pur `repondreChatbot`

**Files:** Create `frontend/lib/whatsapp/chatbot/repondre.ts`, test `frontend/lib/whatsapp/chatbot/chatbot.test.ts`

<!-- fichier: frontend/lib/whatsapp/chatbot/repondre.ts -->
```ts
import { chiffresEtrangers, masquerDonneesPersonnelles } from './chiffres';
import { codeCite, consigneReecriture, PIED_PREMIER, texteQuota, TEXTE_PLAFOND_INCONNU, texteSansChiffre, versWhatsapp, type Palier } from './textes';

/**
 * Réponse de l'assistant WhatsApp à un message libre (spec §1 étape 6).
 * Orchestration PURE : toutes les entrées-sorties sont injectées.
 * Issue 'console' ⇒ l'appelant transmet le message à un humain : jamais perdu.
 */

export interface MessageLlm {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Identite {
  palier: Palier;
  userId: string | null;
  /** Outils personnels (portefeuille, alertes) : Premium lié ET agent_optin. */
  perso: boolean;
}

export interface ResultatLlm {
  texte: string | null;
  /** Retours d'outils sérialisés : seule source admise pour les chiffres. */
  sources: string[];
}

export interface DepsChatbot {
  identifier(): Promise<Identite>;
  /** true = autorisé (et consommé). */
  quota(id: Identite): Promise<boolean>;
  budget(id: Identite): Promise<'ok' | 'plafond_inconnu' | 'refuse' | 'erreur'>;
  historique(): Promise<MessageLlm[]>;
  systeme(id: Identite): Promise<string>;
  llm(messages: MessageLlm[], id: Identite): Promise<ResultatLlm>;
  enregistrer(id: Identite, lignes: MessageLlm[]): Promise<void>;
  envoyer(texte: string): Promise<boolean>;
  /** Codes d'événement seulement : jamais le texte ni le numéro. */
  journal(evenement: string): void;
}

export type IssueChatbot = 'repondu' | 'limite' | 'console';

export interface OptionsChatbot {
  /** Note vocale : la question a déjà été décomptée avant la transcription. */
  quotaDejaPris?: boolean;
}

const VIDE: ResultatLlm = { texte: null, sources: [] };

export async function repondreChatbot(texte: string, deps: DepsChatbot, o: OptionsChatbot = {}): Promise<IssueChatbot> {
  const id = await deps.identifier();

  if (!o.quotaDejaPris && !(await deps.quota(id).catch(() => true))) {
    await deps.envoyer(texteQuota(id.palier)).catch(() => false);
    return 'limite';
  }

  const budget = await deps.budget(id).catch(() => 'erreur' as const);
  if (budget === 'plafond_inconnu') {
    await deps.envoyer(TEXTE_PLAFOND_INCONNU).catch(() => false);
    return 'limite';
  }
  if (budget !== 'ok') {
    deps.journal(budget === 'refuse' ? 'plafond_global' : 'budget_indisponible');
    return 'console';
  }

  const historique = await deps.historique().catch(() => [] as MessageLlm[]);
  const question = masquerDonneesPersonnelles(texte);
  const systeme = await deps.systeme(id);
  const base: MessageLlm[] = [{ role: 'system', content: systeme }, ...historique, { role: 'user', content: question }];
  const autorises = [question, ...historique.map((h) => h.content)];

  const r = await deps.llm(base, id).catch(() => VIDE);
  if (!r.texte) {
    deps.journal('llm_echec');
    return 'console';
  }

  let finale = r.texte;
  const refuses = chiffresEtrangers(r.texte, [...autorises, ...r.sources]);
  if (refuses.length > 0) {
    deps.journal('chiffre_etranger');
    const r2 = await deps
      .llm([...base, { role: 'assistant', content: r.texte }, { role: 'user', content: consigneReecriture(refuses) }], id)
      .catch(() => VIDE);
    const sources = [...r.sources, ...r2.sources];
    if (r2.texte && chiffresEtrangers(r2.texte, [...autorises, ...sources]).length === 0) {
      finale = r2.texte;
    } else {
      deps.journal('chiffre_etranger_repli');
      finale = texteSansChiffre(codeCite(sources));
    }
  }

  finale = versWhatsapp(finale);
  await deps
    .enregistrer(id, [
      { role: 'user', content: question },
      { role: 'assistant', content: finale },
    ])
    .catch(() => deps.journal('memoire_non_ecrite'));

  const envoye = await deps.envoyer(historique.length === 0 ? `${finale}${PIED_PREMIER}` : finale).catch(() => false);
  if (!envoye) {
    deps.journal('envoi_echec');
    return 'console';
  }
  return 'repondu';
}
```

<!-- fichier: frontend/lib/whatsapp/chatbot/chatbot.test.ts -->
```ts
import { describe, it, expect, vi } from 'vitest';
import { repondreChatbot, type DepsChatbot, type Identite, type MessageLlm } from './repondre';
import { codeCite, estDemandeEffacer, PIED_PREMIER, texteQuota, TEXTE_PLAFOND_INCONNU, versWhatsapp } from './textes';

const INCONNU: Identite = { palier: 'inconnu', userId: null, perso: false };
const SOURCE = JSON.stringify({ code: 'SNTS', cours: 39200, variation_pct: -1.53 });

function deps(o: Partial<DepsChatbot> = {}): DepsChatbot & { envois: string[]; lignes: MessageLlm[][]; evenements: string[] } {
  const envois: string[] = [];
  const lignes: MessageLlm[][] = [];
  const evenements: string[] = [];
  return {
    envois,
    lignes,
    evenements,
    identifier: async () => INCONNU,
    quota: async () => true,
    budget: async () => 'ok',
    historique: async () => [],
    systeme: async () => 'SYSTEME',
    llm: async () => ({ texte: 'Sonatel cote 39 200 FCFA.', sources: [SOURCE] }),
    enregistrer: async (_id, l) => {
      lignes.push(l);
    },
    envoyer: async (t) => {
      envois.push(t);
      return true;
    },
    journal: (e) => evenements.push(e),
    ...o,
  };
}

describe('textes', () => {
  it('EFFACER et variantes', () => {
    for (const t of ['EFFACER', 'efface', 'Oublie', '/supprimer', 'effacer mes messages', 'Effacer l’historique.']) expect(estDemandeEffacer(t)).toBe(true);
    for (const t of ['effacer SNTS de ma liste', 'cours SNTS', 'oublie pas le dividende']) expect(estDemandeEffacer(t)).toBe(false);
  });
  it('quotas : aucun chiffre de quota, lien selon le palier', () => {
    for (const p of ['inconnu', 'lie', 'premium'] as const) expect(texteQuota(p).replace(/https?:\/\/\S+/g, '')).not.toMatch(/\d/);
    expect(texteQuota('inconnu')).toContain('/signup?next=');
    expect(texteQuota('lie')).toContain('/pricing');
  });
  it('mise en forme WhatsApp et code cité', () => {
    expect(versWhatsapp('**gras** et ## titre')).toBe('*gras* et ## titre');
    expect(codeCite(['{"x":1}', SOURCE])).toBe('SNTS');
    expect(codeCite([])).toBeNull();
  });
});

describe('repondreChatbot', () => {
  it('réponse vérifiée : envoyée avec le pied au premier échange, mémorisée', async () => {
    const d = deps();
    expect(await repondreChatbot('cours de sonatel ?', d)).toBe('repondu');
    expect(d.envois).toEqual([`Sonatel cote 39 200 FCFA.${PIED_PREMIER}`]);
    expect(d.lignes[0]).toEqual([
      { role: 'user', content: 'cours de sonatel ?' },
      { role: 'assistant', content: 'Sonatel cote 39 200 FCFA.' },
    ]);
  });
  it('pas de pied quand la conversation a déjà un historique', async () => {
    const d = deps({ historique: async () => [{ role: 'user', content: 'bonjour' }] });
    await repondreChatbot('et le cours ?', d);
    expect(d.envois[0]).toBe('Sonatel cote 39 200 FCFA.');
  });
  it('quota atteint : texte fixe, aucun appel IA', async () => {
    const llm = vi.fn();
    const d = deps({ quota: async () => false, llm });
    expect(await repondreChatbot('question', d)).toBe('limite');
    expect(d.envois).toEqual([texteQuota('inconnu')]);
    expect(llm).not.toHaveBeenCalled();
  });
  it('note vocale : quota déjà pris, pas redemandé', async () => {
    const quota = vi.fn(async () => false);
    const d = deps({ quota });
    expect(await repondreChatbot('question', d, { quotaDejaPris: true })).toBe('repondu');
    expect(quota).not.toHaveBeenCalled();
  });
  it('sous-plafond des inconnus : texte fixe ; plafond global ou erreur : console', async () => {
    const a = deps({ budget: async () => 'plafond_inconnu' });
    expect(await repondreChatbot('q', a)).toBe('limite');
    expect(a.envois).toEqual([TEXTE_PLAFOND_INCONNU]);
    expect(await repondreChatbot('q', deps({ budget: async () => 'refuse' }))).toBe('console');
    expect(
      await repondreChatbot(
        'q',
        deps({
          budget: async () => {
            throw new Error('x');
          },
        }),
      ),
    ).toBe('console');
  });
  it('échec de tous les fournisseurs : console, rien envoyé', async () => {
    const d = deps({ llm: async () => ({ texte: null, sources: [] }) });
    expect(await repondreChatbot('q', d)).toBe('console');
    expect(d.envois).toEqual([]);
  });
  it('chiffre étranger : une réécriture, acceptée si propre', async () => {
    const llm = vi
      .fn()
      .mockResolvedValueOnce({ texte: 'Le PER vaut 9,5 et le cours 39 200 FCFA.', sources: [SOURCE] })
      .mockResolvedValueOnce({ texte: 'Le cours est de 39 200 FCFA.', sources: [] });
    const d = deps({ llm, historique: async () => [{ role: 'assistant', content: 'x' }] });
    expect(await repondreChatbot('q', d)).toBe('repondu');
    expect(d.envois).toEqual(['Le cours est de 39 200 FCFA.']);
    expect(d.evenements).toContain('chiffre_etranger');
    expect(llm.mock.calls[1]![0].at(-1).content).toContain('9,5');
  });
  it('chiffre étranger deux fois : réponse sans chiffre avec lien vers la valeur', async () => {
    const llm = vi.fn().mockResolvedValue({ texte: 'Le PER vaut 9,5.', sources: [SOURCE] });
    const d = deps({ llm, historique: async () => [{ role: 'assistant', content: 'x' }] });
    await repondreChatbot('q', d);
    expect(d.envois[0]).toContain('/societes/SNTS');
    expect(d.envois[0]).not.toMatch(/9,5/);
    expect(d.evenements).toContain('chiffre_etranger_repli');
  });
  it('données personnelles masquées avant l’IA et en mémoire', async () => {
    const llm = vi.fn(async () => ({ texte: 'Bien noté.', sources: [] }));
    const d = deps({ llm });
    await repondreChatbot('mon mail a.b@c.com, rappelez le 0102030405', d);
    const envoye = JSON.stringify(llm.mock.calls[0]);
    expect(envoye).not.toContain('a.b@c.com');
    expect(envoye).not.toContain('0102030405');
    expect(JSON.stringify(d.lignes)).not.toContain('a.b@c.com');
  });
  it('envoi impossible : console', async () => {
    expect(await repondreChatbot('q', deps({ envoyer: async () => false }))).toBe('console');
  });
});
```

- [ ] Run `npx vitest run lib/whatsapp/chatbot` → PASS. Commit `feat(whatsapp): orchestrateur pur de l'assistant`.

### Task 5 : outils purs (notions, retrait du signal)

**Files:** Create `frontend/lib/agent/chatbotPur.ts`, test `frontend/lib/agent/chatbotPur.test.ts`

<!-- fichier: frontend/lib/agent/chatbotPur.ts -->
```ts
/**
 * Parties PURES des outils de l'assistant WhatsApp (lib/agent/outilsChatbot.ts).
 */

export interface LeconIndex {
  cours: string;
  slug: string;
  titre: string;
}

const MOTS_VIDES = new Set([
  'les', 'des', 'une', 'que', 'qui', 'quoi', 'est', 'comment', 'pour', 'sur', 'dans', 'avec', 'par', 'mon', 'mes',
  'son', 'ses', 'aux', 'faire', 'fait', 'cest', 'quest', 'brvm', 'bourse', 'action', 'actions', 'expliquer',
  'explique', 'expliquez', 'moi', 'svp', 'veut', 'dire', 'signifie', 'lecon', 'niveau',
]);

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Racine grossière : « dividendes » et « dividende » se rejoignent. */
const racine = (t: string) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

function termes(s: string): string[] {
  return [...new Set(normaliser(s).split(' '))]
    .filter((t) => (t.length >= 3 || t === 'pe') && !MOTS_VIDES.has(t))
    .map(racine);
}

/** Leçons dont le titre partage le plus de termes avec le sujet (3 au plus, score > 0). */
export function classerNotions(sujet: string, lecons: LeconIndex[]): LeconIndex[] {
  const q = termes(sujet);
  if (q.length === 0) return [];
  return lecons
    .map((l) => {
      const t = new Set(termes(l.titre));
      const score = q.filter((m) => t.has(m)).length;
      return { l, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.titre.localeCompare(b.l.titre))
    .slice(0, 3)
    .map((x) => x.l);
}

/** Sur WhatsApp, ni signal ni confiance : ce serait une recommandation (spec §3). */
export function sansSignal(r: unknown): unknown {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
  const { signal: _s, confiance: _c, ...reste } = r as Record<string, unknown>;
  return reste;
}

/** « SNTS, ORAC ; SGBC » ou « Sonatel et Orange CI » → 2 à 3 saisies distinctes, sinon null. */
export function lireListeValeurs(saisie: string): string[] | null {
  const liste = [...new Set(saisie.split(/[,;/]+|\s+et\s+/i).map((s) => s.trim()).filter(Boolean))].slice(0, 3);
  return liste.length >= 2 ? liste : null;
}
```

<!-- fichier: frontend/lib/agent/chatbotPur.test.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { classerNotions, lireListeValeurs, sansSignal, type LeconIndex } from './chatbotPur';

const LECONS: LeconIndex[] = [
  { cours: 'Niveau 2', slug: 'academy-niveau-2-fondamental', titre: 'Leçon 2 — Le PER : évaluer la cherté d’une action' },
  { cours: 'Niveau 1', slug: 'academy-niveau-1-initiation', titre: 'Leçon 5 — Les dividendes : construire un revenu passif' },
  { cours: 'Niveau 1', slug: 'academy-niveau-1-initiation', titre: 'Leçon 9 — Ouvrir un compte et passer son premier ordre' },
];

describe('notions', () => {
  it('trouve la leçon par les termes du sujet, accents, casse et pluriel ignorés', () => {
    expect(classerNotions('c’est quoi le PER ?', LECONS).map((l) => l.titre)).toEqual([LECONS[0]!.titre]);
    expect(classerNotions('dividende', LECONS)[0]!.titre).toBe(LECONS[1]!.titre);
    expect(classerNotions('comment ouvrir un compte', LECONS)[0]!.titre).toBe(LECONS[2]!.titre);
  });
  it('rien de pertinent : liste vide', () => {
    expect(classerNotions('la météo', LECONS)).toEqual([]);
    expect(classerNotions('', LECONS)).toEqual([]);
  });
});

describe('outils', () => {
  it('retire signal et confiance, garde le reste', () => {
    expect(sansSignal({ code: 'SNTS', cours: 1, signal: 'BUY', confiance: 0.7 })).toEqual({ code: 'SNTS', cours: 1 });
    expect(sansSignal(null)).toBeNull();
  });
  it('liste de valeurs à comparer', () => {
    expect(lireListeValeurs('SNTS, ORAC')).toEqual(['SNTS', 'ORAC']);
    expect(lireListeValeurs('Sonatel et Orange CI')).toEqual(['Sonatel', 'Orange CI']);
    expect(lireListeValeurs('SNTS')).toBeNull();
  });
});
```

- [ ] Run `npx vitest run lib/agent/chatbotPur.test.ts` → PASS. Commit.
