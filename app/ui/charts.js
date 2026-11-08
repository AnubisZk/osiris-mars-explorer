/** Minimal canvas charts (no dependencies): multi-series line chart and grouped bar chart. */
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim()||'#888';
function setup(canvas){
  const dpr=Math.min(2,devicePixelRatio||1),w=canvas.clientWidth||300,h=canvas.clientHeight||150;
  canvas.width=w*dpr;canvas.height=h*dpr;const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);return {g,w,h};
}
const nice=v=>Math.abs(v)>=100?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2);
export function lineChart(canvas,{x,series,xLabel='',title=''}){
  const {g,w,h}=setup(canvas),L=42,R=8,T=title?18:8,B=20;
  let lo=Infinity,hi=-Infinity;for(const s of series)for(const v of s.data)if(Number.isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  if(!Number.isFinite(lo)){lo=0;hi=1;}if(hi-lo<1e-9){hi+=1;lo-=1;}const pad=(hi-lo)*.06;lo-=pad;hi+=pad;
  const x0=x[0]??0,x1=x[x.length-1]??1,X=v=>L+(v-x0)/((x1-x0)||1)*(w-L-R),Y=v=>T+(1-(v-lo)/(hi-lo))*(h-T-B);
  g.strokeStyle=css('--grid');g.fillStyle=css('--muted');g.font='11px system-ui';g.lineWidth=1;
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4,y=Y(v);g.beginPath();g.moveTo(L,y);g.lineTo(w-R,y);g.stroke();g.fillText(nice(v),4,y+4);}
  g.fillText(`${nice(x0)}–${nice(x1)} ${xLabel}`,L,h-5);if(title){g.fillStyle=css('--text');g.fillText(title,L,12);}
  series.forEach((s,si)=>{g.strokeStyle=s.color;g.lineWidth=1.6;g.beginPath();let pen=false;
    for(let i=0;i<x.length;i++){const v=s.data[i];if(!Number.isFinite(v)){pen=false;continue;}const px=X(x[i]),py=Y(v);pen?g.lineTo(px,py):g.moveTo(px,py);pen=true;}
    g.stroke();g.fillStyle=s.color;g.fillText(s.label,w-R-110,T+12+si*13);});
}
export function barChart(canvas,{labels,values,errors=null,color='#e07a4a',title='',unit=''}){
  const {g,w,h}=setup(canvas),L=42,R=8,T=title?18:8,B=34,n=labels.length;
  const hi=Math.max(1e-9,...values.map((v,i)=>(Number.isFinite(v)?v:0)+(errors?.[i]??0)))*1.1,Y=v=>T+(1-v/hi)*(h-T-B),bw=(w-L-R)/Math.max(1,n);
  g.font='11px system-ui';g.strokeStyle=css('--grid');g.fillStyle=css('--muted');
  for(let k=0;k<=4;k++){const v=hi*k/4,y=Y(v);g.beginPath();g.moveTo(L,y);g.lineTo(w-R,y);g.stroke();g.fillText(nice(v),4,y+4);}
  labels.forEach((lab,i)=>{const v=values[i],x=L+i*bw+bw*.18;
    if(Number.isFinite(v)){g.fillStyle=color;g.fillRect(x,Y(v),bw*.64,Y(0)-Y(v));
      if(errors?.[i]){g.strokeStyle=css('--text');g.beginPath();g.moveTo(x+bw*.32,Y(v-errors[i]));g.lineTo(x+bw*.32,Y(v+errors[i]));g.stroke();}}
    else{g.fillStyle=css('--muted');g.fillText('—',x+bw*.25,Y(0)-4);}
    g.fillStyle=css('--muted');g.save();g.translate(x+bw*.32,h-B+12);g.fillText(String(lab).slice(0,14),-String(lab).slice(0,14).length*2.7,0);g.restore();});
  if(title){g.fillStyle=css('--text');g.fillText(`${title}${unit?` (${unit})`:''}`,L,12);}
}
