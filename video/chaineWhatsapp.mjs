/**
 * Chaîne WhatsApp WESTBOURSE (lot B, spec docs/superpowers/specs/2026-10-24-whatsapp-lot-b-design.md).
 *
 * `legendeWhatsapp` est PURE : la légende est composée des nombres de
 * seance.json, la même lecture que les images et la voix de la vidéo.
 * `publierChaine` envoie la vidéo DÉJÀ hébergée dans le bucket public (la
 * passerelle la télécharge par son URL : aucun second téléversement).
 *
 * Doublon : un marqueur `chaine/<séance>.json` est créé AVANT l'envoi, en
 * création seule. Une relance manuelle du workflow le trouve et ne republie
 * pas ; un envoi raté le retire, pour qu'une relance puisse réessayer.
 */

const fr = (x, d = 2) => x.toFixed(d).replace('.', ',');
const sg = (x, d = 2) => `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;

export const NUMERO_WHATSAPP = '33743657271';

export function legendeWhatsapp(m) {
  const lignes = [`📊 *BRVM — séance du ${m.date_fr}*`, ''];
  if (m.composite) {
    lignes.push(`📈 *BRVM Composite* : ${sg(m.composite.variation_pct)} % à ${fr(m.composite.valeur)} points`);
  }
  lignes.push(`🟢 ${m.hausses} hausses · 🔴 ${m.baisses} baisses · ⚪ ${m.stables} stables (${m.valeurs} valeurs)`);
  lignes.push(`💰 ${m.capitaux_estimes ? 'Environ ' : ''}${fr(m.capitaux_fcfa / 1e9)} Md FCFA échangés`);
  if (m.plus_forte_hausse) {
    lignes.push(`🚀 Plus forte hausse : *${m.plus_forte_hausse.code}* ${sg(m.plus_forte_hausse.variation_pct)} %`);
  }
  if (m.plus_forte_baisse) {
    lignes.push(`📉 Plus forte baisse : *${m.plus_forte_baisse.code}* ${sg(m.plus_forte_baisse.variation_pct)} %`);
  }
  lignes.push(
    '',
    m.capitaux_estimes
      ? '_Chiffres de la séance officielle de la BRVM ; capitaux estimés (cours × titres), la valeur officielle n’étant pas publiée. Information de marché, pas un conseil en investissement._'
      : '_Chiffres de la séance officielle de la BRVM. Information de marché, pas un conseil en investissement._',
    '',
    '💬 Un cours, un dividende ? Écrivez *AIDE* à WESTBOURSE :',
    `https://wa.me/${NUMERO_WHATSAPP}?text=AIDE`,
    '🔎 Analyses complètes : https://www.westbourse.com',
  );
  return lignes.join('\n').slice(0, 4096);
}

/**
 * Marqueur `chaine/<séance>.json` dans le bucket `seance-video`. Création SANS
 * upsert : le stockage refuse un objet existant (409), ce qui fait du marqueur
 * un verrou « une publication par séance » sans table supplémentaire.
 */
export function marqueurBucket({ urlSupabase, entetes, seance, bucket = 'seance-video', fetchImpl = fetch }) {
  const objet = `${urlSupabase}/storage/v1/object/${bucket}/chaine/${seance}.json`;
  return {
    async creer() {
      const r = await fetchImpl(objet, {
        method: 'POST',
        headers: { ...entetes, 'Content-Type': 'application/json', 'x-upsert': 'false' },
        body: JSON.stringify({ publie_le: new Date().toISOString() }),
      });
      if (r.ok) return true;
      const corps = await r.text();
      if (r.status === 409 || /already exists|Duplicate/i.test(corps)) return false;
      throw new Error(`marqueur → ${r.status} ${corps.slice(0, 200)}`);
    },
    async retirer() {
      await fetchImpl(objet, { method: 'DELETE', headers: entetes });
    },
  };
}

/**
 * @returns {Promise<'publie' | 'deja-publie'>} — lève en cas d'échec réel.
 * `marqueur.creer()` renvoie false si le marqueur existait déjà.
 */
export async function publierChaine({ m, urlVideo, waha, chaineId, marqueur, fetchImpl = fetch }) {
  if (!(await marqueur.creer())) return 'deja-publie';
  try {
    const r = await fetchImpl(`${waha.url.replace(/\/+$/, '')}/api/sendVideo`, {
      method: 'POST',
      headers: { 'X-Api-Key': waha.cle, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: waha.session || 'default',
        chatId: chaineId,
        file: { url: urlVideo, mimetype: 'video/mp4', filename: `westbourse-seance-${m.seance}.mp4` },
        caption: legendeWhatsapp(m),
        convert: false,
      }),
      // La passerelle télécharge la vidéo puis la téléverse chez WhatsApp.
      signal: AbortSignal.timeout(180_000),
    });
    if (!r.ok) {
      // Le corps d'erreur de WAHA ne contient pas la clé d'API ; on le tronque.
      throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    return 'publie';
  } catch (e) {
    await marqueur.retirer().catch(() => {});
    throw e;
  }
}
