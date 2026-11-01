/**
 * Assemblage des dossiers CRM — PUR. Une personne = un compte, ou un prospect
 * sans compte (formulaire avec consentement, ou newsletter confirmée). Le
 * rapprochement se fait par e-mail normalisé : seule clé commune entre comptes,
 * prospects, newsletter et messages.
 */
import type { Dossier } from './types';
import { fmtMontant } from './score';

export const normaliserEmail = (e: string | null | undefined): string => (e ?? '').trim().toLowerCase();

export interface Sources {
  comptes: { id: string; email: string | null; created_at: string | null; last_sign_in_at: string | null }[];
  profils: { id: string; display_name: string | null; is_premium: boolean | null }[];
  admins: { user_id: string }[];
  paiements: { user_id: string | null; amount: number | string; currency: string | null; status: string; created_at: string; paid_at: string | null }[];
  signaux: { user_id: string; page: string; jour: string }[];
  positions: { user_id: string }[];
  messages: { email: string; created_at: string }[];
  prospects: { email: string; nom: string | null; created_at: string; consent: boolean | null }[];
  newsletter: { email: string; confirmed: boolean | null }[];
  academy: { user_id: string; completed: boolean | null }[];
  actions: { email_norm: string; created_at: string; type: 'relance' | 'note'; statut: string; canal: string | null; sujet: string | null; contenu: string; bonus_code: string | null; bonus_at: string | null }[];
  oppositions: { email_norm: string }[];
  prefs: { user_id: string; whatsapp_phone: string | null; whatsapp_chat_id: string | null; telephone_declare: string | null; recontact_optin_at: string | null }[];
  liaisons: { user_id: string; chat_id: string; telephone: string | null }[];
}

type PrefsWa = Omit<Sources['prefs'][number], 'user_id'>;

/** Joignabilité WhatsApp : le numéro PROUVÉ (appairage) prime sur le déclaré. */
export function contactWhatsapp(p: PrefsWa | undefined, liaisons: { chat_id: string; telephone: string | null }[]): Dossier['whatsapp'] {
  const prouve = p?.whatsapp_phone ?? liaisons.find((l) => l.telephone)?.telephone ?? null;
  const lie = Boolean(p?.whatsapp_chat_id) || liaisons.length > 0;
  const recontact = Boolean(p?.recontact_optin_at);
  if (prouve) return { numero: prouve, source: 'prouve', lieSansNumero: false, recontact };
  if (p?.telephone_declare) return { numero: p.telephone_declare, source: 'declare', lieSansNumero: false, recontact };
  return { numero: null, source: null, lieSansNumero: lie, recontact };
}

function grouper<T>(lignes: readonly T[], cle: (l: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes) {
    const k = cle(l);
    const liste = m.get(k);
    if (liste) liste.push(l);
    else m.set(k, [l]);
  }
  return m;
}

