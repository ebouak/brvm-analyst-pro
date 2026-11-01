export interface Paiement { id: string; montant: number; devise: string; statut: 'pending' | 'paid' | 'failed'; provider: string; date: string; payeLe: string | null }
export type DecisionType = 'cloture' | 'reouverture' | 'echeance' | 'responsable' | 'reponse';
export type MotifCloture = 'pas_interesse' | 'doublon' | 'deja_abonne';
export interface ActionCrm {
  date: string; type: 'relance' | 'note' | 'decision'; statut: string; canal: string | null; sujet: string | null; contenu: string;
  decision: DecisionType | null; motif: MotifCloture | null; echeance: string | null; responsable: string | null;
}

/** Une personne vue par le CRM : un compte, ou un prospect sans compte. */
export interface Dossier {
  /** user_id pour un compte, `email:<email_norm>` pour un prospect sans compte. */
  cle: string;
  emailNorm: string;
  userId: string | null;
  nom: string | null;
  inscritLe: string | null;
  derniereConnexion: string | null;
  premium: boolean;
  admin: boolean;
  oppose: boolean;
  paiementsEnAttente: { montant: number; devise: string; date: string }[];
  paiementsReussis: { montant: number; devise: string; date: string }[];
  /** Tous les paiements du compte (en attente, réussis, échoués) : base de `etatPaiement`. */
  paiements: Paiement[];
  offreVues: { page: string; jour: string }[];
  lignesPortefeuille: number;
  messages: { date: string }[];
  prospect: { date: string; consent: boolean } | null;
  newsletter: boolean;
  leconsAcademy: number;
  actions: ActionCrm[];
  /** Joignabilité WhatsApp : numéro prouvé (appairage) d'abord, sinon déclaré. */
  whatsapp: { numero: string | null; source: 'prouve' | 'declare' | null; lieSansNumero: boolean; recontact: boolean };
  /** Dossiers offerts téléchargés (crm_actions.bonus_*). */
  bonus: { code: string; date: string }[];
}

export interface Raison { code: 'paiement' | 'offre' | 'connexion' | 'portefeuille' | 'contact' | 'newsletter' | 'academy' | 'bonus'; points: number; texte: string; date: string | null }
export type Niveau = 'chaud' | 'tiede' | 'froid';
export interface Score { score: number; niveau: Niveau; raisons: Raison[] }
