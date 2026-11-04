# Recherche des sociétés (Jev) — plan d'implémentation, partie 2 (tâches 6 à 12)

Suite de `2026-11-04-recherche-societes-jev.md` (mêmes conventions d'extraction : `<!-- fichier: chemin -->` = contenu complet).

### Task 6 : migration 0191 (tables, fonctions atomiques, flag, purge)

**Files:** Create `supabase/migrations/0191_recherche_societes.sql`, `frontend/scripts/verif-budget-recherche.mjs`

<!-- fichier: supabase/migrations/0191_recherche_societes.sql -->
```sql
-- 0191 — Recherche en langage naturel parmi les sociétés (Jev / TypeSafe).
--
-- Cache par (empreinte de requête, instantané des faits) et budget journalier.
-- RGPD : ni texte de requête ni identifiant de compte. RLS activée SANS policy :
-- service_role seul. Les deux fonctions sont ATOMIQUES : un comptage de lignes
-- cédait sous requêtes simultanées (dix lectures de « 299 », dix appels payés).

create table if not exists public.recherche_societes_cache (
  empreinte          text not null,
  snapshot_id        text not null,
  etat               text not null check (etat in ('en_cours', 'prete')),
  resultat           jsonb,
  -- Probabilité qu'au moins une société corresponde (« any_relevant » de Jev).
  pertinence_globale numeric check (pertinence_globale is null or (pertinence_globale >= 0 and pertinence_globale <= 1)),
  cree_le            timestamptz not null default now(),
  primary key (empreinte, snapshot_id)
);
create index if not exists idx_recherche_societes_cache_cree_le on public.recherche_societes_cache (cree_le);
alter table public.recherche_societes_cache enable row level security;
revoke all on public.recherche_societes_cache from public, anon, authenticated;

create table if not exists public.recherche_societes_budget (
  jour   date primary key,
  appels integer not null check (appels >= 0)
);
alter table public.recherche_societes_budget enable row level security;
revoke all on public.recherche_societes_budget from public, anon, authenticated;

-- Réserve UN appel si le plafond du jour n'est pas atteint. Sûr en concurrence :
-- la mise à jour conditionnelle prend le verrou de ligne.
create or replace function public.recherche_reserver_budget(p_plafond integer, p_jour date default current_date)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.recherche_societes_budget as b (jour, appels)
    select p_jour, 1 where p_plafond > 0
    on conflict (jour) do update set appels = b.appels + 1 where b.appels < p_plafond
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.recherche_reserver_budget(integer, date) from public, anon, authenticated;
grant execute on function public.recherche_reserver_budget(integer, date) to service_role;

-- Verrou par requête : vrai si l'entrée est créée, ou reprise parce qu'abandonnée
-- (en_cours depuis plus de 30 s) ou expirée (prête depuis plus de 24 h).
create or replace function public.recherche_verrouiller(p_empreinte text, p_snapshot text)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.recherche_societes_cache as c (empreinte, snapshot_id, etat, cree_le)
    values (p_empreinte, p_snapshot, 'en_cours', now())
    on conflict (empreinte, snapshot_id) do update
      set etat = 'en_cours', resultat = null, pertinence_globale = null, cree_le = now()
      where (c.etat = 'en_cours' and c.cree_le < now() - interval '30 seconds')
         or (c.etat = 'prete' and c.cree_le < now() - interval '24 hours')
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.recherche_verrouiller(text, text) from public, anon, authenticated;
grant execute on function public.recherche_verrouiller(text, text) to service_role;

-- Interrupteur et éligibilité, pilotables depuis /admin/features.
insert into public.feature_flags (code, label, acces, description) values
  ('recherche_ia', 'Recherche IA des sociétés', 'free',
   'Classement des sociétés par Jev (TypeSafe). Coût par appel : quota horaire par compte et plafond global journalier dans la route.')
on conflict (code) do nothing;

-- Rétention : cache 24 h, budget 30 jours (reprise de 0184 + deux lignes).
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
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

<!-- fichier: frontend/scripts/verif-budget-recherche.mjs -->
```js
// Preuve de concurrence du budget : 20 réservations SIMULTANÉES, plafond 5,
// sur un jour fictif (1900-01-01) supprimé ensuite. Attendu : exactement 5.
// Lit .env.local sans jamais afficher de clé.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'User-Agent': 'westbourse-verif-budget' } },
});
const JOUR = '1900-01-01';
await db.from('recherche_societes_budget').delete().eq('jour', JOUR);
const reponses = await Promise.all(
  Array.from({ length: 20 }, () => db.rpc('recherche_reserver_budget', { p_plafond: 5, p_jour: JOUR })),
);
const erreurs = reponses.filter((r) => r.error).length;
const accordees = reponses.filter((r) => r.data === true).length;
const { data: ligne } = await db.from('recherche_societes_budget').select('appels').eq('jour', JOUR).maybeSingle();
await db.from('recherche_societes_budget').delete().eq('jour', JOUR);
console.log(`réservations accordées : ${accordees}/20, erreurs : ${erreurs}, compteur : ${ligne?.appels ?? 'absent'}`);
process.exit(accordees === 5 && erreurs === 0 && ligne?.appels === 5 ? 0 : 1);
```

- [ ] **Step 1:** Vérifier que la production a la définition de 0184 : `pg_get_functiondef('public.purge_rgpd_retention()'::regprocedure)` doit contenir les 14 `delete` repris ci-dessus ; sinon reprendre la version de production et y ajouter les deux lignes.
- [ ] **Step 2:** Appliquer : `supabase db query --linked -f supabase/migrations/0191_recherche_societes.sql`.
- [ ] **Step 3:** `cd frontend && node scripts/verif-budget-recherche.mjs` → `réservations accordées : 5/20, erreurs : 0, compteur : 5`, sortie 0.
- [ ] **Step 4:** Clé publique (sans l'afficher) : tables illisibles, RPC refusée ; avis de sécurité : aucun nouveau.
- [ ] **Step 5:** Commit `feat(recherche): migration 0191 — cache, verrou et budget atomiques`.

### Task 7 : univers d'actions partagé et chargeur des faits

**Files:** Create `frontend/lib/universActions.ts`, `frontend/lib/recherche/donnees.ts`, `frontend/lib/server/rechercheDonnees.ts`; Modify `frontend/app/simulateur-budget/page.tsx`

<!-- fichier: frontend/lib/universActions.ts -->
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeYield } from '@/lib/dividends';
import type { SimAction } from '@/lib/budgetSimulator';

/** Action de l'univers : ce que lit le simulateur, plus pays et famille comptable. */
export interface ActionUnivers extends SimAction {
  pays: string | null;
  famille: string | null;
}

/**
 * Univers d'actions réel : cours du jour, rendement du dividende (dernier
 * exercice / cours) et performance 12 mois (cours d'une séance à 1 an ± 12 j).
 * Toute métrique manquante reste `null` — jamais inventée. Partagé par le
 * simulateur de budget et la recherche des sociétés : un seul calcul.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerUniversActions(supabase: SupabaseClient<any, any, any>): Promise<{ univers: ActionUnivers[]; dateSeance: string | null }> {
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = (lastRow?.[0]?.date_marche as string | undefined) ?? null;
  if (!lastDate) return { univers: [], dateSeance: null };

  const target = new Date(lastDate);
  target.setFullYear(target.getFullYear() - 1);
  const winFrom = new Date(target);
  winFrom.setDate(winFrom.getDate() - 12);
  const winTo = new Date(target);
  winTo.setDate(winTo.getDate() + 12);
  const iso = (d: Date) => d.toISOString().split('T')[0]!;

  const [{ data: instruments }, { data: lastQuotes }, { data: yearAgoQuotes }, { data: divData }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation, secteur, pays, famille_comptable').eq('type', 'action').eq('actif', true).order('code'),
    supabase.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate),
    supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, date_marche')
      .gte('date_marche', iso(winFrom))
      .lte('date_marche', iso(winTo))
      .order('date_marche', { ascending: true }),
    supabase.from('dividends').select('code, exercice, montant, base_fiscale').order('exercice', { ascending: false }).limit(500),
  ]);

  const coursByCode = new Map<string, number>();
  for (const q of lastQuotes ?? []) {
    if (q.cours_jour != null && q.cours_jour > 0) coursByCode.set(q.code as string, q.cours_jour as number);
  }

  const targetTime = target.getTime();
  const yearAgoByCode = new Map<string, { close: number; dist: number }>();
  for (const q of yearAgoQuotes ?? []) {
    if (q.cours_jour == null || q.cours_jour <= 0) continue;
    const dist = Math.abs(new Date(q.date_marche as string).getTime() - targetTime);
    const prev = yearAgoByCode.get(q.code as string);
    if (!prev || dist < prev.dist) yearAgoByCode.set(q.code as string, { close: q.cours_jour as number, dist });
  }

  // Dividende du dernier exercice (somme) ; `toutNet` : chaque montant est déjà net d'IRVM.
  const divByCode = new Map<string, { exercice: number; total: number; toutNet: boolean }>();
  for (const d of divData ?? []) {
    if (d.exercice == null || d.montant == null) continue;
    const code = d.code as string;
    const ex = d.exercice as number;
    const net = d.base_fiscale === 'net';
    const cur = divByCode.get(code);
    if (!cur || ex > cur.exercice) divByCode.set(code, { exercice: ex, total: d.montant as number, toutNet: net });
    else if (ex === cur.exercice) {
      cur.total += d.montant as number;
      cur.toutNet = cur.toutNet && net;
    }
  }

  const univers: ActionUnivers[] = [];
  for (const i of instruments ?? []) {
    const code = i.code as string;
    const prix = coursByCode.get(code);
    if (prix == null) continue; // pas de cours → action écartée
    const div = divByCode.get(code);
    const yearAgo = yearAgoByCode.get(code);
    univers.push({
      code,
      designation: (i.designation as string) ?? code,
      secteur: (i.secteur as string | null) ?? null,
      pays: (i.pays as string | null) ?? null,
      famille: (i.famille_comptable as string | null) ?? null,
      prix,
      rendement: div ? computeYield(div.total, prix) : null,
      rendementDejaNet: div?.toutNet ?? false,
      perf12: yearAgo ? ((prix - yearAgo.close) / yearAgo.close) * 100 : null,
    });
  }
  return { univers, dateSeance: lastDate };
}
```

