import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DefinitionOutil } from '@/lib/agent/outils';
import { chargerTour } from '@/lib/controle/tour';
import { loadAttention } from '@/lib/admin/attention';
import { controleBoc } from '@/lib/boc/charger';
import { resumer } from '@/lib/boc/ecarts';
import { loadCoherenceDashboard } from '@/lib/admin/coherence';
import { lireDernierRunWorkflow, resoudreWorkflow } from './githubDispatch';
import { auditerValeurFlash, sonderSanteCanaux } from './controles';
import type { InlineKeyboardButton } from './telegramApi';

export const OUTILS_OPS: DefinitionOutil[] = [
  {
    type: 'function',
    function: {
      name: 'lire_tour_controle',
      description:
        'Lit l’état temps réel de la Tour de contrôle WESTBOURSE : envois, tâches planifiées GitHub, fraîcheur des données et appels vocaux.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_attention',
      description:
        'Liste les points urgents « À traiter » sur la console admin (paiements pending, crons en panne, incidents, cohérence, contacts, agrégats).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_ecarts_boc',
      description: 'Lit les écarts PER / rendement entre le site et le dernier Bulletin Officiel de la Cote (BOC).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_coherence',
      description: 'Lit les anomalies de cohérence ouvertes sur les fiches sociétés.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_sante_canaux',
      description: 'Sonde en direct les fournisseurs IA (DeepSeek, Gemini, Grok), WhatsApp, Telegram Ops, Resend et Bland.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'auditer_valeur',
      description: 'Audit flash complet d’une société BRVM : cours, signal, liquidité, comparaison BOC, cohérence, dividendes.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Code BRVM (ex. SNTS) ou nom de la société' } },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_paiements_attente',
      description: 'Liste les transactions billing_transactions actuellement en statut pending.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_contacts_non_repondus',
      description: 'Liste les derniers messages de contact (email/WhatsApp) en statut nouveau.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_incidents_recents',
      description: 'Liste les incidents Ops ouverts ou récents et leur statut d’escalade vocale.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lire_dernier_echec_workflow',
      description: 'Inspecte sur GitHub Actions le dernier run et l’étape en échec d’un workflow donné.',
      parameters: {
        type: 'object',
        properties: { workflow: { type: 'string', description: 'Alias ou nom .yml (ex. daily-brvm, score, alerts)' } },
        required: ['workflow'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'proposer_action_ops',
      description:
        'Ajoute un bouton d’action cliquable sous la réponse Telegram (ne modifie rien directement : demande validation par clic de l’admin).',
      parameters: {
        type: 'object',
        properties: {
          type_action: {
            type: 'string',
            description: 'L’un de : relancer_workflow, ouvrir_paiements, ouvrir_contact, ouvrir_agregats, carte_pulse, voir_tour, voir_boc',
          },
          cible: {
            type: 'string',
            description: 'Paramètre optionnel (ex. alias du workflow comme daily-brvm, score, alerts, ops-controle).',
          },
          libelle: {
            type: 'string',
            description: 'Libellé court du bouton (ex. Relancer daily-brvm).',
          },
        },
        required: ['type_action', 'libelle'],
      },
    },
  },
];

export async function executerOutilOps(
  db: SupabaseClient,
  nom: string,
  args: Record<string, unknown>,
  boutonsCollectes: InlineKeyboardButton[][],
): Promise<unknown> {
  try {
    switch (nom) {
      case 'lire_tour_controle': {
        const tour = await chargerTour();
        return {
          observeA: tour.observeA,
          alertes: tour.signaux.filter((s) => s.niveau === 'alerte' || s.niveau === 'inconnu'),
          aSurveiller: tour.signaux.filter((s) => s.niveau === 'attention'),
          okCount: tour.signaux.filter((s) => s.niveau === 'ok').length,
        };
      }
      case 'lire_attention':
        return await loadAttention();
      case 'lire_ecarts_boc': {
        const controles = await controleBoc(db);
        const resume = resumer(controles);
        return {
          resume,
          ecarts: controles.filter((c) => c.per.etat === 'ecart' || c.rendement.etat === 'ecart'),
        };
      }
      case 'lire_coherence': {
        const coh = await loadCoherenceDashboard();
        return {
          etat: coh.etat,
          kpis: coh.kpis,
          dernierPassage: coh.dernierPassage,
          anomalies: coh.anomalies.slice(0, 12),
        };
      }
      case 'lire_sante_canaux':
        return await sonderSanteCanaux(db);
      case 'auditer_valeur': {
        const res = await auditerValeurFlash(db, String(args.code ?? ''));
        return res.data;
      }
      case 'lire_paiements_attente': {
        const { data } = await db
          .from('billing_transactions')
          .select('id, objet, amount, currency, provider, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);
        return { en_attente: data ?? [] };
      }
      case 'lire_contacts_non_repondus': {
        const { data } = await db
          .from('contact_messages')
          .select('id, prenom, canal, message, created_at')
          .eq('statut', 'nouveau')
          .order('created_at', { ascending: true })
          .limit(8);
        return { messages: data ?? [] };
      }
      case 'lire_incidents_recents': {
        const { data } = await db
          .from('ops_incidents')
          .select('id, type_alerte, gravite, titre, detail, statut, escalade_vocale_at, cree_le')
          .order('cree_le', { ascending: false })
          .limit(10);
        return { incidents: data ?? [] };
      }
      case 'lire_dernier_echec_workflow': {
        const wf = resoudreWorkflow(String(args.workflow ?? ''));
        if (!wf) return { erreur: 'Workflow inconnu ou hors liste blanche.' };
        const info = await lireDernierRunWorkflow(wf.fichier);
        return info ?? { message: 'Aucun run récent lisible sur GitHub.' };
      }
      case 'proposer_action_ops': {
        const typeAction = String(args.type_action ?? '');
        const cible = String(args.cible ?? '').trim();
        const libelle = String(args.libelle ?? 'Action').slice(0, 40);

        let callbackData: string | null = null;
        if (typeAction === 'relancer_workflow') {
          const wf = resoudreWorkflow(cible);
          if (wf) callbackData = `wf:${wf.alias}`;
        } else if (typeAction === 'ouvrir_paiements') {
          callbackData = 'cmd:paiements';
        } else if (typeAction === 'ouvrir_contact') {
          callbackData = 'cmd:contact';
        } else if (typeAction === 'ouvrir_agregats') {
          callbackData = 'cmd:agregats';
        } else if (typeAction === 'carte_pulse') {
          callbackData = 'cmd:pulse';
        } else if (typeAction === 'voir_tour') {
          callbackData = 'cmd:tour';
        } else if (typeAction === 'voir_boc') {
          callbackData = 'cmd:boc';
        }

        if (!callbackData) return { ok: false, raison: 'Action proposée non reconnue ou hors liste blanche.' };
        boutonsCollectes.push([{ text: `⚡ ${libelle}`, callback_data: callbackData }]);
        return { ok: true, bouton_ajoute: libelle };
      }
      default:
        return { erreur: `Outil Ops inconnu : ${nom}` };
    }
  } catch (err) {
    return { erreur: err instanceof Error ? err.message : 'Erreur outil Ops' };
  }
}
