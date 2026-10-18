/* 亡骨行者 Online：遊戲引擎 */
'use strict';
(function(){
const CFG=window.BWCONFIG||{};
const {FLATS,PATHS,ZONES,ZONE_DEFAULT,SPEC,TROW,TAL,ITEMS,MAXLV,CAMPS,NPCS,QD,GEARN,SLOTN,NODE_POS}=window.BWDATA;
if(!window.THREE){document.getElementById('loading').textContent='3D 引擎載入失敗，請重新整理頁面。';return}
const T=THREE,TAU=Math.PI*2,$=id=>document.getElementById(id);
/* ===== 遊玩數據與天梯（GAS） ===== */
const NET={on:!!CFG.GAS_URL,q:[],t:0};
function pid(){let v='';try{v=localStorage.getItem('bw_pid')}catch(e){}if(!v){v='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);try{localStorage.setItem('bw_pid',v)}catch(e){}}return v}
function track(ev,extra){if(!NET.on||!window.__bwP)return;const P=window.__bwP;NET.q.push(Object.assign({ev,ts:Date.now(),zone:window.__bwZone||'',lvl:P.lvl},extra||{}));if(NET.q.length>=8||ev!=='hb')flush()}
function flush(){if(!NET.on||!NET.q.length||!window.__bwP)return;const P=window.__bwP;const body={pid:pid(),name:P.name,lvl:P.lvl,xp:P.xp,spec:P.spec||'',kills:P.stats.kills,deaths:P.stats.deaths,time:Math.round(P.stats.time),quests:window.__bwQDone||0,ver:CFG.VERSION||'',events:NET.q.splice(0)};
  try{fetch(CFG.GAS_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body),keepalive:true}).catch(()=>{})}catch(e){}}
function fetchLadder(){if(!NET.on)return Promise.reject(new Error('off'));return fetch(CFG.GAS_URL+'?action=top').then(r=>r.json())}

const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const d2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function angLerp(a,b,t){let d=((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;return a+d*t}
function hash2(i,j){let n=(Math.imul(i|0,374761393)+Math.imul(j|0,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);return lerp(lerp(hash2(xi,zi),hash2(xi+1,zi),u),lerp(hash2(xi,zi+1),hash2(xi+1,zi+1),u),v)}
function seeded(s){return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
const R=seeded(20261018),rr=(a,b)=>a+R()*(b-a);
function h(tag,props,...kids){const e=document.createElement(tag);if(props)for(const k in props){if(k==='on')for(const ev in props.on)e.addEventListener(ev,props.on[ev]);else if(k==='cls')e.className=props[k];else if(k==='style')e.style.cssText=props[k];else if(k in e)e[k]=props[k];else e.setAttribute(k,props[k])}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:String(c))}return e}

/* ================= 世界地形 ================= */


function segD(x,z,s){const ax=s[0],az=s[1],dx=s[2]-ax,dz=s[3]-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-ax-dx*t,z-az-dz*t)}
function pathD(x,z){let d=1e9;for(const s of PATHS){const v=segD(x,z,s);if(v<d)d=v}return d}
function heightAt(x,z){
  let hh=(vnoise(x*.035+10,z*.035+3)-.5)*6+(vnoise(x*.12+5,z*.12)-.5)*1.3;
  let f=1;for(const F of FLATS)f=Math.min(f,sstep(F[2],F[2]+14,Math.hypot(x-F[0],z-F[1])));
  f=Math.min(f,.25+.75*sstep(2,7,pathD(x,z)));hh*=f;
  const e=Math.max(Math.abs(x),Math.abs(z));if(e>86)hh+=Math.pow(e-86,1.3)*.6*(.6+vnoise(x*.06,z*.06)*.8);
  return hh}



/* ================= Three 基礎 ================= */
const cvs=$('gl');
const renderer=new T.WebGLRenderer({canvas:cvs,antialias:true,powerPreference:'high-performance'});
let QUAL='high';try{QUAL=localStorage.getItem('bw_quality')||(matchMedia('(pointer:coarse)').matches?'mid':'high')}catch(e){}
const QCFG={high:{pr:1.75,sh:1024},mid:{pr:1.35,sh:512},low:{pr:1,sh:0}};
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,QCFG[QUAL].pr));
const scene=new T.Scene();
const FOGC=new T.Color('#4a4360');
scene.background=FOGC.clone();scene.fog=new T.Fog(FOGC,30,100);
const camera=new T.PerspectiveCamera(60,1,.1,500);
scene.add(new T.HemisphereLight('#aca6dc','#2c281f',.9));
const sun=new T.DirectionalLight('#ffe0c0',.75);sun.position.set(-40,60,35);scene.add(sun);scene.add(sun.target);
renderer.shadowMap.enabled=QCFG[QUAL].sh>0;renderer.shadowMap.type=T.PCFSoftShadowMap;sun.castShadow=QCFG[QUAL].sh>0;sun.shadow.mapSize.set(QCFG[QUAL].sh||512,QCFG[QUAL].sh||512);
(function(){const c=sun.shadow.camera;c.left=-26;c.right=26;c.top=26;c.bottom=-26;c.near=1;c.far=150;sun.shadow.bias=-.0006;sun.shadow.normalBias=.02})();

const GC={},MC={};
const geo={
  box:(w,hh,d)=>{const k='b'+w+','+hh+','+d;return GC[k]||(GC[k]=new T.BoxGeometry(w,hh,d))},
  cyl:(a,b,hh,s=6)=>{const k='c'+a+','+b+','+hh+','+s;return GC[k]||(GC[k]=new T.CylinderGeometry(a,b,hh,s))},
  sph:(r,w=8,hs=6)=>{const k='s'+r+','+w+','+hs;return GC[k]||(GC[k]=new T.SphereGeometry(r,w,hs))},
  cone:(r,hh,s=6)=>{const k='k'+r+','+hh+','+s;return GC[k]||(GC[k]=new T.ConeGeometry(r,hh,s))},
  ico:(r,d=0)=>{const k='i'+r+','+d;return GC[k]||(GC[k]=new T.IcosahedronGeometry(r,d))},
  oct:r=>{const k='o'+r;return GC[k]||(GC[k]=new T.OctahedronGeometry(r,0))}
};
const M=c=>MC['l'+c]||(MC['l'+c]=new T.MeshLambertMaterial({color:c}));
const MB=c=>MC['b'+c]||(MC['b'+c]=new T.MeshBasicMaterial({color:c}));
const ME=(c,e)=>MC['e'+c+e]||(MC['e'+c+e]=new T.MeshLambertMaterial({color:c,emissive:e}));
function add(g,m,x,y,z,p){const o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);if(!m.isMeshBasicMaterial){o.castShadow=true;o.receiveShadow=true}(p||scene).add(o);return o}
function canvasTex(w,hh,fn){const c=document.createElement('canvas');c.width=w;c.height=hh;fn(c.getContext('2d'),w,hh);const t=new T.CanvasTexture(c);return t}
const dotTex=canvasTex(32,32,(x)=>{const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.35,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,32,32)});
const shadowTex=canvasTex(64,64,(x)=>{const g=x.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64)});
const shadowMat=new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false});
const shadowGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);

/* 天空 */
(function(){const g=new T.SphereGeometry(320,24,12),c=[],top=new T.Color('#191630'),hor=new T.Color('#4a4360'),p=g.attributes.position;for(let i=0;i<p.count;i++){const k=clamp(p.getY(i)/320,0,1),cc=hor.clone().lerp(top,Math.pow(k,.6));c.push(cc.r,cc.g,cc.b)}g.setAttribute('color',new T.Float32BufferAttribute(c,3));scene.add(new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false})));
  const moon=new T.Mesh(new T.CircleGeometry(14,24),new T.MeshBasicMaterial({color:'#e9e4ff',fog:false}));moon.position.set(-120,130,-220);moon.lookAt(0,0,0);scene.add(moon);
  const halo=new T.Sprite(new T.SpriteMaterial({map:dotTex,color:'#b9a8ff',transparent:true,opacity:.45,fog:false,depthWrite:false}));halo.scale.set(80,80,1);halo.position.copy(moon.position);scene.add(halo)})();

/* 地形 */
const tmpC=new T.Color(),tmpC2=new T.Color();
function groundColor(x,z,y,out){
  const n=vnoise(x*.09,z*.09);out.set('#3a4230').lerp(tmpC2.set('#4c4a36'),n);
  if(z<-15)out.lerp(tmpC2.set('#4a5734'),sstep(-15,-45,z)*.6);
  if(x>28&&z>-6&&z<52)out.lerp(tmpC2.set('#2b3025'),.65*sstep(28,44,x));
  if(Math.hypot(x+55,z-68)<20)out.lerp(tmpC2.set('#4a4232'),.5*sstep(20,8,Math.hypot(x+55,z-68)));
  if(Math.hypot(x,z-72)<17)out.lerp(tmpC2.set('#3f3540'),.55*sstep(17,10,Math.hypot(x,z-72)));
  const pd=pathD(x,z);if(pd<3.3)out.lerp(tmpC2.set('#5e4d3b'),sstep(3.3,1.2,pd)*.9);
  if(y>2.2)out.lerp(tmpC2.set('#4e4a58'),sstep(2.2,7,y));
  out.multiplyScalar(1+(hash2(x*7|0,z*7|0)-.5)*.1);return out}
(function(){const g=new T.PlaneGeometry(240,240,110,110);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));
  const ng=g.toNonIndexed(),q=ng.attributes.position,cols=new Float32Array(q.count*3);
  for(let i=0;i<q.count;i+=3){const cx=(q.getX(i)+q.getX(i+1)+q.getX(i+2))/3,cz=(q.getZ(i)+q.getZ(i+1)+q.getZ(i+2))/3,cy=(q.getY(i)+q.getY(i+1)+q.getY(i+2))/3;groundColor(cx,cz,cy,tmpC);for(let k=0;k<3;k++){cols[(i+k)*3]=tmpC.r;cols[(i+k)*3+1]=tmpC.g;cols[(i+k)*3+2]=tmpC.b}}
  ng.setAttribute('color',new T.BufferAttribute(cols,3));ng.computeVertexNormals();const tm=new T.Mesh(ng,new T.MeshLambertMaterial({vertexColors:true}));tm.receiveShadow=true;scene.add(tm)})();

/* 靜態物件 */
const COLL=[];// {x,z,r}
function inst(g,m,list){if(!list.length)return;const im=new T.InstancedMesh(g,m,list.length),mx=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),p=new T.Vector3(),e=new T.Euler();
  list.forEach((o,i)=>{p.set(o.x,o.y,o.z);e.set(o.rx||0,o.ry||0,o.rz||0);q.setFromEuler(e);s.set(o.sx||o.s||1,o.sy||o.s||1,o.sz||o.s||1);mx.compose(p,q,s);im.setMatrixAt(i,mx);if(o.c)im.setColorAt(i,tmpC.set(o.c))});
  if(im.instanceColor)im.instanceColor.needsUpdate=true;im.castShadow=true;im.receiveShadow=true;scene.add(im);return im}
function freeSpot(x,z,pad){if(Math.abs(x)>97||Math.abs(z)>97)return false;if(pathD(x,z)<pad+2.5)return false;for(const F of FLATS)if(Math.hypot(x-F[0],z-F[1])<F[2]+pad)return false;for(const c of COLL)if(Math.hypot(x-c.x,z-c.z)<c.r+pad)return false;return true}
const trunks=[],canop=[],branches=[],rocks=[],tufts=[],graves=[],shrooms=[];
function addTree(x,z,dead){const s=rr(.8,1.35),y=heightAt(x,z);trunks.push({x,y:y,z,s,ry:rr(0,TAU),rz:rr(-.08,.08),c:pick(['#3a2c26','#43352c','#352c2c'])});
  if(!dead)canop.push({x,y:y+3.5*s,z,sx:s*rr(.9,1.2),sy:s*rr(.7,.95),sz:s*rr(.9,1.2),ry:rr(0,TAU),c:pick(['#3c3350','#463a5a','#36452f','#3f3b4a'])});
  for(let i=0;i<(dead?3:1);i++)branches.push({x,y:y+rr(1.8,2.8)*s,z,s,ry:rr(0,TAU),rz:rr(.7,1.1)*(R()<.5?-1:1),c:'#3a2c26'});
  COLL.push({x,z,r:.6*s})}
for(let i=0;i<70;i++){const a=rr(0,TAU),r=Math.sqrt(R())*24,x=55+Math.cos(a)*r,z=22+Math.sin(a)*r;if(freeSpot(x,z,1.6))addTree(x,z,R()<.25)}
for(let i=0;i<420&&trunks.length<210;i++){const x=rr(-96,96),z=rr(-96,96),e=Math.max(Math.abs(x),Math.abs(z));const dense=e>80?.9:Math.hypot(x,z-38)<20?.15:.4;if(R()<dense&&freeSpot(x,z,2.5))addTree(x,z,R()<.35)}
for(let i=0;i<120;i++){const x=rr(-98,98),z=rr(-98,98);if(freeSpot(x,z,1.5)){const s=rr(.5,1.8);rocks.push({x,y:heightAt(x,z)+.1,z,s,sy:s*rr(.5,.8),ry:rr(0,TAU),c:pick(['#5a5662','#4f4b57','#635e68'])});if(s>1.1)COLL.push({x,z,r:s*.8})}}
for(let i=0;i<700;i++){const x=rr(-98,98),z=rr(-98,98);if(pathD(x,z)>2.5)tufts.push({x,y:heightAt(x,z),z,s:rr(.6,1.3),ry:rr(0,TAU),rz:rr(-.2,.2),c:pick(['#55603d','#4a5236','#6a6a45','#5b4f6a'])})}
for(let i=0;i<34;i++){const a=rr(0,TAU),r=Math.sqrt(R())*15,x=-55+Math.cos(a)*r,z=68+Math.sin(a)*r;if(freeSpot(x,z,1.2)){graves.push({x,y:heightAt(x,z)+.5,z,ry:rr(-.3,.3)+Math.PI/2*0,rz:rr(-.15,.15),rx:rr(-.12,.12),c:pick(['#6a6670','#5a5660','#77727c'])});COLL.push({x,z,r:.45})}}
for(let i=0;i<10;i++){const x=rr(-14,14),z=rr(86,94);if(freeSpot(x,z,.8))graves.push({x,y:heightAt(x,z)+.5,z,rz:rr(-.15,.15),c:'#5a5660'})}
for(let i=0;i<60;i++){const a=rr(0,TAU),r=Math.sqrt(R())*24,x=55+Math.cos(a)*r,z=22+Math.sin(a)*r;shrooms.push({x,y:heightAt(x,z)+.15,z,s:rr(.6,1.3),c:pick(['#93d95e','#7df9c0','#c38cff'])})}
const tgTrunk=new T.CylinderGeometry(.22,.4,3.4,5);tgTrunk.translate(0,1.7,0);
const tgBr=new T.CylinderGeometry(.05,.12,1.7,4);tgBr.translate(0,.85,0);
const tgTuft=new T.ConeGeometry(.13,.6,3);tgTuft.translate(0,.3,0);
const WHITE=new T.MeshLambertMaterial({color:'#ffffff'});
inst(tgTrunk,WHITE,trunks);inst(geo.ico(1.6,0),WHITE,canop);inst(tgBr,WHITE,branches);inst(new T.DodecahedronGeometry(1,0),WHITE,rocks);inst(tgTuft,WHITE,tufts);
inst(geo.box(.75,1.1,.22),WHITE,graves);inst(geo.sph(.12,6,4),new T.MeshBasicMaterial({color:'#ffffff'}),shrooms);

