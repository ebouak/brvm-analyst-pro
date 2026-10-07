import Link from 'next/link';
import { ApercuFrame, ApercuNav } from '@/components/apercu-app/ApercuFrame';
import { HeroAppHybride } from '@/components/apercu-app/HeroAppHybride';
import { SeanceStrip } from '@/components/apercu-app/SeanceStrip';
import { BentoApp } from '@/components/apercu-app/BentoApp';
import { getLandingBisData } from '@/lib/landing/bisData';
import { fmtDateFR } from '@/lib/format';
export const revalidate = 300;
export const metadata = { robots: { index: false, follow: false }, title: 'Apercu — Marche en direct (hybride)' };
export default async function ApercuDashboardPage(){
 const d=await getLandingBisData();
 const dateLabel=d.dateMarche?fmtDateFR(d.dateMarche):null;
 return (
  <ApercuFrame title="Apercu — Marche en direct" subtitle="Meme 60/40 que la landing : editorial + live (IndexChart / JaugeSentiment), isole en sombre sous .apv.">
   <ApercuNav />
   <HeroAppHybride d={d} dateLabel={dateLabel} />
   <div style={{marginTop:12}}><SeanceStrip asOf={d.dateMarche} nbActions={d.nbActions} href="/apercu/dashboard" /></div>
   <section aria-label="Top du jour" style={{marginTop:14,display:'grid',gap:12}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
     <div style={{background:'rgb(var(--color-surface))',border:'1px solid rgb(var(--color-border))',borderRadius:14,padding:12}}>
      <p className="num" style={{fontSize:10,letterSpacing:'.12em',textTransform:'uppercase',color:'rgb(var(--color-faint))'}}>Top hausses</p>
      <ul style={{listStyle:'none',padding:0,margin:'8px 0 0',display:'grid',gap:6}}>{d.topHausses.slice(0,5).map((m)=>(<li key={m.code} style={{display:'flex',justifyContent:'space-between',fontSize:12}}><Link href={`/actions/${m.code}`} style={{fontWeight:600}}>{m.code}</Link><span className="num" style={{color:'rgb(var(--color-up))'}}>+{m.variation.toFixed(2)}%</span></li>))}</ul>
     </div>
     <div style={{background:'rgb(var(--color-surface))',border:'1px solid rgb(var(--color-border))',borderRadius:14,padding:12}}>
      <p className="num" style={{fontSize:10,letterSpacing:'.12em',textTransform:'uppercase',color:'rgb(var(--color-faint))'}}>Top baisses</p>
      <ul style={{listStyle:'none',padding:0,margin:'8px 0 0',display:'grid',gap:6}}>{d.topBaisses.slice(0,5).map((m)=>(<li key={m.code} style={{display:'flex',justifyContent:'space-between',fontSize:12}}><Link href={`/actions/${m.code}`} style={{fontWeight:600}}>{m.code}</Link><span className="num" style={{color:'rgb(var(--color-down))'}}>{m.variation.toFixed(2)}%</span></li>))}</ul>
     </div>
    </div>
    <p style={{fontSize:11,color:'rgb(var(--color-faint))'}}>Ancre <code>#marche</code> — <Link href="/dashboard" style={{textDecoration:'underline',textUnderlineOffset:3}}>dashboard prod</Link></p>
   </section>
   <BentoApp />
   <p style={{fontSize:11,color:'rgb(var(--color-faint))',marginTop:10}}>Previews : <Link href="/apercu/portefeuille">Portefeuille</Link> · <Link href="/apercu/actions">Actions</Link> · <Link href="/apercu/societes">Societes</Link> · <Link href="/apercu/signaux">Signaux</Link> · <Link href="/apercu/obligations">Obligations</Link> · <Link href="/apercu/heatmap">Heatmap</Link></p>
  </ApercuFrame>
 );
}
