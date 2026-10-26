/**
 * Rectificatif du fractionnement SNTS (26/10/2026), envoi unique et manuel
 * (.github/workflows/correctif-snts.yml).
 *
 * Le 26/10, le brief a annoncé SNTS à −89,28 % (veille non ajustée au
 * fractionnement 1 → 10) au lieu de +7,18 %. Ce script écrit :
 *  - aux destinataires du brief de ce soir-là (campagne_envois « brief-2026-10-26 ») ;
 *  - aux porteurs de SNTS (portefeuille, portefeuille virtuel, thèse), avec
 *    leurs lignes converties par la migration 0166.
 *
 * MODE D'ESSAI PAR DÉFAUT : sans --envoyer, affiche destinataires masqués et
 * textes, n'envoie rien. Idempotent : chaque envoi est journalisé dans
 * campagne_envois, une relance ne réécrit à personne.
 */
const ENVOYER = process.argv.includes('--envoyer');
const env = process.env;
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env[k]) { console.error(`${k} absent`); process.exit(1); }
if (ENVOYER && !(env.RESEND_API_KEY && env.ALERTS_EMAIL_FROM)) { console.error('RESEND_API_KEY / ALERTS_EMAIL_FROM absents'); process.exit(1); }
const SB = env.SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
// Clé sb_ : apikey SEUL ; clé héritée : apikey + Bearer (CLAUDE.md, 2026-09-18).
const H = { ...(K.startsWith('sb_') ? { apikey: K } : { apikey: K, Authorization: `Bearer ${K}` }), 'User-Agent': 'westbourse-correctif/1' };
const api = async (chemin, init = {}) => {
  const r = await fetch(`${SB}/rest/v1/${chemin}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${chemin.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 || r.status === 201 ? null : r.json();
};
const masquer = (e) => e.replace(/^(.)[^@]*/, '$1…');

const SUJET_ERRATUM = 'Correctif — séance du 26 octobre : Sonatel +7,18 %, et non −89,28 %';
const erratum = [
  'Bonjour,',
  '',
  'Le brief de la séance du 26 octobre que vous avez reçu contenait une erreur : il annonçait une baisse de 89,28 % pour Sonatel (SNTS).',
  '',
  "Lundi 26 octobre, Sonatel a fractionné son action : chaque action ancienne a été remplacée par 10 actions nouvelles, et le cours a été divisé par 10. Notre collecte a comparé le nouveau cours (4 700 F) à l'ancien (43 850 F) sans l'ajuster.",
  '',
  'Les chiffres justes :',
  '• Sonatel gagne 7,18 % (4 385 F ajusté → 4 700 F) : plus forte hausse de la séance ;',
  '• plus forte baisse : NSIA Banque CI, −7,49 % ;',
  '• 13 hausses, 21 baisses, 14 stables.',
  '',
  'Si vous détenez des actions Sonatel, vous en avez désormais dix fois plus, chacune valant dix fois moins : la valeur de votre ligne ne change pas.',
  '',
  "Ce que nous avons changé : l'historique de Sonatel est ajusté sur WESTBOURSE, et une variation impossible (au-delà du plafond quotidien de la BRVM, ±7,5 %) bloque désormais toute publication automatique.",
  '',
  'La vidéo corrigée est en ligne : https://www.westbourse.com',
  '',
  'Toutes nos excuses pour cette erreur.',
  "L'équipe WESTBOURSE",
].join('\n');

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/\u202f/g, ' ');
const SUJET_PORTEUR = 'Sonatel (SNTS) : votre ligne a été convertie après le fractionnement';
function messagePorteur(positions, paper, theses) {
  const lignes = [
    'Bonjour,',
    '',
    'Sonatel (SNTS) a fractionné son action le 26 octobre 2026 : 1 action ancienne = 10 actions nouvelles, et le cours a été divisé par 10. WESTBOURSE a converti vos données en conséquence. La valeur de chaque ligne ne change pas.',
    '',
  ];
  if (positions.length) {
    lignes.push('Votre portefeuille :');
    for (const p of positions) {
      lignes.push(`• ${fmt(p.quantite / 10)} actions à ${fmt(p.prix_entree * 10)} F → ${fmt(p.quantite)} actions à ${fmt(p.prix_entree)} F (montant investi inchangé : ${fmt(p.quantite * p.prix_entree)} F)`);
    }
    lignes.push('');
  }
  if (paper.length) {
    lignes.push('Votre portefeuille virtuel :');
    for (const p of paper) lignes.push(`• ${fmt(p.num_shares / 10)} actions à ${fmt(p.entry_price * 10)} F → ${fmt(p.num_shares)} actions à ${fmt(p.entry_price)} F`);
    lignes.push('');
  }
  if (theses.length) {
    lignes.push('Votre thèse d’investissement :');
    for (const t of theses) lignes.push(`• cours de référence ${fmt(t.cours_reference * 10)} → ${fmt(t.cours_reference)} F${t.objectif ? `, objectif ${fmt(t.objectif * 10)} → ${fmt(t.objectif)} F` : ''}`);
    lignes.push('');
  }
  lignes.push(
    'Le cours de clôture du 26 octobre est de 4 700 F, en hausse de 7,18 % sur la veille ajustée (4 385 F). Si vous avez vu passer une baisse de 89,28 % dans nos publications d’hier soir, elle était fausse : notre collecte n’avait pas ajusté la veille au fractionnement. C’est corrigé.',
    '',
    'Vos chiffres sont à jour sur https://www.westbourse.com/portefeuille',
    '',
    "L'équipe WESTBOURSE",
  );
  return lignes.join('\n');
}
const enHtml = (t) =>
  `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:15px;line-height:1.55">${t
    .split('\n\n').map((b) => `<p style="margin:0 0 14px">${b.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('')}</div>`;

// ── Destinataires ────────────────────────────────────────────────────────
const brief = await api('campagne_envois?campagne=eq.brief-2026-10-26&statut=eq.envoye&select=email');
const pos = await api('portfolios_positions?code=eq.SNTS&select=user_id,quantite,prix_entree');
const pap = await api('paper_trading_positions?code=eq.SNTS&select=user_id,num_shares,entry_price');
const the = await api('investment_theses?code=eq.SNTS&select=user_id,cours_reference,objectif');
const ids = [...new Set([...pos, ...pap, ...the].map((r) => r.user_id))];
const profils = await api(`profiles?id=in.(${ids.join(',')})&select=id,email`);
const porteurs = profils.filter((p) => p.email).map((p) => ({
  email: p.email,
  texte: messagePorteur(pos.filter((r) => r.user_id === p.id), pap.filter((r) => r.user_id === p.id), the.filter((r) => r.user_id === p.id)),
}));

const dejaEnvoyes = async (campagne) =>
  new Set((await api(`campagne_envois?campagne=eq.${campagne}&statut=eq.envoye&select=email`)).map((r) => r.email));
const journaliser = (campagne, email) =>
  api('campagne_envois?on_conflict=campagne,email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ campagne, email, statut: 'envoye' }),
  });
async function mail(to, sujet, texte) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ALERTS_EMAIL_FROM, to: [to], reply_to: 'support@westbourse.com', subject: sujet, text: texte, html: enHtml(texte) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} ${(await r.text()).slice(0, 160)}`);
}

if (!ENVOYER) {
  console.log(`=== ERRATUM → ${brief.map((b) => masquer(b.email)).join(', ')}\nObjet : ${SUJET_ERRATUM}\n\n${erratum}`);
  for (const p of porteurs) console.log(`\n=== PORTEUR → ${masquer(p.email)}\nObjet : ${SUJET_PORTEUR}\n\n${p.texte}`);
  console.log("\nMode d'essai — rien envoyé (relancer avec --envoyer).");
  process.exit(0);
}

const bilan = [];
let echecs = 0;
// 3. E-mails
for (const [campagne, cibles] of [
  ['correctif-snts-2026-10-26', brief.map((b) => ({ email: b.email, sujet: SUJET_ERRATUM, texte: erratum }))],
  ['porteurs-snts-2026-10-26', porteurs.map((p) => ({ email: p.email, sujet: SUJET_PORTEUR, texte: p.texte }))],
]) {
  const deja = await dejaEnvoyes(campagne);
  for (const c of cibles) {
    if (deja.has(c.email)) { bilan.push(`${campagne} : ${masquer(c.email)} déjà servi`); continue; }
    try {
      await mail(c.email, c.sujet, c.texte);
      await journaliser(campagne, c.email);
      bilan.push(`${campagne} : ${masquer(c.email)} envoyé`);
    } catch (e) {
      echecs++;
      bilan.push(`${campagne} : ${masquer(c.email)} ÉCHEC ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}
console.log(bilan.join('\n'));
if (echecs) process.exit(1);