/* 營地 */
const lights=[];
function ground(x,z){return heightAt(x,z)}
(function camp(){
  const stone=M('#57525f'),dark=M('#2a2531'),cx=0,cz=86;
  add(geo.box(12,4.5,6),stone,cx,ground(cx,cz)+2.2,cz);add(geo.box(12.8,.6,6.8),M('#47424f'),cx,ground(cx,cz)+4.6,cz);
  const roof=add(geo.cone(5.4,3,4),M('#3d3846'),cx,ground(cx,cz)+6.4,cz);roof.rotation.y=Math.PI/4;roof.scale.set(1.25,1,.7);
  add(geo.box(2.4,3,.3),dark,cx,ground(cx,cz)+1.5,cz-3.05);
  for(const s of[-1,1]){add(geo.box(.8,4.6,.8),M('#666070'),cx+s*1.7,ground(cx,cz)+2.3,cz-3.2);add(geo.sph(.35,6,5),MB('#93d95e'),cx+s*1.7,ground(cx,cz)+4.9,cz-3.2)}
  COLL.push({x:-3.5,z:86,r:3.4},{x:3.5,z:86,r:3.4},{x:0,z:86,r:3.2});
  [[-11,70],[11,67],[-9,60.5]].forEach(([x,z],i)=>{const t=add(geo.cone(2.3,3.2,4),M(i%2?'#4b2f6a':'#3e2858'),x,ground(x,z)+1.6,z);t.rotation.y=.3+i;add(geo.box(.9,1.4,.1),dark,x,ground(x,z)+.7,z-1.6).rotation.y=0;COLL.push({x,z,r:2})});
  // 營火
  const fx=5,fz=74,fy=ground(fx,fz);for(let i=0;i<8;i++){const a=i/8*TAU;add(geo.ico(.32,0),stone,fx+Math.cos(a)*1,fy+.15,fz+Math.sin(a)*1)}
  const fl=[add(geo.cone(.45,1.3,5),MB('#6dff5a'),fx,fy+.7,fz),add(geo.cone(.28,1.7,5),MB('#c8ff9a'),fx,fy+.85,fz)];
  const pl=new T.PointLight('#7dff6a',1.4,22,1.6);pl.position.set(fx,fy+2,fz);scene.add(pl);lights.push({l:pl,base:1.4,fl,x:fx,z:fz,c:'#93ff7a'});COLL.push({x:fx,z:fz,r:1.2});
  // 旗幟與柵欄
  const banTex=canvasTex(64,128,(x)=>{x.fillStyle='#4a2a6a';x.fillRect(0,0,64,128);x.fillStyle='#2a183c';x.fillRect(0,0,6,128);x.fillRect(58,0,6,128);x.fillStyle='#93d95e';x.beginPath();x.arc(32,46,14,0,TAU);x.fill();x.fillStyle='#4a2a6a';x.beginPath();x.arc(32,46,9,0,TAU);x.fill();x.fillStyle='#93d95e';x.fillRect(29,62,6,30);x.fillRect(20,72,24,5);x.fillStyle='#2a183c';x.beginPath();x.moveTo(0,128);x.lineTo(32,108);x.lineTo(64,128);x.fill()});
  const banM=new T.MeshLambertMaterial({map:banTex,side:T.DoubleSide});
  [[-5,58],[5,58],[-15,80],[15,80]].forEach(([x,z])=>{const y=ground(x,z);add(geo.cyl(.08,.1,5,5),M('#3a2c26'),x,y+2.5,z);const b=add(new T.PlaneGeometry(1.4,2.8),banM,x,y+3.4,z+.05);COLL.push({x,z,r:.3})});
  const posts=[];for(let i=0;i<46;i++){const a=i/46*TAU,x=Math.cos(a)*17,z=72+Math.sin(a)*17;if(Math.abs(x)<4&&z<72)continue;if(z>80&&Math.abs(x)<9)continue;posts.push({x,y:ground(x,z)+.6,z,ry:a,c:'#3a2e28'})}
  inst(geo.box(.22,1.4,.22),WHITE,posts);
  // 藥劑桌
  const ax=-12.5,az=76,ay=ground(ax,az);add(geo.box(2.6,.15,1.2),M('#4a3424'),ax,ay+1,az);for(const s of[-1,1])add(geo.box(.15,1,1),M('#3a2a1e'),ax+s*1.1,ay+.5,az);
  [['#93d95e',-.8],['#ff6a8a',-.3],['#7aa8ff',.3],['#93d95e',.8]].forEach(([c,o])=>add(geo.cyl(.12,.16,.4,6),MB(c),ax+o,ay+1.28,az+.1));COLL.push({x:ax,z:az,r:1.4});
  add(geo.cyl(.6,.5,.9,8),M('#2a2a2a'),ax+1.9,ay+.45,az+.6);add(geo.cyl(.52,.52,.05,8),MB('#6dff5a'),ax+1.9,ay+.92,az+.6);
})();
/* 銀晨前哨 */
(function(){
  const white=M('#d8d2c4'),blue=M('#2c4a9a'),gold=M('#c9a24a');
  [[-10,-36],[10,-44],[-6,-50],[12,-30],[-14,-46]].forEach(([x,z],i)=>{const y=ground(x,z);const t=add(geo.cone(2.4,3.4,4),i%2?white:M('#e6e0d2'),x,y+1.7,z);t.rotation.y=i*.7;add(geo.cone(.6,.8,4),gold,x,y+3.6,z).rotation.y=i*.7;COLL.push({x,z,r:2.1})});
  const banTex=canvasTex(64,128,(x)=>{x.fillStyle='#2c4a9a';x.fillRect(0,0,64,128);x.fillStyle='#c9a24a';x.fillRect(0,0,64,6);x.fillRect(28,24,8,60);x.fillRect(14,40,36,8);x.beginPath();x.moveTo(0,128);x.lineTo(32,106);x.lineTo(64,128);x.fillStyle='#1a2a5a';x.fill()});
  const banM=new T.MeshLambertMaterial({map:banTex,side:T.DoubleSide});
  [[-5,-22],[5,-22],[-6,-70],[6,-70],[52,-48],[60,-46]].forEach(([x,z])=>{const y=ground(x,z);add(geo.cyl(.08,.1,5.5,5),M('#7a6a4a'),x,y+2.7,z);add(new T.PlaneGeometry(1.4,2.8),banM,x,y+3.8,z+.05);COLL.push({x,z,r:.3})});
  const crates=[];for(let i=0;i<12;i++){const x=rr(-16,16),z=rr(-52,-28);if(freeSpot(x,z,1))crates.push({x,y:ground(x,z)+.45,z,s:rr(.8,1.1),ry:rr(0,1),c:'#7a5a3a'})}inst(geo.box(.9,.9,.9),WHITE,crates);
  const fx=2,fz=-40,fy=ground(fx,fz);const fl=[add(geo.cone(.45,1.3,5),MB('#ff9a3a'),fx,fy+.7,fz),add(geo.cone(.28,1.6,5),MB('#ffe08a'),fx,fy+.85,fz)];
  const pl=new T.PointLight('#ffae5a',1.2,20,1.6);pl.position.set(fx,fy+2,fz);scene.add(pl);lights.push({l:pl,base:1.2,fl,x:fx,z:fz,c:'#ffb35a'});COLL.push({x:fx,z:fz,r:1.2});
  // 審判庭
  const by=ground(0,-81);add(geo.cyl(11,11.5,.5,24),M('#6a6672'),0,by+.2,-81);add(geo.cyl(4,4,.12,24),MB('#d9b44a'),0,by+.5,-81);
  for(let i=0;i<6;i++){const a=i/6*TAU+.3,x=Math.cos(a)*9.5,z=-81+Math.sin(a)*9.5;if(z>-74&&Math.abs(x)<4)continue;add(geo.box(1.1,6,1.1),M('#8a8694'),x,by+3,z);add(geo.box(1.5,.4,1.5),gold,x,by+6.2,z);COLL.push({x,z,r:.9})}
  add(geo.box(3,3.5,1.2),M('#8a8694'),0,by+1.75,-90);add(geo.sph(.7,8,6),MB('#ffe9a0'),0,by+4.2,-90);COLL.push({x:0,z:-90,r:1.8});
  // 聖堂廢墟
  const wall=M('#9a96a2');[[52,-74,10,0],[72,-70,0,8],[62,-50,8,0]].forEach(([x,z,w,d])=>{const y=ground(x,z);if(w){add(geo.box(w,rr(3,6),1),wall,x,y+2,z);COLL.push({x:x-w/4,z,r:w/4+.5},{x:x+w/4,z,r:w/4+.5})}else{add(geo.box(1,rr(3,6),d),wall,x,y+2,z);COLL.push({x,z:z-d/4,r:d/4+.5},{x,z:z+d/4,r:d/4+.5})}});
  [[54,-60],[70,-60],[56,-68],[68,-54],[62,-74]].forEach(([x,z],i)=>{const y=ground(x,z),hh=i%2?6:3.5;add(geo.cyl(.6,.7,hh,8),wall,x,y+hh/2,z);COLL.push({x,z,r:.8})});
  const arch=ground(62,-78);add(geo.box(1.2,9,1.2),wall,58,arch+4.5,-78);add(geo.box(1.2,9,1.2),wall,66,arch+4.5,-78);add(geo.box(9.2,1.2,1.4),wall,62,arch+9,-78);add(geo.cyl(1.4,1.4,.2,16),MB('#ffe9a0'),62,arch+9,-77.2).rotation.x=Math.PI/2;
  // 亡語法陣
  const rx=-62,rz=-50,ry=ground(rx,rz);for(let i=0;i<8;i++){const a=i/8*TAU,x=rx+Math.cos(a)*7,z=rz+Math.sin(a)*7;const st=add(geo.box(1,rr(2.8,4),.6),M('#3a3446'),x,ry+1.6,z);st.rotation.y=-a;add(geo.sph(.18,6,4),MB('#c38cff'),x,ry+3.6,z);COLL.push({x,z,r:.6})}
})();
const ritualRing=add(new T.RingGeometry(4.6,5.2,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#c38cff',transparent:true,opacity:.6,depthWrite:false}),-62,ground(-62,-50)+.08,-50);
const ritualCore=add(geo.oct(.6),MB('#d9b8ff'),-62,ground(-62,-50)+1.6,-50);

/* ================= 角色模型 ================= */
const BONE='#e8e1cb';
function makeBiped(o){
  const root=new T.Group(),body=new T.Group();root.add(body);
  const skin=M(o.skin||BONE),robe=o.robeMat||M(o.robe),trim=M(o.trim||'#8a7a5a'),leg=M(o.leg||o.skin||BONE);
  const legs=[],arms=[];
  for(const s of[-1,1]){const g=new T.Group();g.position.set(s*.13,.6,0);body.add(g);add(geo.cyl(.055,.045,.56,5),leg,0,-.28,0,g);add(geo.box(.14,.08,.24),o.boot?M(o.boot):leg,0,-.57,.04,g);legs.push(g)}
  if(o.long){add(geo.cyl(.25,.46,.78,8),robe,0,.6,0,body);add(geo.cyl(.47,.47,.07,8),trim,0,.23,0,body)}
  else add(geo.box(.46,.34,.3),robe,0,.68,0,body);
  add(geo.cyl(.24,.27,.44,8),robe,0,1.1,0,body);
  if(o.tabard){add(geo.box(.3,.62,.04),M(o.tabard),0,.92,.26,body);add(geo.box(.08,.24,.05),trim,0,1.02,.285,body);add(geo.box(.2,.06,.05),trim,0,1.06,.285,body)}
  if(o.ribs){add(geo.box(.2,.26,.05),skin,0,1.13,.22,body);for(let i=0;i<3;i++)add(geo.box(.17,.022,.06),M('#2a2230'),0,1.05+i*.075,.225,body)}
  for(const s of[-1,1])add(geo.sph(.13,6,5),trim,s*.27,1.3,0,body);
  for(const s of[-1,1]){const g=new T.Group();g.position.set(s*.32,1.27,0);body.add(g);add(geo.cyl(.075,.1,.44,6),robe,0,-.2,0,g);add(geo.sph(.075,6,5),o.glove?M(o.glove):skin,0,-.45,0,g);arms.push(g)}
  const head=new T.Group();head.position.y=1.66;body.add(head);
  if(o.skull){const sk=add(geo.sph(.4,10,8),skin,0,0,0,head);sk.scale.set(1,.93,1.02);add(geo.box(.3,.12,.26),skin,0,-.32,.07,head);
    for(const s of[-1,1]){add(geo.sph(.105,6,5),M('#120d16'),s*.15,0,.31,head);add(geo.sph(.05,6,4),o.eyeMat||MB(o.eye||'#7df9ff'),s*.15,0,.37,head)}
    add(geo.box(.06,.07,.04),M('#120d16'),0,-.13,.385,head)}
  else{add(geo.sph(.34,10,8),skin,0,0,0,head);for(const s of[-1,1])add(geo.box(.06,.08,.03),M('#1a1410'),s*.12,.02,.33,head)}
  if(o.hood){const hd=add(new T.SphereGeometry(.47,10,8,0,TAU,0,Math.PI*.6),robe,0,.05,-.06,head);hd.rotation.x=-.5}
  if(o.helm){add(new T.SphereGeometry(.39,10,8,0,TAU,0,Math.PI*.5),M(o.helm),0,.03,0,head);add(geo.box(.06,.22,.5),M(o.crest||'#c9a24a'),0,.36,-.02,head)}
  let orb=null;const hand=new T.Group();hand.position.set(0,-.45,0);arms[1].add(hand);
  if(o.weapon==='staff'){add(geo.cyl(.035,.04,1.8,5),M(o.wood||'#4a3424'),0,.25,0,hand);orb=add(geo.sph(.13,8,6),o.orbMat||MB(o.orb||'#7df9ff'),0,1.2,0,hand);add(new T.TorusGeometry(.14,.025,4,8),trim,0,1.05,0,hand).rotation.x=Math.PI/2}
  if(o.weapon==='sword'){const sw=new T.Group();sw.rotation.x=Math.PI/2;hand.add(sw);add(geo.box(.07,.9,.03),M('#c8ccd6'),0,.5,0,sw);add(geo.box(.3,.05,.06),M('#c9a24a'),0,.05,0,sw)}
  if(o.weapon==='hammer'){add(geo.cyl(.04,.04,1.4,5),M('#6a4a2a'),0,.3,0,hand);add(geo.box(.45,.3,.3),M('#d8d0a8'),0,1,0,hand)}
  if(o.shield){add(geo.box(.07,.55,.42),M(o.shield),-.06,-.38,.06,arms[0]);add(geo.box(.08,.16,.16),M('#c9a24a'),-.07,-.38,.06,arms[0])}
  if(o.scale)root.scale.setScalar(o.scale);
  return{root,body,head,legs,arms,orb,kind:'bi'};
}
function makeWolf(col){
  const root=new T.Group(),body=new T.Group();root.add(body);const m=M(col),dk=M('#4a4644');
  add(geo.box(.5,.48,1.15),m,0,.78,0,body);add(geo.box(.58,.56,.5),m,0,.84,.38,body);
  const head=new T.Group();head.position.set(0,1.05,.78);body.add(head);add(geo.box(.42,.38,.44),m,0,0,0,head);add(geo.box(.24,.2,.32),dk,0,-.07,.32,head);
  for(const s of[-1,1]){add(geo.cone(.08,.22,4),m,s*.13,.27,-.05,head);add(geo.box(.07,.05,.03),MB('#ffcc44'),s*.12,.07,.23,head)}
  const legs=[];[[-.18,.38],[.18,.38],[-.18,-.38],[.18,-.38]].forEach(([x,z])=>{const g=new T.Group();g.position.set(x,.58,z);body.add(g);add(geo.box(.13,.58,.13),m,0,-.28,0,g);legs.push(g)});
  const tail=new T.Group();tail.position.set(0,.92,-.56);body.add(tail);add(geo.box(.12,.12,.55),m,0,0,-.25,tail).rotation.x=.4;
  return{root,body,head,legs,tail,kind:'quad'};
}
function makeSpider(){
  const root=new T.Group(),body=new T.Group();root.add(body);const m=M('#3b2a4a'),lm=M('#2a1f34');
  add(geo.sph(.38,8,6),m,0,.6,.15,body);const ab=add(geo.sph(.6,8,6),M('#4a3060'),0,.75,-.55,body);ab.scale.set(1,.8,1.15);add(geo.sph(.18,6,4),M('#93d95e'),0,1.05,-.75,body);
  for(const s of[-1,1]){add(geo.sph(.06,5,4),MB('#ff4a4a'),s*.12,.72,.48,body);add(geo.sph(.045,5,4),MB('#ff4a4a'),s*.22,.7,.42,body)}
  const legs=[];for(let i=0;i<8;i++){const s=i<4?-1:1,k=i%4,g=new T.Group();g.position.set(s*.25,.6,.3-k*.22);g.rotation.y=s*(k-1.5)*.35;body.add(g);
    const u=add(geo.cyl(.035,.04,.7,4),lm,s*.3,.2,0,g);u.rotation.z=-s*1.0;const l=add(geo.cyl(.03,.02,.8,4),lm,s*.68,-.15,0,g);l.rotation.z=s*.35;legs.push(g)}
  return{root,body,legs,kind:'spider'};
}
function makeElem(col){
  const root=new T.Group(),body=new T.Group();root.add(body);const core=add(geo.ico(.62,0),ME(col,new T.Color(col).multiplyScalar(.55)),0,1.3,0,body);
  const shards=[];for(let i=0;i<5;i++)shards.push(add(geo.oct(.18),MB(col),0,1.3,0,body));
  add(geo.cone(.35,.9,5),ME(col,new T.Color(col).multiplyScalar(.4)),0,.55,0,body).rotation.x=Math.PI;
  return{root,body,core,shards,kind:'elem'};
}
function animChar(c,t,st){
  const mv=st.move||0;
  if(c.kind==='gl'){if(st.dead){c.one=null;glSet(c,'Death_A');return}
    let want=st.sit?'Sit_Floor_Idle':st.gather?'PickUp':st.cast?'Spellcasting':mv>.6?'Running_A':mv>.12?'Walking_A':st.combat?'Idle_Combat':'Idle';
    if(c.one){if(mv>.6||st.sit)c.one=null;else want=c.one}glSet(c,want);return}
  if(c.kind==='bi'){
    const sw=Math.sin(t*9)*mv;c.legs[0].rotation.x=sw*.7;c.legs[1].rotation.x=-sw*.7;
    c.arms[0].rotation.x=-sw*.5;c.arms[1].rotation.x=sw*.5;c.arms[0].rotation.z=.12;c.arms[1].rotation.z=-.12;
    c.body.position.y=Math.abs(Math.sin(t*9))*.06*mv+Math.sin(t*2)*.015;c.head.rotation.z=Math.sin(t*1.3)*.04;
    if(st.cast){c.arms[0].rotation.x=-1.25+Math.sin(t*14)*.06;c.arms[1].rotation.x=-.95;c.arms[0].rotation.z=-.35;c.arms[1].rotation.z=.25}
    if(st.atk>0){c.arms[1].rotation.x=-2.3*st.atk;c.arms[1].rotation.z=-.3}
    if(st.sit){c.body.position.y=-.5;c.legs[0].rotation.x=c.legs[1].rotation.x=-1.45;c.arms[0].rotation.x=c.arms[1].rotation.x=-.45}
    c.body.rotation.x=st.dead?lerp(c.body.rotation.x,-1.48,.12):0;if(st.dead)c.body.position.y=-.25;
  }else if(c.kind==='quad'){
    const s=Math.sin(t*12)*mv;c.legs[0].rotation.x=c.legs[3].rotation.x=s*.8;c.legs[1].rotation.x=c.legs[2].rotation.x=-s*.8;
    c.body.position.y=Math.abs(s)*.05;c.tail.rotation.y=Math.sin(t*6)*.4;c.head.rotation.x=st.atk>0?-.6*st.atk:Math.sin(t*2)*.05;c.head.position.z=.78+(st.atk>0?.25*st.atk:0);
    c.body.rotation.z=st.dead?lerp(c.body.rotation.z,1.5,.12):0;
  }else if(c.kind==='spider'){
    c.legs.forEach((l,i)=>{l.rotation.x=Math.sin(t*16+i*1.7)*.35*mv+(st.atk>0&&i%4===0?-.5*st.atk:0)});c.body.position.y=Math.sin(t*14)*.03*mv;
    c.body.rotation.z=st.dead?lerp(c.body.rotation.z,Math.PI,.1):0;
  }else if(c.kind==='elem'){
    c.core.rotation.y=t*1.2;c.core.rotation.x=t*.7;c.body.position.y=st.dead?lerp(c.body.position.y,-1.4,.05):Math.sin(t*2)*.15;
    c.shards.forEach((s,i)=>{const a=t*2+i/5*TAU;s.position.set(Math.cos(a)*.95,1.3+Math.sin(t*3+i)*.3,Math.sin(a)*.95)});
    const sc=st.dead?Math.max(.01,c.root.scale.x*.96):1+(st.atk>0?.2*st.atk:0);c.core.scale.setScalar(sc);
  }
}
/* ===== KayKit glTF 角色 ===== */
const ASSETS={},ASSET_LIST=['sk_mage','sk_warrior','sk_minion','knight','hmage','w_staff','w_axe','w_shield'];
const ACC={knight:['1H_Sword_Offhand','Badge_Shield','Rectangle_Shield','Round_Shield','Spike_Shield','1H_Sword','2H_Sword'],hmage:['Spellbook','Spellbook_open','1H_Wand','2H_Staff']};
const ONCE={Death_A:1,Spellcast_Shoot:1,Spellcast_Raise:1,'1H_Melee_Attack_Chop':1,'2H_Melee_Attack_Chop':1,Cheer:1,Skeletons_Awaken_Floor:1,PickUp:0,Hit_A:1};
let CLIPS={};
function prepAsset(g){g.scene.traverse(n=>{if(!n.isMesh)return;const om=n.material,sk=!!n.isSkinnedMesh;let nm;
  if(!om.map)nm=new T.MeshBasicMaterial({color:om.name==='Glow'?'#7df9ff':om.color,skinning:sk});
  else{om.map.encoding=T.LinearEncoding;om.map.needsUpdate=true;nm=new T.MeshLambertMaterial({map:om.map,skinning:sk})}
  nm.name=om.name;n.material=nm;n.castShadow=true;n.frustumCulled=false})}
function loadAssets(onProg){const L=new T.GLTFLoader();let done=0;
  return Promise.all(ASSET_LIST.map(k=>fetch('assets/'+k+'.glb').then(r=>{if(!r.ok)throw new Error(k+' '+r.status);return r.arrayBuffer()}).catch(()=>fetch('assets/'+k+'.b64.txt').then(r=>{if(!r.ok)throw new Error(k+' '+r.status);return r.text()}).then(b=>{const bin=atob(b.trim()),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer})).then(buf=>new Promise((res,rej)=>L.parse(buf,'',res,rej))).then(g=>{prepAsset(g);ASSETS[k]=g;onProg&&onProg(++done,ASSET_LIST.length)})))
    .then(()=>{ASSETS.sk_mage.animations.forEach(c=>CLIPS[c.name]=c)})}
const TINT={};
function tintMat(m,col){const k=m.uuid+col;if(!TINT[k]){TINT[k]=m.clone();TINT[k].color.set(col)}return TINT[k]}
function findBone(o,name){return o.getObjectByName(name)||o.getObjectByName(name.replace(/\./g,''))}
function makeGL(key,o){const A=ASSETS[key];if(!A||!T.SkeletonUtils)return null;o=o||{};
  const root=new T.Group(),sk=T.SkeletonUtils.clone(A.scene);root.add(sk);sk.scale.setScalar(o.scale||.88);
  const acc=ACC[key]||[];let hat=null;
  sk.traverse(n=>{if(!n.isMesh)return;if(acc.includes(n.name)&&!(o.show||[]).includes(n.name))n.visible=false;
    if(o.tint&&n.material.map)n.material=tintMat(n.material,o.tint);
    if(/_Hat$/.test(n.name)){if(o.hatTint)n.material=tintMat(n.material,o.hatTint);if(o.ownHat){n.material=n.material.clone();hat=n.material}}});
  const wp={};for(const side of['r','l']){const w=o['w'+side];if(w&&ASSETS[w]){const b=findBone(sk,'handslot.'+side);if(b){const m=ASSETS[w].scene.clone();b.add(m);wp[side]=m}}}
  const mixer=new T.AnimationMixer(sk);const c={kind:'gl',root,body:sk,mixer,acts:{},cur:'',one:null,hat,hand:findBone(sk,'handslot.r')};
  mixer.addEventListener('finished',e=>{if(c.one&&e.action===c.acts[c.one])c.one=null});
  glSet(c,'Idle');mixer.update(Math.random()*2);return c}
function glAct(c,name){if(!c.acts[name]){const clip=CLIPS[name];if(!clip)return null;const a=c.mixer.clipAction(clip);if(ONCE[name]){a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true}c.acts[name]=a}return c.acts[name]}
function glSet(c,name,fade){if(c.cur===name)return;const a=glAct(c,name);if(!a)return;const prev=c.acts[c.cur];a.reset();a.setEffectiveWeight(1);a.fadeIn(fade==null?.18:fade).play();if(prev&&prev!==a)prev.fadeOut(fade==null?.18:fade);c.cur=name}
function glOne(c,name){if(!c||c.kind!=='gl')return;c.one=name;c.cur='';glSet(c,name,.1)}
function mkHuman(key,o,fb){return makeGL(key,o)||makeBiped(fb)}
function shadowFor(r){const s=new T.Mesh(shadowGeo,shadowMat);s.scale.set(r*2.2,1,r*2.2);scene.add(s);return s}

/* ================= 粒子 ================= */
const PMAX=1200,pPos=new Float32Array(PMAX*3),pCol=new Float32Array(PMAX*3),PS=[];let pIdx=0;
for(let i=0;i<PMAX;i++){PS.push({l:0,m:1,x:0,y:-999,z:0,vx:0,vy:0,vz:0,r:0,g:0,b:0,gr:0});pPos[i*3+1]=-999}
const pGeo=new T.BufferGeometry();pGeo.setAttribute('position',new T.BufferAttribute(pPos,3));pGeo.setAttribute('color',new T.BufferAttribute(pCol,3));
const pts=new T.Points(pGeo,new T.PointsMaterial({size:.55,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));pts.frustumCulled=false;scene.add(pts);
function emit(x,y,z,col,n,spd,life,o){tmpC.set(col);o=o||{};for(let i=0;i<n;i++){const p=PS[pIdx];pIdx=(pIdx+1)%PMAX;const a=Math.random()*TAU,u=Math.random()*2-1,s=Math.sqrt(1-u*u),v=spd*(.4+Math.random()*.6);
  p.x=x+(o.sp?rnd(-o.sp,o.sp):0);p.y=y+(o.sy?rnd(0,o.sy):0);p.z=z+(o.sp?rnd(-o.sp,o.sp):0);p.vx=Math.cos(a)*s*v;p.vy=u*v*(o.flat?.2:1)+(o.up||0);p.vz=Math.sin(a)*s*v;p.l=p.m=life*(.6+Math.random()*.6);p.r=tmpC.r;p.g=tmpC.g;p.b=tmpC.b;p.gr=o.gr||0}}
function updParts(dt){for(let i=0;i<PMAX;i++){const p=PS[i],j=i*3;if(p.l>0){p.l-=dt;p.vy-=p.gr*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vx*=.96;p.vz*=.96;const k=Math.max(0,p.l/p.m);pPos[j]=p.x;pPos[j+1]=p.y;pPos[j+2]=p.z;pCol[j]=p.r*k;pCol[j+1]=p.g*k;pCol[j+2]=p.b*k;if(p.l<=0)pPos[j+1]=-999}}
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true}
const rings=[];
function ringFx(x,z,r,col,dur){const m=add(new T.RingGeometry(.8,1,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide}),x,ground(x,z)+.15,z);rings.push({m,r,t:0,dur})}

/* ================= 遊戲資料 ================= */
const SCHOOL_COL={fire:'#ff8a3a',frost:'#8fdcff',arcane:'#c38cff',holy:'#ffe08a',wand:'#d9c8ff',nature:'#93d95e'};





const MT={
  wolf:{n:'灰狼',mk:()=>{const c=makeWolf(pick(['#76706a','#6a6560','#827a70']));c.body.scale.setScalar(.82);return c},spd:5.4,r:.9,hpM:1,dmgM:1,h:1.6},
  spider:{n:'夜幕蜘蛛',mk:makeSpider,spd:4.8,r:.95,hpM:.95,dmgM:1.05,h:1.5,drop:{silk:.65}},
  recruit:{n:'銀晨新兵',mk:()=>mkHuman('knight',{show:['1H_Sword','Round_Shield']},{skin:'#d9b08c',helm:'#b8bcc8',robe:'#d8d2c4',tabard:'#2c4a9a',trim:'#c9a24a',weapon:'sword',shield:'#2c4a9a',leg:'#7a7f8a',boot:'#4a4440',glove:'#8a8f9a'}),spd:5,r:.6,hpM:1.05,dmgM:1,h:2.4},
  priest:{n:'銀晨牧師',mk:()=>mkHuman('hmage',{show:['2H_Staff']},{skin:'#d9b08c',hood:1,long:1,robe:'#e8e2d4',trim:'#c9a24a',weapon:'staff',orb:'#ffe9a0',wood:'#8a6a3a'}),spd:4.6,r:.6,hpM:.85,dmgM:1,h:2.6,caster:1},
  boss:{n:'審判官 馬洛斯',mk:()=>mkHuman('knight',{show:['2H_Sword'],tint:'#ffe2a0'},{skin:'#d0a888',helm:'#d9b44a',crest:'#b03030',robe:'#e8e2d4',tabard:'#7a1f2a',trim:'#d9b44a',weapon:'hammer',leg:'#9aa0aa',boot:'#3a3430',glove:'#d9b44a',scale:1.55}),spd:5,r:1.1,hpM:3.4,dmgM:1.3,h:3.8,elite:1,boss:1},
  templar:{n:'銀晨聖殿騎士',mk:()=>mkHuman('knight',{show:['1H_Sword','Badge_Shield'],tint:'#e8c8c8'},{skin:'#d9b08c',helm:'#d9d2b4',crest:'#7a1f2a',robe:'#d8d2c4',tabard:'#7a1f2a',trim:'#c9a24a',weapon:'sword',shield:'#e8e2d4',leg:'#8a8f9a',boot:'#4a4440',glove:'#c9a24a'}),spd:5,r:.6,hpM:1.15,dmgM:1.05,h:2.4},
  zealot:{n:'銀晨狂信者',mk:()=>mkHuman('hmage',{show:['2H_Staff'],tint:'#ffcfa8'},{skin:'#d9b08c',hood:1,long:1,robe:'#d8c9a8',trim:'#7a1f2a',weapon:'staff',orb:'#ffb36a',wood:'#8a6a3a'}),spd:4.6,r:.6,hpM:.9,dmgM:1.05,h:2.6,caster:1},
  efire:{n:'失控的火元素',mk:()=>makeElem('#ff7a3a'),spd:4.6,r:.9,hpM:1.4,dmgM:1.1,h:2.6,temp:1,col:'#ff7a3a',drop:{core:1}},
  efrost:{n:'失控的冰元素',mk:()=>makeElem('#7fd0ff'),spd:4.2,r:.9,hpM:1.6,dmgM:.95,h:2.6,temp:1,col:'#7fd0ff',drop:{core:1}},
  earcane:{n:'失控的奧術元素',mk:()=>makeElem('#c38cff'),spd:5,r:.9,hpM:1.3,dmgM:1.1,h:2.6,temp:1,col:'#c38cff',drop:{core:1}}
};



const QBY={};QD.forEach(q=>QBY[q.id]=q);


let uid=1;
function genGear(slot,lv,q){if(slot==='any')slot=pick(['staff','robe','trinket']);const m=q===2?1.35:1,it={id:uid++,slot,lv,q,n:pick(GEARN[slot]),sp:0,hp:0,mana:0,crit:0};
  if(slot==='staff'){it.sp=Math.round((1.5+lv*1.15)*m);if(q===2)it.crit=1}
  if(slot==='robe'){it.hp=Math.round((5+lv*4.5)*m);it.mana=Math.round((6+lv*5)*m)}
  if(slot==='trinket'){it.crit=+((.8+lv*.22)*m).toFixed(1);it.sp=Math.round(lv*.45*m)}
  return it}
function gearStr(it){const a=[];if(it.sp)a.push('法強 +'+it.sp);if(it.hp)a.push('生命 +'+it.hp);if(it.mana)a.push('法力 +'+it.mana);if(it.crit)a.push('爆擊 +'+it.crit+'%');return a.join('　')}
function gearScore(it){return it?it.sp*2+it.hp*.25+it.mana*.15+it.crit*4:0}

/* ================= 狀態 ================= */
const P={name:'',lvl:1,xp:0,hp:1,mana:1,x:0,z:71,y:0,yaw:Math.PI,spec:null,tal:[null,null,null],moving:false,mv:0,cast:null,gcd:0,cd:{},target:null,wand:false,wandT:0,combatT:-99,sit:false,dead:false,shield:0,shieldT:0,arc:0,arcT:0,hot:false,fof:false,potCd:0,phoenixCd:0,evoCd:0,anim:0,stats:{kills:0,deaths:0,time:0}};
const BAG={herb:0,silk:0,core:0,hpot:1,mpot:0};let GEAR=[];const EQ={staff:null,robe:null,trinket:null};
let Q={};
const G={state:'load',time:0,zone:'',saveT:0,ritualUsed:false,hbT:120};window.__bwP=P;
const hasT=id=>{if(!P.spec||id[0]!=={fire:'f',frost:'i',arcane:'a'}[P.spec])return false;const r=+id[1]-1;return P.lvl>=TROW[r]&&P.tal[r]===(id[2]==='a'?0:1)};
const gsum=k=>(EQ.staff?EQ.staff[k]:0)+(EQ.robe?EQ.robe[k]:0)+(EQ.trinket?EQ.trinket[k]:0);
const maxHp=()=>Math.round(60+P.lvl*14+gsum('hp'));
const maxMana=()=>Math.round((100+P.lvl*15+gsum('mana'))*(P.spec==='arcane'?1.3:1));
const spw=()=>8+P.lvl*2.2+gsum('sp');
const critC=()=>5+gsum('crit')+(P.spec==='fire'?10:0)+(hasT('f3b')?8:0);
const xpNeed=()=>60+P.lvl*40;
function conColor(lv){const d=lv-P.lvl;return d>=3?'#ff5a4a':d>=1?'#ff9a3a':d===0?'#ffe14a':d>=-4?'#5fd35f':'#9a9a9a'}
function conXp(lv){const d=lv-P.lvl;return d>=3?1.3:d>=1?1.15:d===0?1:d>=-2?.85:d>=-4?.55:0}

/* ================= 實體 ================= */
const playerRobe=new T.MeshLambertMaterial({color:'#3b2a5a'}),playerOrb=new T.MeshBasicMaterial({color:'#7df9ff'});
let PC,pShadow;
const HAT={fire:'#ff9a7a',frost:'#9fd4ff',arcane:'#ffffff'};
function applySpecLook(){const s=P.spec?SPEC[P.spec]:null;playerRobe.color.set(s?s.robe:'#3b2a5a');playerOrb.color.set(s?s.orb:'#7df9ff');if(PC&&PC.hat)PC.hat.color.set(P.spec?HAT[P.spec]:'#ffffff')}

const npcs=[],mobs=[];let nodes=[];
function spawnMob(type,lv,x,z,camp){const d=MT[type],c=d.mk();c.root.traverse(n=>{if(n.isMesh&&!n.material.isMeshBasicMaterial)n.castShadow=true});scene.add(c.root);const m={type,d,lv,x,z,home:{x,z},yaw:rnd(0,TAU),hp:0,max:0,dmg:0,state:'idle',c,sh:shadowFor(d.r*.8),r:d.r,h:d.h,root:0,slow:0,slowA:0,atkT:1,atkAnim:0,cast:null,healCd:0,skT:8,wanderT:rnd(1,5),wx:x,wz:z,deadT:0,looted:false,loot:null,dot:null,camp,anim:rnd(0,9),kind:'mob',summoned:false,ice:null};
  resetMob(m);mobs.push(m);return m}
function resetMob(m){const d=m.d;m.max=Math.round((38+m.lv*20)*d.hpM*(d.elite?1:1));m.hp=m.max;m.dmg=(3+m.lv*1.7)*d.dmgM;m.state='idle';m.x=m.home.x;m.z=m.home.z;m.root=0;m.slow=0;m.cast=null;m.dot=null;m.looted=false;m.loot=null;m.c.root.visible=true;m.c.body.rotation.set(0,0,0);m.c.body.position.y=0;if(m.c.kind==='gl'){m.c.mixer.stopAllAction();m.c.cur='';m.c.one=null;glSet(m.c,'Idle',0)}m.c.root.scale.setScalar(m.d.mk&&m.type==='boss'?1.55:1);m.halfDone=false;m.skT=8}
function initWorld(){
PC=makeGL('sk_mage',{wr:'w_staff',ownHat:true})||makeBiped({skull:1,hood:1,long:1,robeMat:playerRobe,trim:'#9a7ad0',eye:'#7df9ff',weapon:'staff',orbMat:playerOrb,ribs:1});scene.add(PC.root);pShadow=shadowFor(.55);
for(const id in NPCS){const N=NPCS[id],c=(N.gl&&makeGL(N.gl[0],N.gl[1]))||makeBiped(N.o);c.root.position.set(N.x,ground(N.x,N.z),N.z);c.root.rotation.y=N.yaw;scene.add(c.root);shadowFor(.55).position.set(N.x,ground(N.x,N.z)+.04,N.z);COLL.push({x:N.x,z:N.z,r:.6});npcs.push({id,N,c,x:N.x,z:N.z,h:2.4,kind:'npc',mk:''})}
CAMPS.forEach((cp,ci)=>{for(let i=0;i<cp.n;i++){let x=cp.x,z=cp.z,tries=0;if(cp.r>0)do{const a=Math.random()*TAU,r=Math.sqrt(Math.random())*cp.r;x=cp.x+Math.cos(a)*r;z=cp.z+Math.sin(a)*r}while(tries++<30&&COLL.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+1));
  const lv=cp.lv[0]+Math.floor(Math.random()*(cp.lv[1]-cp.lv[0]+1));spawnMob(cp.t,lv,x,z,ci)}});
nodes=NODE_POS.map(([x,z])=>{const g=new T.Group(),y=ground(x,z);g.position.set(x,y,z);for(let i=0;i<5;i++){const l=add(geo.cone(.12,.7,4),MB(i%2?'#7cf26a':'#a6ff8a'),Math.cos(i*1.3)*.18,.35,Math.sin(i*1.3)*.18,g);l.rotation.z=Math.cos(i*2)*.4;l.rotation.x=Math.sin(i*2)*.4}add(geo.sph(.12,6,4),MB('#e6ffb0'),0,.75,0,g);scene.add(g);return{x,z,g,ready:0,kind:'node',h:1.2}});
}




/* ================= 投射物、地面標記 ================= */
const projs=[];
const PGEO={fire:[geo.sph(.22,8,6),'#ffb36a'],pyro:[geo.sph(.42,10,8),'#ff8a3a'],frost:[geo.oct(.24),'#bfeaff'],lance:[geo.oct(.18),'#e6f8ff'],arcane:[geo.sph(.16,6,5),'#e0c0ff'],arcane2:[geo.sph(.28,8,6),'#d9a8ff'],wand:[geo.sph(.11,6,4),'#efe4ff'],holy:[geo.sph(.22,8,6),'#fff0b0']};
function fireProj(from,to,kind,sch,spd,onHit){const g=PGEO[kind],m=add(g[0],MB(g[1]),from.x,from.y,from.z);projs.push({m,to,kind,sch,spd,onHit,x:from.x,y:from.y,z:from.z,t:0})}
function updProj(dt){for(let i=projs.length-1;i>=0;i--){const p=projs[i],tg=p.to,ty=tg===P?P.y+1.2:(tg.y||0)+tg.h*.45,dx=tg.x-p.x,dy=ty-p.y,dz=tg.z-p.z,dl=Math.hypot(dx,dy,dz),st=p.spd*dt;p.t+=dt;
  if(dl<=st+.3||p.t>4){p.onHit&&p.onHit();emit(tg.x,ty,tg.z,SCHOOL_COL[p.sch],p.kind==='pyro'?26:10,p.kind==='pyro'?6:3.5,.5);scene.remove(p.m);projs.splice(i,1);continue}
  p.x+=dx/dl*st;p.y+=dy/dl*st;p.z+=dz/dl*st;p.m.position.set(p.x,p.y,p.z);p.m.rotation.x+=dt*8;p.m.rotation.y+=dt*6;emit(p.x,p.y,p.z,SCHOOL_COL[p.sch],p.kind==='pyro'?3:1,.6,.35)}}
const tels=[];
function telegraph(x,z,r,dur,fn){const y=ground(x,z)+.12,edge=add(new T.RingGeometry(r-.25,r,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ffd56a',transparent:true,opacity:.9,depthWrite:false,side:T.DoubleSide}),x,y,z),fill=add(new T.CircleGeometry(r,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ffd56a',transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide}),x,y+.01,z);fill.scale.setScalar(.01);tels.push({x,z,r,dur,t:0,edge,fill,fn})}
const selRing=add(new T.RingGeometry(.85,1,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#ff5a4a',transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}),0,-99,0);
const iceGeo=geo.ico(1,0),iceMat=new T.MeshLambertMaterial({color:'#bfeaff',transparent:true,opacity:.45,emissive:'#3a6a8a'});

/* ================= UI 基礎 ================= */
let VW=innerWidth,VH=innerHeight;const V3=new T.Vector3();
function proj(x,y,z){V3.set(x,y,z).project(camera);if(V3.z>1||V3.z<-1)return null;return[(V3.x+1)/2*VW,(1-V3.y)/2*VH]}
let errT=0,errLast='';
function err(msg){const e=$('err');if(msg!==errLast||errT<=0.8){e.textContent=msg;errLast=msg}e.classList.add('on');errT=1.6}
let banT=0;function banner(t,s){$('bnT').textContent=t;$('bnS').textContent=s||'';$('banner').classList.add('on');banT=3}
let toastT=0;function toast(t,s,dur){const e=$('toast');e.textContent=t;if(s)e.append(h('small',null,s));e.classList.add('on');toastT=dur||2.4}
const floats=[],floatBox=$('floats');
function floatTxt(x,y,z,txt,col,big){let el=floats.find(f=>!f.on);if(!el){if(floats.length>40)return;el={el:h('div',{cls:'ft'})};floatBox.append(el.el);floats.push(el)}
  el.on=true;el.x=x+rnd(-.4,.4);el.y=y;el.z=z;el.t=0;el.el.textContent=txt;el.el.style.color=col;el.el.style.fontSize=big?'19px':'14px';el.el.style.display=''}
function updFloats(dt){for(const f of floats){if(!f.on)continue;f.t+=dt;if(f.t>1.1){f.on=false;f.el.style.display='none';continue}const p=proj(f.x,f.y+f.t*1.4,f.z);if(!p){f.el.style.display='none';continue}f.el.style.display='';f.el.style.opacity=f.t>.7?String((1.1-f.t)/.4):'1';f.el.style.transform=`translate(${p[0]}px,${p[1]}px) translate(-50%,-50%) scale(${f.t<.12?1.3:1})`}}

/* ================= 戰鬥 ================= */
const SPL={
  fireball:{n:'骨火箭',s:'火球',lv:1,sch:'fire',cast:()=>P.spec==='fire'?1.7:2,mana:()=>10+P.lvl*1.6,range:30,tgt:1,proj:'fire',spd:26,dmg:()=>1.5*spw()+8,d:'向目標擲出燃燒的骨片。'},
  frostbolt:{n:'寒冰箭',s:'寒冰',lv:4,sch:'frost',cast:()=>hasT('i1a')?1.5:1.8,mana:()=>10+P.lvl*1.5,range:30,tgt:1,proj:'frost',spd:24,dmg:()=>1.25*spw()+6,d:'造成冰霜傷害並緩速目標 6 秒。'},
  missiles:{n:'奧術飛彈',s:'飛彈',lv:6,sch:'arcane',ch:2.5,ticks:()=>hasT('a1b')?4:3,mana:()=>14+P.lvl*1.8,range:30,tgt:1,proj:'arcane',spd:30,dmg:()=>.65*spw(),d:'引導 2.5 秒，連續發射奧術飛彈。'},
  frostnova:{n:'冰霜新星',s:'新星',lv:2,sch:'frost',cast:0,mana:()=>12+P.lvl*1.4,cd:()=>P.spec==='frost'?14:20,tgt:0,d:'凍結周圍敵人，使其無法移動。'},
  blink:{n:'閃現',s:'閃現',lv:8,sch:'arcane',cast:0,mana:()=>8+P.lvl,cd:()=>hasT('a2b')?8:15,tgt:0,d:'向前方瞬間移動 10 碼。'},
  pyro:{n:'炎爆術',s:'炎爆',lv:10,sch:'fire',cast:()=>P.hot?0:(hasT('f1a')?2.5:3.5),mana:()=>24+P.lvl*2.5,range:32,tgt:1,proj:'pyro',spd:22,dmg:()=>3.6*spw()+20,d:'長讀條的巨大火球。'},
  icelance:{n:'冰槍術',s:'冰槍',lv:10,sch:'frost',cast:0,mana:()=>6+P.lvl,range:30,tgt:1,proj:'lance',spd:34,dmg:()=>.75*spw()*(hasT('i1b')?1.35:1),d:'瞬發。對被定身目標或冰霜之指觸發時造成三倍傷害。'},
  arcblast:{n:'奧術衝擊',s:'衝擊',lv:10,sch:'arcane',cast:1.6,mana:()=>(8+P.lvl*1.2)*(1+P.arc)*(hasT('a1a')?.75:1),range:30,tgt:1,proj:'arcane2',spd:30,dmg:()=>1.4*spw()*(1+P.arc*(hasT('a3a')?.45:.35)),d:'疊加奧術充能，提高傷害與消耗。'}
};
const SLOTS=['fireball','frostbolt','missiles','frostnova','blink','SPEC'];
const slotSpell=i=>SLOTS[i]==='SPEC'?(P.spec?SPEC[P.spec].spell:null):SLOTS[i];
const val=v=>typeof v==='function'?v():v;
const isHostile=t=>t&&t.kind==='mob';
const alive=m=>m&&m.kind==='mob'&&m.state!=='dead';
function inCombat(){return G.time-P.combatT<5||mobs.some(m=>m.state==='combat')}
function setTarget(t){if(P.target!==t){P.target=t;P.wand=false}}
function nearestHostile(range,front){let best=null,bs=1e9;const fx=Math.sin(P.yaw),fz=Math.cos(P.yaw);for(const m of mobs){if(m.state==='dead'||m.state==='evade'||!m.c.root.visible)continue;const d=d2(m,P);if(d>range)continue;let s=d;if(front){const dot=((m.x-P.x)*fx+(m.z-P.z)*fz)/(d||1);s=d*(1.6-dot*.6)}if(s<bs){bs=s;best=m}}return best}
function tabTarget(){const list=mobs.filter(m=>m.state!=='dead'&&m.state!=='evade'&&d2(m,P)<32).sort((a,b)=>d2(a,P)-d2(b,P));if(!list.length){err('附近沒有敵人');return}const i=list.indexOf(P.target);setTarget(list[(i+1)%list.length])}
function faceTarget(t){P.yaw=Math.atan2(t.x-P.x,t.z-P.z)}
function standUp(){if(P.sit){P.sit=false}}
function tryCast(id){
  if(G.state!=='play'||P.dead)return;const S=SPL[id];if(!S)return;
  if(P.lvl<S.lv){err(`需要等級 ${S.lv}`);return}
  standUp();
  if(P.cast){err('正在施法');return}
  if(P.gcd>0)return;
  const cd=P.cd[id]||0;if(cd>G.time){err('技能還在冷卻中');return}
  const ct=val(S.cast)||0;
  if(S.tgt){if(!alive(P.target)){const n=nearestHostile(S.range,true);if(n)setTarget(n);else{err('沒有目標');return}}
    const t=P.target;if(t.state==='evade'){err('目標正在脫離戰鬥');return}if(d2(t,P)>S.range+t.r){err('超出範圍');return}}
  if((ct>0||S.ch)&&P.moving){err('移動中無法施法');return}
  if(P.mana<val(S.mana)){err('法力不足');return}
  P.gcd=1.5;if(S.tgt){faceTarget(P.target);P.wand=true}
  if(S.ch){P.mana-=val(S.mana);P.cast={id,t:0,dur:S.ch,ch:1,ticks:val(S.ticks),done:0,tgt:P.target,arc:P.arc};if(id==='missiles'&&P.spec==='arcane'){P.arc=0}return}
  if(ct>0){P.cast={id,t:0,dur:ct,tgt:P.target};return}
  execSpell(id,P.target)}
const HV=new T.Vector3();function handPos(){if(PC&&PC.hand){PC.hand.getWorldPosition(HV);return{x:HV.x,y:HV.y+.3,z:HV.z}}return{x:P.x+Math.sin(P.yaw)*.5,y:P.y+2,z:P.z+Math.cos(P.yaw)*.5}}
function execSpell(id,t){
  const S=SPL[id],cost=val(S.mana);if(P.mana<cost){err('法力不足');return}P.mana-=cost;if(S.cd)P.cd[id]=G.time+val(S.cd);P.combatT=Math.max(P.combatT,G.time-4);
  const from=handPos();if(id!=='blink')glOne(PC,id==='frostnova'?'Spellcast_Raise':'Spellcast_Shoot');
  if(id==='frostnova'){const r=8+(hasT('i2b')?4:0),dur=5+(hasT('i2b')?2:0);ringFx(P.x,P.z,r,'#bfeaff',.5);emit(P.x,P.y+.5,P.z,'#bfeaff',40,r*1.6,.5,{flat:1});
    for(const m of mobs)if(m.state==='combat'||m.state==='idle')if(m.state!=='dead'&&d2(m,P)<r+m.r){m.root=m.d.boss?dur*.4:dur;hitMob(m,.4*spw(),'frost',{})}
    if(hasT('i2a')){P.shield=Math.round(maxHp()*.3);P.shieldT=G.time+12}return}
  if(id==='blink'){let dx=Math.sin(P.yaw),dz=Math.cos(P.yaw);emit(P.x,P.y+1,P.z,'#c38cff',24,3,.5,{sy:1.5});for(let i=0;i<20;i++){const nx=P.x+dx*.5,nz=P.z+dz*.5;if(blocked(nx,nz,.4))break;P.x=nx;P.z=nz}P.y=ground(P.x,P.z);emit(P.x,P.y+1,P.z,'#c38cff',24,3,.5,{sy:1.5});return}
  if(!alive(t))return;
  if(id==='pyro'&&P.hot)P.hot=false;
  let lanceMult=1;if(id==='icelance'){if(t.root>0||P.fof){lanceMult=3;P.fof=false}}
  const dmg=S.dmg()*lanceMult,arcNow=P.arc;
  if(id==='arcblast'){P.arc=Math.min(hasT('a3a')?5:4,P.arc+1);P.arcT=G.time+10}
  fireProj(from,t,S.proj,S.sch,S.spd,()=>{hitMob(t,dmg,S.sch,{spell:id});if(id==='frostbolt'){t.slow=6;t.slowA=hasT('i1a')?.6:.4;if(P.spec==='frost'&&Math.random()<(hasT('i3b')?.45:.25)){P.fof=true}}})}
function hitMob(m,base,sch,o){
  if(!m||m.state==='dead'||m.state==='evade')return;
  let cc=critC();if(hasT('i3a')&&m.root>0)cc+=40;
  const crit=Math.random()*100<cc&&sch!=='wand';let dmg=base*rnd(.92,1.08);
  if(crit)dmg*=1.5+(hasT('f3b')?.25:0)+(P.spec==='fire'&&sch==='fire'?.4:0);
  dmg=Math.max(1,Math.round(dmg));m.hp-=dmg;P.combatT=G.time;
  floatTxt(m.x,(m.y||0)+m.h,m.z,crit?dmg+'!':String(dmg),crit?'#ffe14a':(sch==='wand'?'#d8d0e8':'#ffffff'),crit);
  if(crit&&P.spec==='fire'&&sch==='fire'){const tot=dmg*.4*(hasT('f1b')?1.6:1);m.dot={dps:tot/6,t:6,tick:1,acc:0};if(hasT('f2a')&&o&&(o.spell==='fireball'||o.spell==='pyro'))P.hot=true}
  aggro(m);
  if(m.hp<=0)killMob(m)}
function aggro(m){if(m.state==='idle'){m.state='combat';m.atkT=Math.min(m.atkT,1);let n=0;for(const o of mobs)if(n<1&&o!==m&&o.state==='idle'&&o.camp===m.camp&&d2(o,m)<4.5&&!o.d.boss){o.state='combat';n++}}}
function killMob(m){m.state='dead';m.hp=0;m.deadT=G.time;m.dot=null;m.cast=null;m.root=0;P.stats.kills++;
  const xp=Math.round((12+m.lv*4)*conXp(m.lv)*(m.d.elite?3:1));if(xp>0&&!m.summoned)gainXp(xp,m);
  const loot=[];const dr=m.d.drop||{};for(const k in dr){if(k==='core'){if(Q.trial&&Q.trial.s==='active')loot.push([k,1])}else if(Math.random()<dr[k])loot.push([k,1])}
  if(!m.summoned&&(m.d.elite||Math.random()<.11))loot.push(['gear',genGear('any',m.lv,m.d.elite?2:1)]);
  m.loot=loot.length?loot:null;
  for(const q of QD){const st=Q[q.id];if(!st||st.s!=='active')continue;q.obj.forEach((o,i)=>{if(o.kill&&o.kill.split('|').includes(m.type)&&st.c[i]<o.n){st.c[i]++;if(qReady(q))toast(q.t,'任務目標已完成，回去回報',2.2)}})}
  if(P.target===m)P.wand=false;
  if(m.d.boss){banner('審判官倒下了','聖光在這片林地熄滅');track('boss',{t:Math.round(P.stats.time)})}
  save()}
function gainXp(n,src){if(P.lvl>=MAXLV)return;P.xp+=n;floatTxt(src?src.x:P.x,(src?(src.y||0)+src.h:P.y+2.5)+.6,src?src.z:P.z,'+'+n+' 經驗','#c3a2ff');
  while(P.lvl<MAXLV&&P.xp>=xpNeed()){P.xp-=xpNeed();P.lvl++;P.hp=maxHp();P.mana=maxMana();emit(P.x,P.y+.2,P.z,'#ffe14a',60,2,1.4,{sp:.6,up:3,sy:.3});ringFx(P.x,P.z,3,'#ffe14a',.8);
    const learned=Object.values(SPL).filter(s=>s.lv===P.lvl&&s.lv<10).map(s=>s.n);
    glOne(PC,'Cheer');track('level');toast('等級提升！現在是 '+P.lvl+' 級',learned.length?'學會新法術：'+learned.join('、'):(TROW.includes(P.lvl)&&P.spec?'可以選擇新的天賦':P.lvl===10?'回營地找艾瑟琳接受職業任務':'生命、法力與法術強度提升'),3)}
  if(P.lvl>=MAXLV)P.xp=0;save()}
function hurtPlayer(dmg,src,sch){if(P.dead)return;dmg=Math.round(dmg*(src&&src.lv?1+.08*(src.lv-P.lvl):1));if(dmg<1)dmg=1;P.combatT=G.time;P.sit=false;
  if(P.shield>0){const a=Math.min(P.shield,dmg);P.shield-=a;dmg-=a;if(a)floatTxt(P.x,P.y+2.2,P.z,'吸收 '+a,'#bfeaff')}
  if(hasT('a2a')&&dmg>0){const mm=Math.min(P.mana,Math.round(dmg*.3)*2);dmg-=Math.floor(mm/2);P.mana-=mm}
  if(dmg<=0)return;P.hp-=dmg;floatTxt(P.x,P.y+2.2,P.z,'-'+dmg,'#ff5a4a');
  if(src&&hasT('f2b')&&src.kind==='mob'&&!sch)hitMob(src,.4*spw(),'fire',{});
  if(P.cast&&!P.cast.ch&&Math.random()<.35){P.cast.t=Math.max(0,P.cast.t-.4)}
  if(P.hp<=0){if(hasT('f3a')&&P.phoenixCd<=G.time){P.hp=Math.round(maxHp()*.4);P.phoenixCd=G.time+120;emit(P.x,P.y+1,P.z,'#ff8a3a',70,5,1.2,{up:2});toast('鳳凰之怒','你從灰燼中重生',2);return}die()}}
function die(){track('death');P.hp=0;P.dead=true;P.cast=null;P.sit=false;P.stats.deaths++;for(const m of mobs)if(m.state==='combat')m.state='evade';
  setTimeout(()=>openPanel(()=>[h('h2',null,'你的骨頭散落一地'),h('div',{cls:'sub'},'死亡'),h('p',null,'營地的守墓人會把你的骨頭撿回去重新拼好。\n等級、物品與任務進度都會保留。'),h('div',{cls:'row'},h('button',{type:'button',cls:'btn pri',on:{click:respawn}},'在亡息營地重組'))],true),900)}
function respawn(){P.dead=false;P.hp=Math.round(maxHp()*.6);P.mana=Math.round(maxMana()*.6);P.x=0;P.z=71;P.y=ground(0,77);setTarget(null);closePanel(true);banner('亡息營地','骨頭重組完成')}
function blocked(x,z,r){if(Math.abs(x)>98||Math.abs(z)>98)return true;if(heightAt(x,z)>6)return true;for(const c of COLL)if((x-c.x)*(x-c.x)+(z-c.z)*(z-c.z)<(c.r+r)*(c.r+r))return true;return false}

/* ================= 任務 ================= */
function qAvail(q){return !Q[q.id]&&(!q.req||(Q[q.req]&&Q[q.req].s==='done'))&&P.lvl>=q.lv}
function qReady(q){const st=Q[q.id];if(!st||st.s!=='active')return false;return q.obj.every((o,i)=>o.item?BAG[o.item]>=o.n:st.c[i]>=o.n)}
function qProg(q,i){const o=q.obj[i],st=Q[q.id];return o.item?Math.min(BAG[o.item],o.n):Math.min(st.c[i],o.n)}
function acceptQ(q){Q[q.id]={s:'active',c:q.obj.map(()=>0)};toast('接受任務',q.t,1.8);save()}
function turnIn(q){q.obj.forEach(o=>{if(o.item)BAG[o.item]-=o.n});Q[q.id].s='done';const rw=[];
  if(q.reward)for(const k in q.reward){BAG[k]+=q.reward[k];rw.push(ITEMS[k].n+' ×'+q.reward[k])}
  if(q.gear){const it=genGear(q.gear[0],q.gear[1],q.gear[2]);GEAR.push(it);autoEquip(it);rw.push(it.n)}
  window.__bwQDone=QD.filter(x=>Q[x.id]&&Q[x.id].s==='done').length;track('quest',{q:q.id});toast('任務完成：'+q.t,rw.length?'獲得 '+rw.join('、'):'',2.4);gainXp(q.xp);save();
  if(q.id==='herbs'||q.id==='silk')setTimeout(()=>{if(G.state==='play')err('')},0);
  if(q.spec)openSpecPanel(true)}
function autoEquip(it){const cur=EQ[it.slot];if(gearScore(it)>gearScore(cur)){EQ[it.slot]=it;GEAR=GEAR.filter(g=>g!==it);if(cur)GEAR.push(cur);toast('已自動裝備',it.n+'　'+gearStr(it),2.2)}}
function npcMark(id){let m='';for(const q of QD){const st=Q[q.id];if(st&&st.s==='active'&&(q.to||q.giver)===id){if(qReady(q)||q.obj[0].talk===id)return'?';if(!m)m='?g'}if(q.giver===id&&qAvail(q))m='!'}return m}

/* ================= 面板 ================= */
const panel=$('panel'),sheet=$('sheet');let panelLock=false;
function openPanel(fn,lock){panelLock=!!lock;ptrs.clear();pinch=0;sheet.replaceChildren(...fn());panel.hidden=false;sheet.scrollTop=0;joyEnd();if(G.state==='play')G.state='panel'}
function closePanel(force){if(panelLock&&!force)return;panel.hidden=true;panelLock=false;if(G.state==='panel')G.state='play'}
panel.addEventListener('pointerdown',e=>{if(e.target===panel)closePanel()});
const closeBtn=(l)=>h('button',{type:'button',cls:'btn',on:{click:()=>closePanel()}},l||'關閉');
function talkTo(id){const N=NPCS[id];
  for(const q of QD){const st=Q[q.id];if(st&&st.s==='active'&&q.obj[0].talk===id){st.c[0]=1}}
  const ready=QD.filter(q=>Q[q.id]&&Q[q.id].s==='active'&&(q.to||q.giver)===id&&qReady(q));
  const avail=QD.filter(q=>q.giver===id&&qAvail(q));
  const prog=QD.filter(q=>Q[q.id]&&Q[q.id].s==='active'&&q.giver===id&&!qReady(q));
  if(id!=='apoth'&&!prog.length&&ready.length+avail.length===1&&!(id==='trainer'&&Q.trial&&Q.trial.s==='done')){questView(ready[0]||avail[0],id);return}
  openPanel(()=>{const k=[h('h2',null,N.n),h('div',{cls:'sub'},N.sub),h('p',null,N.greet)];
    ready.forEach(q=>k.push(h('button',{type:'button',cls:'li',on:{click:()=>questView(q,id)}},h('span',{cls:'ic',style:'color:var(--gold)'},'?'),h('span',{cls:'tx'},q.t,h('small',null,'可以回報')))));
    avail.forEach(q=>k.push(h('button',{type:'button',cls:'li',on:{click:()=>questView(q,id)}},h('span',{cls:'ic',style:'color:var(--gold)'},'!'),h('span',{cls:'tx'},q.t,h('small',null,'新任務 · 建議等級 '+q.lv)))));
    prog.forEach(q=>k.push(h('button',{type:'button',cls:'li',on:{click:()=>questView(q,id)}},h('span',{cls:'ic',style:'color:var(--muted)'},'?'),h('span',{cls:'tx'},q.t,h('small',null,'進行中')))));
    if(id==='apoth'&&Q.herbs&&Q.herbs.s==='done')k.push(h('button',{type:'button',cls:'li',on:{click:craftView}},h('span',{cls:'ic',style:'color:#93d95e'},'藥'),h('span',{cls:'tx'},'調配藥水',h('small',null,'用墓地苔與蛛絲製作藥水'))));
    if(id==='trainer'&&Q.trial&&Q.trial.s==='done')k.push(h('button',{type:'button',cls:'li',on:{click:()=>openSpecPanel(false)}},h('span',{cls:'ic',style:'color:var(--arcane)'},'專'),h('span',{cls:'tx'},P.spec?'更換專精':'選擇專精',h('small',null,P.spec?'目前：'+SPEC[P.spec].n+'（更換會重置天賦）':'冰霜、火焰或奧術'))));
    if(id==='trainer'&&P.lvl<10)k.push(h('p',{style:'font-size:12px;color:var(--muted);margin-top:10px'},'到了 10 級再來找我，我會告訴你如何選擇專精。'));
    k.push(h('div',{cls:'row'},closeBtn('再見')));return k})}
function questView(q,npc){const st=Q[q.id],ready=qReady(q)||(st&&st.s==='active'&&q.obj[0].talk===npc);
  openPanel(()=>{const k=[h('h2',null,q.t),h('div',{cls:'sub'},NPCS[npc].n+(st?ready?' · 可以回報':' · 進行中':' · 新任務'))];
    k.push(h('p',null,ready&&st?q.done:q.txt));
    if(!(ready&&st)){k.push(h('h3',null,'目標'));k.push(h('div',{cls:'obj'},q.obj.map((o,i)=>h('div',{cls:st&&qProg(q,i)>=o.n?'ok':''},'· '+o.l+(o.talk?'':`　${st?qProg(q,i):0} / ${o.n}`)))))}
    const rw=['經驗 '+q.xp];if(q.reward)for(const r in q.reward)rw.push(ITEMS[r].n+' ×'+q.reward[r]);if(q.gear)rw.push('精良'+(SLOTN[q.gear[0]]||'裝備'));if(q.spec)rw.push('解鎖專精');
    k.push(h('h3',null,'獎勵'),h('div',{cls:'rw'},rw.join('　·　')));
    const row=h('div',{cls:'row'});
    if(!st)row.append(h('button',{type:'button',cls:'btn pri',on:{click:()=>{acceptQ(q);closePanel()}}},'接受任務'));
    else if(ready)row.append(h('button',{type:'button',cls:'btn pri',on:{click:()=>{closePanel();turnIn(q)}}},'完成任務'));
    row.append(h('button',{type:'button',cls:'btn',on:{click:()=>talkTo(npc)}},'返回'));k.push(row);return k})}
function craftView(){openPanel(()=>{const k=[h('h2',null,'調配藥水'),h('div',{cls:'sub'},'藥劑師 葛倫'),h('p',{style:'font-size:12px;color:var(--muted)'},`持有：墓地苔 ${BAG.herb}　蛛絲 ${BAG.silk}　治療藥水 ${BAG.hpot}　法力藥水 ${BAG.mpot}`)];
  const rec=[{k:'hpot',need:{herb:2},ok:true},{k:'mpot',need:{herb:2,silk:1},ok:Q.silk&&Q.silk.s==='done'}];
  rec.forEach(r=>{const has=Object.entries(r.need).every(([a,b])=>BAG[a]>=b);const need=Object.entries(r.need).map(([a,b])=>ITEMS[a].n+' '+b).join(' + ');
    k.push(h('div',{cls:'li'},h('span',{cls:'ic',style:'color:'+ITEMS[r.k].c},ITEMS[r.k].ic),h('span',{cls:'tx'},ITEMS[r.k].n,h('small',null,r.ok?need+'　·　'+ITEMS[r.k].d:'完成「蛛絲與藥劑」後解鎖')),h('button',{type:'button',cls:'btn pri',disabled:!(r.ok&&has),on:{click:()=>{for(const a in r.need)BAG[a]-=r.need[a];BAG[r.k]++;save();craftView()}}},'調配')))});
  k.push(h('div',{cls:'row'},h('button',{type:'button',cls:'btn',on:{click:()=>talkTo('apoth')}},'返回'),closeBtn()));return k})}
function openSpecPanel(fromQuest){if(inCombat()&&!fromQuest){err('戰鬥中無法這麼做');return}
  openPanel(()=>{const k=[h('h2',null,'選擇專精'),h('div',{cls:'sub'},'死亡法師 艾瑟琳'),h('p',{style:'font-size:13px'},'專精決定你的第六個技能與被動效果。11、13、15 級時可以在天賦面板選擇天賦。之後可以回來更換，天賦會重置。')];
    for(const s in SPEC){const S=SPEC[s];k.push(h('div',{cls:'spec',style:'border-color:'+S.col+'66'},h('h4',{style:'color:'+S.col},S.n+(P.spec===s?'（目前）':'')),h('p',null,S.desc+'\n'+S.sk),h('button',{type:'button',cls:'btn pri',disabled:P.spec===s,on:{click:()=>{P.spec=s;P.tal=[null,null,null];track('spec',{s});P.arc=0;P.hot=false;P.fof=false;P.mana=Math.min(P.mana,maxMana());applySpecLook();buildBar();save();closePanel(true);emit(P.x,P.y+1,P.z,S.col,80,4,1.2,{up:2,sy:1});toast('專精：'+S.n,'快捷列第 6 格已解鎖 '+SPL[S.spell].n,2.6)}}},'選擇'+S.n)))}
    if(!fromQuest)k.push(h('div',{cls:'row'},closeBtn('取消')));return k},fromQuest)}
function talentPanel(){openPanel(()=>{const k=[h('h2',null,'天賦'),h('div',{cls:'sub'},P.spec?'專精：'+SPEC[P.spec].n:'尚未選擇專精')];
  if(!P.spec){k.push(h('p',null,P.lvl<10?`10 級後向營地的死亡法師艾瑟琳接受職業任務「奧法的試煉」，完成後即可選擇專精。\n\n目前等級：${P.lvl}`:'回營地找死亡法師艾瑟琳，接受職業任務「奧法的試煉」。'));k.push(h('h3',null,'三系專精預覽'));for(const s in SPEC)k.push(h('div',{cls:'spec'},h('h4',{style:'color:'+SPEC[s].col},SPEC[s].n),h('p',null,SPEC[s].desc+'\n'+SPEC[s].sk)))}
  else{const S=SPEC[P.spec];k.push(h('p',{style:'font-size:13px;color:#d6cfbf'},S.desc));
    TAL[P.spec].forEach((row,ri)=>{const lock=P.lvl<TROW[ri];k.push(h('div',{cls:'trow'},h('div',{cls:'lv'},`等級 ${TROW[ri]}`+(lock?'（未解鎖）':'')),h('div',{cls:'tal'},row.map((t,oi)=>h('button',{type:'button',cls:P.tal[ri]===oi?'sel':'',disabled:lock,on:{click:()=>{if(inCombat()){err('戰鬥中無法更換天賦');return}P.tal[ri]=oi;save();talentPanel()}}},t.n,h('small',null,t.d))))))})}
  k.push(h('div',{cls:'row'},closeBtn()));return k})}
function bagPanel(){openPanel(()=>{const k=[h('h2',null,'背包'),h('div',{cls:'sub'},'裝備與物品')];
  const st=h('div',{cls:'kv'});[['生命',maxHp()],['法力',maxMana()],['法術強度',Math.round(spw())],['爆擊',critC().toFixed(1)+'%']].forEach(([a,b])=>st.append(h('div',null,h('span',null,a),String(b))));k.push(st);
  k.push(h('h3',null,'已裝備'));['staff','robe','trinket'].forEach(s=>{const it=EQ[s];k.push(h('div',{cls:'li'},h('span',{cls:'ic',style:'color:var(--muted)'},SLOTN[s][0]),h('span',{cls:'tx'},h('span',{cls:it?'q'+it.q:''},it?it.n:'（空）'),h('small',null,it?SLOTN[s]+' · 物品等級 '+it.lv+'　'+gearStr(it):SLOTN[s]))))});
  k.push(h('h3',null,'裝備'));if(!GEAR.length)k.push(h('div',{cls:'stat'},'目前沒有備用裝備。怪物有機會掉落綠色裝備，菁英必掉藍色裝備。'));
  GEAR.forEach(it=>{const cur=EQ[it.slot],diff=gearScore(it)-gearScore(cur);k.push(h('div',{cls:'li'},h('span',{cls:'ic',style:'color:var(--muted)'},SLOTN[it.slot][0]),h('span',{cls:'tx'},h('span',{cls:'q'+it.q},it.n),h('small',null,SLOTN[it.slot]+' · '+gearStr(it)+'　',h('b',{cls:diff>0?'up':'dn'},diff>0?'▲ 較好':'▼ 較差'))),h('button',{type:'button',cls:'btn pri',on:{click:()=>{EQ[it.slot]=it;GEAR=GEAR.filter(g=>g!==it);if(cur)GEAR.push(cur);P.hp=Math.min(P.hp,maxHp());P.mana=Math.min(P.mana,maxMana());save();bagPanel()}}},'裝備'),h('button',{type:'button',cls:'btn',on:{click:()=>{GEAR=GEAR.filter(g=>g!==it);save();bagPanel()}}},'丟棄')))});
  k.push(h('h3',null,'物品'));const items=Object.keys(ITEMS).filter(i=>BAG[i]>0);if(!items.length)k.push(h('div',{cls:'stat'},'空的。'));
  items.forEach(i=>{const I=ITEMS[i],use=i==='hpot'||i==='mpot';k.push(h('div',{cls:'li'},h('span',{cls:'ic',style:'color:'+I.c},I.ic),h('span',{cls:'tx'},I.n+' ×'+BAG[i],h('small',null,I.d)),use?h('button',{type:'button',cls:'btn pri',on:{click:()=>{closePanel();usePotion(i)}}},'使用'):null))});
  k.push(h('div',{cls:'row'},closeBtn()));return k})}
function questPanel(){openPanel(()=>{const k=[h('h2',null,'任務日誌'),h('div',{cls:'sub'},'幽影林地')];const act=QD.filter(q=>Q[q.id]&&Q[q.id].s==='active');
  if(!act.length)k.push(h('p',null,'目前沒有進行中的任務。頭上有金色「!」的角色有任務可以接。'));
  act.forEach(q=>{k.push(h('div',{cls:'spec'},h('h4',{style:'color:var(--gold);font-size:16px'},q.t),h('div',{cls:'obj'},q.obj.map((o,i)=>h('div',{cls:qProg(q,i)>=o.n?'ok':''},'· '+o.l+(o.talk?'':`　${qProg(q,i)} / ${o.n}`)))),h('p',{style:'font-size:12px;color:var(--muted);margin:8px 0 0'},q.txt.split('\n')[0]),h('div',{cls:'stat',style:'margin-top:6px'},'回報給：'+NPCS[q.to||q.giver].n)))});
  const done=QD.filter(q=>Q[q.id]&&Q[q.id].s==='done').length;k.push(h('div',{cls:'stat',style:'margin-top:8px'},`已完成 ${done} / ${QD.length} 個任務`));
  k.push(h('div',{cls:'row'},closeBtn()));return k})}
function ladderPanel(){openPanel(()=>{const k=[h('h2',null,'天梯'),h('div',{cls:'sub'},'所有亡者的排名')];
  if(!NET.on){k.push(h('p',null,'天梯尚未開啟。'),h('div',{cls:'row'},closeBtn()));return k}
  const box=h('div',{cls:'stat'},'讀取中……');k.push(box);
  flush();setTimeout(()=>fetchLadder().then(d=>{const rows=(d&&d.top)||[];const me=pid();if(!rows.length){box.textContent='還沒有人上榜，你可以成為第一個。';return}
    box.replaceChildren(...rows.map((r,i)=>h('div',{cls:'li',style:r.pid===me?'box-shadow:0 0 0 1px var(--gold)':''},h('span',{cls:'ic',style:'color:'+(i<3?'var(--gold)':'var(--muted)')},String(i+1)),h('span',{cls:'tx'},r.name+(r.pid===me?'（你）':''),h('small',null,`Lv ${r.lvl}${r.spec?' · '+(SPEC[r.spec]?SPEC[r.spec].n:r.spec):''} · 擊殺 ${r.kills} · ${Math.floor((r.time||0)/60)} 分`+(r.boss?` · 審判官 ${Math.floor(r.boss/60)} 分擊破`:''))))))}).catch(()=>{box.textContent='天梯暫時無法讀取，請稍後再試。'}),600);
  k.push(h('div',{cls:'row'},closeBtn()));return k})}
function sysPanel(){openPanel(()=>{const k=[h('h2',null,'系統'),h('div',{cls:'sub'},'亡骨行者 · 試作版 0.4')];
  const st=h('div',{cls:'kv'});[['擊殺',P.stats.kills],['死亡',P.stats.deaths],['遊玩時間',Math.floor(P.stats.time/60)+' 分'],['等級',P.lvl]].forEach(([a,b])=>st.append(h('div',null,h('span',null,a),String(b))));k.push(st);
  k.push(h('h3',null,'操作'),h('div',{cls:'help'},'手機\n· 左下：拖曳移動\n· 畫面其他區域：拖曳轉動鏡頭、雙指縮放\n· 點敵人選取目標，技能會打目前目標\n· 施法需要站定，移動會打斷讀條\n\n鍵盤\n· WASD 移動　← → 轉鏡頭　滾輪縮放\n· Tab 選怪　1–6 技能　F 互動　C 冥想　R 藥水'));
  k.push(h('h3',null,'畫質'));const qn={high:'高（陰影 + 高解析）',mid:'中（建議手機）',low:'低（關閉陰影，最順）'};
  k.push(h('div',{cls:'row',style:'margin-top:4px'},...Object.keys(qn).map(q=>h('button',{type:'button',cls:'btn'+(QUAL===q?' pri':''),on:{click:()=>{try{localStorage.setItem('bw_quality',q)}catch(e){}save();location.reload()}}},qn[q]))));
  k.push(h('div',{cls:'stat',style:'margin-top:6px'},'切換畫質會重新載入頁面，進度會先存檔。'));
  k.push(h('h3',null,'測試工具'));
  const lvBtn=h('button',{type:'button',cls:'btn',on:{click:()=>{if(P.lvl>=10)return;P.lvl=10;P.xp=0;P.hp=maxHp();P.mana=maxMana();['wake','wolves','herbs','spiders','silk','scouts'].forEach(id=>{if(!Q[id]||Q[id].s!=='done')Q[id]={s:'done',c:[]}});BAG.hpot+=5;BAG.mpot+=5;EQ.staff=genGear('staff',9,2);EQ.robe=genGear('robe',9,2);save();closePanel();toast('已跳到 10 級','前期任務已標記完成，找艾瑟琳接職業任務',3)}}},'直接升到 10 級');
  const lv15=h('button',{type:'button',cls:'btn',on:{click:()=>{if(!P.spec){err('請先完成職業任務並選擇專精');return}P.lvl=MAXLV;P.xp=0;P.hp=maxHp();P.mana=maxMana();save();closePanel();toast('已升到 15 級','打開天賦面板試試三排天賦',3)}}},'升到 15 級（測天賦）');
  k.push(h('div',{cls:'row',style:'margin-top:4px'},lvBtn,lv15));
  const rb=h('button',{type:'button',cls:'btn',style:'width:100%;margin-top:14px'},'刪除角色並重新開始');let armed=false;rb.addEventListener('click',()=>{if(!armed){armed=true;rb.textContent='再按一次確認刪除';rb.style.color='var(--red)';return}try{localStorage.removeItem(SKEY)}catch(e){}location.reload()});k.push(rb);
  k.push(h('div',{cls:'row'},closeBtn('返回遊戲')));return k})}
$('mBag').onclick=()=>G.state==='play'&&bagPanel();$('mTal').onclick=()=>G.state==='play'&&talentPanel();$('mQ').onclick=()=>G.state==='play'&&questPanel();$('mSys').onclick=()=>G.state==='play'&&sysPanel();if($('mRank'))$('mRank').onclick=()=>G.state==='play'&&ladderPanel();if(!NET.on&&$('mRank'))$('mRank').hidden=true;

/* ================= 互動 ================= */
function nearInteract(){let best=null,bd=4.5;for(const n of npcs){const d=d2(n,P);if(d<bd){bd=d;best={l:'對話',f:()=>talkTo(n.id),o:n}}}
  for(const n of nodes){if(n.ready>G.time)continue;const d=d2(n,P);if(d<Math.min(bd,3.2)){bd=d;best={l:'採集',f:()=>startGather(n),o:n}}}
  if(Math.hypot(P.x+62,P.z+50)<4&&Q.trial&&Q.trial.s==='active'&&BAG.core<3&&!mobs.some(m=>m.d.temp&&m.state!=='dead'))best={l:'啟動',f:startRitual};
  return best}
function startGather(n){if(P.moving){err('移動中無法採集');return}if(inCombat()){err('戰鬥中無法採集');return}standUp();P.cast={id:'gather',t:0,dur:1.8,node:n}}
function startRitual(){banner('法陣甦醒了','擊敗三種失控的元素');ringFx(-62,-50,6,'#c38cff',1);emit(-62,ground(-62,-50)+1,-50,'#c38cff',80,6,1.2,{up:2});
  ['efire','efrost','earcane'].forEach((t,i)=>{const a=i/3*TAU+.5,m=spawnMob(t,10,-62+Math.cos(a)*5,-50+Math.sin(a)*5,99);m.summoned=false;setTimeout(()=>{if(m.state==='idle'){m.state='combat'}},1200+i*1500)})}
function usePotion(kind){if(P.dead)return;if(P.potCd>G.time){err('藥水還在冷卻中');return}
  if(!kind){kind=(P.hp/maxHp()<.6&&BAG.hpot>0)?'hpot':(P.mana/maxMana()<.6&&BAG.mpot>0)?'mpot':BAG.hpot>0?'hpot':BAG.mpot>0?'mpot':null}
  if(!kind||BAG[kind]<=0){err('沒有藥水');return}BAG[kind]--;P.potCd=G.time+20;
  if(kind==='hpot'){const v=Math.round(maxHp()*.4);P.hp=Math.min(maxHp(),P.hp+v);floatTxt(P.x,P.y+2.3,P.z,'+'+v,'#5fd35f');emit(P.x,P.y+1,P.z,'#ff6a6a',20,1.5,.8,{up:1.5})}
  else{const v=Math.round(maxMana()*.45);P.mana=Math.min(maxMana(),P.mana+v);floatTxt(P.x,P.y+2.3,P.z,'+'+v+' 法力','#6aa0ff');emit(P.x,P.y+1,P.z,'#6aa0ff',20,1.5,.8,{up:1.5})}save()}
function toggleSit(){if(P.dead)return;if(P.sit){P.sit=false;return}if(inCombat()){err('戰鬥中無法冥想');return}if(P.cast){err('正在施法');return}P.sit=true;P.wand=false}

/* ================= 輸入 ================= */
const keys=new Set();const cam={yaw:0,pitch:.52,dist:12.5};let camDist=12.5;let lastDrag=0;
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();keys.add(k);if(G.state!=='play'){if(k==='escape')closePanel();return}
  if(k==='tab'){e.preventDefault();tabTarget()}else if(k>='1'&&k<='6'){const s=slotSpell(+k-1);if(s)tryCast(s)}else if(k==='f'){const a=nearInteract();if(a)a.f()}else if(k==='c')toggleSit();else if(k==='r')usePotion();else if(k==='escape'){if(P.cast){P.cast=null}else setTarget(null)}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();joyEnd()});
