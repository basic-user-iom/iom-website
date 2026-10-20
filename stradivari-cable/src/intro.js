import * as THREE from 'three';

export function createIntroduction({host,canvas,controls,getCamera,render,prepare}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const panel=document.createElement('div');panel.className='cable-intro';panel.setAttribute('aria-label','Cable introduction');
 panel.innerHTML='<span class="intro-copy" role="status" aria-live="polite"></span><div class="intro-actions"><button type="button" data-intro="next" hidden>Next detail</button><button type="button" data-intro="skip" hidden>Skip</button><button type="button" data-intro="replay">Replay intro</button></div>';
 host.append(panel);
 const label=panel.querySelector('.intro-copy'),skip=panel.querySelector('[data-intro=skip]'),replay=panel.querySelector('[data-intro=replay]'),next=panel.querySelector('[data-intro=next]');
 let phase='idle',index=-1,frame=0,serial=0,last=0,elapsed=0,from,to,remaining=0,lastApplied=0,reason='ready',shots=[];
 const offset=new THREE.Vector3(192.5,224,370),identity=new THREE.Quaternion();
 const busy=()=>phase==='preparing'||phase==='moving'||phase==='holding'||phase==='static';
 const capture=()=>({target:controls.target.clone(),offset:getCamera().position.clone().sub(controls.target),zoom:getCamera().zoom});
 function pose(shot){
  const camera=getCamera(),target=new THREE.Vector3(...shot.target),radius=offset.length();
  const span=camera.isPerspectiveCamera?2*radius*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect:camera.right-camera.left;
  return {target,offset:offset.clone(),zoom:span/shot.width};
 }
 function apply(a,b,t){
  const camera=getCamera(),e=t*t*t*(t*(t*6-15)+10);
  const start=a.offset.clone().normalize(),end=b.offset.clone().normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(start,end);
  const direction=start.applyQuaternion(identity.clone().slerp(rotation,e));
  const distance=Math.exp(THREE.MathUtils.lerp(Math.log(Math.max(50,a.offset.length())),Math.log(b.offset.length()),e));
  controls.target.copy(a.target).lerp(b.target,e);camera.position.copy(controls.target).addScaledVector(direction,distance);
  camera.zoom=Math.exp(THREE.MathUtils.lerp(Math.log(a.zoom),Math.log(b.zoom),e));camera.updateProjectionMatrix();controls.update();render();
 }
 function ui(text){
  label.textContent=text;skip.hidden=!busy();replay.hidden=busy();next.hidden=phase!=='static';
  replay.textContent=reduced.matches?'View introduction':'Replay intro';
 }
 function stop(why='skipped'){
  serial++;if(frame)cancelAnimationFrame(frame);frame=0;phase='idle';reason=why;controls.enabled=true;
  ui(reduced.matches?'Explore freely · reduced motion':'Explore freely');
 }
 async function move(i){
  if(i>=shots.length){stop('completed');return;}
  const generation=serial;if(i>0){phase='preparing';ui('Loading the next detail.');await prepare(i);if(generation!==serial)return;}
  index=i;from=capture();to=pose(shots[i]);elapsed=0;last=performance.now();phase=reduced.matches?'static':'moving';ui(shots[i].title);
  if(reduced.matches){apply(from,to,1);return;}
  if(i+1<shots.length)void prepare(i+1);
  frame=requestAnimationFrame(tick);
 }
 function tick(now){
  frame=0;if(document.hidden||!busy())return;
  const dt=Math.min(80,Math.max(0,now-last));last=now;
  if(phase==='moving'){
   elapsed+=dt;const t=Math.min(1,elapsed/shots[index].travel);
   if(now-lastApplied>=1000/30||t===1){apply(from,to,t);lastApplied=now;}
   if(t===1){phase='holding';remaining=shots[index].hold;}
  }else if(phase==='holding'){
   remaining-=dt;if(remaining<=0){move(index+1);return;}
  }
  if(busy())frame=requestAnimationFrame(tick);
 }
 async function start(){
  stop('restarting');const generation=serial;phase='preparing';ui('Preparing introduction…');
  await prepare(0);if(generation!==serial)return;
  const mobile=host.clientWidth<700;
  shots=[
   {title:'The complete cable',target:[2.5,1,0],width:170,travel:1600,hold:900},
   {title:'STRADIVARI® · Copper jacket marking',target:[-10.5,0,0],width:mobile?19:27,travel:4000,hold:4500},
   {title:'Protective layers and shielding braids',target:[19,0,0],width:mobile?44:54,travel:3400,hold:2000},
   {title:'OCC copper · 30 strands per conductor',target:[65,0,0],width:mobile?16:20,travel:3400,hold:2700},
   {title:'The complete cable · Explore freely',target:[2.5,1,0],width:170,travel:4000,hold:0},
  ];
  controls.enabled=false;move(0);
 }
 function interrupt(){if(busy())stop('interaction');}
 canvas.addEventListener('pointerdown',interrupt,{capture:true});
 canvas.addEventListener('wheel',interrupt,{capture:true,passive:true});
 document.querySelector('aside').addEventListener('pointerdown',interrupt,{capture:true});
 document.querySelector('aside').addEventListener('click',interrupt,{capture:true});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&busy())stop('escape');});
 window.addEventListener('resize',()=>{if(busy())stop('resize');});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}
  else if(phase==='moving'||phase==='holding'){last=performance.now();frame=requestAnimationFrame(tick);}
 });
 reduced.addEventListener('change',()=>stop('motion-preference'));
 skip.onclick=()=>stop('skipped');replay.onclick=()=>{void start();};next.onclick=()=>move(index+1);
 ui(reduced.matches?'Explore freely · reduced motion':'Explore freely');
 return {start,stop,autoplay:()=>!reduced.matches,inspect:()=>({phase,index,title:shots[index]?.title,reason,active:busy(),reducedMotion:reduced.matches,controlsEnabled:controls.enabled,target:controls.target.toArray(),position:getCamera().position.toArray(),zoom:getCamera().zoom,plannedDurationMs:shots.reduce((n,s)=>n+s.travel+s.hold,0)})};
}
