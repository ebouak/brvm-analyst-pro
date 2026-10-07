'use client';
import Link from 'next/link';
import { IndexChart } from './IndexChart';
import { JaugeSentiment } from './JaugeSentiment';
import type { LandingBisData } from '@/lib/landing/bisData';
import { fmtNumber } from '@/lib/format';
const fmtPct=(v:number)=>`${v>0?'+':v<0?'−':''}${Math.abs(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} %`;
const fmtM=(v:number|null)=>v==null?'—':v>=1e9?`${(v/1e9).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} Md`:v>=1e6?`${(v/1e6).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})} M`:v>=1e3?`${(v/1e3).toLocaleString('fr-FR',{maximumFractionDigits:0})} k`:fmtNumber(v);
export function HeroHybride({d,dateLabel}:{d:LandingBisData;dateLabel:string|null}){
 const brvm=d.brvmC; const v=brvm?.variation??null; const score=d.etat.sentimentScore??50;
 const h=d.hausses,b=d.baisses,s=d.inchangees,tot=d.nbActions;
 const lb=score>=60?'Tendance acheteuse':score<=40?'Tendance vendeuse':'Équilibre';
 return (<section className="hh" aria-labelledby="h1"><div className="hh-grid"><div className="hh-claim">
 <p className="hh-kicker"><span className="hh-dot" aria-hidden /> BRVM · DONNÉES VÉRIFIÉES — TOUTES LES 15 MIN EN SÉANCE</p>
 <h1 id="h1" className="hh-title">De la donnée<br />à la <em>décision</em></h1>
 <p className="hh-lead">La BRVM décryptée avec les chiffres officiels — cours, volumes, fondamentaux et signaux expliqués. Pas de rumeurs, <b>les mêmes données que les professionnels</b>, rendues lisibles.</p>
 <ul className="hh-assur">{['Aucune carte bancaire','Compte en 1 minute','Sans engagement'].map(t=>(<li key={t}><svg width={16} height={16} viewBox="0 0 16 16" aria-hidden><circle cx={8} cy={8} r={8} fill="rgb(var(--color-up))"/><path d="M4.5 8.5l2.2 2.2L11.5 6" fill="none" stroke="white" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/></svg>{t}</li>))}</ul>
 <div className="hh-cta"><Link href="/signup" className="btn btn-ink btn-lg">Créer mon compte gratuit <span aria-hidden>→</span></Link><Link href="/societes" className="btn btn-ghost">Explorer les {tot>0?tot:''} sociétés <span aria-hidden>→</span></Link></div>
 <p className="hh-preuve"><span className="num">{tot>0?`${tot} sociétés cotées`:'BRVM'}</span><i>·</i><span className="num" style={{color:'rgb(var(--color-up))'}}>{h} hausses</span><i>·</i><span className="num" style={{color:'rgb(var(--color-down))'}}>{b} baisses</span>{dateLabel&&<><i>·</i><span>{dateLabel}</span></>}{v!=null&&<><i>·</i><span className="num">{`BRVM-C ${fmtPct(v)}`}</span></>}</p>
 <p className="hh-note">Ceci n&apos;est pas un conseil en investissement — notes et signaux sont des indicateurs quantitatifs, expliqués et vérifiables.</p>
 </div><div className="hh-live" aria-label="Marché en direct">
 <div className="hh-live-head"><span className="hh-live-kicker"><span className="live-dot" aria-hidden /> MARCHÉ EN DIRECT</span>{dateLabel&&<span className="hh-live-date num">{dateLabel}</span>}</div>
 <div className="hh-live-brvm"><div><span className="over" style={{fontSize:10}}>BRVM Composite</span><b className="num" style={{display:'block',fontSize:22,lineHeight:1,letterSpacing:'-0.02em'}}>{brvm?fmtNumber(Math.round(brvm.valeur)):'—'}</b><small className="num" style={{color:'var(--muted)',fontSize:11}}>veille {brvm?.veille!=null?fmtNumber(Math.round(brvm.veille)):'—'}</small></div>{v!=null&&<span className={`hh-pill num ${v>=0?'is-up':'is-down'}`}>{fmtPct(v)}</span>}</div>
 {d.brvmCSerie.length>=2&&<div className="hh-chart"><IndexChart serie={d.brvmCSerie} /></div>}
 <div className="hh-stats"><div className="hh-stat"><b className="num">{fmtM(d.etat.valeurEchangee)}</b><span>Valeur échangée</span>{d.etat.valeurVsVeille!=null&&<em className="num">{`${fmtPct(d.etat.valeurVsVeille)} vs veille`}</em>}</div><div className="hh-stat"><b className="num">{d.etat.titresEchanges!=null?fmtNumber(d.etat.titresEchanges):'—'}</b><span>Titres échangés</span></div><div className="hh-stat"><b className="num">{d.etat.transactions!=null?fmtNumber(d.etat.transactions):'—'}</b><span>Transactions</span></div></div>
 <div className="hh-sentiment"><div className="hh-sentiment-jauge"><JaugeSentiment score={score} /></div><div className="hh-sentiment-txt"><b className="num">{`${Math.round(score)}/100 · ${lb}`}</b><span><b className="up">{h}</b> hausses · <b>{s}</b> stables · <b className="down">{b}</b> baisses <small className="num">sur {tot}</small></span>{d.plusEchangee&&<span className="hh-plus">La plus échangée · <b className="num">{d.plusEchangee.code}</b> · {fmtM(d.plusEchangee.valeur)}</span>}</div></div>
 <div className="hh-live-foot"><span className="hh-stamp">Source brvm.org · 15 min · <Link href="/methodologie" style={{textDecoration:'underline',textUnderlineOffset:3}}>Méthode</Link></span><Link href="#marche" className="hh-voir">Voir toute la séance <span aria-hidden>→</span></Link></div>
 </div></div><p className="hh-sub">Données officielles · Analyses expliquées · Outils concrets — la même plateforme côté vitrine et côté app.</p></section>);}