const joy={id:null,ox:0,oy:0,x:0,y:0},joyEl=$('joy'),joyK=$('joyK');
function joyHome(){joyEl.style.left=`calc(${76}px + env(safe-area-inset-left,0px))`;joyEl.style.top=`calc(100% - ${96}px - env(safe-area-inset-bottom,0px))`;joyK.style.transform=''}
joyHome();
function joyEnd(){joy.id=null;joy.x=joy.y=0;joyHome()}
const ptrs=new Map();let pinch=0;
function resetInput(){joyEnd();ptrs.clear();pinch=0;keys.clear()}
addEventListener('pointerdown',e=>{if(e.isPrimary&&e.pointerType!=='mouse'){if(joy.id!==null&&joy.id!==e.pointerId)joyEnd();for(const id of [...ptrs.keys()])if(id!==e.pointerId)ptrs.delete(id);pinch=0}},true);
document.addEventListener('visibilitychange',()=>{resetInput();if(document.hidden){save();flush()}});
cvs.addEventListener('pointerdown',e=>{if(G.state!=='play')return;e.preventDefault();
  if(joy.id===null&&e.clientX<VW*.5&&e.clientY>VH*.58){joy.id=e.pointerId;joy.ox=e.clientX;joy.oy=e.clientY;joyEl.style.left=e.clientX+'px';joyEl.style.top=e.clientY+'px';return}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,t:performance.now(),mv:0});if(ptrs.size===2){const a=[...ptrs.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
addEventListener('pointermove',e=>{if(e.pointerId===joy.id){let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const l=Math.hypot(dx,dy),m=46;if(l>m){dx=dx/l*m;dy=dy/l*m}joy.x=dx/m;joy.y=dy/m;joyK.style.transform=`translate(${dx}px,${dy}px)`;return}
  const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;p.mv+=Math.abs(dx)+Math.abs(dy);
  if(ptrs.size>=2){const a=[...ptrs.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch)cam.dist=clamp(cam.dist*pinch/d,5,22);pinch=d;return}
  if(p.mv>6){cam.yaw-=dx*.009;cam.pitch=clamp(cam.pitch+dy*.006,.12,1.2);lastDrag=G.time}});
function ptrUp(e,cancel){if(e.pointerId===joy.id){joyEnd();return}const p=ptrs.get(e.pointerId);if(!p)return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=0;if(!cancel&&p.mv<10&&performance.now()-p.t<400&&G.state==='play')tapPick(e.clientX,e.clientY)}
addEventListener('pointerup',e=>ptrUp(e));addEventListener('pointercancel',e=>ptrUp(e,1));
cvs.addEventListener('wheel',e=>{e.preventDefault();cam.dist=clamp(cam.dist*(e.deltaY>0?1.1:.9),5,22)},{passive:false});
document.addEventListener('contextmenu',e=>e.preventDefault());
function tapPick(sx,sy){let best=null,bd=1e9;const cands=[...mobs.filter(m=>m.c.root.visible&&(m.state!=='dead'||m.loot)),...npcs,...nodes.filter(n=>n.ready<=G.time)];
  for(const o of cands){const y=(o.y!==undefined?o.y:ground(o.x,o.z))+(o.h||1.5)*.5,p=proj(o.x,y,o.z);if(!p)continue;const dist=d2(o,P),lim=clamp(70-dist*.8,34,70),d=Math.hypot(p[0]-sx,p[1]-sy);if(d<lim&&d<bd){bd=d;best=o}}
  if(!best)return;
  if(best.kind==='mob'){if(P.target===best&&alive(best))P.wand=true;setTarget(best)}
  else if(best.kind==='npc'){setTarget(best);if(d2(best,P)<5.5)talkTo(best.id);else err('距離太遠，走近一點')}
  else if(best.kind==='node'){if(d2(best,P)<3.5)startGather(best);else err('距離太遠，走近一點')}}
function bindHold(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fn()})}
bindHold($('uTab'),tabTarget);bindHold($('uAct'),()=>{const a=nearInteract();if(a)a.f();else err('附近沒有可以互動的對象')});bindHold($('uSit'),toggleSit);bindHold($('uPot'),()=>usePotion());

