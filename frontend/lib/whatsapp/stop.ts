import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { enregistrerOpposition } from '@/lib/crm/opposition';
import { userParChat } from './liaisons';
import { telephoneDepuisChatId } from './appairage';
import { passerelleWhatsapp } from './passerelle';
import { formesNumero } from './stopNumero';

const ACCUSE_OK = "C'est noté : WESTBOURSE ne vous enverra plus de propositions commerciales. Vos alertes et services restent actifs ; vous pouvez les couper dans vos paramètres.";
const ACCUSE_INCONNU = 'STOP bien reçu. Si vous avez un compte WESTBOURSE, vous pouvez aussi vous opposer depuis vos paramètres.';

/**
 * STOP reçu : opposition (art. 21) de l'e-mail du ou des comptes rattachés —
 * par la conversation (couvre @lid), sinon par numéro prouvé ou déclaré. Un
 * numéro déclaré n'est pas unique : s'il correspond à plusieurs comptes, TOUS
 * sont mis en opposition (une opposition ne nuit jamais). true = au moins une
 * opposition enregistrée ; false = expéditeur non rattaché ou erreur (l'appelant
 * transmet alors à la console, comme tout message). Ne lève jamais ; aucun
 * numéro ni e-mail dans les journaux.
 */
export async function traiterStop(chatId: string): Promise<boolean> {
  let enregistre = false;
  let connu = false;
  try {
    const db = getServiceClient();
    const ids = new Set<string>();
    const parChat = await userParChat(db, chatId);
    if (parChat) ids.add(parChat);

    const formes = formesNumero(telephoneDepuisChatId(chatId));
    if (!ids.size && formes.length) {
      // Deux requêtes .in() plutôt qu'un .or() : pas de « + » à échapper dans la syntaxe de filtre.
      const requetes = [
        db.from('whatsapp_liaisons').select('user_id').in('telephone', formes),
        db.from('notification_prefs').select('user_id').in('whatsapp_phone', formes),
        db.from('notification_prefs').select('user_id').in('telephone_declare', formes),
      ];
      for (const r of await Promise.all(requetes)) {
        if (r.error) throw new Error(`recherche : ${r.error.code ?? 'erreur'}`);
        for (const l of r.data ?? []) ids.add(l.user_id as string);
      }
    }

    let echec = false;
    for (const id of ids) {
      const { data, error } = await db.auth.admin.getUserById(id);
      const email = data?.user?.email ?? null;
      if (error || !email) {
        echec = true;
        continue;
      }
      if (await enregistrerOpposition(email, 'whatsapp')) enregistre = true;
      else echec = true;
    }
    if (echec) console.error('[waha] STOP : enregistrement incomplet'); // sans numéro ni e-mail
    // Compte connu mais rien d'enregistré : pas d'accusé trompeur, la console prend le relais.
    if (!enregistre && ids.size > 0) return false;
    connu = ids.size > 0;
  } catch (e) {
    console.error('[waha] STOP :', (e as Error).message);
    return false;
  }
  if (enregistre || !connu) {
    await passerelleWhatsapp().envoyerTexte(chatId, enregistre ? ACCUSE_OK : ACCUSE_INCONNU).catch(() => null);
  }
  return enregistre;
}
