'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Etape } from './FilConducteur';
const EASE=[0.22,1,0.36,1] as const;
export function TimelineHybride({ etapes }: { etapes: Etape[] }){
 return (
 <section className="tlh" aria-labelledby="h-tlh">
  <div className="tlh-head">
   <div>
    <p className="over">De la source à la décision</p>
    <h2 id="h-tlh">Sept étapes.<br />Une seule <span className="accent">exigence</span> : la preuve.</h2>
    <p className="lead">Chaque étape s&apos;appuie sur la précédente. Rien n&apos;est affirmé sans la donnée qui le justifie — et chaque chiffre ci-dessous est réel, daté, vérifiable.</p>
   </div>
   <p className="tlh-note" aria-hidden><span className="hand">Rien n&apos;est affirmé<br />sans la donnée qui<br />le justifie.</span><svg viewBox="0 0 90 8" width={90} height={8}><path d="M2 5 C 25 1, 60 8, 88 3" fill="none" stroke="rgb(var(--color-accent))" strokeWidth={3} strokeLinecap="round"/></svg></p>
  </div>
  <ol className="tl">
   {etapes.map((e,idx)=>(
    <motion.li key={e.k} className="tl-step" initial={{opacity:0,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.2}} transition={{duration:0.45,ease:EASE,delay:idx*0.05}}>
     <span className="tl-line" aria-hidden />
     <span className="tl-dot" style={{background:e.bg,borderColor:e.c, color:e.c}}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>{e.ic}</svg></span>
     <span className="tl-k num">{e.k}</span>
     <div className="tl-body">
      <h3>{e.t}</h3>
      <p className="tl-desc">{e.d}</p>
      {e.fait?(
       <div className="tl-fait">
        <span className="over" style={{fontSize:10}}>{e.fait.libelle}</span>
        <b className="num tl-val">{e.fait.valeur}</b>
        <p>{e.fait.detail}</p>
        {e.fait.href&&<Link href={e.fait.href} className="tl-link">{e.fait.hrefLabel??'Voir'} <span aria-hidden>→</span></Link>}
       </div>
      ):(
       <div className="tl-fait is-empty"><span className="over" style={{fontSize:10}}>Donnée indisponible</span><p>Cette étape s&apos;illustre avec un chiffre réel de la dernière séance ; il n&apos;est pas encore en base.</p></div>
      )}
     </div>
    </motion.li>
   ))}
  </ol>
  <p className="tl-foot">Source brvm.org · méthode transparente · <Link href="/methodologie" style={{textDecoration:'underline',textUnderlineOffset:3}}>Lire la méthode</Link> — ceci n&apos;est pas un conseil en investissement.</p>
 </section>
 );
}