<!-- fichier: frontend/lib/recherche/donnees.ts -->
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { chargerUniversActions } from '@/lib/universActions';
import type { DonneesSociete } from './instantane';

/** Faits par société, depuis la base ; null si aucune séance n'est connue. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerDonneesRecherche(supabase: SupabaseClient<any, any, any>): Promise<{ donnees: DonneesSociete[]; dateSeance: string } | null> {
  const [{ univers, dateSeance }, liquidite] = await Promise.all([
    chargerUniversActions(supabase),
    supabase
      .from('liquidity_daily')
      .select('code, classe, date_marche')
      .not('classe', 'is', null)
      .order('date_marche', { ascending: false })
      .limit(400),
  ]);
  if (!dateSeance || univers.length === 0) return null;

  // Dernière classe connue par code (lignes triées de la plus récente à la plus ancienne).
  const classe = new Map<string, DonneesSociete['liquidite']>();
  for (const r of liquidite.data ?? []) {
    const code = r.code as string;
    if (!classe.has(code)) classe.set(code, r.classe as DonneesSociete['liquidite']);
  }

  return {
    dateSeance,
    donnees: univers.map((a) => ({
      code: a.code,
      nom: a.designation,
      secteur: a.secteur,
      activite: a.famille === 'banque' || a.famille === 'assurance' ? a.famille : null,
      pays: a.pays,
      rendement: a.rendement != null ? { valeur: a.rendement, base: a.rendementDejaNet ? ('net' as const) : ('non_precisee' as const) } : null,
      liquidite: classe.get(a.code) ?? null,
      perf12m: a.perf12,
    })),
  };
}
```

<!-- fichier: frontend/lib/server/rechercheDonnees.ts -->
```ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesRecherche } from '@/lib/recherche/donnees';
import { construireInstantane } from '@/lib/recherche/instantane';
import type { Instantane } from '@/lib/recherche/types';

/**
 * Instantané des faits, recalculé au plus une fois par heure. Une absence de
 * données LÈVE (jamais mise en cache) : la route se replie, puis réessaie.
 */