export function assemblerDossiers(s: Sources): Dossier[] {
  const profils = new Map(s.profils.map((p) => [p.id, p]));
  const admins = new Set(s.admins.map((a) => a.user_id));
  const opposes = new Set(s.oppositions.map((o) => normaliserEmail(o.email_norm)));
  const paiements = grouper(s.paiements.filter((p) => p.user_id), (p) => p.user_id as string);
  const signaux = grouper(s.signaux, (x) => x.user_id);
  const positions = grouper(s.positions, (x) => x.user_id);
  const academy = grouper(s.academy, (x) => x.user_id);
  const messages = grouper(s.messages, (x) => normaliserEmail(x.email));
  const actions = grouper(s.actions, (x) => normaliserEmail(x.email_norm));
  const prefs = new Map(s.prefs.map((p) => [p.user_id, p]));
  const liaisons = grouper(s.liaisons, (l) => l.user_id);
  const prospects = new Map<string, Sources['prospects'][number]>();
  for (const p of [...s.prospects].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = normaliserEmail(p.email);
    if (k && !prospects.has(k)) prospects.set(k, p); // le plus récent
  }
  const abonnes = new Set(s.newsletter.filter((n) => n.confirmed).map((n) => normaliserEmail(n.email)));

  const commun = (emailNorm: string): Pick<Dossier, 'messages' | 'prospect' | 'newsletter' | 'oppose' | 'actions' | 'bonus'> => {
    const p = prospects.get(emailNorm);
    return {
      messages: (messages.get(emailNorm) ?? []).map((m) => ({ date: m.created_at })),
      prospect: p ? { date: p.created_at, consent: p.consent === true } : null,
      newsletter: abonnes.has(emailNorm),
      oppose: opposes.has(emailNorm),
      actions: (actions.get(emailNorm) ?? []).map((a) => ({ date: a.created_at, type: a.type, statut: a.statut, canal: a.canal, sujet: a.sujet, contenu: a.contenu })),
      bonus: (actions.get(emailNorm) ?? []).filter((a) => a.bonus_code && a.bonus_at).map((a) => ({ code: a.bonus_code as string, date: a.bonus_at as string })),
    };
  };

  const dossiers: Dossier[] = [];
  const emailsComptes = new Set<string>();
  for (const c of s.comptes) {
    const emailNorm = normaliserEmail(c.email);
    if (!emailNorm) continue;
    emailsComptes.add(emailNorm);
    const pr = profils.get(c.id);
    const ps = paiements.get(c.id) ?? [];
    dossiers.push({
      cle: c.id,
      emailNorm,
      userId: c.id,
      nom: pr?.display_name ?? prospects.get(emailNorm)?.nom ?? null,
      inscritLe: c.created_at,
      derniereConnexion: c.last_sign_in_at,
      premium: pr?.is_premium === true,
      admin: admins.has(c.id),
      paiementsEnAttente: ps.filter((p) => p.status === 'pending').map((p) => ({ montant: Number(p.amount), devise: p.currency ?? 'XOF', date: p.created_at })),
      paiementsReussis: ps.filter((p) => p.status === 'paid').map((p) => ({ montant: Number(p.amount), devise: p.currency ?? 'XOF', date: p.paid_at ?? p.created_at })),
      offreVues: (signaux.get(c.id) ?? []).map((x) => ({ page: x.page, jour: x.jour })),
      lignesPortefeuille: (positions.get(c.id) ?? []).length,
      leconsAcademy: (academy.get(c.id) ?? []).filter((a) => a.completed).length,
      whatsapp: contactWhatsapp(prefs.get(c.id), liaisons.get(c.id) ?? []),
      ...commun(emailNorm),
    });
  }

  // Prospects sans compte : formulaire AVEC consentement, ou newsletter confirmée.
  const sansCompte = new Set<string>();
  for (const [k, p] of prospects) if (p.consent === true && !emailsComptes.has(k)) sansCompte.add(k);
  for (const k of abonnes) if (!emailsComptes.has(k)) sansCompte.add(k);
  for (const emailNorm of sansCompte) {
    dossiers.push({
      cle: `email:${emailNorm}`, emailNorm, userId: null, nom: prospects.get(emailNorm)?.nom ?? null,
      inscritLe: null, derniereConnexion: null, premium: false, admin: false,
      paiementsEnAttente: [], paiementsReussis: [], offreVues: [], lignesPortefeuille: 0, leconsAcademy: 0,
      whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false },
      ...commun(emailNorm),
    });
  }
  return dossiers;
}

export interface Evenement { date: string; libelle: string }

/** Faits du dossier, du plus récent au plus ancien (fiche CRM). */
export function chronologie(d: Dossier): Evenement[] {
  const ev: Evenement[] = [];
  if (d.inscritLe) ev.push({ date: d.inscritLe, libelle: 'Inscription' });
  for (const p of d.paiementsEnAttente) ev.push({ date: p.date, libelle: `Paiement commencé (${fmtMontant(p.montant, p.devise)}), non terminé` });
  for (const p of d.paiementsReussis) ev.push({ date: p.date, libelle: `Paiement réussi (${fmtMontant(p.montant, p.devise)})` });
  for (const v of d.offreVues) ev.push({ date: `${v.jour}T12:00:00Z`, libelle: `A consulté ${v.page}` });
  for (const m of d.messages) ev.push({ date: m.date, libelle: 'Message envoyé au support' });
  if (d.prospect) ev.push({ date: d.prospect.date, libelle: 'Formulaire prospect' });
  for (const b of d.bonus) ev.push({ date: b.date, libelle: `Dossier ${b.code} téléchargé (offre)` });
  for (const a of d.actions) ev.push({ date: a.date, libelle: a.type === 'note' ? `Note : ${a.contenu.slice(0, 80)}` : a.canal === 'whatsapp' ? 'Relance WhatsApp préparée (envoi manuel)' : `Relance ${a.canal ?? ''} (${a.statut}) : ${a.sujet ?? ''}` });
  return ev.sort((a, b) => b.date.localeCompare(a.date));
}
