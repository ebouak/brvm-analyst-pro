import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastMarketDate } from '@/lib/marketDate';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { chargerInstantane } from '@/lib/server/rechercheDonnees';
import { rechercheMotsCles } from '@/lib/recherche/motsCles';
import { OUTILS, executerOutil, resoudreCode, type DefinitionOutil } from './outils';
import { chiffresParAction, classerNotions, lireListeValeurs, sansSignal, type LeconIndex } from './chatbotPur';

/**
 * Outils de l'assistant WhatsApp ouvert à tous (spec 2026-11-04 §3).
 * LECTURE SEULE, comme lib/agent/outils.ts. Les outils personnels
 * (portefeuille, alertes) ne s'exécutent que pour un Premium lié ayant activé
 * l'assistant ; signal et confiance sont retirés de tout retour.
 */

const SITE = 'https://www.westbourse.com';
const PERSONNELS = new Set(['mon_portefeuille', 'mes_alertes']);

type Proprietes = DefinitionOutil['function']['parameters']['properties'];
const outil = (name: string, description: string, properties: Proprietes, required: string[]): DefinitionOutil => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const CODE = { code: { type: 'string', description: 'Code BRVM (ex. SNTS) ou nom de la société.' } };

export const OUTILS_CHATBOT: DefinitionOutil[] = [
  outil(
    'fiche_societe',
    "Fiche d'une société cotée : secteur, pays, cours et plage sur 52 semaines, derniers comptes annuels publiés (revenus et résultat net, en FCFA), BPA, dividende par action et PER quand ils sont recoupés (par_action nul : non vérifiable, dis-le), rendement du dividende avec sa base fiscale, liquidité, performance sur 12 mois.",
    CODE,
    ['code'],
  ),
  outil('carnet_ordres', "Meilleure limite à l'achat et à la vente publiée par la BRVM pour une valeur, avec la date de la séance.", CODE, ['code']),
  outil(
    'comparer_valeurs',
    'Fiches de deux ou trois sociétés côte à côte, en un seul appel.',
    { codes: { type: 'string', description: 'Deux ou trois codes ou noms séparés par des virgules (ex. "SNTS, ORAC").' } },
    ['codes'],
  ),
  outil(
    'chercher_societes',
    'Trouve les sociétés cotées correspondant à une description (secteur, pays, dividende, liquidité, tendance), ex. « une banque sénégalaise qui verse un dividende ».',
    { description: { type: 'string', description: 'La description, telle que formulée.' } },
    ['description'],
  ),
  outil(
    'notion_bourse',
    "Leçons de la formation WESTBOURSE Academy qui traitent d'une notion boursière (PER, dividende, détachement, ouvrir un compte, SGI…), avec leur lien.",
    { sujet: { type: 'string', description: 'La notion, en quelques mots.' } },
    ['sujet'],
  ),
];

/** Outils proposés au modèle : les personnels seulement si `perso`. */
export function outilsChatbot(perso: boolean): DefinitionOutil[] {
  return [...OUTILS.filter((o) => perso || !PERSONNELS.has(o.function.name)), ...OUTILS_CHATBOT];
}

const leconsAcademy = unstable_cache(
  async (): Promise<LeconIndex[]> => {
    const { data, error } = await getServiceClient().from('academy_courses').select('slug, titre, content').eq('published', true);
    if (error) throw new Error('academy');
    const sortie: LeconIndex[] = [];
    for (const c of data ?? []) {
      const lecons = (c.content as { lessons?: { titre?: unknown }[] } | null)?.lessons ?? [];
      for (const l of lecons) {
        if (typeof l.titre === 'string') sortie.push({ cours: (c.titre as string | null) ?? (c.slug as string), slug: c.slug as string, titre: l.titre });
      }
    }
    return sortie;
  },
  ['whatsapp-lecons-academy-v1'],
  { revalidate: 6 * 3600 },
);

