/**
 * Noms de société tels qu'on les écrit dans un article : « Sonatel » plutôt que
 * « SONATEL SENEGAL ». COPIE de `nomDit` (video/recit.mjs) : vidéo et scraper
 * sont deux paquets distincts — toute correction est à reporter des deux côtés.
 */
const PAYS = ["COTE D'IVOIRE", 'BURKINA FASO', 'GUINEE BISSAU', 'SENEGAL', 'NIGER', 'MALI', 'BENIN', 'TOGO'];
const MOTS: Record<string, string> = {
  SOCIETE: 'Société', GENERALE: 'Générale', NESTLE: 'Nestlé', TOTALENERGIES: 'TotalEnergies',
  BERNABE: 'Bernabé', SODE: 'Sodeci', SENEGAL: 'Sénégal', BENIN: 'Bénin', COTE: 'Côte',
};
// Divergence assumée avec video/recit.mjs : les suffixes pays (CI, SN, BF, TG)
// et quelques sigles restent en capitales — la vidéo dit encore « Unilever Ci ».
const ACRONYMES = new Set([
  'CFAO', 'CIE', 'SMB', 'SOGB', 'NSIA', 'BICI', 'NEI', 'CEDA',
  'CI', 'SN', 'BF', 'TG', 'SGBCI', 'SAPH', 'SITAB', 'SVOC', 'ETI',
]);
const PETITS = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'ET', 'POUR', 'OF']);

const normaliser = (s: string) => s.replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().toUpperCase();

/** Retire le pays final, sauf s'il fait partie du nom (« … DU BENIN »). */
function tronc(nom: string): string {
  for (const p of PAYS) {
    if (nom.endsWith(` ${p}`)) {
      const reste = nom.slice(0, -p.length - 1);
      return /\b(DU|DE)$|D'$/.test(reste) ? nom : reste;
    }
  }
  return nom;
}

function casse(mot: string): string {
  return mot
    .split('-')
    .map((m) => MOTS[m] ?? (ACRONYMES.has(m) ? m : m.charAt(0) + m.slice(1).toLowerCase()))
    .join('-');
}

function joliNom(nom: string): string {
  return nom
    .split(' ')
    .map((mot, i) => {
      const ap = mot.match(/^([LD])'(.+)$/);
      if (ap) return `${i === 0 ? ap[1] : (ap[1] ?? '').toLowerCase()}'${casse(ap[2] ?? '')}`;
      if (i > 0 && PETITS.has(mot)) return mot.toLowerCase();
      return casse(mot);
    })
    .join(' ');
}

/** Le pays reste quand il départage (Bank of Africa Sénégal / Niger). */
export function nomDit(designation: string, toutes: string[] = []): string {
  const nom = normaliser(designation);
  const t = tronc(nom);
  if (t !== nom) {
    const autres = toutes.map(normaliser).filter((x) => x !== nom).map(tronc);
    if (autres.some((x) => x === t || x.startsWith(`${t} `))) return joliNom(nom);
  }
  return joliNom(t);
}
