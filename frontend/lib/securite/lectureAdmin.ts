import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { fetchAllRowsOuErreur } from '@/lib/supabase/paginate';
import { lireReglages, lireSessionsVivantes, type Reglages } from './serveur';
import { regrouperAppareils, type AppareilConnecte } from './appareils';
import { suspensionActive } from './decisions';
import type { Raison } from './signaux';

/**
 * Lectures de la console /admin/securite (service_role). Elles LÈVENT : une
 * table illisible s'affiche comme telle, jamais comme « aucun compte suspect ».
 */

export type TypeDecision = 'legitime' | 'deconnexion' | 'avertissement' | 'suspension' | 'levee';

export interface LigneSignal {
  userId: string;
  email: string | null;
  premium: boolean;
  niveau: 'surveiller' | 'suspect';
  raisons: Raison[];
  derniereDecision: { type: TypeDecision; created_at: string } | null;
  suspendu: boolean;
}

export interface LigneFermeture {
  id: number;
  userId: string;
  email: string | null;
  userAgent: string | null;
  motif: 'plafond' | 'admin' | 'utilisateur';
  simulee: boolean;
  notifie: string | null;
  derniereActivite: string | null;
  created_at: string;
}

export interface TableauSecurite {
  reglages: Reglages;
  jourSignaux: string | null;
  signaux: LigneSignal[];
  fermetures: LigneFermeture[];
  dernierRapport: { jour: string; statut: string; envoye_at: string | null } | null;
  suspensionsActives: number;
}

async function emailsDe(ids: string[]): Promise<Map<string, { email: string | null; premium: boolean }>> {
  const m = new Map<string, { email: string | null; premium: boolean }>();
  if (ids.length === 0) return m;
  const db = getServiceClient();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('profiles').select('id, email, is_premium').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`profils illisibles : ${error.message}`);
    for (const p of (data ?? []) as { id: string; email: string | null; is_premium: boolean | null }[]) {
      m.set(p.id, { email: p.email, premium: Boolean(p.is_premium) });
    }
  }
  return m;
}

export async function chargerTableauSecurite(maintenant: Date = new Date()): Promise<TableauSecurite> {
  const db = getServiceClient();
  const reglages = await lireReglages(db);

  const { data: dernier, error: eJ } = await db.from('securite_signaux').select('jour').order('jour', { ascending: false }).limit(1);
  if (eJ) throw new Error(`signaux illisibles : ${eJ.message}`);
  const jourSignaux = ((dernier ?? []) as { jour: string }[])[0]?.jour ?? null;

  const depuis7 = new Date(maintenant.getTime() - 7 * 86_400_000).toISOString();
  const [signaux, decisions, fermetures, rapports] = await Promise.all([
    jourSignaux
      ? fetchAllRowsOuErreur<{ user_id: string; niveau: 'surveiller' | 'suspect'; raisons: Raison[] }>((f, t) =>
          db.from('securite_signaux').select('user_id, niveau, raisons').eq('jour', jourSignaux).order('user_id').range(f, t))
      : Promise.resolve([]),
    fetchAllRowsOuErreur<{ id: number; user_id: string; type: TypeDecision; jusqu_au: string | null; created_at: string }>((f, t) =>
      db.from('securite_decisions').select('id, user_id, type, jusqu_au, created_at').order('id').range(f, t)),
    fetchAllRowsOuErreur<{ id: number; user_id: string; user_agent: string | null; motif: LigneFermeture['motif']; simulee: boolean; notifie: string | null; derniere_activite: string | null; created_at: string }>((f, t) =>
      db.from('securite_revocations').select('id, user_id, user_agent, motif, simulee, notifie, derniere_activite, created_at').gte('created_at', depuis7).order('id', { ascending: false }).range(f, t)),
    db.from('securite_rapports').select('jour, statut, envoye_at').order('jour', { ascending: false }).limit(1),
  ]);
  if (rapports.error) throw new Error(`rapports illisibles : ${rapports.error.message}`);

  const parCompte = new Map<string, typeof decisions>();
  for (const d of decisions) {
    const l = parCompte.get(d.user_id);
    if (l) l.push(d);
    else parCompte.set(d.user_id, [d]);
  }
  const profils = await emailsDe([...new Set([...signaux.map((s) => s.user_id), ...fermetures.map((f) => f.user_id)])]);

  const ordre = { suspect: 0, surveiller: 1 } as const;
  return {
    reglages,
    jourSignaux,
    signaux: signaux
      .map((s) => {
        const dec = (parCompte.get(s.user_id) ?? []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return {
          userId: s.user_id,
          email: profils.get(s.user_id)?.email ?? null,
          premium: profils.get(s.user_id)?.premium ?? false,
          niveau: s.niveau,
          raisons: s.raisons ?? [],
          derniereDecision: dec[0] ? { type: dec[0].type, created_at: dec[0].created_at } : null,
          suspendu: suspensionActive(dec, maintenant) !== null,
        };
      })
      .sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || b.raisons.length - a.raisons.length),
    fermetures: fermetures.slice(0, 50).map((f) => ({
      id: f.id,
      userId: f.user_id,
      email: profils.get(f.user_id)?.email ?? null,
      userAgent: f.user_agent,
      motif: f.motif,
      simulee: f.simulee,
      notifie: f.notifie,
      derniereActivite: f.derniere_activite,
      created_at: f.created_at,
    })),
    dernierRapport: ((rapports.data ?? []) as TableauSecurite['dernierRapport'][])[0] ?? null,
    suspensionsActives: [...parCompte.values()].filter((l) => suspensionActive(l, maintenant) !== null).length,
  };
}