/* 快捷列 */
const barEl=$('bar'),btns=[];
function buildBar(){barEl.replaceChildren();btns.length=0;
  for(let i=0;i<6;i++){const b=h('button',{type:'button',cls:'ab'},h('span',{cls:'k'},String(i+1)),h('span',{cls:'nm'}),h('span',{cls:'t'}));bindHold(b,()=>{const s=slotSpell(i);if(s)tryCast(s);else err(i===5?'完成 10 級職業任務後解鎖':'尚未學會')});barEl.append(b);btns.push({b,nm:b.querySelector('.nm'),t:b.querySelector('.t'),last:''})}}
buildBar();
function updBar(){const tg=alive(P.target)?P.target:null;
  for(let i=0;i<6;i++){const B=btns[i],id=slotSpell(i),S=id&&SPL[id];let cls='ab',nm='',tx='',cd=0;
    if(!S){cls+=' lock';nm=i===5?'專精':'—'}
    else if(P.lvl<S.lv){cls+=' lock';nm='Lv'+S.lv}
    else{cls+=' '+S.sch;nm=S.s;const c=(P.cd[id]||0)-G.time;if(c>0){cd=c/val(S.cd);tx=c>=1?String(Math.ceil(c)):''}else if(P.gcd>0)cd=P.gcd/1.5;
      if(P.mana<val(S.mana))cls+=' oom';else if(S.tgt&&tg&&d2(tg,P)>S.range+tg.r)cls+=' oor';
      if((id==='pyro'&&P.hot)||(id==='icelance'&&(P.fof||(tg&&tg.root>0)))||(id==='arcblast'&&P.arc>0))cls+=' proc'}
    const key=cls+nm+tx;if(B.last!==key){B.b.className=cls;B.nm.textContent=nm;B.t.textContent=tx;B.last=key}B.b.style.setProperty('--cd',cd.toFixed(3))}}

