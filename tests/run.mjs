import puppeteer from 'puppeteer-core';import fs from 'fs';
const gen=fs.readFileSync(new URL('./gen.js',import.meta.url),'utf8');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
async function open(url){const p=await b.newPage();p.errs=[];p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});p.on('pageerror',e=>p.errs.push('pageerror: '+e.message));await p.goto(url,{waitUntil:'networkidle0'});await p.addScriptTag({content:gen});p.setDefaultTimeout(0);return p}
const R={};
// ---------- 1. null test: new build with all new stages off == old build ----------
const nullCfg=`async cfg=>{const sr=48000;const[L,R]=T.drums(sr,12);audioBuffer=T.buf(L,R,sr);
  if(cfg==='am'){tools.am.on=true}
  if(cfg==='eq_imm_am'){tools.am.on=true;tools.eq.on=true;tools.eq.bands[3].g=3;applyImmersivePreset('Wide')}
  if(cfg==='am_meter_off'){tools.am.on=true;tools.am.target=-9;tools.meter.on=false}
  await runMaster(currentMasterOpts(),'t');const ab=await masterBlob.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',ab);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16)+' '+ab.byteLength}`;
R.null={};
for(const cfg of ['default','am','eq_imm_am','am_meter_off']){const po=await open('http://localhost:8812/'),pn=await open('http://localhost:8811/');
  const ho=await po.evaluate(`(${nullCfg})('${cfg}')`),hn=await pn.evaluate(`(${nullCfg})('${cfg}')`);R.null[cfg]={old:ho,new:hn,identical:ho===hn};await po.close();await pn.close()}
console.log(JSON.stringify(R.null,null,1));
// ---------- 2. Smart Master on test signals ----------
const p=await open('http://localhost:8811/');
const smart=`async([sig,inten])=>{const sr=48000;let s;if(sig==='pink')s=T.pink(sr,20,0.06,1);else if(sig==='sweep')s=T.sweep(sr,20,0.5);else if(sig==='drums')s=T.drums(sr,20);else if(sig==='sibilant')s=T.sibilant(sr,20);
  audioBuffer=T.buf(s[0],s[1],sr);document.querySelector('#smartIntensity [data-k='+inten+']').click();const t0=performance.now();await smartRun(false);const ms=performance.now()-t0;
  const st=T.stats(lastMaster);return{sig,inten,ms:Math.round(ms),intensityTarget:SMART_INT[inten].target,finalTarget:lastTarget,...st,lufsErr:+(st.I-lastTarget).toFixed(2),found:smartPlan.found,fix:smartPlan.fix,status:document.getElementById('status').textContent.split('\\n').slice(0,3).join(' | ')}}`;
R.smart=[];
for(const [sig,inten] of [['pink','Balanced'],['sweep','Balanced'],['drums','Subtle'],['drums','Balanced'],['drums','Loud'],['sibilant','Balanced']]){const r=await p.evaluate(`(${smart})(${JSON.stringify([sig,inten])})`);R.smart.push(r);console.log(JSON.stringify(r))}
// ---------- 3. fixed targets with every studio card on ----------
R.fixed=[];
for(const tg of [-14,-11,-9]){const r=await p.evaluate(`(async tg=>{const sr=48000;const s=T.drums(sr,20);audioBuffer=T.buf(s[0],s[1],sr);STUDIO_KEYS.forEach(k=>studio[k].on=true);studio.lim.on=true;studio.dither.on=true;tools.am.on=true;tools.am.target=tg;syncAllStudio();lastTarget=null;await runMaster(currentMasterOpts(),'fixed');const st=T.stats(lastMaster);return{tg,...st,err:+(st.I-tg).toFixed(2)}})(${tg})`);R.fixed.push(r);console.log(JSON.stringify(r))}
// ---------- 4. aliasing: 1 kHz + 15 kHz tones, Loud ----------
R.alias=await p.evaluate(`(async()=>{const sr=48000;const s=T.multitone(sr,12,[1000,15000],0.35);audioBuffer=T.buf(s[0],s[1],sr);document.querySelector('#smartIntensity [data-k=Loud]').click();await smartRun(false);
  const d=lastMaster.getChannelData(0),n=65536,m=T.spec(d,sr*5,n),bin=sr/n,top=Math.max(...m);let spur=-999,at=0;
  for(let k=Math.round(20/bin);k<n/2;k++){const f=k*bin;if(Math.abs(f-1000)<60||Math.abs(f-15000)<60)continue;if(m[k]>spur){spur=m[k];at=f}}
  let above=-999;for(let k=Math.round(16000/bin);k<n/2;k++)above=Math.max(above,m[k]);
  return{toneDb:+top.toFixed(1),worstSpuriousDbRel:+(spur-top).toFixed(1),at:Math.round(at),maxAbove16kDbRel:+(above-top).toFixed(1),...T.stats(lastMaster)}})()`);
