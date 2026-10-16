import {mobileProfile} from './DeviceProfile';
import {defaults,type LinarWalls,type LinarSettings} from './LinarWalls';
import {deskDefaults,type ReceptionDesk} from './ReceptionDesk';
import type {LinarCamera,LinarTarget} from './LinarCamera';
import type {OrbitMode} from './controls/OrbitMode';import type {WalkMode} from './controls/WalkMode';
import {TourAudio} from './TourAudio';import {tourSteps} from './TourSteps';
type UI={selectApplication:(id:LinarTarget,open?:boolean,focus?:boolean)=>void;sync:()=>void;flush:()=>void;selected:()=>LinarTarget};
export type TourJourney={prepare:()=>Promise<void>;start:()=>void;update:(dt:number)=>boolean;restore:(manual:boolean)=>void;complete?:()=>void;inspect:()=>unknown};
type Options={linar:LinarWalls;desk:ReceptionDesk;ui:UI;camera:LinarCamera;orbit:OrbitMode;walking:WalkMode;changed:(final?:boolean)=>void;setReceptionLight:(value:boolean)=>void;journey?:TourJourney};
type Snapshot={states:LinarWalls['states'];desk:LinarSettings;light:boolean;receptionLight:boolean;selected:LinarTarget;panelHidden:boolean;camera:ReturnType<LinarCamera['capture']>};
type Tween={id:Exclude<LinarTarget,'desk'>;from:{bend:number;sCurve:number};to:{bend:number;sCurve:number};requested:{bend:number;sCurve:number};elapsed:number;duration:number;applied:number};
type Phase='idle'|'loading'|'entry'|'camera'|'settle'|'layout'|'shape'|'hold'|'completed'|'error';
export class ConfiguratorTour{
 readonly audio=new TourAudio(()=>this.sync());readonly startButton:HTMLButtonElement;readonly panel:HTMLElement;
 private pauseButton:HTMLButtonElement;private muteButton:HTMLButtonElement;private status:HTMLElement;private detail:HTMLElement;private previousButton:HTMLButtonElement;private nextButton:HTMLButtonElement;
 private layout?:{id:Exclude<LinarTarget,'desk'>;elapsed:number;duration:number;started:boolean;from:LinarSettings;to:LinarSettings};
 private snapshot?:Snapshot;private frame=0;private remaining=0;private tween?:Tween;private available=false;private index=0;private paused=false;private reason='not-started';private phase:Phase='idle';private last=0;private serial=0;private error='';
 constructor(private o:Options){
  const start=this.startButton=document.createElement('button');start.id='tour-start';start.className='traffic-control';start.textContent='Start tour';start.hidden=true;start.title='Explore the configurator with the Gallery of Light soundtrack. Finish on the final view, or end early to restore your settings.';document.querySelector('.dock-actions')!.prepend(start);
  const panel=this.panel=document.createElement('section');panel.id='tour-panel';panel.hidden=true;panel.setAttribute('aria-label','Configurator tour');panel.innerHTML='<div class="tour-copy"><strong id="tour-step" role="status" aria-live="polite"></strong><small id="tour-detail"></small></div><div class="tour-actions"><button id="tour-previous" aria-label="Previous tour step">Previous</button><button id="tour-next" aria-label="Next tour step">Next</button><button id="tour-pause">Pause</button><button id="tour-mute" aria-pressed="false" aria-label="Mute tour music">Mute</button><button id="tour-stop" title="Restore your settings">End tour</button><button id="tour-replay" hidden>Replay tour</button></div>';document.getElementById('viewer-dock')!.prepend(panel);
  this.pauseButton=panel.querySelector('#tour-pause')!;this.muteButton=panel.querySelector('#tour-mute')!;this.status=panel.querySelector('#tour-step')!;this.detail=panel.querySelector('#tour-detail')!;this.previousButton=panel.querySelector('#tour-previous')!;this.nextButton=panel.querySelector('#tour-next')!;
  start.onclick=()=>void this.start();(panel.querySelector('#tour-replay') as HTMLButtonElement).onclick=()=>void this.start();this.previousButton.onclick=()=>this.previous();this.nextButton.onclick=()=>this.advance();this.pauseButton.onclick=()=>this.paused?this.resume():this.pause();this.muteButton.onclick=()=>{if(this.audio.inspect().error)this.audio.play();else this.audio.toggleMute();this.sync();};(panel.querySelector('#tour-stop') as HTMLButtonElement).onclick=()=>this.stop('ended');
  for(const name of ['pointerdown','wheel','keydown','input','change','click'])document.addEventListener(name,e=>this.manual(e),{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});window.addEventListener('blur',()=>this.pause());
 }
 get active(){return !!this.snapshot;}
 setAvailable(value:boolean){this.available=value;if(!value&&this.active)this.stop('navigation');this.sync();}
 private sync(){
  document.getElementById('stage')!.dataset.touring=String(this.active);
  const completed=this.phase==='completed';this.startButton.hidden=!this.available||this.active||completed;this.panel.hidden=!this.active&&!completed;for(const id of ['tour-previous','tour-next','tour-pause','tour-mute','tour-stop'])(this.panel.querySelector('#'+id) as HTMLButtonElement).hidden=completed;(this.panel.querySelector('#tour-replay') as HTMLButtonElement).hidden=!completed;this.pauseButton.textContent=this.paused?'Resume':'Pause';this.muteButton.textContent=this.audio.inspect().error?'Retry music':this.audio.muted?'Unmute':'Mute';this.muteButton.setAttribute('aria-pressed',String(this.audio.muted));this.muteButton.setAttribute('aria-label',this.audio.inspect().error?'Retry tour music':this.audio.muted?'Unmute tour music':'Mute tour music');
  const travelling=this.phase==='loading'||this.phase==='entry';this.previousButton.disabled=travelling||this.index===0||this.phase==='error';this.nextButton.disabled=travelling||this.phase==='error';this.pauseButton.disabled=this.phase==='error';
  this.status.textContent=completed?'Tour complete':travelling?'Welcome · entering reception':'Step '+(this.index+1)+' of '+tourSteps.length+' · '+tourSteps[Math.min(this.index,tourSteps.length-1)].title;
  const labels:Record<Phase,string>={idle:'',loading:'Preparing the interior…',entry:'Travelling through the entrance',camera:'Moving to the next view',settle:this.tween?'Watch the shape change':'New configuration · take a closer look',layout:'Changing layout · '+Math.round(100*(this.layout?.elapsed??0)/(this.layout?.duration??1))+'%',shape:'Bending · '+Math.round(100*(this.tween?.elapsed??0)/(this.tween?.duration??1))+'%',hold:'Take a closer look · Next to continue',completed:'Explore this view or replay the tour.',error:this.error};
  this.detail.textContent=(this.paused?'Paused · ':'')+labels[this.phase]+(this.audio.inspect().error?' · Music unavailable':'');
 }
 async start(){
  if(this.active||!this.available)return;const {linar,desk,ui,camera,walking}=this.o;ui.flush();this.snapshot={states:structuredClone(linar.states),desk:{...desk.settings},light:linar.canopyLightEnabled,receptionLight:linar.receptionEnabled,selected:ui.selected(),panelHidden:document.getElementById('linar-panel')!.hidden,camera:camera.capture()};
  walking.stop();this.audio.start();this.paused=false;this.reason='running';this.error='';this.index=0;this.phase='loading';this.o.orbit.cancelTransition();this.o.orbit.setEnabled(false);this.sync();const generation=++this.serial;
  try{await this.o.journey?.prepare();if(!this.active||generation!==this.serial)return;
   linar.states=structuredClone(defaults);linar.rebuildAll();desk.settings={...deskDefaults};desk.rebuild();linar.setCanopyLight(true);this.o.setReceptionLight(true);camera.unlocked=false;camera.context('wall',true);this.o.journey?.start();
   this.phase=this.o.journey?'entry':'camera';if(!this.o.journey)this.enter();this.schedule();this.sync();
  }catch(error){if(!this.active||generation!==this.serial)return;this.error='The route could not be prepared. End tour and retry.';this.reason=String(error);this.phase='error';this.audio.pause();this.o.changed(true);this.sync();}
 }
 private rebuild(id:LinarTarget,final=false){if(id==='desk')this.o.desk.rebuild();else this.o.linar.rebuild(id);this.o.ui.sync();this.o.changed(final);}
 private settings(id:LinarTarget){return id==='desk'?this.o.desk.settings:this.o.linar.states[id];}
 private enter(override?:LinarSettings){
  if(!this.active)return;this.finishTween();if(this.index>=tourSteps.length){this.complete();return;}
  const step=tourSteps[this.index],s=this.settings(step.id),before={...s},prior={bend:s.bend,sCurve:s.sCurve};Object.assign(s,override??step.settings);const requested={bend:s.bend,sCurve:s.sCurve};
  if(step.id!=='desk'&&(prior.bend!==requested.bend||prior.sCurve!==requested.sCurve)&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   // Interpolate achievable geometry so room limits cannot hide most of the motion.
   const from={bend:this.o.linar.effectiveBend(step.id,{...s,...prior}),sCurve:prior.sCurve},to={bend:this.o.linar.effectiveBend(step.id,s),sCurve:requested.sCurve};
   const duration=Math.min(6500,3400+Math.abs(to.bend-from.bend)*24+Math.abs(to.sCurve-from.sCurve)*10+(from.bend*to.bend<0?700:0));
   this.tween={id:step.id,from,to,requested,elapsed:0,duration,applied:0};Object.assign(s,from);
  }
  if(step.id!=='desk'&&(before.panels!==s.panels||before.width!==s.width||before.height!==s.height)&&!matchMedia('(prefers-reduced-motion: reduce)').matches)this.layout={id:step.id,elapsed:0,duration:4200,started:false,from:before,to:{...s}};
  this.o.ui.selectApplication(step.id,true,false);if(!this.layout)this.rebuild(step.id,true);else{this.o.ui.sync();this.o.changed(true);}if(step.light!==undefined){this.o.linar.setCanopyLight(step.light);this.o.changed(true);}try{this.o.camera.choose(step.id,step.view,true);}catch(error){this.reason=String(error);this.error='This view has no clear camera route. End tour to restore your settings.';this.phase='error';this.audio.pause();this.o.camera.endTour();this.o.changed(true);this.sync();return;}this.phase='camera';this.remaining=0;this.sync();this.schedule();if(this.paused)this.o.camera.pauseTour();
 }
 private schedule(){if(this.frame||!this.active||this.paused||this.phase==='loading'||this.phase==='error')return;this.last=performance.now();this.frame=requestAnimationFrame(t=>this.tick(t));}
 private tick(now:number){
  this.frame=0;if(!this.active||this.paused)return;const dt=Math.min(80,Math.max(0,now-this.last));this.last=now;
  if(this.phase==='entry'){if(this.o.journey!.update(dt/1000))this.enter();}
  else if(this.phase==='camera'){this.o.camera.updateTour(dt/1000);if(!this.o.camera.tourMoving()){this.phase='settle';this.remaining=this.tween?700:950;}}
  else if(this.phase==='settle'){this.remaining-=dt;if(this.remaining<=0){if(this.layout){this.o.linar.beginLayout(this.layout.id);this.layout.started=true;this.phase='layout';this.o.changed(false);}else{this.phase=this.tween?'shape':'hold';this.remaining=tourSteps[this.index].duration??2800;}}}
  else if(this.phase==='layout'&&this.layout){const l=this.layout;l.elapsed=Math.min(l.duration,l.elapsed+dt);const f=l.elapsed/l.duration;this.o.linar.updateLayout(f*f*(3-2*f));this.o.changed(false);if(f===1){this.o.linar.finishLayout();this.layout=undefined;this.o.changed(true);this.phase='settle';this.remaining=700;}}
  else if(this.phase==='shape'&&this.tween){const t=this.tween;t.elapsed=Math.min(t.duration,t.elapsed+dt);if(t.elapsed-t.applied>=30||t.elapsed===t.duration){t.applied=t.elapsed;const f=t.elapsed/t.duration,ease=f*f*(3-2*f),s=this.settings(t.id);s.bend=t.from.bend+(t.to.bend-t.from.bend)*ease;s.sCurve=t.from.sCurve+(t.to.sCurve-t.from.sCurve)*ease;this.rebuild(t.id,false);if(f===1){Object.assign(s,t.requested);this.rebuild(t.id,true);this.tween=undefined;this.phase='hold';this.remaining=1800;}}}
  else if(this.phase==='hold'){this.remaining-=dt;if(this.remaining<=0)this.advance();}
  this.sync();if(this.active&&!this.paused&&!this.frame&&this.phase!=='error')this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 private finishTween(){if(this.layout){const l=this.layout;this.layout=undefined;if(l.started)this.o.linar.finishLayout();else this.rebuild(l.id,true);}if(this.tween){const t=this.tween;this.tween=undefined;Object.assign(this.settings(t.id),t.requested);this.rebuild(t.id,true);}}
 advance(){if(!this.active||['entry','loading','error'].includes(this.phase))return;this.index++;this.enter();}
 previous(){if(!this.active||!this.index||['entry','loading','error'].includes(this.phase))return;this.finishTween();this.index--;const states=structuredClone(defaults),desk={...deskDefaults};let light=true;for(const step of tourSteps.slice(0,this.index+1)){Object.assign(step.id==='desk'?desk:states[step.id],step.settings);if(step.light!==undefined)light=step.light;}const id=tourSteps[this.index].id;for(const key of ['wall','ceiling','freestanding'] as const)if(key!==id){this.o.linar.states[key]=states[key];this.o.linar.rebuild(key);}if(id!=='desk'){this.o.desk.settings=desk;this.o.desk.rebuild();}this.o.linar.setCanopyLight(light);this.enter(id==='desk'?desk:states[id]);}
 pause(){if(!this.active||this.paused)return;this.paused=true;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.o.camera.pauseTour();this.audio.pause();this.o.changed(true);this.sync();}
 resume(){if(!this.active||!this.paused)return;this.paused=false;this.audio.play();this.o.camera.resumeTour();this.schedule();this.sync();}
 private complete(){
  if(!this.snapshot)return;
  this.snapshot=undefined;this.serial++;this.reason='completed';this.phase='completed';this.index=tourSteps.length-1;this.remaining=0;this.paused=false;
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.tween=undefined;this.layout=undefined;
  this.audio.pause();this.o.camera.endTour();this.o.orbit.cancelTransition();
  if(mobileProfile){document.getElementById('linar-panel')!.hidden=true;document.getElementById('linar-toggle')!.setAttribute('aria-expanded','false');}
  // Release route ownership without restoring the entry snapshot or rebuilding
  // the final scene. Unlocking controls leaves position, target and FOV intact.
  this.o.journey?.complete?.();this.o.camera.setUnlocked(true);this.o.ui.sync();this.o.changed(true);this.sync();
 }
 stop(reason='ended',manual=false,keepPanel=false){
  if(!this.snapshot)return;const saved=this.snapshot,current=this.o.ui.selected();this.snapshot=undefined;this.serial++;this.reason=reason;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.tween=undefined;this.layout=undefined;this.o.linar.finishLayout();this.audio.pause();this.o.camera.endTour();this.o.orbit.cancelTransition();this.o.journey?.restore(manual);
  this.o.linar.states=structuredClone(saved.states);this.o.linar.rebuildAll();this.o.desk.settings={...saved.desk};this.o.desk.rebuild();this.o.linar.setCanopyLight(saved.light);this.o.setReceptionLight(saved.receptionLight);
  const panel=document.getElementById('linar-panel')!;panel.hidden=keepPanel?false:saved.panelHidden;document.getElementById('linar-toggle')!.setAttribute('aria-expanded',String(!panel.hidden));this.o.ui.selectApplication(manual&&keepPanel?current:saved.selected,false,false);this.o.camera.restore(saved.camera,!manual);if(manual&&keepPanel)this.o.camera.context(current,true);this.o.ui.sync();this.o.changed(true);this.paused=false;this.phase='idle';this.sync();
 }
 private manual(event:Event){const target=event.target;if(!this.active){if(this.phase==='completed'&&event.type==='click'&&target instanceof Element&&target.closest('#reset,.views')){this.phase='idle';this.sync();}return;}if(!(target instanceof Element)||this.panel.contains(target)||this.startButton.contains(target))return;if(event instanceof KeyboardEvent&&!['Escape','Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','W','A','S','D','r','+','-','='].includes(event.key))return;
  if(!target.closest('#linar-panel,#linar-toggle,#walk-toggle,#canvas,.views,.tools,.environment'))return;const field=target instanceof HTMLInputElement||target instanceof HTMLSelectElement?target:undefined,value=field?.value,checked=field instanceof HTMLInputElement?field.checked:undefined,keepPanel=!!target.closest('#linar-panel'),unlock=!!target.closest('#linar-camera-unlock'),wasUnlocked=this.o.camera.unlocked;this.stop('manual-takeover',true,keepPanel);
  if(unlock){this.o.camera.unlocked=wasUnlocked;this.o.camera.context(this.o.ui.selected(),true);this.o.ui.sync();}if((event.type==='input'||event.type==='change')&&field)field.value=value!;if(field instanceof HTMLInputElement&&field.type==='checkbox'&&checked!==undefined)field.checked=checked;if(target.id==='canvas'){this.o.camera.setUnlocked(true);this.o.ui.sync();}
 }
 inspect(){return{active:this.active,paused:this.paused,index:this.index,steps:tourSteps.length,title:tourSteps[Math.min(this.index,tourSteps.length-1)].title,reason:this.reason,phase:this.phase,remainingMs:this.active?Math.max(0,this.remaining):0,tween:!!this.tween,transition:this.tween?{...this.tween}:null,layout:this.layout?{...this.layout,geometry:this.o.linar.inspectLayout()}:null,journey:this.o.journey?.inspect(),audio:this.audio.inspect()};}
}