async function ficheSociete(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };
  const asOf = await getLastMarketDate(db);
  const [instrument, seance, comptes, instantane] = await Promise.all([
    db.from('brvm_instruments').select('designation, secteur, pays, shares').eq('code', code).maybeSingle().then((r) => r.data),
    asOf
      ? db
          .from('brvm_actions_daily')
          .select('cours_jour, variation_pct, cours_haut_52s, cours_bas_52s')
          .eq('date_marche', asOf)
          .eq('code', code)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    db
      .from('income_statements')
      .select('periode, revenu_total, resultat_net, benefice_par_action, dividende_par_action')
      .eq('code', code)
      .in('type_periode', ['annuel', 'annual'])
      .order('periode', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    chargerInstantane().catch(() => null),
  ]);
  // Un chiffre par action ne part que recoupé : voir chiffresParAction.
  const parAction = comptes
    ? chiffresParAction({
        exercice: comptes.periode,
        resultatNet: comptes.resultat_net,
        bpa: comptes.benefice_par_action,
        dpa: comptes.dividende_par_action,
        titres: instrument?.shares ?? null,
        cours: seance?.cours_jour ?? null,
        anneeSeance: Number(String(asOf ?? '').slice(0, 4)),
      })
    : null;
  const faits = instantane?.fiches.find((f) => f.code === code)?.faits.filter((f) => f.cle !== 'secteur' && f.cle !== 'pays') ?? [];
  return {
    code,
    societe: instrument?.designation ?? null,
    secteur: instrument?.secteur ?? null,
    pays: instrument?.pays ?? null,
    seance: asOf,
    cours: seance?.cours_jour ?? null,
    variation_pct: seance?.variation_pct ?? null,
    plus_haut_52_semaines: seance?.cours_haut_52s ?? null,
    plus_bas_52_semaines: seance?.cours_bas_52s ?? null,
    derniers_comptes_annuels: comptes
      ? { exercice: comptes.periode, revenus_fcfa: comptes.revenu_total, resultat_net_fcfa: comptes.resultat_net }
      : null,
    par_action: parAction,
    faits: faits.map((f) => `${f.libelle} : ${f.valeur}`),
    lien: `${SITE}/societes/${code}`,
  };
}

async function carnetOrdres(db: SupabaseClient, saisie: string) {
  const code = await resoudreCode(db, saisie);
  if (!code) return { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` };
  const { data } = await db
    .from('brvm_carnet_daily')
    .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { code, erreur: `Aucun carnet d'ordres publié pour ${code}.` };
  const cote = (auMarche: boolean, cours: number | null, quantite: number | null) =>
    auMarche ? { au_marche: true, quantite } : cours != null ? { cours, quantite } : null;
  return {
    code,
    seance: data.date_marche,
    achat: cote(Boolean(data.achat_au_marche), data.cours_achat as number | null, data.qte_achat as number | null),
    vente: cote(Boolean(data.vente_au_marche), data.cours_vente as number | null, data.qte_vente as number | null),
    note: "Meilleure limite de chaque côté seulement, publiée par la BRVM après la clôture (Bulletin officiel de la cote) : ni la profondeur complète du carnet, ni l'état du marché à cet instant. null = aucun ordre de ce côté.",
  };
}

async function chercherSocietes(description: string) {
  if (description.trim().length < 3) return { erreur: 'Décrivez la société cherchée.' };
  const inst = await chargerInstantane();
  const r = rechercheMotsCles(description, inst.fiches);
  return {
    seance: inst.actualiseLe,
    statut: r.statut,
    societes: r.resultats.slice(0, 5).map((x) => ({
      code: x.code,
      nom: x.nom,
      faits: x.faits.map((f) => `${f.libelle} : ${f.valeur}`),
      lien: `${SITE}/societes/${x.code}`,
    })),
  };
}

function notionBourse(sujet: string, lecons: LeconIndex[]) {
  const trouvees = classerNotions(sujet, lecons);
  if (trouvees.length === 0) return { lecons: [], message: 'Aucune leçon Academy ne traite précisément ce sujet.' };
  return {
    lecons: trouvees.map((l) => ({ cours: l.cours, lecon: l.titre, lien: `${SITE}/formations/academy/${l.slug}` })),
    note: 'Contenu réservé à la formation : explique la notion en quelques mots, sans chiffre, puis renvoie à la leçon.',
  };
}

/** Ne lève jamais : une erreur devient un objet `erreur`, comme executerOutil. */
export async function executerOutilChatbot(
  db: SupabaseClient,
  userId: string | null,
  perso: boolean,
  nom: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (PERSONNELS.has(nom) && (!perso || !userId)) {
    return { erreur: 'Réservé aux abonnés Premium dont le WhatsApp est lié et l’assistant activé.' };
  }
  try {
    switch (nom) {
      case 'fiche_societe':
        return await ficheSociete(db, String(args.code ?? ''));
      case 'carnet_ordres':
        return await carnetOrdres(db, String(args.code ?? ''));
      case 'comparer_valeurs': {
        const liste = lireListeValeurs(String(args.codes ?? ''));
        if (!liste) return { erreur: 'Indiquez deux ou trois valeurs à comparer.' };
        return { valeurs: await Promise.all(liste.map((c) => ficheSociete(db, c))) };
      }
      case 'chercher_societes':
        return await chercherSocietes(String(args.description ?? ''));
      case 'notion_bourse':
        return notionBourse(String(args.sujet ?? ''), await leconsAcademy());
    }
  } catch (e) {
    console.error('[chatbot/outils]', nom, (e as Error).message);
    return { erreur: 'Donnée temporairement indisponible.' };
  }
  return sansSignal(await executerOutil(db, userId ?? '', nom, args));
}