export const chargerInstantane = unstable_cache(
  async (): Promise<Instantane> => {
    const r = await chargerDonneesRecherche(createPublicClient());
    if (!r) throw new Error('donnees_indisponibles');
    return construireInstantane(r.donnees, r.dateSeance);
  },
  ['recherche-societes-instantane-v1'],
  { revalidate: 3600 },
);
```

- [ ] **Step 1:** Extraire les trois fichiers.
- [ ] **Step 2:** Dans `frontend/app/simulateur-budget/page.tsx` : supprimer `getUnivers` (et son commentaire) et l'import de `computeYield` ; importer `{ chargerUniversActions }` depuis `@/lib/universActions` ; remplacer `const { univers, asOf } = await getUnivers();` par `const { univers, dateSeance } = await chargerUniversActions(createPublicClient());` suivi de `const asOf = dateSeance ? fmtDateFR(dateSeance) : null;`.
- [ ] **Step 3:** tsc → 0. **Step 4:** commit `refactor(univers): calcul cours/rendement/perf partagé ; chargeur des faits de la recherche`.

### Task 8 : stockage Supabase, garde de fonctionnalité, route

**Files:** Create `frontend/lib/server/rechercheSocietesStore.ts`, `frontend/app/api/recherche-societes/route.ts`; Modify `frontend/lib/server/featureGate.ts`

<!-- fichier: frontend/lib/server/rechercheSocietesStore.ts -->
```ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { EntreeCache, StockageRecherche } from '@/lib/recherche/orchestrer';
import type { CleCache, ResultatJevValide } from '@/lib/recherche/types';

const DUREE_CACHE_MS = 24 * 3600 * 1000;

/** Cache, verrou et budget de la recherche : service_role seul (RLS sans policy). */
export function stockageSupabase(): StockageRecherche {
  const db = getServiceClient();
  const table = () => db.from('recherche_societes_cache');

  return {
    async lire(cle: CleCache): Promise<EntreeCache | null> {
      const { data, error } = await table()
        .select('etat, resultat, cree_le')
        .eq('empreinte', cle.empreinte)
        .eq('snapshot_id', cle.snapshotId)
        .maybeSingle();
      if (error) throw new Error('cache_lecture');
      if (!data) return null;
      if (data.etat === 'prete' && Date.now() - new Date(data.cree_le as string).getTime() > DUREE_CACHE_MS) return null;
      return { etat: data.etat as EntreeCache['etat'], resultat: (data.resultat as ResultatJevValide | null) ?? null };
    },
    async verrouiller(cle) {
      const { data, error } = await db.rpc('recherche_verrouiller', { p_empreinte: cle.empreinte, p_snapshot: cle.snapshotId });
      if (error) throw new Error('cache_verrou');
      return data === true;
    },
    async ecrire(cle, resultat) {
      const { error } = await table()
        .update({ etat: 'prete', resultat, pertinence_globale: resultat.pertinenceGlobale, cree_le: new Date().toISOString() })
        .eq('empreinte', cle.empreinte)
        .eq('snapshot_id', cle.snapshotId);
      if (error) throw new Error('cache_ecriture');
      // Minimisation : purge des entrées expirées à chaque écriture.
      await table().delete().lt('cree_le', new Date(Date.now() - DUREE_CACHE_MS).toISOString());
    },
    async liberer(cle) {
      await table().delete().eq('empreinte', cle.empreinte).eq('snapshot_id', cle.snapshotId).eq('etat', 'en_cours');
    },
  };
}