export interface FicheSecurite {
  userId: string;
  email: string | null;
  premium: boolean;
  creeLe: string | null;
  appareils: (AppareilConnecte & { reseau: string | null })[];
  historique: { session_id: string; user_agent: string | null; reseau: string | null; pays: string | null; premiere_vue: string; derniere_vue: string; fermee_at: string | null; fermee_par: string | null }[];
  fermetures: LigneFermeture[];
  signaux: { jour: string; niveau: string; raisons: Raison[] }[];
  decisions: { id: number; type: TypeDecision; motif: string; jusqu_au: string | null; created_at: string; auteur: string | null }[];
  connexions: { created_at: string; pays: string | null }[];
  suspendu: ReturnType<typeof suspensionActive>;
}

export async function chargerFicheSecurite(userId: string, maintenant: Date = new Date()): Promise<FicheSecurite> {
  const db = getServiceClient();
  const depuis30 = new Date(maintenant.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: u }, vivantes, historique, fermetures, signaux, decisions, connexions] = await Promise.all([
    db.auth.admin.getUserById(userId),
    lireSessionsVivantes(db, userId),
    db.from('securite_sessions').select('session_id, user_agent, reseau, pays, premiere_vue, derniere_vue, fermee_at, fermee_par').eq('user_id', userId).gte('derniere_vue', depuis30).order('derniere_vue', { ascending: false }).limit(200),
    db.from('securite_revocations').select('id, user_id, user_agent, motif, simulee, notifie, derniere_activite, created_at').eq('user_id', userId).order('id', { ascending: false }).limit(100),
    db.from('securite_signaux').select('jour, niveau, raisons').eq('user_id', userId).order('jour', { ascending: false }).limit(30),
    db.from('securite_decisions').select('id, type, motif, jusqu_au, created_at, auteur').eq('user_id', userId).order('created_at', { ascending: false }),
    db.from('auth_events').select('created_at, pays').eq('user_id', userId).eq('event', 'sign_in').gte('created_at', depuis30).order('created_at', { ascending: false }).limit(100),
  ]);
  for (const r of [historique, fermetures, signaux, decisions, connexions]) {
    if (r.error) throw new Error(`fiche illisible : ${r.error.message}`);
  }
  const profil = (await emailsDe([userId])).get(userId);
  const reseauPar = new Map(vivantes.map((s) => [s.sessionId, s.reseau]));
  const decs = (decisions.data ?? []) as FicheSecurite['decisions'];
  return {
    userId,
    email: u?.user?.email ?? profil?.email ?? null,
    premium: profil?.premium ?? false,
    creeLe: u?.user?.created_at ?? null,
    appareils: regrouperAppareils(vivantes, null).map((a) => ({ ...a, reseau: reseauPar.get(a.sessionIds[0]) ?? null })),
    historique: (historique.data ?? []) as FicheSecurite['historique'],
    fermetures: ((fermetures.data ?? []) as { id: number; user_id: string; user_agent: string | null; motif: LigneFermeture['motif']; simulee: boolean; notifie: string | null; derniere_activite: string | null; created_at: string }[]).map((f) => ({
      id: f.id, userId: f.user_id, email: null, userAgent: f.user_agent, motif: f.motif, simulee: f.simulee,
      notifie: f.notifie, derniereActivite: f.derniere_activite, created_at: f.created_at,
    })),
    signaux: (signaux.data ?? []) as FicheSecurite['signaux'],
    decisions: decs,
    connexions: (connexions.data ?? []) as FicheSecurite['connexions'],
    suspendu: suspensionActive(decs, maintenant),
  };
}
