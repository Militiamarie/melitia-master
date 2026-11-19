// test-signal generators + analysis helpers injected into the page (test code only)
window.T={};
T.rng=seed=>{let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296*2-1}};
T.buf=(L,R,sr)=>{const b=new AudioBuffer({length:L.length,numberOfChannels:2,sampleRate:sr});b.copyToChannel(L,0);b.copyToChannel(R,1);return b};
T.pink=(sr,secs,rms,seed)=>{const N=sr*secs,o=[new Float32Array(N),new Float32Array(N)];[0,1].forEach(c=>{const r=T.rng(seed+c*77);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,ss=0;for(let i=0;i<N;i++){const w=r();b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.3104856;b4=0.55*b4+w*0.5329522;b5=-0.7616*b5-w*0.016898;const v=b0+b1+b2+b3+b4+b5+b6+w*0.5362;b6=w*0.115926;o[c][i]=v;ss+=v*v}const g=rms/Math.sqrt(ss/N);for(let i=0;i<N;i++)o[c][i]*=g});return o};
T.sweep=(sr,secs,amp)=>{const N=sr*secs,o=new Float32Array(N),f0=20,f1=20000,K=Math.log(f1/f0);for(let i=0;i<N;i++){const t=i/sr;o[i]=amp*Math.sin(2*Math.PI*f0*secs/K*(Math.exp(t/secs*K)-1))*Math.min(1,i/2000,(N-i)/2000)}return[o,o.slice()]};
T.drums=(sr,secs)=>{const N=sr*secs,L=new Float32Array(N),R=new Float32Array(N),r=T.rng(99),beat=Math.round(sr*0.5);
  for(let s=0;s<N;s+=beat){const k=(s/beat)|0;
    for(let i=0;i<sr*0.4&&s+i<N;i++){const t=i/sr,ph=2*Math.PI*(50*t+70*(1-Math.exp(-t*30))/30);const v=0.9*Math.sin(ph)*Math.exp(-t*6);L[s+i]+=v;R[s+i]+=v}
    if(k%2===1){let lp=0;for(let i=0;i<sr*0.2&&s+i<N;i++){const t=i/sr,n=r();lp+=0.3*(n-lp);const v=(0.5*(n-lp)+0.4*Math.sin(2*Math.PI*190*t))*Math.exp(-t*18);L[s+i]+=v;R[s+i]+=v*0.95}}
    for(let h=0;h<2;h++){const o=s+h*(beat>>1);let pv=0;for(let i=0;i<sr*0.05&&o+i<N;i++){const n=r(),v=(n-pv)*0.25*Math.exp(-i/sr*60);pv=n;L[o+i]+=v*0.8;R[o+i]+=v}}}
  // bass line + pad so it is "music-like"
  for(let i=0;i<N;i++){const t=i/sr,f=[55,55,65.4,49][(t/2|0)%4];const v=0.25*Math.sin(2*Math.PI*f*t)+0.04*Math.sin(2*Math.PI*440*t)+0.03*Math.sin(2*Math.PI*660.5*t);L[i]+=v;R[i]+=v}
  return[L,R]};
T.sibilant=(sr,secs)=>{const[L,R]=T.pink(sr,secs,0.05,5);const r=T.rng(4242),f=[[],[]];const C=MMS.coefs;[0,1].forEach(c=>{f[c]=[new MMS.Biquad(C("highpass",5000,sr)),new MMS.Biquad(C("highpass",5000,sr)),new MMS.Biquad(C("lowpass",10000,sr))]});
  for(let i=0;i<L.length;i++){const t=i/sr,ph=t%0.5;const env=ph<0.09?Math.sin(Math.PI*ph/0.09):0;const n=r();[L,R].forEach((a,c)=>{let v=n;f[c].forEach(q=>v=q.run(v));a[i]+=0.8*env*v+0.08*Math.sin(2*Math.PI*220*t)})}
  return[L,R]};
T.multitone=(sr,secs,fs,amp)=>{const N=sr*secs,o=new Float32Array(N);for(let i=0;i<N;i++){let v=0;fs.forEach(f=>v+=Math.sin(2*Math.PI*f*i/sr));o[i]=amp*v*Math.min(1,i/4800)}return[o,o.slice()]};
// FFT (test analysis only)
T.fft=(re,im)=>{const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci,vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}};
T.spec=(x,off,n)=>{const re=new Float64Array(n),im=new Float64Array(n);let wsum=0;for(let i=0;i<n;i++){const w=0.35875-0.48829*Math.cos(2*Math.PI*i/n)+0.14128*Math.cos(4*Math.PI*i/n)-0.01168*Math.cos(6*Math.PI*i/n);re[i]=x[off+i]*w;wsum+=w}T.fft(re,im);const m=new Float64Array(n/2);for(let k=0;k<n/2;k++)m[k]=20*Math.log10(Math.hypot(re[k],im[k])/wsum*2+1e-15);return m};
T.stats=b=>{let nan=0,pk=0;for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++){const v=d[i];if(!isFinite(v))nan++;else if(Math.abs(v)>pk)pk=Math.abs(v)}}const a=analyzeLoudness(b);return{nan,samplePeakDb:+(20*Math.log10(pk)).toFixed(2),I:+a.I.toFixed(2),TP:+a.TP.toFixed(2),LRA:+a.LRA.toFixed(1)}};
T.voice=(sr,secs)=>{const N=sr*secs,L=new Float32Array(N),R=new Float32Array(N),r=T.rng(2026);
  const C=MMS.coefs,B=MMS.Biquad,form=[[],[]];
  [0,1].forEach(c=>{form[c]=[new B(C("peaking",700,sr,6,10)),new B(C("peaking",1200,sr,8,8)),new B(C("peaking",2600,sr,6,6)),new B(C("highpass",80,sr,0.7071))]});
  let ph=0;
  for(let i=0;i<N;i++){const t=i/sr,syl=(Math.sin(2*Math.PI*2.4*t)*0.5+0.5); // ~syllable envelope
    const env=0.15+0.85*Math.pow(syl,1.4)*((t%0.9)<0.65?1:0.15);
    const f0=165+8*Math.sin(2*Math.PI*0.35*t);
    ph+=2*Math.PI*f0/sr;let buzz=0;for(let h=1;h<=8;h++)buzz+=Math.sin(ph*h)/h;
    [L,R].forEach((a,c)=>{let v=buzz*0.22*env;form[c].forEach(q=>v=q.run(v));a[i]=v})}
  const sib=T.sibilant(sr,secs);for(let i=0;i<N;i++){L[i]+=sib[0][i]*0.55;R[i]+=sib[1][i]*0.55}
  return[L,R]};
