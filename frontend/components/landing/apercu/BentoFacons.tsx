'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
// Bento 2x2 editoriale — remplace 4 colonnes : 2 grandes cartes premium + 2 second rang. Pas de néon.
const EASE=[0.22,1,0.36,1] as const;
const PREMIUM=new Set(['/premium/paper-trading','/premium/diagnostic']);
const PROTEGEES=new Set(['/signaux','/fondamentaux','/screener','/parametres/alertes','/portefeuille','/premium/paper-trading','/backtest','/obligations','/weekly']);
interface O{ t:string;d:string;href:string;ic:React.ReactNode }
const Ic=({c}:{c:React.ReactNode})=><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>{c}</svg>;
const I:any={ trend:<path d="M3 16l5-6 4 4 5-8 4 5"/>, search:<><circle cx={11} cy={11} r={7}/><path d="M20 20l-4-4"/></>, bell:<><path d="M6 9a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/></>, pie:<><path d="M12 3v9h9"/><circle cx={12} cy={12} r={9}/></>, sim:<><path d="M4 18l5-7 4 4 7-9"/><path d="M4 21h16"/></>, news:<><rect x={4} y={4} width={16} height={16} rx={2}/><path d="M8 9h8M8 13h8M8 17h5"/></>, bond:<><rect x={3} y={6} width={18} height={12} rx={2}/><path d="M7 12h10M7 15h6"/></>, scale:<><path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z"/></> };
export function BentoFacons(){
 const cols=[
  {k:'01',t:'Analyser',d:"Comprendre une société avant d'agir.", accent:'rgb(var(--color-accent))', href:'/societes', outils:[
   {t:'Fondamentaux',d:'Bilans, résultats, ratios',href:'/fondamentaux',ic:I.search},{t:'Signaux',d:'Notes A–F et BUY/HOLD/SELL',href:'/signaux',ic:I.trend},{t:'Diagnostics',d:'Dossiers Premium structurés',href:'/premium/diagnostic',ic:I.news},{t:'Screener',d:'Filtrer les 46 sociétés',href:'/screener',ic:I.search},
  ]},
  {k:'02',t:'Surveiller',d:'Ne rien rater de la séance.', accent:'rgb(var(--color-up))', href:'/fonds', outils:[
   {t:'Portefeuille',d:'Positions, perf., dividendes',href:'/portefeuille',ic:I.pie},{t:'Alertes',d:'Seuils, gardiens, email',href:'/parametres/alertes',ic:I.bell},{t:'Brief du soir',d:'L’essentiel à 18h',href:'/weekly',ic:I.news},
  ]},
  {k:'03',t:'Simuler',d:'Tester avant de décider.', accent:'rgb(var(--color-warn))', href:'/simulateur', outils:[
   {t:'Portefeuille fictif',d:'Capital virtuel sans risque',href:'/premium/paper-trading',ic:I.sim},{t:'Backtest',d:'Rejouer 10 ans, dividendes inclus',href:'/backtest',ic:I.trend},{t:'Comparateur SGI',d:'Trouver la bonne SGI',href:'/comparateur-sgi',ic:I.scale},
  ]},
  {k:'04',t:'Explorer',d:'Élargir au-delà des actions.', accent:'rgb(var(--color-purple))', href:'/obligations', outils:[
   {t:'Obligations',d:'YTM, duration, courbe des taux',href:'/obligations',ic:I.bond},{t:'Analyses hebdo',d:'Valeurs à suivre',href:'/analyses/hebdo',ic:I.news},{t:'Academy & API',d:'Se former, intégrer',href:'/formations',ic:I.scale},
  ]},
 ];
 return (
 <section className="bento" aria-labelledby="h-bento">
  <div className="bento-head"><div><p className="over">La plateforme</p><h2 id="h-bento">Quatre façons de travailler<br/>le <span className="accent">marché</span>.</h2><p className="lead">Les mêmes outils que dans l’app — présentés comme une une de presse, pas un dashboard.</p></div><p className="hand" aria-hidden>Des outils concrets<br/>pour aller plus loin.</p></div>
  <div className="bento-grid">
   {cols.map((c,i)=>(
    <motion.article key={c.k} className={`bento-card ${i<2?'is-hero':''}`} style={{['--acc' as string]:c.accent}} initial={{opacity:0,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.2}} transition={{duration:0.45,ease:EASE,delay:i*0.05}} whileHover={{y:-2}}>
     <header><span className="k num">{c.k}</span><h3>{c.t}</h3><p>{c.d}</p></header>
     <ul>{c.outils.map(o=>(
      <li key={o.t}><Link href={o.href}><span className="ic"><Ic c={o.ic}/></span><span><b>{o.t}{PREMIUM.has(o.href)?<em className="cg cg--premium">Premium ✦</em>:PROTEGEES.has(o.href)?<em className="cg">compte gratuit</em>:null}</b><small>{o.d}</small></span></Link></li>
     ))}</ul>
     <Link href={c.href} className="voir">Voir les outils <span aria-hidden>→</span></Link>
    </motion.article>
   ))}
  </div>
  <div className="banner"><div><b>Une plateforme. Plusieurs façons de travailler le marché.</b><span>Des données fiables · Des analyses claires · Des outils concrets</span></div><Link href="/signup" className="btn btn-gold">Créer mon compte gratuit <span aria-hidden>→</span></Link></div>
 </section>
 );
}
