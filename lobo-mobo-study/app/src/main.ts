import { createLoading } from './loading';
import { createTour } from './tour';
import { createIntro } from './intro';
import { createGuidance } from './guidance';
import { ENABLE_ROOM_INSPECTION } from './features';
import type { InspectionAction } from './room-inspection';
import { Color, LinearSRGBColorSpace } from 'three';
import { finishes, validateFinishes, type ExportedFinish, type FinishId, type StudyState } from './materials';
import type { StudyViewer, CameraAction, ViewMode } from './viewer';

const element = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const stage = element('stage'), host = element('canvas-host'), status = element('status');
const poster = element<HTMLImageElement>('poster'), unavailable = element('poster-unavailable');
const retry = element<HTMLButtonElement>('retry');
const mode = element('stage-mode');
const loading=createLoading(),controls=document.querySelector<HTMLElement>('.controls')!;
const viewToggle=element<HTMLButtonElement>('view-toggle');
let viewMode:ViewMode='room';
let exploring=false;let dofEnabled=true;
const dofToggle=element<HTMLButtonElement>('dof-toggle');
dofToggle.addEventListener('click',()=>{dofEnabled=!dofEnabled;viewer?.setDepthOfField(dofEnabled);updateDofControls();});
function updateDofControls(){dofToggle.hidden=viewMode!=='room';dofToggle.disabled=phase!=='ready'||viewer?.snapshot().depthOfField.supported===false;dofToggle.setAttribute('aria-pressed',String(dofEnabled));element('dof-state').textContent=viewer?.snapshot().depthOfField.supported===false?'Unavailable':exploring?'Off in Free fly':dofEnabled?'On':'Off';}

const exploreButton=element<HTMLButtonElement>('explore-room');
const state:StudyState = {finish:'shell-white',lit:false};
const lighting={progress:0,brightness:.7,lampLevel:1,playing:false};
const cabinet={enabled:true,brightness:.45};
const cabinetToggle=element<HTMLButtonElement>('cabinet-toggle'),cabinetSlider=element<HTMLInputElement>('cabinet-brightness');
let transitionFrame=0,transitionLast=0,transitionTarget=1;
let transitionStart=0,transitionLampStart=0;
const timeSlider=element<HTMLInputElement>('time-slider'),brightnessSlider=element<HTMLInputElement>('brightness-slider'),playButton=element<HTMLButtonElement>('play-transition');
let viewer:StudyViewer|undefined;
let materialData:ExportedFinish[] = [];
let phase:'loading'|'ready'|'fallback' = 'loading';
let failure = '';
let generation = 0;
let posterGeneration = 0;
let timer:ReturnType<typeof setTimeout>;
const cameraButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-camera]')];
function updateView(preserveCamera=false) {
  updateDofControls();
  stage.dataset.view=viewMode;
  stage.dataset.exploring=String(exploring&&viewMode==='room');
  exploreButton.hidden=!ENABLE_ROOM_INSPECTION||viewMode!=='room';exploreButton.disabled=phase!=='ready';
  exploreButton.textContent=exploring?'Exit free fly':'Free fly';exploreButton.setAttribute('aria-pressed',String(exploring));
  element('explore-pad').hidden=!ENABLE_ROOM_INSPECTION||viewMode!=='room'||!exploring;
  element('explore-help').hidden=!ENABLE_ROOM_INSPECTION||viewMode!=='room'||!exploring;
  element('explore-help').textContent='Click the view, then WASD / arrows to fly. Q down, E up; Shift moves faster. Drag to look; two fingers move and pinch zoom. Home resets; Esc exits. No collision limits.';
  viewToggle.textContent=viewMode==='room'?'View lamp':'Back to room';
  viewToggle.setAttribute('aria-label',viewToggle.textContent);
  cameraButtons.forEach(b=>{b.disabled=phase!=='ready';b.hidden=viewMode==='room'&&b.dataset.camera!=='reset';});
  element('view-help').textContent=viewMode==='room'?(exploring?'Free fly through the partial scene. Reset view returns to the original camera.':'Fixed room view. Switch to the lamp to rotate and zoom.'):'Drag to rotate · pinch or scroll to zoom. Arrow keys rotate; + / − zoom.';
  if(phase==='ready')mode.textContent=viewMode==='room'?(exploring?'FREE FLY':'IN THE ROOM'):'INTERACTIVE STUDY';
  viewer?.setMode(viewMode);viewer?.setInspection(exploring,preserveCamera);
  document.querySelector<HTMLButtonElement>('[data-camera=reset]')!.textContent=exploring&&viewMode==='room'?'Reset view':'Reset';
  element('daynight-controls').hidden=viewMode!=='room';
  element('cabinet-controls').hidden=viewMode!=='room';
  refreshGuidance();
}

