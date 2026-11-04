import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { appelerJev } from '@/lib/jev/client';
import { lireCommande, estDemandeHumain } from '@/lib/whatsapp/commandes';
import { aiguillerParJev } from '../aiguiller';
import type { Decision } from '../decider';
import type { SocieteIdentite } from '../requete';
import { JEU, type MessageEval } from './jeu';

const ATTENDU_COMMANDE = new Set(['cours', 'dividendes', 'palmares_hausses', 'palmares_baisses', 'palmares_volumes', 'aide']);
const CODE = /^[A-Z]{3,6}$/;

/** Aiguillage actuel : commande figée, sinon HUMAIN, sinon chemin actuel (agent ou console). */
function actuel(texte: string): Decision {
  const c = lireCommande(texte);
  if (c) return { type: 'commande', commande: c };
  if (estDemandeHumain(texte)) return { type: 'console' };
  return { type: 'aiguillage_actuel' };
}

function exacte(m: MessageEval, d: Decision): boolean {
  if (m.intention === 'conseil') return d.type === 'refus_conseil';
  if (m.intention === 'salutation') return d.type === 'salutation';
  if (d.type !== 'commande') return false;
  const c = d.commande;
  if (m.intention === 'cours' || m.intention === 'dividendes') {
    // L'aiguillage actuel transmet le texte (« Nestlé CI », résolu ensuite par nom) ; Jev transmet le code.
    return c.type === m.intention && 'valeur' in c && (c.valeur.toUpperCase() === m.code || !CODE.test(c.valeur));
  }
  if (m.intention === 'aide') return c.type === 'aide';
  return c.type === 'palmares' && `palmares_${c.critere}` === m.intention;
}

interface Mesures {
  exactes: number;
  attendues: number;
  mauvaiseSociete: number;
  conseilEnCommande: number;
  consoleATort: number;
}
const vides = (): Mesures => ({ exactes: 0, attendues: 0, mauvaiseSociete: 0, conseilEnCommande: 0, consoleATort: 0 });

function noter(mes: Mesures, m: MessageEval, d: Decision) {
  if (ATTENDU_COMMANDE.has(m.intention) || m.intention === 'conseil' || m.intention === 'salutation') {
    mes.attendues += 1;
    if (exacte(m, d)) mes.exactes += 1;
  }
  if (d.type === 'commande' && 'valeur' in d.commande && m.code && CODE.test(d.commande.valeur) && d.commande.valeur !== m.code) mes.mauvaiseSociete += 1;
  if (m.intention === 'conseil' && d.type === 'commande') mes.conseilEnCommande += 1;
  if (ATTENDU_COMMANDE.has(m.intention) && (d.type === 'console' || d.type === 'aiguillage_actuel')) mes.consoleATort += 1;
}

describe('évaluation de l’aiguillage WhatsApp (manuelle — appels payants)', () => {
  it(
    'Jev contre l’aiguillage actuel',
    async () => {
      const { data } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
        .from('brvm_instruments')
        .select('code, designation, secteur, pays')
        .eq('type', 'action')
        .eq('actif', true)
        .order('code');
      const societes: SocieteIdentite[] = (data ?? []).map((r) => ({ code: r.code, nom: r.designation ?? r.code, secteur: r.secteur, pays: r.pays }));
      for (const m of JEU) if (m.code) expect(societes.some((s) => s.code === m.code)).toBe(true);

      const jev = vides();
      const base = vides();
      const ecarts: string[] = [];
      for (const m of JEU) {
        const d = await aiguillerParJev(m.texte, 'evaluation', {
          actif: async () => true,
          societes: async () => societes,
          quota: async () => true,
          reserverBudget: async () => 'ok',
          jev: (corps, signal) => appelerJev(corps, signal),
          journaliser: async () => undefined,
          journal: () => undefined,
          delaiMs: 20_000,
        });
        noter(jev, m, d);
        noter(base, m, actuel(m.texte));
        if (!exacte(m, d)) ecarts.push(`${m.intention.padEnd(17)} → ${d.type}${d.type === 'commande' && 'valeur' in d.commande ? ` ${d.commande.valeur}` : ''} · « ${m.texte} »`);
      }
      const ligne = (x: Mesures) => ({
        'réponses exactes': `${x.exactes}/${x.attendues}`,
        'mauvaise société': x.mauvaiseSociete,
        'conseil traité en commande': x.conseilEnCommande,
        'envoyés à la console à tort': x.consoleATort,
      });
      console.table({ Jev: ligne(jev), Actuel: ligne(base) });
      console.log(ecarts.length ? `Écarts Jev :\n${ecarts.join('\n')}` : 'Aucun écart Jev.');
      const activation = jev.exactes > base.exactes && jev.consoleATort < base.consoleATort && jev.mauvaiseSociete === 0 && jev.conseilEnCommande === 0;
      console.log(`Règle d’activation : ${activation ? 'SATISFAITE — activer whatsapp_jev' : 'NON SATISFAITE — laisser le drapeau coupé'}`);
      expect(jev.conseilEnCommande).toBe(0);
    },
    900_000,
  );
});