/* ================= 存檔 ================= */
const SKEY='bonewalker_online_v02';
function save(){if(G.state==='load'||G.state==='title')return;try{localStorage.setItem(SKEY,JSON.stringify({P:{name:P.name,lvl:P.lvl,xp:P.xp,hp:P.hp,mana:P.mana,x:P.x,z:P.z,spec:P.spec,tal:P.tal,stats:P.stats},BAG,GEAR,EQ,Q,uid}))}catch(e){}}
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SKEY)||'null');return s&&s.P?s:null}catch(e){return null}}
function applySave(s){Object.assign(P,s.P);Object.assign(BAG,s.BAG);GEAR=s.GEAR||[];Object.assign(EQ,s.EQ);Q=s.Q||{};uid=s.uid||100;P.hp=clamp(P.hp,1,maxHp());P.mana=clamp(P.mana,0,maxMana());if(blocked(P.x,P.z,.4)){P.x=0;P.z=71}}

/* ================= 名牌 ================= */
const plateBox=$('plates'),plates=new Map();
function plateFor(o){let p=plates.get(o);if(!p){const el=h('div',{cls:'np'}),nm=h('div'),mk=h('div',{cls:'mk'}),hb=h('div',{cls:'hb'},h('i'));el.append(mk,nm,hb);plateBox.append(el);p={el,nm,mk,hb,fill:hb.firstChild,k:''};plates.set(o,p)}return p}
function updPlates(){const seen=new Set();
  const list=[...mobs.filter(m=>m.c.root.visible&&(m.state!=='dead'||m===P.target)),...npcs];
  for(const o of list){const dist=d2(o,P);if(dist>38&&o!==P.target)continue;const y=(o.kind==='npc'?ground(o.x,o.z):o.y)+o.h+.3,sp=proj(o.x,y,o.z);if(!sp)continue;seen.add(o);const p=plateFor(o);
    let name,col,showBar=false,mk='';if(o.kind==='npc'){name=o.N.n;col='#5fd35f';const m=npcMark(o.id);mk=m==='!'?'!':m==='?'?'?':m==='?g'?'?':'';p.mk.style.color=m==='?g'?'#9a9a9a':'var(--gold)'}
    else{name=(o.d.elite?'★ ':'')+o.d.n;col=o.state==='dead'?'#8a8a8a':conColor(o.lv);showBar=o.state!=='dead'&&(o.hp<o.max||o===P.target)}
    const k=name+col+mk+(o===P.target?'t':'')+showBar;if(p.k!==k){p.nm.textContent=name;p.nm.style.color=col;p.mk.textContent=mk;p.mk.hidden=!mk;p.hb.hidden=!showBar;p.el.classList.toggle('tg',o===P.target);p.k=k}
    if(showBar)p.fill.style.width=(o.hp/o.max*100).toFixed(1)+'%';
    const sc=clamp(1.25-dist/60,.7,1.1);p.el.style.transform=`translate(${sp[0].toFixed(1)}px,${sp[1].toFixed(1)}px) translate(-50%,-100%) scale(${sc.toFixed(2)})`;p.el.style.display=''}
  for(const [o,p] of plates)if(!seen.has(o))p.el.style.display='none'}

