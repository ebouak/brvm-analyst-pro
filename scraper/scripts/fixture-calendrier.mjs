// Extrait les fragments positionnés d'un calendrier BRVM en fixture de test.
// Même extraction que src/dividends/calendrierFetch.ts (trim, x/y arrondis).
// Usage : node scripts/fixture-calendrier.mjs <calendrier.pdf> <sortie.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error('Usage : node scripts/fixture-calendrier.mjs <calendrier.pdf> <sortie.json>');
  process.exit(1);
}
const doc = await getDocument({ data: new Uint8Array(readFileSync(entree)) }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const contenu = await (await doc.getPage(i)).getTextContent();
  pages.push(
    contenu.items
      .filter((x) => 'str' in x && x.str.trim())
      .map((x) => ({ s: x.str.trim(), x: Math.round(x.transform[4]), y: Math.round(x.transform[5]) })),
  );
}
writeFileSync(sortie, JSON.stringify(pages));
console.log(`${sortie} : ${pages.length} page(s), ${pages.flat().length} fragments`);