function updatePoster() {
  if(phase==='ready'&&state.finish.startsWith('reference-')){poster.hidden=true;unavailable.hidden=true;return;}
  const sequence = ++posterGeneration;
  const label = finishes.find(f=>f.id===state.finish)!.label;
  const src = `./posters/${state.finish}-${state.lit?'lit':'unlit'}.webp`;
  // Hide the old state immediately; do not label a previous image as the new finish.
  poster.hidden = true; unavailable.hidden = true;
  const next = new Image();
  next.onload = () => { if (sequence !== posterGeneration) return; poster.src=src; poster.alt=`${label} — Light ${state.lit?'on':'off'}. Rendered concept poster.`; poster.hidden=phase==='ready'; };
  next.onerror = () => { if(sequence !== posterGeneration) return; poster.hidden=true; unavailable.hidden=phase==='ready'; unavailable.textContent=`Rendered preview unavailable for ${label} / Light ${state.lit?'on':'off'}.`; if(phase!=='ready') status.textContent=`${failure || 'Loading interactive view.'} Matching poster unavailable.`; };
  next.src = src;
}
function update() {
  updateCabinetControls();
  if(phase==='ready')viewer?.setCabinetLight(cabinet.enabled,cabinet.brightness);
  document.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.finish===state.finish)));
  document.querySelectorAll<HTMLButtonElement>('[data-light]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.light==='lit')===state.lit)));
  updatePoster();
  if(phase==='ready') {viewer?.apply(state,materialData);viewer?.setLighting(lighting.progress,lighting.brightness,lighting.lampLevel); status.textContent=`${finishes.find(f=>f.id===state.finish)!.label} · Light ${state.lit?'on':'off'}`;}
}
function fallback(message:string) {
  pauseTransition();tour.setReady(false);
  generation++; clearTimeout(timer); phase='fallback'; failure=message;intro.setPhase(phase);loading.fail();controls.inert=false;
  viewer?.dispose(); viewer=undefined; host.hidden=true;
  stage.setAttribute('aria-busy','false'); retry.hidden=false;
  cameraButtons.forEach(b=>b.disabled=true); mode.textContent='RENDERED PREVIEW';
  viewToggle.disabled=true;exploreButton.disabled=true;element('explore-pad').hidden=true;
  status.textContent=message; updatePoster();
}
async function start() {
  const current = ++generation;
  phase='loading'; intro.setPhase(phase);loading.start();controls.inert=true;tour.setReady(false);failure=''; retry.hidden=true; host.hidden=true; stage.setAttribute('aria-busy','true');
  viewToggle.disabled=true;updateView();
  status.textContent='Loading interactive view…'; updatePoster();
  timer=setTimeout(()=>fallback('3D loading timed out. Showing the matching rendered poster.'),15000);
  try {
    const [module,response] = await Promise.all([import('./viewer'),fetch('./assets/finish-materials.json',{signal:AbortSignal.timeout(15000)})]);
    if(!response.ok) throw new Error('Material data unavailable.');
    const data = validateFinishes(await response.json());
    if(current!==generation) return;
    materialData=data;
    data.forEach(f=>{
      const p=f.actualExportedMaterial.pbrMetallicRoughness.baseColorFactor;
      const color=new Color().setRGB(p[0],p[1],p[2],LinearSRGBColorSpace);
      document.querySelector<HTMLElement>(`[data-finish="${f.id}"] .swatch`)!.style.background=color.getStyle();
    });
    viewer = new module.StudyViewer(host,fallback);
    await viewer.load(data);
    if(current!==generation) return;
    // Give the renderer its final dimensions and state while the loading image covers it.
    host.hidden=false;host.style.visibility='hidden';
    viewer.setMode(viewMode);viewer.setInspection(exploring);viewer.setDepthOfField(dofEnabled);
    viewer.apply(state,materialData);viewer.setLighting(lighting.progress,lighting.brightness,lighting.lampLevel);viewer.setCabinetLight(cabinet.enabled,cabinet.brightness);
    await viewer.prepareFirstFrame();
    if(current!==generation)return;
    clearTimeout(timer);phase='ready';host.style.visibility='';poster.hidden=true;unavailable.hidden=true;controls.inert=false;
    stage.setAttribute('aria-busy','false'); mode.textContent='INTERACTIVE STUDY';
    viewToggle.disabled=false;updateView();update();tour.setReady(true);intro.setPhase(phase);loading.reveal();
  } catch(error) {
    if(current!==generation) return;
    console.warn('MOBO viewer unavailable:',error);
    fallback('3D view unavailable. Showing the matching rendered poster.');
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach(b=>b.addEventListener('click',()=>{state.finish=b.dataset.finish as FinishId;update();}));
document.querySelectorAll<HTMLButtonElement>('[data-light]').forEach(b=>b.addEventListener('click',()=>{pauseTransition();state.lit=b.dataset.light==='lit';lighting.lampLevel=state.lit?1:0;update();updateLightingControls();}));
cameraButtons.forEach(b=>b.addEventListener('click',()=>viewer?.move(b.dataset.camera as CameraAction)));
retry.addEventListener('click',start);
function updateCabinetControls(){
  cabinetToggle.setAttribute('aria-pressed',String(cabinet.enabled));
  element('cabinet-state').textContent=cabinet.enabled?'On':'Off';
  element('cabinet-value').textContent=`${Math.round(cabinet.brightness*100)}%`;
  cabinetSlider.value=String(cabinet.brightness*100);
}
cabinetToggle.addEventListener('click',()=>{cabinet.enabled=!cabinet.enabled;updateCabinetControls();viewer?.setCabinetLight(cabinet.enabled,cabinet.brightness);});
cabinetSlider.addEventListener('input',()=>{cabinet.brightness=Number(cabinetSlider.value)/100;updateCabinetControls();viewer?.setCabinetLight(cabinet.enabled,cabinet.brightness);});
exploreButton.addEventListener('click',()=>{if(phase!=='ready')return;exploring=!exploring;updateView();update();});
host.addEventListener('room-inspection-exit',()=>{exploring=false;updateView();update();});
document.querySelectorAll<HTMLButtonElement>('[data-explore]').forEach(b=>b.addEventListener('click',()=>viewer?.inspectMove(b.dataset.explore as InspectionAction)));
viewToggle.addEventListener('click',()=>{if(phase!=='ready')return;viewMode=viewMode==='room'?'lamp':'room';updateView();update();});
window.addEventListener('pagehide',()=>{pauseTransition();tour.dispose();intro.dispose();guidance.dispose();loading.dispose();clearTimeout(timer);viewer?.dispose();});

function updateLightingControls() {
  document.querySelectorAll<HTMLButtonElement>('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.light==='lit')===state.lit)));
  timeSlider.value=String(lighting.progress*100);
  timeSlider.setAttribute('aria-valuetext',lighting.progress===0?'Day':lighting.progress===1?'Night':`${Math.round(lighting.progress*100)}% towards night`);
  element('time-value').textContent=lighting.progress===0?'Day':lighting.progress===1?'Night':`${Math.round(lighting.progress*100)}% night`;
  element('brightness-value').textContent=`${Math.round(lighting.brightness*100)}%`;
  playButton.textContent=lighting.playing?'Pause':'Play';
  playButton.setAttribute('aria-label',lighting.playing?'Pause day to night transition':'Play day to night transition');
  playButton.setAttribute('aria-pressed',String(lighting.playing));
  document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b=>b.setAttribute('aria-pressed',String(lighting.progress===Number(b.dataset.time))));
}
function pauseTransition() {
  cancelAnimationFrame(transitionFrame);transitionFrame=0;transitionLast=0;lighting.playing=false;updateLightingControls();
}
function setTime(value:number,level?:number) {
  const wasLit=state.lit;
  lighting.progress=Math.max(0,Math.min(1,value));
  const t=Math.max(0,Math.min(1,(lighting.progress-.05)/.9));
  lighting.lampLevel=level??t*t*(3-2*t);state.lit=lighting.lampLevel>0;
  // Keep frame updates lightweight: no poster loads or live-region announcements per frame.
  if(phase==='ready'){if(wasLit!==state.lit)viewer?.apply(state,materialData);viewer?.setLighting(lighting.progress,lighting.brightness,lighting.lampLevel);}
  updateLightingControls();
}
function transitionStep(now:number) {
  if(!lighting.playing)return;
  if(document.hidden){transitionLast=0;transitionFrame=requestAnimationFrame(transitionStep);return;}
  const dt=transitionLast?(now-transitionLast)/1000:0;transitionLast=now;
  const direction=transitionTarget>lighting.progress?1:-1;
  const next=lighting.progress+direction*dt/24;
  const value=direction>0?Math.min(next,transitionTarget):Math.max(next,transitionTarget);
  const q=Math.abs((value-transitionStart)/(transitionTarget-transitionStart));
  const eased=q*q*(3-2*q);
  setTime(value,transitionLampStart+(transitionTarget-transitionLampStart)*eased);
  if(lighting.progress===transitionTarget){pauseTransition();update();return;}
  transitionFrame=requestAnimationFrame(transitionStep);
}
function playTransition(target:number) {
  pauseTransition();transitionTarget=target;if(lighting.progress===target)return;
  transitionStart=lighting.progress;transitionLampStart=state.lit?lighting.lampLevel:0;
  lighting.playing=true;updateLightingControls();transitionFrame=requestAnimationFrame(transitionStep);
}
timeSlider.addEventListener('input',()=>{const value=Number(timeSlider.value)/100;pauseTransition();setTime(value);update();});
brightnessSlider.addEventListener('input',()=>{lighting.brightness=Number(brightnessSlider.value)/100;updateLightingControls();update();});
playButton.addEventListener('click',()=>{if(lighting.playing){pauseTransition();update();}else playTransition(lighting.progress>=1?0:lighting.progress<=0?1:transitionTarget);});
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b=>b.addEventListener('click',()=>playTransition(Number(b.dataset.time))));
updateLightingControls();
document.addEventListener('visibilitychange',()=>{transitionLast=0;});

const tour=createTour({
 ready:()=>phase==='ready',
 capture:()=>{const saved={dofEnabled,state:{...state},lighting:{...lighting},cabinet:{...cabinet},viewMode,exploring,cameras:viewer?.captureCameras()};pauseTransition();return saved;},
 restore:s=>{dofEnabled=s.dofEnabled;viewer?.setDepthOfField(dofEnabled);Object.assign(state,s.state);Object.assign(lighting,s.lighting,{playing:false});Object.assign(cabinet,s.cabinet);viewMode=s.viewMode;exploring=s.exploring;updateView();update();brightnessSlider.value=String(lighting.brightness*100);updateLightingControls();if(s.cameras)viewer?.restoreCameras(s.cameras);},
 apply:(s,entry)=>{if(entry)pauseTransition();state.finish=s.finish;state.lit=s.lit;lighting.progress=s.time;lighting.brightness=s.brightness;lighting.lampLevel=s.lampLevel??(s.lit?1:0);cabinet.enabled=s.led;cabinet.brightness=s.ledBrightness;viewMode='room';exploring=false;
  if(entry){updateView(true);update();}else{viewer?.setLighting(lighting.progress,lighting.brightness,lighting.lampLevel);viewer?.setCabinetLight(cabinet.enabled,cabinet.brightness);}brightnessSlider.value=String(lighting.brightness*100);updateLightingControls();updateCabinetControls();},
 camera:frame=>viewer?.tourCamera(frame),
 releaseCamera:()=>{viewer?.stopTourCamera();refreshGuidance();}
});
function refreshGuidance(){guidance.setView(viewMode,phase==='ready'&&intro.snapshot().dismissed&&!tour.snapshot().active);}
const guidance=createGuidance(stage,viewToggle);
const intro=createIntro({
 stage,onDismiss:()=>refreshGuidance(),
 automatic:()=>{element<HTMLButtonElement>('tour-start').click();element<HTMLButtonElement>('tour-pause').focus({preventScroll:true});},
 explore:()=>{pauseTransition();viewMode='room';exploring=ENABLE_ROOM_INSPECTION;updateView(true);update();host.querySelector<HTMLCanvasElement>('canvas')?.focus({preventScroll:true});}
});
// Read-only local QA observability; omitted from the production bundle.
if(import.meta.env.DEV) Object.defineProperty(window,'__moboStudy',{value:()=>({loading:loading.snapshot(),intro:intro.snapshot(),guidance:guidance.snapshot(),dofEnabled,tour:tour.snapshot(),cabinet:{...cabinet},state:{...state},viewMode,exploring,phase,lighting:{...lighting},viewer:viewer?.snapshot()})});
void start();