console.log('alias',JSON.stringify(R.alias));
// ---------- 5. artifact tests ----------
// 5a. multitone residual after least-squares gain/phase match (should be ~ noise floor, no warble sidebands)
R.residual=await p.evaluate(`(async()=>{const sr=48000,fs=[100,440,1200,3300,7700];const s=T.multitone(sr,14,fs,0.1);audioBuffer=T.buf(s[0],s[1],sr);document.querySelector('#smartIntensity [data-k=Balanced]').click();await smartRun(false);
  const y=lastMaster.getChannelData(0),o=sr*7,N=sr*4;const basis=[];fs.forEach(f=>{const c=new Float64Array(N),si=new Float64Array(N);for(let i=0;i<N;i++){c[i]=Math.cos(2*Math.PI*f*(o+i)/sr);si[i]=Math.sin(2*Math.PI*f*(o+i)/sr)}basis.push(c,si)});
  const r=Float64Array.from(y.subarray(o,o+N));let sig=0;for(let i=0;i<N;i++)sig+=r[i]*r[i];
  for(let it=0;it<3;it++)basis.forEach(bv=>{let num=0,den=0;for(let i=0;i<N;i++){num+=r[i]*bv[i];den+=bv[i]*bv[i]}const a=num/den;for(let i=0;i<N;i++)r[i]-=a*bv[i]});
  let res=0;for(let i=0;i<N;i++)res+=r[i]*r[i];const m=T.spec(r,0,65536),ref=T.spec(y,o,65536);
  return{residualDbRel:+(10*Math.log10(res/sig)).toFixed(1),residualPeakBinDbRel:+(Math.max(...m)-Math.max(...ref)).toFixed(1)}})()`);
console.log('residual',JSON.stringify(R.residual));
// 5b. gain-trace smoothness of every dynamic stage (energy of gain modulation above 40 Hz) on drums + sibilant
R.gainTrace=await p.evaluate(`(async()=>{const sr=48000,out={};for(const sig of ['drums','sibilant']){const s=sig==='drums'?T.drums(sr,12):T.sibilant(sr,12);const b=T.buf(s[0],s[1],sr);
  const st=studioSnapshot();['clean','mono','ceq','deq','dess','mb','glue'].forEach(k=>st[k].on=true);st.deq.mudMax=3;st.deq.harshMax=3;st.dess.max=6;
  const r=await renderStudio(b,st,{traceEvery:8});const tr=r.dsp.trace.data,fsT=sr/8;const o={};
  for(const k in tr){const a=tr[k];let mean=0;a.forEach(v=>mean+=v);mean/=a.length;let vtot=0;a.forEach(v=>vtot+=(v-mean)*(v-mean));
    const h1=new MMS.Biquad(MMS.coefs('highpass',40,fsT)),h2=new MMS.Biquad(MMS.coefs('highpass',40,fsT));let vh=0,mx=0,maxStep=0;a.forEach((v,i)=>{const h=h2.run(h1.run(v));if(i>fsT*0.1)vh+=h*h;if(v>mx)mx=v;if(i)maxStep=Math.max(maxStep,Math.abs(v-a[i-1]))});
    o[k]={maxGrDb:+mx.toFixed(2),modAbove40HzDbRel:vtot>1e-9?+(10*Math.log10(vh/vtot+1e-12)).toFixed(1):null,maxSlewDbPerMs:+(maxStep*fsT/1000).toFixed(3)}}
  out[sig]=o}return out})()`);
console.log('gainTrace',JSON.stringify(R.gainTrace));
// 5c. musical-noise check on pink noise: per-bin temporal spread (dB std over frames) in vs out
R.musicalNoise=await p.evaluate(`(async()=>{const sr=48000;const s=T.pink(sr,16,0.06,3);audioBuffer=T.buf(s[0],s[1],sr);document.querySelector('#smartIntensity [data-k=Loud]').click();await smartRun(false);
  const spread=(x,o)=>{const n=2048,F=[];for(let f=0;f<300;f++)F.push(T.spec(x,o+f*1024,n));const lo=Math.round(50/(sr/n)),hi=Math.round(16000/(sr/n));let sd=0,c=0;for(let k=lo;k<hi;k++){let m=0;F.forEach(a=>m+=a[k]);m/=F.length;let v=0;F.forEach(a=>v+=(a[k]-m)**2);sd+=Math.sqrt(v/F.length);c++}return sd/c};
  const a=spread(s[0],sr*5),b2=spread(lastMaster.getChannelData(0),sr*5);return{inStdDb:+a.toFixed(2),outStdDb:+b2.toFixed(2),diffDb:+(b2-a).toFixed(2),...T.stats(lastMaster)}})()`);
console.log('musicalNoise',JSON.stringify(R.musicalNoise));
// ---------- 6. live preview with studio worklet ----------
R.preview=await p.evaluate(`(async()=>{await startImmersivePreview();await new Promise(r=>setTimeout(r,3000));const m=document.getElementById('mI').textContent,mode=pv.tail&&pv.tail.mode,run=previewRunning();stopImmersivePreview(false);return{mode,run,meterI:m,head:pv.head.length}})()`);
console.log('preview',JSON.stringify(R.preview));
R.consoleErrors=p.errs;console.log('console errors',JSON.stringify(p.errs));
fs.writeFileSync('results.json',JSON.stringify(R,null,1));await b.close();
