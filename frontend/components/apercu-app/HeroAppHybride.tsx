'use client';
import Link from 'next/link';
import { IndexChart } from '@/components/landing/apercu/IndexChart';
import { JaugeSentiment } from '@/components/landing/apercu/JaugeSentiment';
import type { LandingBisData } from '@/lib/landing/bisData';
import { fmtNumber } from '@/lib/format';
const fmtPct=(v:number)=>`${v>0?'+':v<0?'−':''}${Math.abs(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} %`;
const fmtM=(v:number|null)=>v==null?'—':v>=1e9?`${(v/1e9).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} Md`:v>=1e6?`${(v/1e6).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} M`:v>=1e3?`${(v/1e3).toLocaleString('fr-FR',{maximumFractionDigits:0})} k`:fmtNumber(v);
export function HeroAppHybride({d,dateLabel}:{d:LandingBisData;dateLabel:string|null}){
 const brvm=d.brvmC; const v=brvm?.variation??null; const score=d.etat.sentimentScore??50;
 const h=d.hausses,b=d.baisses,s=d.inchangees,tot=d.nbActions;
 const lb=score>=60?'Tendance acheteuse':score<=40?'Tendance vendeuse':'Équilibre';
 return (<section className="hh" aria-labelledby="h-app"><div className="hh-grid"><div className="hh-claim">
  <p className="hh-kicker"><span className="hh-dot" aria-hidden /> APERÇU APP · DONNÉES RÉELLES — LECTURE SEULE</p>
  <h1 id="h-app" className="hh-title">Le marché<br/>en <em>aperçu</em></h1>
  <p className="hh-lead">Même 60/40 que la vitrine : éditorial à gauche, <b>marché en direct</b> à droite. Source <code>brvm.org</code> toutes les 15 min — <Link href="/dashboard" style={{textDecoration:'underline',textUnderlineOffset:3}}>dashboard prod</Link>.</p>
  <div className="hh-cta" style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}>
    <Link href="/signup" style={{minHeight:44,padding:'0 18px',display:'inline-flex',alignItems:'center',borderRadius:999,background:'rgb(var(--color-accent))',color:'#06141a',fontWeight:700}}>Créer mon compte →</Link>
    <Link href="/apercu/portefeuille" style={{minHeight:44,padding:'0 14px',display:'inline-flex',alignItems:'center',borderRadius:999,border:'1px solid rgb(var(--color-border))'}}>Portefeuille (preview)</Link>
  </div>
  <p className="hh-preuve" style={{marginTop:10,fontSize:12,color:'rgb(var(--color-muted))',display:'flex',gap:6,flexWrap:'wrap'}}><span className="num">{tot>0?`${tot} sociétés`:'BRVM'}</span><i>·</i><span className="num" style={{color:'rgb(var(--color-up))'}}>{h} hausses</span><i>·</i><span className="num" style={{color:'rgb(var(--color-down))'}}>{b} baisses</span>{dateLabel&&<><i>·</i><span>{dateLabel}</span></>}{v!=null&&<><i>·</i><span className="num">{`BRVM-C ${fmtPct(v)}`}</span></>}</p>
  <p style={{fontSize:11,color:'rgb(var(--color-faint))',marginTop:6}}>Preview noindex — pas un conseil en investissement.</p>
 </div><div className="hh-live" aria-label="Marché en direct">
  <div className="hh-live-head"><span className="hh-live-kicker"><span className="live-dot" aria-hidden /> MARCHÉ EN DIRECT</span>{dateLabel&&<span className="hh-live-date num">{dateLabel}</span>}</div>
  <div className="hh-live-brvm"><div><span style={{fontSize:10,letterSpacing:'.12em',textTransform:'uppercase',color:'rgb(var(--color-muted))'}}>BRVM Composite</span><b className="num" style={{display:'block',fontSize:22,lineHeight:1}}>{brvm?fmtNumber(Math.round(brvm.valeur)):'—'}</b><small className="num" style={{color:'rgb(var(--color-muted))',fontSize:11}}>veille {brvm?.veille!=null?fmtNumber(Math.round(brvm.veille)):'—'}</small></div>{v!=null&&<span className={`hh-pill num ${v>=0?'is-up':'is-down'}`} style={{fontSize:12,padding:'4px 8px',borderRadius:999,border:'1px solid rgb(var(--color-border))'}}>{fmtPct(v)}</span>}</div>
  {d.brvmCSerie.length>=2&&<div className="hh-chart"><IndexChart serie={d.brvmCSerie} /></div>}
  <div className="hh-stats"><div className="hh-stat"><b className="num">{fmtM(d.etat.valeurEchangee)}</b><span>Valeur échangée</span>{d.etat.valeurVsVeille!=null&&<em className="num">{`${fmtPct(d.etat.valeurVsVeille)} vs veille`}</em>}</div><div className="hh-stat"><b className="num">{d.etat.titresEchanges!=null?fmtNumber(d.etat.titresEchanges):'—'}</b><span>Titres échangés</span></div><div className="hh-stat"><b className="num">{d.etat.transactions!=null?fmtNumber(d.etat.transactions):'—'}</b><span>Transactions</span></div></div>
  <div className="hh-sentiment"><div className="hh-sentiment-jauge"><JaugeSentiment score={score} /></div><div className="hh-sentiment-txt"><b className="num">{`${Math.round(score)}/100 · ${lb}`}</b><span><b className="up">{h}</b> hausses · <b>{s}</b> stables · <b className="down">{b}</b> baisses <small className="num">sur {tot}</small></span>{d.plusEchangee&&<span className="hh-plus">La plus échangée · <b className="num">{d.plusEchangee.code}</b> · {fmtM(d.plusEchangee.valeur)}</span>}</div></div>
  <div className="hh-live-foot"><span className="hh-stamp">Source brvm.org · 15 min · <Link href="/methodologie" style={{textDecoration:'underline',textUnderlineOffset:3}}>Méthode</Link></span><Link href="/apercu/actions" className="hh-voir">Voir les actions →</Link></div>
 </div></div></section>);}