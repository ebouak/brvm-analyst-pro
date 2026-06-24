// scraper/scripts/finance-fix/run.mjs   ->   node scripts/finance-fix/run.mjs <CODE>
import { upsertAndVerify } from './lib.mjs';

const code = process.argv[2];
if (!code) { console.error('usage: node run.mjs <CODE>'); process.exit(1); }

const mod = await import(`./companies/${code}.mjs`);
const res = await upsertAndVerify(code, mod.default);
console.log(JSON.stringify(res, null, 2));
if (res.dbErrors.length || res.issues.length) { console.error('⚠️ ÉCHEC garde-fous'); process.exit(2); }
console.log('✅', code, 'OK');
