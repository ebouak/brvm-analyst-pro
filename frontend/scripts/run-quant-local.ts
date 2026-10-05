import * as fs from 'fs';
import * as path from 'path';
(() => {
  const p = path.join(__dirname, '..', '.env.local');
  const txt = fs.readFileSync(p,'utf8');
  for(const line of txt.split('\n')){
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if(m){ const k=m[1].trim(); let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(!process.env[k]) process.env[k]=v; }
  }
})();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const calculationDate = (()=>{ const a=args.find(s=>s.startsWith('--date=')); return a ? a.slice(7) : undefined; })() as string | undefined;

async function main(){
  // next/headers n'existe pas hors requête HTTP, mais runQuantModels n'utilise que createPublicClient + getServiceClient
  // On importe après avoir chargé dotenv
  const { runQuantModels } = await import('../lib/quant/run-model');
  console.log(`→ runQuantModels calc=${calculationDate ?? '(today)'} dryRun=${dryRun}`);
  const res = await runQuantModels({ calculationDate, dryRun });
  console.log(JSON.stringify({ calculationDate: res.calculationDate, total: res.total, eligible: res.eligible, runs: res.runs, sample: res.results.slice(0,5) }, null, 2));
  if(!dryRun){
    console.log('Persisté:', res.runs);
  } else {
    console.log('Dry-run : rien écrit. Top 5 combined:');
    const top = [...res.results].filter(r=> r.combinedAlpha!=null).sort((a,b)=> (b.combinedAlpha! - a.combinedAlpha!)).slice(0,5);
    console.table(top);
  }
}
main().catch(e=>{ console.error(e); process.exit(1); });