/** Réservation atomique d'un appel Jev dans le plafond du jour. */
export async function reserverBudgetRecherche(plafond: number): Promise<'ok' | 'refuse' | 'erreur'> {
  const { data, error } = await getServiceClient().rpc('recherche_reserver_budget', { p_plafond: plafond });
  if (error) return 'erreur';
  return data === true ? 'ok' : 'refuse';
}
```

<!-- fichier: frontend/app/api/recherche-societes/route.ts -->
```ts
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { chargerInstantane } from '@/lib/server/rechercheDonnees';
import { reserverBudgetRecherche, stockageSupabase } from '@/lib/server/rechercheSocietesStore';
import { classerParJev } from '@/lib/recherche/jev';
import { hacherIdentifiant, validerRequete } from '@/lib/recherche/normaliser';
import { rechercher, type DepsRecherche } from '@/lib/recherche/orchestrer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUOTA_HEURE = 20;
const plafondJour = () => {
  const n = Number(process.env.RECHERCHE_JEV_PLAFOND_JOUR ?? 300);
  return Number.isInteger(n) && n >= 0 ? n : 300;
};

/** POST { q } → ReponseRecherche. Le texte de la requête n'est jamais journalisé. */
export async function POST(req: NextRequest) {
  let corps: unknown = null;
  try {
    corps = await req.json();
  } catch {
    corps = null;
  }
  const v = validerRequete((corps as { q?: unknown } | null)?.q);
  if (!v.ok) return Response.json({ erreur: v.erreur }, { status: 400 });

  const supabase = createClient();
  const deps: DepsRecherche = {
    instantane: () => chargerInstantane(),
    utilisateur: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? { id: user.id, email: user.email ?? null } : null;
    },
    eligible: async (u) => {
      const { data: profil } = await supabase.from('profiles').select('is_premium').eq('id', u.id).maybeSingle();
      const gate = await checkFeature('recherche_ia', { id: u.id, email: u.email, isPremium: Boolean(profil?.is_premium) }, { consume: false });
      return gate.allowed;
    },
    quota: async (u) =>
      (await checkRateLimit({ route: 'recherche-societes', ip: hacherIdentifiant(u.id), maxHits: QUOTA_HEURE, windowSeconds: 3600 })).allowed,
    stockage: stockageSupabase(),
    reserverBudget: () => reserverBudgetRecherche(plafondJour()),
    jev: (q, instantane, signal) => classerParJev(q, instantane.fiches, signal),
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    journal: (evenement, details) => console.warn('[recherche-societes]', evenement, details ?? {}),
  };

  try {
    return Response.json(await rechercher(v.q, deps));
  } catch {
    console.error('[recherche-societes] erreur_interne');
    return Response.json({ erreur: 'interne' }, { status: 500 });
  }
}
```

- [ ] **Step 1:** Extraire les deux fichiers ; dans `featureGate.ts`, ajouter `| 'recherche_ia'` à `FeatureCode` (après `'whatsapp_agent'`).
- [ ] **Step 2:** tsc → 0. **Step 3:** commit `feat(recherche): stockage Supabase, éligibilité et route POST`.

### Task 9 : interface et intégration à /societes

**Files:** Create `frontend/components/societes/RechercheSocietes.tsx`; Modify `frontend/app/societes/page.tsx`

<!-- fichier: frontend/components/societes/RechercheSocietes.tsx -->
```tsx
'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import type { RaisonRepli, ReponseRecherche } from '@/lib/recherche/types';
import { Sequenceur } from '@/lib/recherche/sequenceur';

const EXEMPLES = [
  'une banque qui verse un dividende',
  'une valeur liquide des télécoms',
  'société sénégalaise en hausse sur un an',
  'industriel hors Côte d’Ivoire',
];

const RAISONS: Record<RaisonRepli, string> = {
  non_connecte: 'Recherche simple. Connectez-vous pour la recherche intelligente.',
  offre_non_eligible: 'Recherche simple : la recherche intelligente n’est pas incluse dans votre offre.',
  quota_atteint: 'Recherche simple : limite horaire de recherches intelligentes atteinte.',
  plafond_atteint: 'Recherche simple : la recherche intelligente est momentanément indisponible.',
  compteur_indisponible: 'Recherche simple : la recherche intelligente est momentanément indisponible.',
  jev_indisponible: 'Recherche simple : la recherche intelligente n’a pas répondu à temps.',
  donnees_indisponibles: 'Les données des sociétés sont momentanément indisponibles.',
};

const ERREURS: Record<string, string> = {
  longueur: 'Décrivez votre recherche en 3 à 150 caractères.',
  donnee_personnelle: 'Retirez les adresses e-mail et numéros de téléphone : ils ne sont jamais envoyés.',
  interne: 'La recherche a échoué. Réessayez dans un instant.',
};

const dateFr = (iso: string) => iso.split('-').reverse().join('/');

