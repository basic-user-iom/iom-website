import {createStemPlayer} from './gallery-audio.js';
import type {FinishId} from './materials';
import type {TourCameraFrame,TourShot} from './tour-camera';
export type TourSettings={finish:FinishId;view:'room'|'lamp';time:number;lit:boolean;brightness:number;led:boolean;ledBrightness:number;lampLevel?:number};
type Step={title:string;text:string;seconds:number;settings:TourSettings;end?:Partial<TourSettings>;shot?:TourShot};
const room:TourSettings={finish:'reference-white',view:'room',time:0,lit:false,brightness:.7,led:true,ledBrightness:.45};
const variants:[FinishId,string,string][]=[['shell-white','02. Shell White','The original warm white glaze.'],['burnt-orange','07. Burnt Orange','The original warm orange glaze.'],['midnight-green','09. Midnight Green','The original deep green glaze.'],['reference-white','White · photo reference','Satin white ceramic, pale textile and chrome.'],['reference-black','Black · photo reference','Glossy black ceramic, taupe textile and black metal.'],['reference-olive','Olive · photo reference','Glossy olive ceramic with a brass fitting.'],['reference-terracotta','Terracotta · photo reference','A softer terracotta finish with a brass fitting.']];
export const tourSteps:Step[]=[{title:'MOBO in the room',text:'A handmade form, seen in warm daylight.',seconds:6,settings:room},...variants.map(([finish,title,text],index)=>({title,text,seconds:index===0?9:5,settings:{...room,finish,view:'lamp' as const}})),{shot:'table',title:'Light, at your level',text:'Switch on the pendant and adjust its warm glow.',seconds:7,settings:{...room,finish:'reference-terracotta',view:'lamp',lit:true,brightness:.2},end:{brightness:.85}},{title:'From day into night',text:'Daylight fades as a quiet moonlight enters through the window.',seconds:12,settings:{...room,led:false},end:{time:1}},{title:'Moonlight alone',text:'A cool exterior light reveals the window and furniture shadows.',seconds:7,settings:{...room,time:1,led:false}},{title:'Warm pendant light',text:'The pendant lights remain the focus after dark.',seconds:7,settings:{...room,time:1,led:false,lit:true,brightness:.25},end:{brightness:.8}},{title:'Under-cabinet light',text:'An independent warm wash, gently dimmed along the worktop.',seconds:7,settings:{...room,time:1,lit:true,brightness:.8,led:true,ledBrightness:.15},end:{ledBrightness:.65}},{title:'Your own combination',text:'Warm pendants and under-cabinet light, balanced with moonlight.',seconds:6,settings:{...room,time:1,lit:true,brightness:.8,ledBrightness:.65}}];
export function createTour<T>(api:{ready:()=>boolean;capture:()=>T;restore:(saved:T)=>void;apply:(settings:TourSettings,entry:boolean)=>void;camera:(frame:TourCameraFrame)=>void;releaseCamera:()=>void}){
 const root=document.getElementById('tour')!,get=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
 const start=get<HTMLButtonElement>('tour-start'),toggle=get<HTMLButtonElement>('tour-pause'),previous=get<HTMLButtonElement>('tour-prev'),next=get<HTMLButtonElement>('tour-next'),exit=get<HTMLButtonElement>('tour-exit'),mute=get<HTMLButtonElement>('tour-mute'),volume=get<HTMLInputElement>('tour-volume');
 const musicToggle=document.createElement('button');musicToggle.id='tour-music-pause';musicToggle.hidden=true;get('tour-audio').prepend(musicToggle);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let active=false,playing=false,completed=false,returning=false,index=0,elapsed=0,motionTime=0,last=0,frame=0,settleRemaining=0,needsRebase=true,saved:T|undefined;
 const returnSeconds=6;
 function musicUi(state:{status:string}){musicToggle.textContent=state.status==='playing'?'Pause music':'Resume music';musicToggle.setAttribute('aria-pressed',String(state.status!=='playing'));}
 const music=createStemPlayer({stems:['bass','guitar','keyboard','strings','synth','brass'].map(id=>({id,label:id,url:`./audio/${id}.m4a`})),duration:213.624,headroom:.707,volume:.18,onChange:s=>{get('tour-audio-status').textContent=s.error?'Music unavailable. Resume to retry.':s.status==='loading'?'Loading music.':s.muted?'Music muted':s.status==='playing'?'Gallery of Light — music playing':'Music starts with the tour';musicUi(s);}});music.setLoop(false);
 function ui(){
  start.hidden=active;get('tour-controls').hidden=!active;get('tour-audio').hidden=!active&&!completed;get('tour-copy').hidden=!active&&!completed;musicToggle.hidden=!completed;
  toggle.textContent=playing?'Pause':'Resume';toggle.setAttribute('aria-pressed',String(!playing));previous.disabled=index===0;next.disabled=index===tourSteps.length-1;
  root.dataset.state=active?(playing?'playing':'paused'):completed?'completed':'idle';
  if(completed){get('tour-step').textContent='TOUR COMPLETE';get('tour-title').textContent='Back in daylight';get('tour-description').textContent='Explore your own combination. The music is yours to keep playing.';}
  else if(active){get('tour-step').textContent=`${index+1} / ${tourSteps.length}`;get('tour-title').textContent=returning?'Returning to daylight':tourSteps[index].title;get('tour-description').textContent=returning?'A gentle return to the room, ready for you to explore.':tourSteps[index].text;}
  mute.textContent=music.state.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(music.state.muted));get('tour-volume-value').textContent=`${Math.round(music.state.volume*100)}%`;musicUi(music.state);
 }
 function render(entry=false,delta=0){
  const step=tourSteps[index],t=Math.min(1,elapsed/(returning?returnSeconds:step.seconds)),q=t*t*(3-2*t);
  const settings={...step.settings};
  if(returning){settings.time=1-q;settings.brightness=.8+(.7-.8)*q;settings.lit=t<1;settings.lampLevel=1-q;settings.ledBrightness=.65+(.45-.65)*q;}
  else for(const key of ['time','brightness','ledBrightness'] as const)if(step.end?.[key]!==undefined)settings[key]=step.settings[key]+(step.end[key]!-step.settings[key])*q;
  api.apply(settings,entry||(returning&&t===1));
  const shot:TourShot=returning?'room':step.shot??(step.settings.view==='lamp'?'lamp':'room');
  api.camera({shot,amount:Math.sin(motionTime*.12)*.75*(returning?1-q:1),lift:Math.cos(motionTime*.12)*.75*(returning?1-q:1),delta,rebase:needsRebase,immediate:reduced.matches});needsRebase=false;
 }
 function finish(){
  active=false;playing=false;completed=true;returning=false;settleRemaining=0;last=0;saved=undefined;api.releaseCamera();ui();
  // Automatic completion leaves the daylight scene and the user's music running.
 }
 function tick(now:number){
  if(!active||(!playing&&settleRemaining<=0))return;
  const delta=last?Math.min((now-last)/1000,.15):0;last=now;let entry=false;
  if(playing){elapsed+=delta;motionTime+=delta;
   if(!returning&&elapsed>=tourSteps[index].seconds){elapsed-=tourSteps[index].seconds;if(index===tourSteps.length-1){returning=true;}else index++;entry=true;ui();}
  }else settleRemaining=Math.max(0,settleRemaining-delta);
  render(entry,delta);
  if(returning&&elapsed>=returnSeconds){finish();return;}
  if(playing||settleRemaining>0)frame=requestAnimationFrame(tick);else last=0;
 }
 function schedule(){cancelAnimationFrame(frame);last=0;frame=requestAnimationFrame(tick);}
 function pause(manual=false){if(!active)return;playing=false;settleRemaining=0;cancelAnimationFrame(frame);last=0;if(manual)needsRebase=true;music.pause('tour-pause');ui();}
 function resume(){if(!active)return;playing=true;settleRemaining=0;render(true);void music.play();ui();schedule();}
 function begin(){if(active||!api.ready())return;saved=api.capture();active=true;completed=false;returning=false;index=0;elapsed=0;motionTime=0;needsRebase=true;render(true);playing=!reduced.matches;void music.seek(0);void music.play();ui();if(playing)schedule();else get('tour-description').textContent+=' Reduced motion: use Next, or Resume for timed steps.';}
 function stop(){if(!active)return;playing=false;active=false;completed=false;returning=false;settleRemaining=0;cancelAnimationFrame(frame);last=0;music.pause('tour-exit');api.releaseCamera();if(saved!==undefined)api.restore(saved);saved=undefined;ui();start.focus({preventScroll:true});}
 function move(delta:number){if(!active)return;returning=false;index=Math.max(0,Math.min(tourSteps.length-1,index+delta));elapsed=0;render(true);ui();if(!playing&&!reduced.matches)settleRemaining=10;if(playing||settleRemaining>0)schedule();}
 start.addEventListener('click',begin);toggle.addEventListener('click',()=>playing?pause():resume());previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));exit.addEventListener('click',stop);mute.addEventListener('click',()=>{music.setMuted(!music.state.muted);ui();});volume.addEventListener('input',()=>{music.setVolume(Number(volume.value)/100);ui();});musicToggle.addEventListener('click',()=>{if(music.state.status==='playing')music.pause('user');else void music.play();ui();});
 const manual=(e:Event)=>{if(!active||root.contains(e.target as Node))return;const target=e.target as HTMLElement;if(target.closest('.controls')||target.closest('#canvas-host')||target.closest('#explore-pad'))pause(true);};
 const keyboard=(e:KeyboardEvent)=>{if(e.key==='Escape'&&active){e.preventDefault();stop();}};
 const visibility=()=>{if(document.hidden){pause();if(completed)music.pause('hidden');}};
 for(const name of ['pointerdown','input','click','keydown','wheel'])document.addEventListener(name,manual,true);
 document.addEventListener('keydown',keyboard);document.addEventListener('visibilitychange',visibility);
 ui();return{setReady:(ready:boolean)=>{start.disabled=!ready;if(!ready&&active)stop();},snapshot:()=>({active,playing,completed,returning,index,elapsed,motionTime,steps:tourSteps.length,reducedMotion:reduced.matches,music:{...music.state},audio:music.getDiagnostics()}),dispose:()=>{cancelAnimationFrame(frame);music.dispose();for(const name of ['pointerdown','input','click','keydown','wheel'])document.removeEventListener(name,manual,true);document.removeEventListener('keydown',keyboard);document.removeEventListener('visibilitychange',visibility);}};
}
