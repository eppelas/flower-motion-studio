import { outline } from './geometry.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cross = (a, b, c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points) {
  const sorted = [...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]), lo=[], hi=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p)}
  for(const p of [...sorted].reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p)}
  return [...lo.slice(0,-1),...hi.slice(0,-1)];
}
const domain = hull(outline.map(([x,y])=>[x*194+99,y*194+102]));
function cells(count) {
  const seeds = Array.from({length:count},(_,i)=>{const r=78*Math.sqrt((i+.5)/count), a=i*2.3999632297;return [99+Math.cos(a)*r,102+Math.sin(a)*r]});
  return seeds.map((seed,i)=>{
    let polygon=domain.map(p=>[...p]);
    for(let j=0;j<seeds.length;j++){
      if(i===j)continue;
      const other=seeds[j], nx=other[0]-seed[0], ny=other[1]-seed[1], mx=(seed[0]+other[0])/2,my=(seed[1]+other[1])/2;
      const d=p=>(p[0]-mx)*nx+(p[1]-my)*ny, next=[];
      for(let k=0;k<polygon.length;k++){
        const a=polygon[k],b=polygon[(k+1)%polygon.length],da=d(a),db=d(b);
        if(da<=.00001)next.push(a);
        if((da<0)!==(db<0)){const t=da/(da-db);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
      }
      polygon=next;
    }
    const centre=polygon.reduce((s,p)=>[s[0]+p[0]/polygon.length,s[1]+p[1]/polygon.length],[0,0]);
    return { polygon:polygon.map(p=>[p[0]-centre[0],p[1]-centre[1]]), centre };
  });
}

export function setupClickEffects({world,paused,reduced,paint}) {
  const {body,element,arena}=world;
  const canvas=document.createElement('canvas');canvas.className='fragment-canvas';canvas.setAttribute('aria-hidden','true');arena.append(canvas);
  const context=canvas.getContext('2d'), status=document.querySelector('#click-status'),charge=document.querySelector('#charge-logo');
  const ids=['click-enabled','click-threshold','explosion-force','piece-count','expansion'];
  const controls=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  let mode='whole',clicks=0,age=0,targetScale=1,particles=[],texture=null,version=0,paletteVersion=0,down=null,eligible=true;
  let previousSize={width:body.width,height:body.height};
  const settings=()=>({enabled:controls['click-enabled'].checked,threshold:+controls['click-threshold'].value,force:+controls['explosion-force'].value,count:+controls['piece-count'].value,expansion:+controls.expansion.value});
  const announce=()=>{status.textContent=mode==='exploded'?`${particles.length} pieces · Reset logo to reassemble`:mode==='preparing'?'Preparing pieces…':`${clicks} / ${settings().threshold} clicks`};
  function reset(){version++;mode='whole';clicks=0;age=0;targetScale=1;particles=[];body.responseScale=1;body.responseHeld=false;body.effectHidden=false;element.disabled=false;charge.disabled=!settings().enabled;announce();render()}
  function setScale(value){const b=body.support(),scale=body.responseScale;const fit=Math.min((body.width-24)/((b.right-b.left)/scale),(body.floor-12)/((b.bottom-b.top)/scale));body.responseScale=Math.min(value,fit);body.constrain()}
  function resize(){
    const sx=body.width/previousSize.width,sy=body.height/previousSize.height;
    for(const p of particles){p.x*=sx;p.y*=sy;p.vx*=sx;p.vy*=sy;p.scaleX*=Math.min(sx,sy);p.scaleY*=Math.min(sx,sy)}
    previousSize={width:body.width,height:body.height};
    setScale(body.responseScale);for(const p of particles)bound(p);
    const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(body.width*ratio);canvas.height=Math.round(body.height*ratio);context.setTransform(ratio,0,0,ratio,0,0);
  }
  async function image(){
    const source=element.querySelector('svg');
    if(!source)throw new Error('Logo is still loading');
    const copy=source.cloneNode(true);copy.setAttribute('width','776');copy.setAttribute('height','792');
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    try{const img=new Image();img.src=url;await img.decode();return img}finally{URL.revokeObjectURL(url)}
  }
  async function shatter(){
    if(mode==='preparing'||mode==='exploded')return;
    mode='preparing';announce();const token=++version;
    try{
      const img=await image();if(token!==version)return;texture=img;
      const config=settings(), factor=body.size/194*body.responseScale, cos=Math.cos(body.angle),sin=Math.sin(body.angle);
      particles=cells(config.count).map((cell,i)=>{
        const dx=(cell.centre[0]-99)*factor*body.sx,dy=(cell.centre[1]-102)*factor*body.sy;
        const x=body.x+dx*cos-dy*sin,y=body.y+dx*sin+dy*cos;
        const a=Math.atan2(y-body.y,x-body.x),random=(Math.sin(i*127.1+43.7)*43758.5453)%1, r=Math.abs(random),speed=(160+r*210)*config.force/100*body.unit;
        return {...cell,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-100*config.force/100*body.unit,angle:body.angle,spin:(r-.5)*9,scaleX:factor*body.sx,scaleY:factor*body.sy};
      });
      mode='exploded';body.effectHidden=true;body.responseHeld=true;element.disabled=true;charge.disabled=true;
      if(reduced()){for(const p of particles){p.x+=p.vx*.14;p.y+=p.vy*.14;p.vx=p.vy=p.spin=0;bound(p)}}
      announce();paint();
    }catch(error){if(token!==version)return;reset();status.textContent='The logo could not burst. Try again.'}
  }
  function bounds(p){const c=Math.cos(p.angle),s=Math.sin(p.angle);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const[x,y]of p.polygon){const px=x*p.scaleX*c-y*p.scaleY*s,py=x*p.scaleX*s+y*p.scaleY*c;left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py)}return{left,right,top,bottom}}
  function bound(p){const b=bounds(p);if(p.x+b.left<8){p.x=8-b.left;p.vx=Math.abs(p.vx)*.3}if(p.x+b.right>body.width-8){p.x=body.width-8-b.right;p.vx=-Math.abs(p.vx)*.3}if(p.y+b.top<8){p.y=8-b.top;p.vy=Math.abs(p.vy)*.3}if(p.y+b.bottom>body.floor){p.y=body.floor-b.bottom;p.vy=Math.abs(p.vy)<25?0:-Math.abs(p.vy)*.23;p.vx*=.78;p.spin*=.7}}
  function step(dt){
    if(mode==='charging'||mode==='priming'){
      setScale(body.responseScale+(targetScale-body.responseScale)*(1-Math.exp(-15*dt)));
      if(mode==='priming'){age+=dt;if(age>=.2)shatter()}
    }
    if(mode==='exploded')for(const p of particles){p.vy+=900*body.unit*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;p.vx*=Math.exp(-.25*dt);bound(p)}
  }
  function render(){
    context.clearRect(0,0,body.width,body.height);if(mode!=='exploded'||!texture)return;
    for(const p of particles){context.save();context.translate(p.x,p.y);context.rotate(p.angle);context.scale(p.scaleX,p.scaleY);context.beginPath();p.polygon.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));context.closePath();context.clip();context.drawImage(texture,-p.centre[0],-p.centre[1],194,198);context.restore()}
  }
  function click(){
    if(!settings().enabled||['preparing','priming','exploded'].includes(mode))return;
    clicks++;body.responseHeld=true;targetScale=1+(settings().expansion/100-1)*Math.min(clicks/settings().threshold,1);mode='charging';announce();
    if(paused()){setScale(targetScale)}
    if(clicks>=settings().threshold){mode='priming';age=0;if(paused())shatter()}
    paint();
  }
  element.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};eligible=e.isPrimary&&e.button===0});
  element.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)eligible=false});
  element.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)eligible=false});
  element.addEventListener('pointercancel',()=>{eligible=false;down=null});
  element.addEventListener('click',()=>{if(eligible)click();down=null});
  charge.addEventListener('click',click);
  document.querySelector('#reset-logo').addEventListener('click',()=>document.querySelector('#reset').click());
  let saved={};try{saved=JSON.parse(localStorage.getItem('flower-logo-studio-clicks-v1')||'{}')||{}}catch{}
  for(const[id,input]of Object.entries(controls)){
    if(input.type==='checkbox'){if(typeof saved[id]==='boolean')input.checked=saved[id]}
    else if(Number.isFinite(saved[id]))input.value=clamp(saved[id],+input.min,+input.max);
    input.addEventListener('input',()=>{if(!controls['click-enabled'].checked){reset();body.drop()}refresh()});
  }
  function refresh(){const record={};for(const[id,input]of Object.entries(controls)){record[id]=input.type==='checkbox'?input.checked:+input.value;const output=document.getElementById(id+'-value');if(output)output.textContent=input.value+(['explosion-force','expansion'].includes(id)?'%':'')}try{localStorage.setItem('flower-logo-studio-clicks-v1',JSON.stringify(record))}catch{}if(mode==='charging'){targetScale=1+(settings().expansion/100-1)*Math.min(clicks/settings().threshold,1);if(paused())setScale(targetScale);if(clicks>=settings().threshold){mode='priming';age=0;if(paused())shatter()}}charge.disabled=!settings().enabled||['exploded','preparing','priming'].includes(mode);if(!['exploded','preparing'].includes(mode))announce()}
  document.addEventListener('flower:colours',async()=>{if(mode!=='exploded')return;const token=version,palette=++paletteVersion;try{const img=await image();if(token===version&&palette===paletteVersion){texture=img;render()}}catch{}});
  refresh();resize();
  return{step,render,reset,resize,snapshot:()=>({mode,clicks,targetScale,scale:body.responseScale,count:particles.length,settings:settings(),finite:particles.every(p=>[p.x,p.y,p.vx,p.vy,p.angle].every(Number.isFinite))})};
}