export function RechercheSocietes() {
  const [q, setQ] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<ReponseRecherche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const sequence = useRef(new Sequenceur());
  const requete = useRef<AbortController | null>(null);

  async function lancer(texte: string) {
    const t = texte.trim();
    if (t.length < 3) {
      setErreur(ERREURS.longueur!);
      return;
    }
    requete.current?.abort();
    const ctrl = new AbortController();
    requete.current = ctrl;
    const id = sequence.current.suivante();
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch('/api/recherche-societes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: t }),
        signal: ctrl.signal,
      });
      const corps = (await r.json()) as ReponseRecherche & { erreur?: string };
      if (!sequence.current.estCourante(id)) return; // une recherche plus récente a été lancée
      if (!r.ok) {
        setReponse(null);
        setErreur(ERREURS[corps.erreur ?? 'interne'] ?? ERREURS.interne!);
      } else {
        setReponse(corps);
      }
    } catch (e) {
      if (sequence.current.estCourante(id) && !(e instanceof DOMException && e.name === 'AbortError')) setErreur(ERREURS.interne!);
    } finally {
      if (sequence.current.estCourante(id)) setEnCours(false);
    }
  }

  return (
    <section aria-labelledby="titre-recherche" className="mb-8 rounded-panel border border-border bg-surface p-5 md:p-6">
      <h2 id="titre-recherche" className="flex items-center gap-2 font-display text-lg text-ivory">
        <Sparkles size={18} aria-hidden className="text-accent" /> Décrivez la société que vous cherchez
      </h2>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void lancer(q);
        }}
      >
        <label className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
          <Search size={17} aria-hidden className="flex-none text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={150}
            placeholder="ex. une banque qui verse un dividende"
            aria-label="Décrivez la société que vous cherchez"
            className="w-full bg-transparent py-2.5 text-[15px] text-ivory outline-none placeholder:text-faint"
          />
        </label>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-95 disabled:opacity-60"
        >
          {enCours ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXEMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              void lancer(ex);
            }}
            className="min-h-[36px] rounded-full border border-border px-3 text-[12.5px] text-muted transition-colors hover:border-accent/40 hover:text-ivory"
          >
            {ex}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4">
        {erreur && <p className="text-sm text-warn">{erreur}</p>}
        {reponse && (
          <>
            {reponse.raison && (
              <p className="mb-3 text-[13px] text-muted">
                {RAISONS[reponse.raison]}{' '}
                {reponse.raison === 'non_connecte' && (
                  <Link href="/login?next=/societes" className="font-semibold text-accent hover:underline">
                    Se connecter
                  </Link>
                )}
              </p>
            )}
            {reponse.statut === 'aucune' ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                Aucune société ne correspond clairement à cette recherche.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {reponse.resultats.map((r) => (
                  <li key={r.code} className="rounded-xl border border-border bg-bg/40 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/societes/${r.code}`} className="font-medium text-ivory hover:text-accent">
                        {r.nom} <span className="tabular text-[12px] text-faint">{r.code}</span>
                      </Link>
                      <span className="flex items-center gap-2" title="Pertinence estimée">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-border" aria-hidden>
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(r.score * 100)}%` }} />
                        </span>
                        <span className="tabular text-[12px] text-muted">{Math.round(r.score * 100)} %</span>
                      </span>
                    </div>
                    {r.faits.length > 0 && (
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{r.faits.map((f) => `${f.libelle} : ${f.valeur}`).join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-[11px] text-faint">
              Classement par pertinence{reponse.mode === 'jev' ? ' (Jev, TypeSafe)' : ''}, pas une recommandation d’investissement.
              {reponse.actualiseLe ? ` Données de la séance du ${dateFr(reponse.actualiseLe)}.` : ''}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 1:** Extraire le composant ; dans `frontend/app/societes/page.tsx`, importer `{ RechercheSocietes }` et insérer `<RechercheSocietes />` juste après le `</div>` de l'en-tête (`mb-8`), avant `{companies.length === 0 ? (`.
- [ ] **Step 2:** tsc → 0 ; tests verts. **Step 3:** commit `feat(recherche): champ de recherche sur /societes`.

### Task 10 : RGPD

**Files:** Modify `frontend/app/confidentialite/page.tsx`, `docs/RGPD.md`

- [ ] **Step 1:** `/confidentialite`, liste « Destinataires et sous-traitants », après les fournisseurs d'IA :

```tsx
          <li>
            <strong>TypeSafe (Jev)</strong> — classement des sociétés pour la recherche en langage naturel
            réservée aux comptes connectés. Seul le texte de votre recherche lui est transmis, sans votre
            identité ; nous ne conservons qu&apos;une empreinte de la recherche, 24 heures, sans lien avec
            votre compte.
          </li>
```

- [ ] **Step 2:** `docs/RGPD.md`, inventaire : « Recherche des sociétés (Jev) — données : texte de recherche (non conservé ; empreinte SHA-256, 24 h) ; identifiant de compte haché dans `rate_limit_hits` (fenêtre d'une heure) ; finalité : classer les sociétés ; base légale : exécution du service ; sous-traitant : TypeSafe ; RLS sans policy ; purge `purge_rgpd_retention()`. »
- [ ] **Step 3:** Commit `docs(rgpd): TypeSafe sous-traitant de la recherche des sociétés`.

### Task 11 : évaluation figée (Jev contre repli)

**Files:** Create `frontend/lib/recherche/evaluation/jeu.ts`, `frontend/lib/recherche/evaluation/recherche.eval.ts`, `frontend/vitest.eval.config.ts`; Modify `frontend/package.json`

<!-- fichier: frontend/lib/recherche/evaluation/jeu.ts -->
```ts
import { normaliser } from '../normaliser';
import type { DonneesSociete } from '../instantane';

/** Contraintes VÉRIFIABLES sur les faits en base : la vérité découle de l'instantané. */
export type Contrainte =
  | { champ: 'activite' | 'secteur' | 'pays'; egal: string }
  | { champ: 'activite' | 'secteur' | 'pays'; different: string }
  | { champ: 'rendement' | 'liquidite' | 'perf12m'; present: true }
  | { champ: 'rendement'; min: number }
  | { champ: 'perf12m'; min?: number; max?: number }
  | { champ: 'liquidite'; auMoins: 'A' | 'B' | 'C' };

export type Categorie = 'courante' | 'synonyme' | 'multiple' | 'negation' | 'aucune' | 'manquante' | 'impossible';

export interface CasEval {
  id: string;
  q: string;
  categorie: Categorie;
  contraintes: Contrainte[];
  /** Explicite pour les cas sans contrainte ; sinon déduit (aucune société ne satisfait). */
  aucuneAttendue?: boolean;
}

const champ = (c: 'activite' | 'secteur' | 'pays', d: DonneesSociete) => normaliser(d[c] ?? '');

function verifier(c: Contrainte, d: DonneesSociete): boolean {
  if ('egal' in c) return champ(c.champ, d) === normaliser(c.egal);
  if ('different' in c) return champ(c.champ, d) !== normaliser(c.different);
  if ('present' in c) return c.champ === 'rendement' ? d.rendement != null : c.champ === 'liquidite' ? d.liquidite != null : d.perf12m != null;
  if ('auMoins' in c) return d.liquidite != null && 'ABCD'.indexOf(d.liquidite) <= 'ABCD'.indexOf(c.auMoins);
  if (c.champ === 'rendement') return d.rendement != null && d.rendement.valeur >= (c as { min: number }).min;
  const p = c as { min?: number; max?: number };
  return d.perf12m != null && (p.min == null || d.perf12m >= p.min) && (p.max == null || d.perf12m <= p.max);
}

export const satisfait = (cas: CasEval, d: DonneesSociete) => cas.contraintes.every((c) => verifier(c, d));

const BANQUE = { champ: 'activite', egal: 'banque' } as const;
const ASSURANCE = { champ: 'activite', egal: 'assurance' } as const;
const DIVIDENDE = { champ: 'rendement', present: true } as const;
const LIQUIDE = { champ: 'liquidite', auMoins: 'B' } as const;
const secteur = (s: string) => ({ champ: 'secteur', egal: s }) as const;
const pays = (p: string) => ({ champ: 'pays', egal: p }) as const;

export const JEU: CasEval[] = [
  { id: 'c01', categorie: 'courante', q: 'une banque', contraintes: [BANQUE] },
  { id: 'c02', categorie: 'courante', q: 'une compagnie d’assurance', contraintes: [ASSURANCE] },
  { id: 'c03', categorie: 'courante', q: 'société de télécommunications', contraintes: [secteur('Télécommunications')] },
  { id: 'c04', categorie: 'courante', q: 'entreprise du secteur de l’énergie', contraintes: [secteur('Énergie')] },
  { id: 'c05', categorie: 'courante', q: 'valeur industrielle', contraintes: [secteur('Industriels')] },
  { id: 'c06', categorie: 'courante', q: 'société sénégalaise', contraintes: [pays('SN')] },
  { id: 'c07', categorie: 'courante', q: 'action ivoirienne', contraintes: [pays('CI')] },
  { id: 'c08', categorie: 'courante', q: 'société qui verse un dividende', contraintes: [DIVIDENDE] },
  { id: 'c09', categorie: 'courante', q: 'action très liquide', contraintes: [{ champ: 'liquidite', auMoins: 'A' }] },
  { id: 'c10', categorie: 'courante', q: 'action en hausse sur un an', contraintes: [{ champ: 'perf12m', min: 0 }] },
  { id: 's01', categorie: 'synonyme', q: 'opérateur téléphonique', contraintes: [secteur('Télécommunications')] },
  { id: 's02', categorie: 'synonyme', q: 'établissement bancaire', contraintes: [BANQUE] },
  { id: 's03', categorie: 'synonyme', q: 'un assureur', contraintes: [ASSURANCE] },
  { id: 's04', categorie: 'synonyme', q: 'société pétrolière', contraintes: [secteur('Énergie')] },
  { id: 's05', categorie: 'synonyme', q: 'agroalimentaire', contraintes: [secteur('Consommation de base')] },
  { id: 's06', categorie: 'synonyme', q: 'distribution d’eau et d’électricité', contraintes: [secteur('Services publics')] },
  { id: 's07', categorie: 'synonyme', q: 'titre facile à acheter et à revendre', contraintes: [LIQUIDE] },
  { id: 's08', categorie: 'synonyme', q: 'rendement du dividende élevé', contraintes: [{ champ: 'rendement', min: 6 }] },
  { id: 'm01', categorie: 'multiple', q: 'banque ivoirienne', contraintes: [BANQUE, pays('CI')] },
  { id: 'm02', categorie: 'multiple', q: 'banque sénégalaise', contraintes: [BANQUE, pays('SN')] },
  { id: 'm03', categorie: 'multiple', q: 'une banque qui verse un dividende', contraintes: [BANQUE, DIVIDENDE] },
  { id: 'm04', categorie: 'multiple', q: 'télécom avec un bon dividende', contraintes: [secteur('Télécommunications'), { champ: 'rendement', min: 5 }] },
  { id: 'm05', categorie: 'multiple', q: 'action liquide qui distribue un dividende', contraintes: [LIQUIDE, DIVIDENDE] },
  { id: 'm06', categorie: 'multiple', q: 'société burkinabè', contraintes: [pays('BF')] },
  { id: 'm07', categorie: 'multiple', q: 'société togolaise', contraintes: [pays('TG')] },
  { id: 'm08', categorie: 'multiple', q: 'banque en hausse sur 12 mois', contraintes: [BANQUE, { champ: 'perf12m', min: 0 }] },
  { id: 'm09', categorie: 'multiple', q: 'industriel ivoirien', contraintes: [secteur('Industriels'), pays('CI')] },
  { id: 'm10', categorie: 'multiple', q: 'valeur liquide en baisse sur un an', contraintes: [LIQUIDE, { champ: 'perf12m', max: 0 }] },
  { id: 'm11', categorie: 'multiple', q: 'assurance ivoirienne', contraintes: [ASSURANCE, pays('CI')] },
  { id: 'm12', categorie: 'multiple', q: 'énergie avec dividende', contraintes: [secteur('Énergie'), DIVIDENDE] },
  { id: 'n01', categorie: 'negation', q: 'société ivoirienne hors banques', contraintes: [pays('CI'), { champ: 'activite', different: 'banque' }] },
  { id: 'n02', categorie: 'negation', q: 'dividende mais pas une banque', contraintes: [DIVIDENDE, { champ: 'activite', different: 'banque' }] },
  { id: 'n03', categorie: 'negation', q: 'action liquide sans les télécoms', contraintes: [LIQUIDE, { champ: 'secteur', different: 'Télécommunications' }] },
  { id: 'n04', categorie: 'negation', q: 'entreprise non ivoirienne', contraintes: [{ champ: 'pays', different: 'CI' }] },
  { id: 'n05', categorie: 'negation', q: 'services financiers sauf assurances', contraintes: [secteur('Services financiers'), { champ: 'activite', different: 'assurance' }] },
  { id: 'n06', categorie: 'negation', q: 'valeur industrielle hors Côte d’Ivoire', contraintes: [secteur('Industriels'), { champ: 'pays', different: 'CI' }] },
  { id: 'a01', categorie: 'aucune', q: 'société minière au Ghana', contraintes: [], aucuneAttendue: true },
  { id: 'a02', categorie: 'aucune', q: 'cryptomonnaie', contraintes: [], aucuneAttendue: true },
  { id: 'a03', categorie: 'aucune', q: 'compagnie aérienne', contraintes: [], aucuneAttendue: true },
  { id: 'a04', categorie: 'aucune', q: 'banque au Nigeria', contraintes: [], aucuneAttendue: true },
  { id: 'a05', categorie: 'aucune', q: 'éditeur de jeux vidéo', contraintes: [], aucuneAttendue: true },
  { id: 'a06', categorie: 'aucune', q: 'action cotée à Paris', contraintes: [], aucuneAttendue: true },
  { id: 'd01', categorie: 'manquante', q: 'rendement supérieur à 25 %', contraintes: [{ champ: 'rendement', min: 25 }] },
  { id: 'd02', categorie: 'manquante', q: 'performance de plus de 200 % sur un an', contraintes: [{ champ: 'perf12m', min: 200 }] },
  { id: 'd03', categorie: 'manquante', q: 'banque nigérienne', contraintes: [BANQUE, pays('NE')] },
  { id: 'd04', categorie: 'manquante', q: 'assurance malienne', contraintes: [ASSURANCE, pays('ML')] },
  { id: 'i01', categorie: 'impossible', q: 'action garantie sans risque', contraintes: [], aucuneAttendue: true },
  { id: 'i02', categorie: 'impossible', q: 'quelle action va doubler demain', contraintes: [], aucuneAttendue: true },
  { id: 'i03', categorie: 'impossible', q: 'la meilleure action à acheter maintenant', contraintes: [], aucuneAttendue: true },
  { id: 'i04', categorie: 'impossible', q: 'où placer mon salaire', contraintes: [], aucuneAttendue: true },
];
```

<!-- fichier: frontend/lib/recherche/evaluation/recherche.eval.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { chargerDonneesRecherche } from '../donnees';
import { construireInstantane, type DonneesSociete } from '../instantane';
import { rechercheMotsCles } from '../motsCles';
import { classerParJev } from '../jev';
import { validerReponseJev } from '../validerJev';
import { resultatsJev } from '../decision';
import { VERSION_DICTIONNAIRE } from '../dictionnaire';
import { JEU, satisfait } from './jeu';
import type { ResultatRecherche, StatutRecherche } from '../types';

interface Mesures {
  p3: number[];
  respect: { ok: number; total: number };
  aucune: { ok: number; total: number };
  inventes: number;
  echecs: number;
}
type Sortie = { statut: StatutRecherche; resultats: ResultatRecherche[] };
const vides = (): Mesures => ({ p3: [], respect: { ok: 0, total: 0 }, aucune: { ok: 0, total: 0 }, inventes: 0, echecs: 0 });
const taux = (x: { ok: number; total: number }) => (x.total ? x.ok / x.total : 1);
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

describe('évaluation de la recherche (manuelle — appels payants)', () => {
  it(
    'Jev contre le repli, sur le jeu figé',
    async () => {
      const r = await chargerDonneesRecherche(
        createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }),
      );
      expect(r).not.toBeNull();
      const inst = construireInstantane(r!.donnees, r!.dateSeance);
      const parCode = new Map<string, DonneesSociete>(r!.donnees.map((d) => [d.code, d]));
      const faitsConnus = new Map(inst.fiches.map((f) => [f.code, new Set(f.faits.map((x) => `${x.cle}|${x.valeur}`))]));
      const m = { jev: vides(), repli: vides() };

      const noter = (mes: Mesures, i: number, sortie: Sortie) => {
        const cas = JEU[i]!;
        const satisfiables = r!.donnees.filter((d) => satisfait(cas, d)).length;
        const aucuneAttendue = cas.aucuneAttendue ?? (cas.contraintes.length > 0 && satisfiables === 0);
        for (const res of sortie.resultats) for (const f of res.faits) if (!faitsConnus.get(res.code)?.has(`${f.cle}|${f.valeur}`)) mes.inventes += 1;
        if (aucuneAttendue) {
          mes.aucune.total += 1;
          if (sortie.statut === 'aucune') mes.aucune.ok += 1;
          return;
        }
        const ok = (res: ResultatRecherche) => satisfait(cas, parCode.get(res.code)!);
        const denom = Math.min(3, satisfiables);
        mes.p3.push(denom ? sortie.resultats.slice(0, 3).filter(ok).length / denom : 0);
        mes.respect.total += sortie.resultats.length;
        mes.respect.ok += sortie.resultats.filter(ok).length;
      };

      for (let i = 0; i < JEU.length; i += 1) {
        const cas = JEU[i]!;
        noter(m.repli, i, rechercheMotsCles(cas.q, inst.fiches));
        let sortieJev: Sortie = { statut: 'aucune', resultats: [] };
        try {
          const v = validerReponseJev(await classerParJev(cas.q, inst.fiches, AbortSignal.timeout(20_000)), inst.fiches.map((f) => f.code));
          if (v) sortieJev = resultatsJev(v, inst.fiches);
          else m.jev.echecs += 1;
        } catch {
          m.jev.echecs += 1;
        }
        noter(m.jev, i, sortieJev);
      }

      const ligne = (x: Mesures) => ({
        'précision top 3': moyenne(x.p3).toFixed(3),
        'respect des contraintes': taux(x.respect).toFixed(3),
        'absence juste': taux(x.aucune).toFixed(3),
        'faits inventés': x.inventes,
        'échecs fournisseur': x.echecs,
      });
      console.log(`Instantané ${inst.snapshotId} · dictionnaire ${VERSION_DICTIONNAIRE} · ${JEU.length} recherches`);
      console.table({ Jev: ligne(m.jev), Repli: ligne(m.repli) });
      const lancement =
        moyenne(m.jev.p3) > moyenne(m.repli.p3) &&
        taux(m.jev.respect) > taux(m.repli.respect) &&
        taux(m.jev.aucune) >= taux(m.repli.aucune) &&
        m.jev.inventes === 0;
      console.log(`Règle de lancement : ${lancement ? 'SATISFAITE — Jev bat le repli' : 'NON SATISFAITE — garder le repli'}`);

      expect(m.jev.inventes).toBe(0);
      expect(m.repli.inventes).toBe(0);
    },
    900_000,
  );
});
```

<!-- fichier: frontend/vitest.eval.config.ts -->
```ts
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Évaluation MANUELLE de la recherche (appels Jev payants) : jamais en CI.
export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['lib/recherche/evaluation/**/*.eval.ts'],
    env: loadEnv(mode, process.cwd(), ''),
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  esbuild: { jsx: 'automatic' },
}));
```

- [ ] **Step 1:** Extraire les trois fichiers ; script `"eval:recherche": "vitest run --config vitest.eval.config.ts"` dans `frontend/package.json`.
- [ ] **Step 2:** tsc → 0. **Step 3:** commit `test(recherche): jeu d'évaluation figé (50 recherches) et règle de lancement`.
- [ ] **Step 4 (manuel) :** `cd frontend && npm run eval:recherche` ; consigner le tableau dans la PR. Règle non satisfaite ⇒ `recherche_ia` en `disabled` (repli seul) et corriger.

### Task 12 : vérification finale et PR

- [ ] `cd frontend && npx vitest run lib/recherche tests` → vert ; tsc → 0.
- [ ] Push, PR « feat(recherche): recherche en langage naturel parmi les sociétés (Jev) » : résumé, écarts, preuves (tests, concurrence, RLS, évaluation), prérequis `TYPESAFE_API_KEY` sur Vercel. **Pas de fusion sans « fusionne ».**