/* ================= 小地圖 ================= */
const mmc=$('mmc'),mx=mmc.getContext('2d');const worldMap=document.createElement('canvas');worldMap.width=worldMap.height=200;
(function(){const x=worldMap.getContext('2d'),img=x.createImageData(200,200);for(let j=0;j<200;j++)for(let i=0;i<200;i++){const wx=i-100,wz=j-100,c=groundColor(wx,wz,heightAt(wx,wz),tmpC),k=(j*200+i)*4;img.data[k]=c.r*255*1.3;img.data[k+1]=c.g*255*1.3;img.data[k+2]=c.b*255*1.3;img.data[k+3]=255}x.putImageData(img,0,0);
  x.fillStyle='#57525f';x.fillRect(94,183,12,6);COLL.filter(c=>c.r>1.5&&c.r<4).forEach(c=>{x.fillStyle='#4b2f6a';x.fillRect(c.x+100-1.5,c.z+100-1.5,3,3)})})();
function drawMinimap(){const S=192,sc=2.2,cx=S/2,cy=S/2;mx.save();mx.fillStyle='#0d0b12';mx.fillRect(0,0,S,S);mx.translate(cx,cy);mx.scale(sc,sc);mx.drawImage(worldMap,-P.x-100,-P.z-100);mx.restore();
  const pt=(x,z,col,r)=>{const px=cx+(x-P.x)*sc,py=cy+(z-P.z)*sc;if(Math.hypot(px-cx,py-cy)>S/2-6)return;mx.fillStyle=col;mx.beginPath();mx.arc(px,py,r,0,TAU);mx.fill()};
  for(const n of nodes)if(n.ready<=G.time)pt(n.x,n.z,'#93d95e',3);
  for(const m of mobs)if(m.state!=='dead'&&m.c.root.visible)pt(m.x,m.z,m===P.target?'#ffe14a':m.state==='combat'?'#ff3a2a':'#c84a3a',m.d.elite?5:3);
  for(const n of npcs){const k=npcMark(n.id);pt(n.x,n.z,k==='!'||k==='?'?'#f2c94c':'#5fd35f',4)}
  if(Q.trial&&Q.trial.s==='active')pt(-62,-50,'#c38cff',6);
  mx.save();mx.translate(cx,cy);mx.rotate(-P.yaw+Math.PI);mx.fillStyle='#fff';mx.beginPath();mx.moveTo(0,-9);mx.lineTo(6,7);mx.lineTo(0,3);mx.lineTo(-6,7);mx.closePath();mx.fill();mx.restore();
  mx.fillStyle='#f2c94c';mx.font='bold 20px sans-serif';mx.textAlign='center';mx.fillText('N',cx,20)}

