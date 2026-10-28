/**
 * Noms de société tels qu'on les écrit dans un article : « Sonatel », « Nestlé CI ».
 * COPIE de scraper/src/articles/noms.ts (paquets distincts) — à corriger des deux côtés.
 */
const PAYS = ["COTE D'IVOIRE", 'BURKINA FASO', 'GUINEE BISSAU', 'SENEGAL', 'NIGER', 'MALI', 'BENIN', 'TOGO'];
const MOTS: Record<string, string> = {
  SOCIETE: 'Société', GENERALE: 'Générale', NESTLE: 'Nestlé', TOTALENERGIES: 'TotalEnergies',
  BERNABE: 'Bernabé', SODE: 'Sodeci', SENEGAL: 'Sénégal', BENIN: 'Bénin', COTE: 'Côte',
};
const ACRONYMES = new Set([
  'CFAO', 'CIE', 'SMB', 'SOGB', 'NSIA', 'BICI', 'NEI', 'CEDA',
  'CI', 'SN', 'BF', 'TG', 'SGBCI', 'SAPH', 'SITAB', 'SVOC', 'ETI',
]);
const PETITS = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'ET', 'POUR', 'OF']);

const normaliser = (s: string) => s.replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim().toUpperCase();

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

export function nomDit(designation: string, toutes: string[] = []): string {
  const nom = normaliser(designation);
  const t = tronc(nom);
  if (t !== nom) {
    const autres = toutes.map(normaliser).filter((x) => x !== nom).map(tronc);
    if (autres.some((x) => x === t || x.startsWith(`${t} `))) return joliNom(nom);
  }
  return joliNom(t);
}
