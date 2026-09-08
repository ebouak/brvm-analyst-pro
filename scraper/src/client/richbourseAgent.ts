/**
 * Agent HTTP pour richbourse.com — un choix à expliciter plutôt qu'à subir.
 *
 * Richbourse renvoie **403** à « Mozilla/5.0 (compatible; BRVMAnalystPro/1.0) »
 * et 200 à un agent de navigateur : un filtre grossier sur la chaîne, qui
 * contredit leur propre robots.txt. Celui-ci est explicite — « une page servie
 * en 200 à un visiteur anonyme ET déclarée dans le sitemap est ouverte », pour
 * TOUS les robots, IA génératives comprises. Ni `/common/dividende/index` ni
 * `/common/mouvements/index/<CODE>` ne figurent dans un Disallow, et le bloc
 * réservé aux robots d'IA se termine par `Allow: /`.
 *
 * On garde donc NOTRE IDENTITÉ et notre URL dans la chaîne : le préfixe
 * navigateur sert à passer le filtre, pas à se faire passer pour un humain.
 *
 * POURQUOI CE FICHIER EXISTE. La chaîne vivait en double, et une seule des
 * deux copies était juste : `richbourse-details.ts` gardait l'ancienne, prenait
 * 403 sur chaque appel et laissait `flottant` et `vol_moyen_30j` à 0 ligne sur
 * 335 depuis la migration `0020`. Une justification recopiée diverge ; une
 * constante partagée ne le peut pas.
 */
export const RICHBOURSE_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BRVMAnalystPro/1.0 (+https://westbourse.com)';
