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