/* ================= 更新 ================= */
let zoneT=0,mmT=0,qtT=0;
function update(dt){
  G.time+=dt;if(G.state!=='play'&&G.state!=='panel')return;
  P.stats.time+=dt;
  if(errT>0){errT-=dt;if(errT<=0)$('err').classList.remove('on')}if(banT>0){banT-=dt;if(banT<=0)$('banner').classList.remove('on')}if(toastT>0){toastT-=dt;if(toastT<=0)$('toast').classList.remove('on')}
  const active=G.state==='play';
  // 移動
  let ix=joy.x,iy=joy.y;if(active){if(keys.has('w'))iy-=1;if(keys.has('s'))iy+=1;if(keys.has('a'))ix-=1;if(keys.has('d'))ix+=1;if(keys.has('arrowleft'))cam.yaw+=dt*2;if(keys.has('arrowright'))cam.yaw-=dt*2}else{ix=iy=0}
  const il=Math.hypot(ix,iy);P.moving=!P.dead&&il>.2;
  if(P.moving){const n=Math.min(1,il),fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw),mx_=(fx*-iy+rx*ix)/il,mz=(fz*-iy+rz*ix)/il,sp=6.4*n*dt;
    const nx=P.x+mx_*sp,nz=P.z+mz*sp;if(!blocked(nx,P.z,.4))P.x=nx;if(!blocked(P.x,nz,.4))P.z=nz;P.yaw=angLerp(P.yaw,Math.atan2(mx_,mz),Math.min(1,dt*12));P.sit=false;
    if(P.cast){err(P.cast.id==='gather'?'採集被打斷':'移動打斷了施法');P.cast=null}}
  P.mv=lerp(P.mv,P.moving?1:0,Math.min(1,dt*10));P.y=ground(P.x,P.z);
  P.gcd=Math.max(0,P.gcd-dt);
  // 施法
  if(P.cast&&!P.dead){const c=P.cast;c.t+=dt;
    if(c.id==='gather'){if(c.t>=c.dur){const n=c.node,amt=Math.random()<.3?2:1;BAG.herb+=amt;n.ready=G.time+40;floatTxt(n.x,ground(n.x,n.z)+1.6,n.z,'+'+amt+' 墓地苔','#93d95e');emit(n.x,ground(n.x,n.z)+.6,n.z,'#a6ff8a',20,2,.8,{up:1});P.cast=null;const q=QBY.herbs;if(Q.herbs&&Q.herbs.s==='active'&&qReady(q))toast(q.t,'任務目標已完成，回去回報',2.2);save()}}
    else if(c.ch){const S=SPL[c.id],iv=c.dur/c.ticks;if(!alive(c.tgt)){P.cast=null}else{faceTarget(c.tgt);while(c.done<c.ticks&&c.t>=iv*(c.done+.4)){c.done++;const t=c.tgt,bonus=P.spec==='arcane'?1+c.arc*.25:1,dmg=S.dmg()*bonus;fireProj(handPos(),t,'arcane','arcane',30,()=>hitMob(t,dmg,'arcane',{spell:'missiles'}))}if(c.t>=c.dur)P.cast=null}}
    else{if(c.t>=c.dur){P.cast=null;if(!alive(c.tgt)){err('目標已死亡')}else if(d2(c.tgt,P)>SPL[c.id].range+c.tgt.r+2){err('超出範圍')}else execSpell(c.id,c.tgt)}else if(alive(c.tgt))faceTarget(c.tgt)}
    if(P.cast&&P.cast.id!=='gather'){const col=SCHOOL_COL[SPL[P.cast.id].sch];const hp=handPos();if(Math.random()<.8)emit(hp.x,hp.y,hp.z,col,1,1,.5,{sp:.2,up:.6})}}
  // 魔杖
  P.wandT-=dt;if(P.wand&&alive(P.target)&&!P.cast&&!P.moving&&!P.sit&&P.wandT<=0&&P.gcd<=0&&d2(P.target,P)<26){const t=P.target;faceTarget(t);P.wandT=1.6;fireProj(handPos(),t,'wand','wand',28,()=>hitMob(t,.45*spw()+3,'wand',{}))}
  if(P.target&&P.target.kind==='mob'&&P.target.state==='dead'&&!P.target.loot&&G.time-P.target.deadT>3)setTarget(null);
  // 回復
  const ic=inCombat(),mh=maxHp(),mm=maxMana();
  if(!P.dead){if(P.sit){P.hp=Math.min(mh,P.hp+mh*.07*dt);P.mana=Math.min(mm,P.mana+mm*.08*dt);if(Math.random()<.2)emit(P.x,P.y+.4,P.z,'#93d95e',1,.5,1,{sp:.6,up:.8});if(P.hp>=mh&&P.mana>=mm)P.sit=false}
    else if(!ic){P.hp=Math.min(mh,P.hp+mh*.012*dt);P.mana=Math.min(mm,P.mana+mm*.015*(P.spec==='arcane'?1.5:1)*dt)}
    else P.mana=Math.min(mm,P.mana+mm*.004*(P.spec==='arcane'?1.5:1)*dt);
    if(hasT('a3b')&&P.mana<mm*.2&&P.evoCd<=G.time){P.mana=mm;P.evoCd=G.time+90;toast('喚醒','法力已回滿',1.6);emit(P.x,P.y+1,P.z,'#c38cff',40,3,1,{up:1})}}
  if(P.arc>0&&G.time>P.arcT)P.arc=0;if(P.shield>0&&G.time>P.shieldT)P.shield=0;
  // 撿東西
  for(const m of mobs)if(m.state==='dead'&&m.loot&&d2(m,P)<3.2){const got=[];for(const[k,v]of m.loot){if(k==='gear'){GEAR.push(v);got.push(v.n);autoEquip(v)}else{BAG[k]+=v;got.push(ITEMS[k].n)}}m.loot=null;floatTxt(m.x,m.y+1.5,m.z,'拾取：'+got.join('、'),'#f2c94c');
    for(const q of QD){if(Q[q.id]&&Q[q.id].s==='active'&&q.obj.some(o=>o.item)&&qReady(q))toast(q.t,'任務目標已完成，回去回報',2.2)}save()}
  updMobs(dt,active);updProj(dt);
  for(let i=tels.length-1;i>=0;i--){const t=tels[i];t.t+=dt;const k=t.t/t.dur;t.fill.scale.setScalar(Math.max(.01,k));t.edge.material.opacity=.6+Math.sin(G.time*16)*.3;if(k>=1){t.fn();emit(t.x,ground(t.x,t.z)+.5,t.z,'#ffe08a',50,t.r*1.4,.7,{flat:1,up:2});scene.remove(t.edge);scene.remove(t.fill);[t.edge,t.fill].forEach(o=>{o.geometry.dispose();o.material.dispose()});tels.splice(i,1)}}
  for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.t+=dt;const k=r.t/r.dur;r.m.scale.setScalar(.5+k*r.r);r.m.material.opacity=.9*(1-k);if(k>=1){scene.remove(r.m);r.m.geometry.dispose();r.m.material.dispose();rings.splice(i,1)}}
  updParts(dt);
  // 地區
  zoneT-=dt;if(zoneT<=0){zoneT=.5;let z=ZONE_DEFAULT;for(const Z of ZONES)if(Math.hypot(P.x-Z.x,P.z-Z.z)<Z.r){z=Z;break}if(z.n!==G.zone){if(G.zone)banner(z.n,z.s);G.zone=z.n;window.__bwZone=z.n;$('zone').textContent=z.n}}
  G.saveT-=dt;if(G.saveT<=0){G.saveT=6;save()}G.hbT-=dt;if(G.hbT<=0){G.hbT=120;track('hb')}
}
function updMobs(dt,active){
  for(let i=mobs.length-1;i>=0;i--){const m=mobs[i],d=m.d;
    const far=d2(m,P)>72;m.c.root.visible=m.state!=='gone';
    if(m.state==='dead'){if(d.temp&&G.time-m.deadT>15){scene.remove(m.c.root);scene.remove(m.sh);const pl=plates.get(m);if(pl){pl.el.remove();plates.delete(m)}if(P.target===m)setTarget(null);if(m.ice)scene.remove(m.ice);mobs.splice(i,1);continue}
      if(!d.temp&&!m.summoned&&G.time-m.deadT>(d.boss?90:40)&&d2(m.home,P)>18){resetMob(m)}
      else if(m.summoned&&G.time-m.deadT>12){scene.remove(m.c.root);scene.remove(m.sh);const pl=plates.get(m);if(pl){pl.el.remove();plates.delete(m)}mobs.splice(i,1);continue}}
    m.root=Math.max(0,m.root-dt);m.slow=Math.max(0,m.slow-dt);m.atkT-=dt;m.healCd-=dt;m.atkAnim=Math.max(0,m.atkAnim-dt*3);
    if(m.dot&&m.state!=='dead'){m.dot.t-=dt;m.dot.acc+=dt;if(m.dot.acc>=1){m.dot.acc-=1;hitMob(m,m.dot.dps,'fire',{dot:1});if(Math.random()<.9)emit(m.x,m.y+1,m.z,'#ff8a3a',6,1.5,.6,{up:1.5})}if(m.dot&&m.dot.t<=0)m.dot=null}
    let mv=0;const dist=d2(m,P);
    if(m.state==='idle'&&active){m.wanderT-=dt;if(m.wanderT<=0){m.wanderT=rnd(4,9);if(!d.temp){const a=Math.random()*TAU,r=Math.random()*4;m.wx=m.home.x+Math.cos(a)*r;m.wz=m.home.z+Math.sin(a)*r}}
      const wd=Math.hypot(m.wx-m.x,m.wz-m.z);if(wd>.4){const s=1.4*dt;m.x+=(m.wx-m.x)/wd*s;m.z+=(m.wz-m.z)/wd*s;m.yaw=angLerp(m.yaw,Math.atan2(m.wx-m.x,m.wz-m.z),dt*5);mv=.4}
      const ar=clamp(9+(m.lv-P.lvl)*1.2,3.5,15);if(!P.dead&&dist<ar)aggro(m)}
    else if(m.state==='combat'&&active){
      if(P.dead||d2(m,m.home)>45&&!d.temp){m.state='evade';m.cast=null}
      else if(m.cast){m.cast.t+=dt;m.yaw=angLerp(m.yaw,Math.atan2(P.x-m.x,P.z-m.z),dt*8);if(m.cast.n==='懲擊'&&dist>26){m.cast=null}else if(m.cast.t>=m.cast.dur){const f=m.cast.fn;m.cast=null;glOne(m.c,'Spellcast_Shoot');f()}}
      else{
        if(d.boss){m.skT-=dt;if(m.skT<=0){m.skT=m.hp<m.max*.5?8:11;const tx=P.x,tz=P.z;telegraph(tx,tz,4.5,2.4,()=>{if(Math.hypot(P.x-tx,P.z-tz)<4.5&&!P.dead)hurtPlayer(m.dmg*3,m,'holy')});floatTxt(m.x,m.y+m.h+.6,m.z,'聖光審判！','#ffe08a',true)}
          if(!m.halfDone&&m.hp<m.max*.5){m.halfDone=true;banner('馬洛斯：守衛！','審判官召喚了援兵');for(const s of[-1,1]){const a=spawnMob('recruit',8,m.x+s*3,m.z+2,98);a.summoned=true;a.state='combat'}}}
        const speed=d.spd*(m.slow>0?1-m.slowA:1);
        const moveTo=(tx,tz,stop)=>{const dd=Math.hypot(tx-m.x,tz-m.z);if(dd>stop&&m.root<=0){const s=Math.min(dd-stop,speed*dt);m.x+=(tx-m.x)/dd*s;m.z+=(tz-m.z)/dd*s;mv=1}m.yaw=angLerp(m.yaw,Math.atan2(P.x-m.x,P.z-m.z),dt*8)};
        if(d.caster){let healed=false;if(m.healCd<=0){const ally=mobs.find(a=>a!==m&&a.state==='combat'&&a.hp<a.max*.45&&d2(a,m)<20);if(ally){m.cast={n:'治療術',t:0,dur:2.5,fn:()=>{if(ally.state!=='dead'&&m.state==='combat'){const v=Math.round(ally.max*.35);ally.hp=Math.min(ally.max,ally.hp+v);floatTxt(ally.x,ally.y+ally.h,ally.z,'+'+v,'#5fd35f');emit(ally.x,ally.y+1,ally.z,'#ffe08a',20,2,.8,{up:1.5})}}};m.healCd=12;healed=true}}
          if(!healed){if(dist>17)moveTo(P.x,P.z,16);else{moveTo(P.x,P.z,99);if(m.atkT<=0){m.cast={n:'懲擊',t:0,dur:2.2,fn:()=>{if(m.state==='combat'&&!P.dead)fireProj({x:m.x,y:m.y+2,z:m.z},P,'holy','holy',22,()=>hurtPlayer(m.dmg*1.35,m,'holy'))}};m.atkT=1.4}}}}
        else{const reach=m.r+.5+.9;if(dist>reach)moveTo(P.x,P.z,reach-.2);else{moveTo(P.x,P.z,99);if(m.atkT<=0){m.atkT=2;m.atkAnim=1;glOne(m.c,d.boss?'2H_Melee_Attack_Chop':'1H_Melee_Attack_Chop');hurtPlayer(m.dmg,m);if(d.col)emit(P.x,P.y+1.2,P.z,d.col,8,2,.4)}}}
      }}
    else if(m.state==='evade'){const dd=d2(m,m.home);m.cast=null;m.dot=null;m.root=0;if(dd>.5){const s=Math.min(dd,9*dt);m.x+=(m.home.x-m.x)/dd*s;m.z+=(m.home.z-m.z)/dd*s;m.yaw=Math.atan2(m.home.x-m.x,m.home.z-m.z);mv=1}else{m.state='idle';m.hp=m.max}m.hp=Math.min(m.max,m.hp+m.max*.5*dt);}
    if(m.state!=='dead'&&m.state!=='evade'){for(const o of mobs){if(o===m||o.state==='dead')continue;const dx=m.x-o.x,dz=m.z-o.z,dd=Math.hypot(dx,dz),mn=(m.r+o.r)*.8;if(dd>0&&dd<mn){m.x+=dx/dd*(mn-dd)*.5;m.z+=dz/dd*(mn-dd)*.5}}}
    m.y=ground(m.x,m.z);
    if(!far){m.c.root.position.set(m.x,m.y,m.z);m.c.root.rotation.y=m.yaw;m.anim+=dt;animChar(m.c,m.anim,{move:mv,dead:m.state==='dead',atk:m.atkAnim,cast:!!m.cast,combat:m.state==='combat'});if(m.c.mixer)m.c.mixer.update(dt);m.sh.position.set(m.x,m.y+.04,m.z);
      if(m.d.boss&&m.c.root.scale.x!==1.55)m.c.root.scale.setScalar(1.55);
      if(m.root>0&&m.state!=='dead'){if(!m.ice){m.ice=new T.Mesh(iceGeo,iceMat);scene.add(m.ice)}m.ice.position.set(m.x,m.y+.6,m.z);m.ice.scale.set(m.r*1.3,.9,m.r*1.3);m.ice.visible=true}else if(m.ice)m.ice.visible=false}
    m.c.root.visible=!far;m.sh.visible=!far}}

