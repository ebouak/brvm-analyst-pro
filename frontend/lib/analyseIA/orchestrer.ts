/**
 * Réponse à une question posée sur la fiche d'une valeur (module PUR : toutes
 * les entrées-sorties sont injectées).
 *
 *   1. Jev classe la demande. Sûr ET déterministe ⇒ réponse par gabarit, sans
 *      LLM, `provenance: 'jev'`.
 *   2. Sinon (doute, « autre », Jev indisponible, quota ou budget épuisé,
 *      gabarit sans donnée) ⇒ LLM avec outils, `provenance: 'ia'`.
 *   3. Contrôle des chiffres de la réponse IA : une réécriture, puis réponse
 *      sans chiffre renvoyant à la fiche. Même logique que l'assistant WhatsApp.
 *   4. Événement `meta` final : provenance, sources réellement lues, relances.
 *
 * La réponse IA n'est envoyée qu'APRÈS le contrôle : la diffuser au fil de la
 * génération montrerait des chiffres que le contrôle peut refuser ensuite.
 */
import { chiffresEtrangers, masquerDonneesPersonnelles } from '@/lib/whatsapp/chatbot/chiffres';
import { consigneReecriture } from '@/lib/whatsapp/chatbot/textes';
import { decouperTexte } from './flux';
import type { IntentionDeterministe, Voie } from './intention';
import { promptSysteme } from './prompt';
import { relancesSuivantes } from './questions';
import { fusionnerSources } from './sources';
import type { EvenementFlux, MessageConversation, SourceDonnee } from './types';

export interface ValeurAnalyse {
  code: string;
  nom: string | null;
  exerciceComptes: number | null;
}

export interface MessageLlmAnalyse {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ResultatLlmAnalyse {
  texte: string | null;
  /** Retours d'outils sérialisés : seule source admise pour les chiffres. */
  retours: string[];
  sources: SourceDonnee[];
}

export interface DepsAnalyse {
  classer(question: string): Promise<Voie>;
  /** null ⇒ pas de réponse exacte possible : l'IA prend le relais. */
  repondreJev(intention: IntentionDeterministe, question: string): Promise<{ texte: string; sources: SourceDonnee[] } | null>;
  llm(messages: MessageLlmAnalyse[]): Promise<ResultatLlmAnalyse>;
  emettre(e: EvenementFlux): void;
  /** Codes d'événement seulement : jamais le texte de la question. */
  journal(evenement: string): void;
  aujourdhui: string;
}

export function texteSansChiffreFiche(code: string): string {
  return `Je préfère ne pas vous donner de chiffre que je ne peux pas vérifier dans les données de WESTBOURSE. Les données à jour de ${code} sont sur cette fiche, plus haut : cours, comptes, dividendes et liquidité.`;
}

const VIDE: ResultatLlmAnalyse = { texte: null, retours: [], sources: [] };

function diffuser(deps: DepsAnalyse, texte: string) {
  for (const morceau of decouperTexte(texte)) deps.emettre({ type: 'texte', texte: morceau });
}

export async function repondreAnalyse(
  entree: { question: string; historique: MessageConversation[]; valeur: ValeurAnalyse },
  deps: DepsAnalyse,
): Promise<'jev' | 'ia' | 'echec'> {
  const { valeur } = entree;
  const question = masquerDonneesPersonnelles(entree.question);
  const posees = [...entree.historique.filter((m) => m.role === 'user').map((m) => m.content), entree.question];
  const relances = relancesSuivantes(valeur, posees);

  deps.emettre({ type: 'etape', libelle: 'Recherche des données…' });
  const voie = await deps.classer(question).catch(() => ({ voie: 'ia' }) as Voie);

  if (voie.voie === 'jev') {
    const r = await deps.repondreJev(voie.intention, question).catch(() => null);
    if (r) {
      diffuser(deps, r.texte);
      deps.emettre({ type: 'meta', meta: { provenance: 'jev', sources: fusionnerSources(r.sources), relances } });
      return 'jev';
    }
    deps.journal('jev_sans_reponse');
  }

  const historique = entree.historique.slice(-8).map((m) => ({ role: m.role, content: masquerDonneesPersonnelles(m.content) }));
  const base: MessageLlmAnalyse[] = [
    { role: 'system', content: promptSysteme(valeur, deps.aujourdhui) },
    ...historique,
    { role: 'user', content: question },
  ];
  const autorises = [question, ...historique.map((h) => h.content)];

  const r = await deps.llm(base).catch(() => VIDE);
  if (!r.texte) {
    deps.journal('llm_echec');
    deps.emettre({ type: 'erreur', code: 'indisponible', message: 'L’analyse n’a pas pu être rédigée. Réessayez dans un instant.' });
    return 'echec';
  }

  let finale = r.texte;
  let sources = r.sources;
  const refuses = chiffresEtrangers(r.texte, [...autorises, ...r.retours]);
  if (refuses.length > 0) {
    deps.journal('chiffre_etranger');
    deps.emettre({ type: 'etape', libelle: 'Vérification des chiffres…' });
    const r2 = await deps
      .llm([...base, { role: 'assistant', content: r.texte }, { role: 'user', content: consigneReecriture(refuses) }])
      .catch(() => VIDE);
    const retours = [...r.retours, ...r2.retours];
    sources = [...r.sources, ...r2.sources];
    if (r2.texte && chiffresEtrangers(r2.texte, [...autorises, ...retours]).length === 0) {
      finale = r2.texte;
    } else {
      deps.journal('chiffre_etranger_repli');
      finale = texteSansChiffreFiche(valeur.code);
    }
  }

  diffuser(deps, finale);
  deps.emettre({ type: 'meta', meta: { provenance: 'ia', sources: fusionnerSources(sources), relances } });
  return 'ia';
}
