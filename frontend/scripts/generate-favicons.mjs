import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++) c=(c&1)?(0xedb88320 ^ (c>>>1)):(c>>>1); t[n]=c;} return t;})();
function crc32(buf){ let c=0xffffffff; for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c>>>8); return (c ^ 0xffffffff) >>> 0; }
function u32be(n){ const b=Buffer.alloc(4); b.writeUInt32BE(n,0); return b; }
function chunk(type,data){ const t=Buffer.from(type); return Buffer.concat([u32be(data.length),t,data,u32be(crc32(Buffer.concat([t,data]))) ]); }
function encodePNG(width,height,rgba){
  const sig=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const rowBytes=width*4+1; const raw=Buffer.alloc(rowBytes*height);
  for(let y=0;y<height;y++){ const off=y*rowBytes; raw[off]=0; rgba.copy(raw,off+1,y*width*4,y*width*4+width*4); }
  const comp=zlib.deflateSync(raw);
  return Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',comp),chunk('IEND',Buffer.alloc(0))]);
}
function createRgba(w,h){ return Buffer.alloc(w*h*4); }
function setPixel(buf,W,H,x,y,col){ if(x<0||x>=W||y<0||y>=H) return; const i=(y*W+x)*4; buf[i]=col[0]; buf[i+1]=col[1]; buf[i+2]=col[2]; buf[i+3]=col[3]; }
function drawCircle(buf,W,H,cx,cy,r,col){ const ri=Math.round(r); if(ri<=0){setPixel(buf,W,H,Math.round(cx),Math.round(cy),col);return;} for(let dy=-ri;dy<=ri;dy++) for(let dx=-ri;dx<=ri;dx++) if(dx*dx+dy*dy<=ri*ri+0.5) setPixel(buf,W,H,cx+dx,cy+dy,col); }
function drawThickLine(buf,W,H,x0,y0,x1,y1,col,thick){ const len=Math.hypot(x1-x0,y1-y0); const steps=Math.max(1,Math.ceil(len*2)); const r=thick/2; for(let i=0;i<=steps;i++){ const t=i/steps; drawCircle(buf,W,H,Math.round(x0+(x1-x0)*t),Math.round(y0+(y1-y0)*t),r,col);} }
function pointInTri(px,py,a,b,c){ const d1=(px-c.x)*(a.y-c.y)-(a.x-c.x)*(py-c.y); const d2=(px-a.x)*(b.y-a.y)-(b.x-a.x)*(py-a.y); const d3=(px-b.x)*(c.y-b.y)-(c.x-b.x)*(py-b.y); const hasNeg=(d1<0)||(d2<0)||(d3<0); const hasPos=(d1>0)||(d2>0)||(d3>0); return !(hasNeg&&hasPos); }
function fillTriangle(buf,W,H,p1,p2,p3,col){ const minX=Math.max(0,Math.floor(Math.min(p1.x,p2.x,p3.x))); const maxX=Math.min(W-1,Math.ceil(Math.max(p1.x,p2.x,p3.x))); const minY=Math.max(0,Math.floor(Math.min(p1.y,p2.y,p3.y))); const maxY=Math.min(H-1,Math.ceil(Math.max(p1.y,p2.y,p3.y))); for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) if(pointInTri(x+0.5,y+0.5,p1,p2,p3)) setPixel(buf,W,H,x,y,col); }
function insideRoundedRect(x,y,W,H,r){ const cx=x+0.5,cy=y+0.5; if(cx>=r&&cx<W-r) return true; if(cy>=r&&cy<H-r) return true; let cx2,cy2; if(cx<r&&cy<r){cx2=r;cy2=r;} else if(cx>=W-r&&cy<r){cx2=W-r;cy2=r;} else if(cx<r&&cy>=H-r){cx2=r;cy2=H-r;} else if(cx>=W-r&&cy>=H-r){cx2=W-r;cy2=H-r;} else return true; const dx=cx-cx2,dy=cy-cy2; return dx*dx+dy*dy<=r*r; }
const BG=[0x0c,0x1d,0x2e,255]; const WHITE=[0xff,0xff,0xff,255]; const TEAL=[0x16,0xb6,0xa4,255];
function renderIcon(size, { transparent }={transparent:true}){
  const W=size,H=size; const buf=createRgba(W,H);
  if(transparent){
    const rx=(96*size)/512;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const ok=insideRoundedRect(x,y,W,H,rx); const i=(y*W+x)*4; if(ok){buf[i]=BG[0];buf[i+1]=BG[1];buf[i+2]=BG[2];buf[i+3]=BG[3];} else buf[i+3]=0; }
  } else {
    for(let i=0;i<W*H;i++){ const o=i*4; buf[o]=BG[0];buf[o+1]=BG[1];buf[o+2]=BG[2];buf[o+3]=BG[3]; }
  }
  const scale=size/512; function tx(p){ return {x:(76+p.x*2.77)*scale, y:(146+p.y*2.77)*scale}; }
  const thick=12*2.77*scale;
  const pA=tx({x:16,y:24}),pB=tx({x:40,y:82}),pC=tx({x:58,y:48}),pD=tx({x:76,y:82}),pE=tx({x:76,y:82}),pF=tx({x:100,y:33});
  const t1=tx({x:110,y:12}),t2=tx({x:117,y:40}),t3=tx({x:86,y:28});
  drawThickLine(buf,W,H,pA.x,pA.y,pB.x,pB.y,WHITE,thick);
  drawThickLine(buf,W,H,pB.x,pB.y,pC.x,pC.y,WHITE,thick);
  drawThickLine(buf,W,H,pC.x,pC.y,pD.x,pD.y,WHITE,thick);
  drawThickLine(buf,W,H,pE.x,pE.y,pF.x,pF.y,TEAL,thick);
  fillTriangle(buf,W,H,t1,t2,t3,TEAL);
  return encodePNG(W,H,buf);
}
const outDir=path.resolve('frontend/public');
const targets=[
  {size:16,name:'favicon-16x16.png', transparent:true},
  {size:32,name:'favicon-32x32.png', transparent:true},
  {size:180,name:'apple-touch-icon.png', transparent:false},
  {size:192,name:'icon-192.png', transparent:false},
  {size:512,name:'icon-512.png', transparent:false},
];
for(const {size,name,transparent} of targets){ const png=renderIcon(size,{transparent}); fs.writeFileSync(path.join(outDir,name),png); console.log('wrote '+name+' '+png.length+' bytes '+size+'x'+size+(transparent?' rounded':' square')); }
function buildIco(entries){ const count=entries.length; const header=Buffer.alloc(6); header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(count,4); const dirSize=16*count; let offset=6+dirSize; const dirs=[]; for(const e of entries){ const d=Buffer.alloc(16); d[0]=e.size>=256?0:e.size; d[1]=e.size>=256?0:e.size; d[2]=0; d[3]=0; d.writeUInt16LE(1,4); d.writeUInt16LE(32,6); d.writeUInt32LE(e.png.length,8); d.writeUInt32LE(offset,12); offset+=e.png.length; dirs.push(d);} return Buffer.concat([header,...dirs,...entries.map(e=>e.png)]); }
const icoEntries=[16,32].map(s=>({size:s,png:fs.readFileSync(path.join(outDir,s===16?'favicon-16x16.png':'favicon-32x32.png'))}));
const ico=buildIco(icoEntries); fs.writeFileSync(path.join(outDir,'favicon.ico'),ico); console.log('wrote favicon.ico '+ico.length+' bytes');