/* ================= 繪製 ================= */
function updCam(){const t=new T.Vector3(P.x,P.y+1.6,P.z),cp=Math.cos(cam.pitch),sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);let dd=cam.dist;for(let d=1.5;d<=cam.dist;d+=.5){const px=P.x+sy*cp*d,pz=P.z+cy*cp*d;if(COLL.some(c=>c.r>=1.5&&(px-c.x)*(px-c.x)+(pz-c.z)*(pz-c.z)<(c.r+.4)*(c.r+.4))){dd=Math.max(2.5,d-.5);break}}camDist=lerp(camDist,dd,.15);let x=P.x+sy*cp*camDist,z=P.z+cy*cp*camDist,y=P.y+1.6+Math.sin(cam.pitch)*camDist;const gy=ground(x,z)+.8;if(y<gy)y=gy;camera.position.set(x,y,z);camera.lookAt(t)}
function syncPlayer(dt){PC.root.position.set(P.x,P.y,P.z);PC.root.rotation.y=P.yaw;P.anim+=dt;animChar(PC,P.anim,{move:P.mv,cast:!!(P.cast&&P.cast.id!=='gather'),gather:!!(P.cast&&P.cast.id==='gather'),sit:P.sit,dead:P.dead,atk:0,combat:inCombat()});if(PC.mixer)PC.mixer.update(dt);
  sun.position.set(P.x-30,P.y+55,P.z+25);sun.target.position.set(P.x,P.y,P.z);pShadow.position.set(P.x,P.y+.04,P.z);
  if(PC.orb){const s=1+Math.sin(G.time*4)*.12+(P.cast?.35:0);PC.orb.scale.setScalar(s)}
  const t=P.target;if(t&&(t.kind!=='mob'||t.state!=='dead'||t.loot)){const ty=t.kind==='npc'?ground(t.x,t.z):t.y;selRing.position.set(t.x,ty+.08,t.z);selRing.scale.setScalar((t.r||.6)*1.4);selRing.material.color.set(t.kind==='npc'?'#5fd35f':t.state==='dead'?'#f2c94c':'#ff5a4a');selRing.rotation.y+=dt}else selRing.position.y=-99;
  for(const L of lights){const f=1+Math.sin(G.time*11+L.x)*.12+Math.sin(G.time*7.3)*.08;L.l.intensity=L.base*f;L.fl.forEach((m,i)=>m.scale.set(1,f+i*.1,1));if(Math.random()<.4)emit(L.x,ground(L.x,L.z)+1.4,L.z,L.c,1,.6,1,{sp:.3,up:1.8})}
  ritualRing.rotation.y+=dt*.3;ritualCore.rotation.y+=dt;ritualCore.position.y=ground(-62,-50)+1.6+Math.sin(G.time*2)*.2;ritualRing.material.opacity=Q.trial&&Q.trial.s==='active'?.75+Math.sin(G.time*3)*.2:.35;
  for(const n of nodes){n.g.visible=n.ready<=G.time;if(n.g.visible){n.g.rotation.y+=dt*.5;if(Math.random()<.04)emit(n.x,ground(n.x,n.z)+.8,n.z,'#a6ff8a',1,.4,1.2,{sp:.4,up:.5})}}
  for(const n of npcs){animChar(n.c,G.time+n.x,{move:0});if(n.c.mixer)n.c.mixer.update(dt)}
  for(const m of mobs)if(m.state==='dead'&&m.loot&&Math.random()<.15&&m.c.root.visible)emit(m.x,m.y+.6,m.z,'#f2c94c',1,.4,.8,{sp:.5,up:1})}
const hc={};function setTxt(id,v){if(hc[id]!==v){hc[id]=v;$(id).textContent=v}}function setW(id,v){const s=(clamp(v,0,1)*100).toFixed(1)+'%';if(hc[id+'w']!==s){hc[id+'w']=s;$(id).style.width=s}}
function updHud(){const mh=maxHp(),mm=maxMana();setTxt('pfN',P.name||'亡者');setTxt('pfL',(P.spec?SPEC[P.spec].n+' · ':'')+'Lv '+P.lvl);setW('pfH',P.hp/mh);setTxt('pfHT',Math.ceil(P.hp)+' / '+mh);setW('pfM',P.mana/mm);setTxt('pfMT',Math.floor(P.mana)+' / '+mm);
  const bf=[];if(P.shield>0)bf.push('護盾 '+P.shield);if(P.hot)bf.push('熱力迸發');if(P.fof)bf.push('冰霜之指');if(P.arc>0)bf.push('奧術充能 ×'+P.arc);if(P.sit)bf.push('冥想中');if(inCombat())bf.push('戰鬥中');const bk=bf.join('|');if(hc.bf!==bk){hc.bf=bk;$('buffs').replaceChildren(...bf.map(b=>h('b',null,b)))}
  const t=P.target,tf=$('tf');if(t){tf.hidden=false;$('buffWrap').style.top=`calc(${t?190:106}px + env(safe-area-inset-top,0px))`;
    if(t.kind==='npc'){setTxt('tfN',t.N.n);$('tfN').style.color='#5fd35f';setTxt('tfL','');setW('tfH',1);setTxt('tfHT','友善');$('tfCB').hidden=true;setTxt('tfSub',t.N.sub)}
    else{setTxt('tfN',(t.d.elite?'★ ':'')+t.d.n);$('tfN').style.color=t.state==='dead'?'#9a9a9a':conColor(t.lv);setTxt('tfL',(t.d.elite?'菁英 ':'')+'Lv '+t.lv);setW('tfH',t.hp/t.max);setTxt('tfHT',t.state==='dead'?'已死亡':Math.max(0,Math.ceil(t.hp))+' / '+t.max);
      if(t.cast){$('tfCB').hidden=false;setW('tfC',t.cast.t/t.cast.dur)}else $('tfCB').hidden=true;
      const sub=[];if(t.state==='evade')sub.push('脫離戰鬥');if(t.root>0)sub.push('冰凍 '+t.root.toFixed(1)+'s');if(t.slow>0)sub.push('緩速');if(t.dot)sub.push('點燃');if(t.cast)sub.push('施放：'+t.cast.n);if(t.state!=='dead')sub.push(Math.round(d2(t,P))+' 碼');setTxt('tfSub',sub.join(' · '))}}
  else{tf.hidden=true;$('buffWrap').style.top='calc(106px + env(safe-area-inset-top,0px))'}
  const cb=$('cb');if(P.cast){cb.hidden=false;const c=P.cast;cb.classList.toggle('ch',!!c.ch);setW('cbF',c.ch?1-c.t/c.dur:c.t/c.dur);setTxt('cbT',c.id==='gather'?'採集 墓地苔':SPL[c.id].n)}else cb.hidden=true;
  setW('xpF',P.lvl>=MAXLV?1:P.xp/xpNeed());setTxt('xpT',P.lvl>=MAXLV?'已達試作版等級上限 15':`經驗 ${P.xp} / ${xpNeed()}`);
  const a=G.state==='play'?nearInteract():null;setTxt('uActS',a?a.l:'—');if(a)$('uAct').removeAttribute('data-off');else $('uAct').setAttribute('data-off','');
  setTxt('uPotS',BAG.hpot+'/'+BAG.mpot);$('uSit').classList.toggle('on',P.sit);
  updBar();
  qtT-=1;if(qtT<=0){qtT=10;const act=QD.filter(q=>Q[q.id]&&Q[q.id].s==='active');const key=act.map(q=>q.id+q.obj.map((o,i)=>qProg(q,i)).join(',')+qReady(q)).join('|');
    if(hc.qt!==key){hc.qt=key;$('qt').replaceChildren(...act.slice(0,4).map(q=>{const rd=qReady(q)||q.obj[0].talk;return h('div',{cls:'q'},h('b',null,q.t),rd&&!q.obj[0].talk?h('div',{cls:'ok'},'完成 · 回報給'+NPCS[q.to||q.giver].n.split(' ')[1]):q.obj.map((o,i)=>h('div',null,o.talk?o.l:`${o.l} ${qProg(q,i)}/${o.n}`)))}))}
    const dot=QD.some(q=>q.giver&&qAvail(q));if(dot)$('mQ').setAttribute('data-dot','');else $('mQ').removeAttribute('data-dot');
    if(P.spec&&TROW.some((lv,i)=>P.lvl>=lv&&P.tal[i]===null))$('mTal').setAttribute('data-dot','');else $('mTal').removeAttribute('data-dot')}}

function resize(){VW=innerWidth;VH=innerHeight;renderer.setSize(VW,VH,false);camera.aspect=VW/VH;camera.fov=VW<VH?64:55;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

let last=performance.now();
let errCount=0,lastErr='';function showFatal(t,msg){const o=$('fatal');if(!o)return;$('fatalT').textContent=t;$('fatalM').textContent=msg;o.hidden=false}
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(ctxLost){requestAnimationFrame(loop);return}try{update(dt);syncPlayer(dt);updCam();if(G.state==='play'||G.state==='panel'){updPlates();updFloats(dt);updHud();mmT-=dt;if(mmT<=0){mmT=.15;drawMinimap()}}errCount=Math.max(0,errCount-1)}catch(e){console.error(e);errCount+=30;lastErr=(e&&e.message||String(e))+' @ '+((e&&e.stack||'').split('\n')[1]||'').trim();if(errCount>300){save();showFatal('遊戲發生錯誤',lastErr)}}renderer.render(scene,camera);requestAnimationFrame(loop)}
let ctxLost=false;cvs.addEventListener('webglcontextlost',e=>{e.preventDefault();ctxLost=true;save();showFatal('畫面被系統暫停','手機記憶體不足時，瀏覽器會暫停 3D 畫面。進度已存檔，重新載入即可繼續。建議到「系統」把畫質調成「中」或「低」。')});

/* ================= 標題 / 建立角色 ================= */
function titleScreen(){const s=loadSave(),ti=$('titleIn');$('title').hidden=false;G.state='title';cam.yaw=.6;cam.pitch=.35;cam.dist=14;
  const kids=[h('h1',null,'亡骨行者'),h('div',{cls:'en'},'BONEWALKER ONLINE'),h('p',null,'你在亡息營地的墓穴中甦醒。\n生前的記憶已經消散，只剩下骨頭與魔力。')];
  if(s){kids.push(h('button',{type:'button',cls:'btn pri',style:'flex:none',on:{click:()=>startGame(s)}},`繼續：${s.P.name}　Lv ${s.P.lvl} 骨法師${s.P.spec?'（'+SPEC[s.P.spec].n+'）':''}`));kids.push(h('button',{type:'button',cls:'btn',style:'flex:none',on:{click:createScreen}},'建立新角色'))}
  else kids.push(h('button',{type:'button',cls:'btn pri',style:'flex:none',on:{click:createScreen}},'建立角色'));
  kids.push(h('div',{cls:'tag'},'試作版 0.4 · 單機 · 進度存在此瀏覽器'));ti.replaceChildren(...kids)}
function createScreen(){const ti=$('titleIn');const inp=h('input',{id:'nameIn',maxLength:10,placeholder:'例如：骨頭先生',autocomplete:'off'});
  ti.replaceChildren(h('h1',{style:'font-size:32px'},'建立角色'),h('div',{cls:'en'},'UNDEAD · 不死族'),
    h('label',null,'角色名稱',inp),
    h('div',{style:'text-align:left;font-size:12px;color:var(--muted)'},'職業'),
    h('div',{cls:'cls'},h('button',{type:'button',cls:'sel'},'骨法師',h('small',null,'冰 · 火 · 奧術')),h('button',{type:'button',disabled:true},'骷髏戰士',h('small',null,'尚未開放')),h('button',{type:'button',disabled:true},'幽魂遊俠',h('small',null,'尚未開放'))),
    h('p',{style:'text-align:left;font-size:12px'},'骨法師前期使用骨火箭、寒冰箭、奧術飛彈。10 級完成職業任務後選擇專精，11、13、15 級解鎖天賦。'),
    h('button',{type:'button',cls:'btn pri',style:'flex:none',on:{click:()=>{const n=(inp.value||'').trim()||'無名亡者';try{localStorage.removeItem(SKEY)}catch(e){}startGame(null,n)}}},'進入幽影林地'),
    h('button',{type:'button',cls:'btn',style:'flex:none',on:{click:titleScreen}},'返回'))}
function startGame(s,name){if(s)applySave(s);else{P.name=name;EQ.staff={id:uid++,slot:'staff',lv:1,q:0,n:'新手法杖',sp:1,hp:0,mana:0,crit:0};EQ.robe={id:uid++,slot:'robe',lv:1,q:0,n:'破舊長袍',sp:0,hp:4,mana:5,crit:0};P.hp=maxHp();P.mana=maxMana()}
  window.__bwQDone=QD.filter(x=>Q[x.id]&&Q[x.id].s==='done').length;applySpecLook();buildBar();$('title').hidden=true;G.state='play';setTimeout(()=>track(s?'resume':'new'),500);P.y=ground(P.x,P.z);cam.yaw=0;cam.pitch=.52;cam.dist=12.5;camDist=12.5;G.zone='';
  banner('幽影林地',s?'歡迎回來，'+P.name:'亡者的甦醒');
  if(!s){glOne(PC,'Skeletons_Awaken_Floor');setTimeout(()=>{if(G.state==='play'){setTarget(npcs[0]);talkTo('trainer')}},2600)}save()}
window.BW={P,mobs,Q:()=>Q,BAG,tryCast,G,setTarget,talkTo};
const ld=$('loading');
const boot=()=>{initWorld();ld.hidden=true;titleScreen();requestAnimationFrame(loop)};
if(T.GLTFLoader&&T.SkeletonUtils)loadAssets((a,b)=>{ld.textContent=`正在喚醒亡者……載入角色 ${a} / ${b}`}).then(boot).catch(e=>{console.warn('角色模型載入失敗，改用簡易模型',e);boot()});else boot();
})();
