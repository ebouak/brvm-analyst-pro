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
  paiementsReussis: { montant: number; date: string }[];
  offreVues: { page: string; jour: string }[];
  lignesPortefeuille: number;
  messages: { date: string }[];
  prospect: { date: string; consent: boolean } | null;
  newsletter: boolean;
  leconsAcademy: number;
  actions: { date: string; type: 'relance' | 'note'; statut: string; canal: string | null; sujet: string | null; contenu: string }[];
}

export interface Raison { code: 'paiement' | 'offre' | 'connexion' | 'portefeuille' | 'contact' | 'newsletter' | 'academy'; points: number; texte: string; date: string | null }
export type Niveau = 'chaud' | 'tiede' | 'froid';
export interface Score { score: number; niveau: Niveau; raisons: Raison[] }
