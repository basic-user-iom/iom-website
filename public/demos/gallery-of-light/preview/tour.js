import { Color } from 'three';
import { createGalleryNavigation } from './gallery-navigation.js';
import { createGalleryEntryFlight } from './gallery-entry-flight.js';

const WARM_METAL = {color:'#b47743',roughness:.2,metalness:.9,clearcoat:.45,clearcoatRoughness:.2,normalStrength:1,envMapIntensity:1};
const MATTE_BLUE = {color:'#416780',roughness:.82,metalness:.05,clearcoat:.05,clearcoatRoughness:.65,normalStrength:1,envMapIntensity:1};
const STOPS = [
  {id:'welcome',camera:'overview',duration:10,title:'Welcome to the gallery',before:'The lighting, soft shadows, and floor reflections gently fade to a clear comparison.',after:'HDR lighting, soft shadows, and floor reflections gradually return together.'},
  {id:'refraction',camera:'A',effect:'refraction',duration:16,title:'A · Refraction',before:'First, the original marble relief.',after:'The HDR panorama gradually refracts through the surface.',settings:{ratio:.92}},
  {id:'wireframe',camera:'B001',effect:'wireframe',duration:14,title:'B1 · Wireframe',before:'The sculpture with its original material.',after:'Blue lines gradually reveal the triangles that form the sculpture.',settings:{color:'#247ce5'}},
  {id:'subsurface',camera:'B002',effect:'subsurface',duration:16,title:'B2 · Subsurface scattering',before:'First, the original marble relief.',after:'The relief gradually turns to translucent amber, with warm light scattering through its surface.',settings:{amount:1.5,thickness:.45,distortion:.45,power:2,color:'#ffae70',lightIntensity:1.8,translucency:.9}},
  {id:'deformation',camera:'C001',effect:'deform',duration:17,title:'C1 · Deformation',before:'The original relief, before the twist.',after:'An animated twist gradually changes its shape. The original model is preserved.',settings:{amount:1.1,speed:.7}},
  {id:'fog',camera:'floor-fog',effect:'fog',duration:16,title:'Gallery · Floor mist',before:'A clear view across the gallery floor before the mist arrives.',after:'Low drifting mist gradually spreads across the gallery floor, around the sculptures and their pedestals.',settings:{density:1.15,height:.65,speed:.15,color:'#dce8ed'}},
  {id:'spotlight',camera:'D',effect:'spotlight',duration:16,title:'D · Spotlight',before:'The sculpture in the gallery lighting.',after:'A focused light gradually adds a projected pattern and soft shadow.',settings:{intensity:130,color:'#fff1da',angle:.48,projected:true}},
  {id:'material',camera:'E',effect:'material',duration:24,title:'E · Material lab',before:'The original carved sculpture. Watch its surface change while the form stays intact.',after:'Warm polished metal gradually changes into a matte blue finish.',settings:WARM_METAL},
  {id:'glass',camera:'F001',effect:'caustics',duration:17,title:'F1 · Glass and caustics',before:'The original marble torso on its red pedestal.',after:'The torso gradually becomes glass, with soft floor caustics estimated from its shape and a dedicated light.',settings:{intensity:.7,speed:.6,ior:1.45}},
  {id:'original-f2',camera:'F002',duration:16,title:'F2 · Moving sunlight',before:'The original sunlight and shadows before the sun moves.',after:'The sun moves slowly, shifting the roof and sculpture shadows across the gallery.'},
  {id:'music-screen',camera:'music-screen',duration:26,title:'Music · Light in motion',before:'The cinema screen comes into view. The music you hear will shape its light.',after:'Bass, midrange, and high frequencies shape flowing light. The screen gently illuminates the room.'},
  {id:'finish',camera:'overview',duration:8,title:'Explore at your own pace',before:'All sculptures and the music screen and IOM website are available from the view menu. Your previous lighting, shadows, reflections, and effects return gently.'},
];
const GLOBAL_STUDIES = [
  {key:'shadows',method:'setShadows',property:'softness',min:.5,max:5,target:{enabled:true,intensity:1,softness:2.5}},
  {key:'reflections',method:'setReflections',property:'roughness',min:0,max:1,target:{enabled:true,intensity:.28,roughness:.38}},
];
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const mixAzimuth=(a,b,t)=>t===0?a:t===1?b:((a+(((b-a+540)%360)-180)*t+540)%360)-180;
const strengthOf=(config,id)=>clamp(config?.strength?.[id]??(config?.enabled?.[id]?1:0));
const lightBlend=config=>config?.environment?.enabled?(config.environment.blend??1):0;
const warmColor=new Color(WARM_METAL.color),blueColor=new Color(MATTE_BLUE.color),mixedColor=new Color();

export function createGalleryTour({getStudies,getMusicScreen=()=>null,onPlayMusic=()=>{},onBeforePlay=()=>{},onSkip=()=>{},selectCamera,selectSculpture,canvas,manualInteraction=false,autoStart=true,galleryModel,sculptureModel,cameraRig,roof,fullscreen}) {
  const navigation=createGalleryNavigation({galleryModel,sculptureModel});
  const entryFlight=createGalleryEntryFlight({galleryModel,sculptureModel});
  const RELOCATION_DURATION=1.2,ROOF_DURATION=1.5,baseDuration=STOPS.reduce((sum,stop)=>sum+stop.duration,0);
  let totalDuration=baseDuration;
  const approximateDuration=Math.ceil(totalDuration/10)*10;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={mode:'waiting',ready:false,index:-1,stop:null,title:'Guided tour',phase:'waiting',effectProgress:0,materialProgress:0,stepElapsed:0,elapsed:0,totalDuration,totalStops:STOPS.length,reason:null,repeat:false,reducedMotion:media.matches,countdown:3,history:[],navigation:navigation.state,travel:null,relocation:null};
  let lastFrame=null,countdownElapsed=0,manualBeforeStart=manualInteraction,savedConfiguration=null,animation=null,disposed=false;
  let entryConfiguration=null,entryGlobals={},savedGlobals={},effectAvailable=true,restorePrepared=false,materialFinalized=false,returnTransition=null;
  let travel=null,relocation=null,flight=null,roofTransition=null,savedRoof=null,savedFullscreen=null,roofManuallyChanged=false,plannedLegs=[],plannedFlightDuration=0,entryRoofAmount=0;
  state.flight=null;state.roofTransition=null;
  let savedScreenAmount=0;
  const panel=document.createElement('section');panel.className='tour-bar';panel.id='guided-tour';panel.setAttribute('aria-label','Guided gallery tour');
  panel.innerHTML=`<div class="tour-heading"><span class="tour-eyebrow" id="tour-duration">GUIDED TOUR · ABOUT ${Math.floor(approximateDuration/60)} MIN ${approximateDuration%60} SEC</span><strong id="tour-title">Preparing your tour</strong></div>
    <div class="tour-controls"><button id="tour-toggle" type="button" disabled>Loading tour…</button><button id="tour-skip" type="button" disabled>Skip tour</button><button id="tour-restart" type="button" disabled>Restart tour</button><label><input id="tour-repeat" type="checkbox"> Repeat</label></div>
    <p id="tour-description" role="status" aria-live="polite">${autoStart?'The tour will start automatically. Manual controls remain available.':'The tour waits for you. Choose Enter tour, or explore at your own pace.'}</p>
    <progress id="tour-progress" max="${totalDuration}" value="0" aria-label="Tour progress"></progress>`;
  const viewport=document.getElementById('viewport');(viewport.closest('.viewer-layout')??viewport).before(panel);document.body.classList.add('has-guided-tour');
  const el=id=>panel.querySelector('#'+id);
  state.description=el('tour-description').textContent;
  function label(text){state.description=text;if(el('tour-description').textContent!==text)el('tour-description').textContent=text;}
  function updateUI(){
    el('tour-toggle').disabled=!state.ready;el('tour-restart').disabled=!state.ready;el('tour-skip').disabled=!state.ready;
    el('tour-toggle').textContent=state.mode==='playing'?'Pause tour':state.mode==='complete'?'Replay tour':state.mode==='paused'&&state.index>=0?'Resume tour':'Play tour';
    el('tour-toggle').setAttribute('aria-pressed',String(state.mode==='playing'));
    el('tour-title').textContent=state.index>=0?`${state.index+1} / ${STOPS.length} · ${state.title}`:state.reason==='skipped'?'Explore at your own pace':'Welcome to the gallery';
    el('tour-progress').max=state.totalDuration;el('tour-progress').value=state.elapsed;panel.dataset.mode=state.mode;
    const seconds=Math.ceil(state.totalDuration/10)*10;el('tour-duration').textContent=`GUIDED WALK · ABOUT ${Math.floor(seconds/60)} MIN ${seconds%60} SEC`;
  }
  function phase(value,text){
    if(state.phase!==value){state.phase=value;const stop=STOPS[state.index]??STOPS[0];state.history.push({stop:stop.id,camera:stop.camera,event:value,at:state.elapsed});}
    if(text)label(text);
  }
  function settingsFor(settings){const result={...settings};if(media.matches&&'speed' in result)result.speed=0;return result;}
  function selectView(stop){cameraRig.selectView(stop.camera);}
  function planDurations(){
    let from=navigation.visitorPose(cameraRig.getPose('interior'));plannedLegs=STOPS.map(()=>0);
    plannedFlightDuration=(from&&entryFlight.plan(cameraRig.getPose('overview'),from,{roofHidden:true})?.duration)??RELOCATION_DURATION;
    for(let i=1;i<STOPS.length;i++){const to=cameraRig.getPose(i===STOPS.length-1?'interior':STOPS[i].camera),route=from&&navigation.plan(from,to);plannedLegs[i]=(route?.duration??0)+(i===1||i===STOPS.length-1?plannedFlightDuration+ROOF_DURATION:0);from=route?.to??navigation.visitorPose(to);}
    totalDuration=baseDuration+plannedLegs.reduce((a,b)=>a+b,0);state.totalDuration=totalDuration;
  }
  function remainingAfter(index){let time=0;for(let i=index+1;i<STOPS.length;i++)time+=STOPS[i].duration+plannedLegs[i];return time;}
  function refreshDuration(remaining){state.totalDuration=state.elapsed+remaining+remainingAfter(Math.max(0,state.index));updateUI();}
  function relocate(pose,complete,text){
    relocation={elapsed:0,duration:RELOCATION_DURATION,pose,complete,moved:false};state.relocation={elapsed:0,duration:RELOCATION_DURATION};
    phase('entering',text??'Entering the gallery. The walk begins at the gallery entrance.');
  }
  function changeRoof(amount,complete,text){
    if(!roof||roofManuallyChanged||Math.abs(roof.getAmount()-amount)<.00001){complete();return;}
    roofTransition={from:roof.getAmount(),to:amount,elapsed:0,duration:ROOF_DURATION,complete};
    state.roofTransition={from:roofTransition.from,to:amount,elapsed:0,duration:ROOF_DURATION};
    phase('roof-transition',text);
  }
  function startFlight(route,complete,text){
    flight={route,elapsed:0,complete};state.flight={from:route.from.position,to:route.to.position,points:route.points,duration:route.duration,elapsed:0};
    phase('flying',text);canvas.style.opacity='1';
  }
  function beginEntry(index){
    const entrance=navigation.visitorPose(cameraRig.getPose('interior'));
    if(!entrance){pause('route-unavailable');return;}
    const stop=STOPS[index];state.index=index;state.stop=stop.id;state.title=stop.title;state.stepElapsed=0;state.effectProgress=0;state.materialProgress=0;getStudies().resetEffects();
    const complete=()=>changeRoof(1,()=>beginTravel(index,{fromEntrance:true}),'The roof gently returns as the walk begins inside the gallery.');
    // The aerial route uses the opening revealed in the welcome. A manual roof
    // choice instead keeps the covered recovery, avoiding visible roof crossings.
    const route=(!roof||roof.getAmount()===0)?entryFlight.plan(cameraRig.getPose(),entrance,{roofHidden:true}):null;
    if(route)startFlight(route,complete,'Descending from the overview into the gallery.');
    else relocate(entrance,complete,'Entering the gallery before continuing the walk.');
    const walk=navigation.plan(entrance,cameraRig.getPose(STOPS[index].camera));
    refreshDuration((route?.duration??RELOCATION_DURATION)+(roofManuallyChanged?0:ROOF_DURATION)+(walk?.duration??0)+STOPS[index].duration);
  }
  function beginExit(index){
    changeRoof(0,()=>{
      const overview=cameraRig.getPose('overview');
      const route=(!roof||roof.getAmount()===0)?entryFlight.plan(overview,cameraRig.getPose(),{roofHidden:true})?.reverse():null;
      if(route)startFlight(route,()=>enterStep(index),'Rising smoothly to the final gallery overview.');
      else relocate(overview,()=>enterStep(index),'Returning to the gallery overview.');
      refreshDuration((route?.duration??RELOCATION_DURATION)+STOPS[index].duration);
    },'The roof gently opens for the final overview.');
  }
  function beginTravel(index,{fromEntrance=false}={}){
    getStudies().clearTourSunOffset();
    const stop=STOPS[index],studies=getStudies();getMusicScreen()?.setAmount(0);studies.resetEffects();state.index=index;state.stop=stop.id;state.title=stop.title;state.stepElapsed=0;state.effectProgress=0;state.materialProgress=0;returnTransition=null;
    const destination=cameraRig.getPose(index===STOPS.length-1?'interior':stop.camera),route=navigation.plan(cameraRig.getPose(),destination);
    if(!route){
      const entrance=navigation.visitorPose(cameraRig.getPose('interior'));
      if(!entrance||fromEntrance){pause('route-unavailable');label('This walking route is unavailable. The gallery remains available for manual exploration.');return;}
      relocate(entrance,()=>beginTravel(index,{fromEntrance:true}),'Returning to the gallery entrance before continuing the walk.');
      const planned=navigation.plan(entrance,destination);refreshDuration(RELOCATION_DURATION+(planned?.duration??0)+stop.duration+(index===STOPS.length-1?RELOCATION_DURATION:0));return;
    }
    if(roof&&!roofManuallyChanged&&roof.getAmount()<1){
      changeRoof(1,()=>beginTravel(index,{fromEntrance}),'The roof gently returns before the guided walk resumes.');
      refreshDuration(ROOF_DURATION+route.duration+stop.duration+(index===STOPS.length-1?plannedFlightDuration+ROOF_DURATION:0));return;
    }
    travel={route,elapsed:0,index};state.travel={from:route.from.position,to:route.to.position,points:route.points.map(p=>[...p]),length:route.length,duration:route.duration,elapsed:0};
    refreshDuration(route.duration+stop.duration+(index===STOPS.length-1?plannedFlightDuration+(roofManuallyChanged?0:ROOF_DURATION):0));
    phase('travelling',index===STOPS.length-1?'Walking back to the gallery entrance.':`Walking to ${stop.title}. Effects remain off while moving through the gallery.`);updateUI();
  }
  function fadeConfiguration(config,remaining){
    const studies=getStudies();
    for(const id of Object.keys(config?.enabled??{}))if(strengthOf(config,id)>0)studies.setEffectStrength(id,strengthOf(config,id)*remaining);
  }
  function captureGlobals(config){
    const studies=getStudies(),result={};
    for(const {key,method,property,min,max,target} of GLOBAL_STUDIES){
      if(typeof studies[method]!=='function'||(!config?.[key]&&!studies.state?.[key]))continue;
      const source={...studies.state?.[key],...config?.[key]};
      result[key]={enabled:typeof source.enabled==='boolean'?source.enabled:target.enabled,intensity:Number.isFinite(source.intensity)?clamp(source.intensity):target.intensity,[property]:Number.isFinite(source[property])?Math.max(min,Math.min(max,source[property])):target[property]};
    }
    return result;
  }
  function applyWelcomeGlobals(t){
    const studies=getStudies();
    for(const {key,method,target} of GLOBAL_STUDIES){
      const entry=entryGlobals[key];if(!entry)continue;
      const initial=entry.enabled?entry.intensity:0;
      // Shape changes happen only once the contribution has reached zero.
      const settings=t<2?{...entry,intensity:mix(initial,0,ease(t/2))}:{...target,intensity:target.intensity*ease((t-3.5)/3)};
      studies[method]({...settings,enabled:true});
    }
  }
  function applyFinishGlobals(progress){
    const studies=getStudies();
    for(const {key,method,property} of GLOBAL_STUDIES){
      const entry=entryGlobals[key],target=savedGlobals[key]??entry;if(!entry||!target)continue;
      const initial=entry.enabled?entry.intensity:0,final=target.enabled?target.intensity:0;
      // Keep the pass enabled at zero until the exact saved flags are restored.
      studies[method]({enabled:true,intensity:mix(initial,final,progress),[property]:mix(entry[property],target[property],progress)});
    }
  }
  function enterStep(index){
    const studies=getStudies(),stop=STOPS[index];entryConfiguration=studies.getConfiguration();entryGlobals=captureGlobals(entryConfiguration);entryRoofAmount=roof?.getAmount()??0;
    state.index=index;state.stop=stop.id;state.title=stop.title;state.stepElapsed=0;state.phase='entering';state.effectProgress=0;state.materialProgress=0;
    effectAvailable=true;restorePrepared=false;materialFinalized=false;returnTransition=null;
    // Every automatic effect has already reached zero before this camera change.
    // Welcome additionally eases away any effects the visitor enabled beforehand.
    if(stop.id!=='welcome')studies.resetEffects();
    if(stop.id==='welcome'){
      const env=entryConfiguration.environment;
      studies.setEnvironment({enabled:true,background:env.enabled&&env.background,intensity:env.intensity,blend:lightBlend(entryConfiguration)});
    }
    if(stop.effect)effectAvailable=studies.configureEffect(stop.effect,settingsFor(stop.settings));
    travel=null;relocation=null;flight=null;roofTransition=null;state.travel=null;state.relocation=null;state.flight=null;state.roofTransition=null;canvas.style.opacity='1';
    selectView(stop);phase('before',stop.before);refreshDuration(stop.duration);
    applyStep();updateUI();
  }
  function applyWelcome(t){
    const studies=getStudies();
    if(roof&&!roofManuallyChanged)roof.setAmount(1-ease((t-2)/3));
    if(t<2){const progress=ease(t/2);fadeConfiguration(entryConfiguration,1-progress);studies.setEnvironment({intensity:mix(entryConfiguration.environment.intensity,1,progress)});state.effectProgress=mix(lightBlend(entryConfiguration),0,progress);phase('fading',STOPS[0].before);}
    else if(t<3.5){fadeConfiguration(entryConfiguration,0);studies.setEnvironment({intensity:1});state.effectProgress=0;phase('before','Compare the original gallery lighting with soft shadows and floor reflections at zero.');}
    else if(t<6.5){state.effectProgress=ease((t-3.5)/3);phase('transition',STOPS[0].after);}
    else{state.effectProgress=1;phase('effect','HDR lighting, soft shadows, and floor reflections are ready. Each sculpture will now change gradually and return to its original surface.');}
    studies.setEnvironmentBlend(state.effectProgress);
    applyWelcomeGlobals(t);
  }
  function applyMaterial(t){
    const studies=getStudies();let progress;
    if(t<3){progress=0;phase('before',STOPS[state.index].before);}
    else if(t<6){progress=ease((t-3)/3);phase('transition','The original marble gradually becomes warm polished metal.');}
    else if(t<9){progress=1;phase('effect','Warm copper tones, a polished surface and a clear coat catch the gallery reflections.');}
    else if(t<13){
      progress=1;const blend=ease((t-9)/4);state.materialProgress=blend;
      const material={color:'#'+mixedColor.copy(warmColor).lerp(blueColor,blend).getHexString()};
      for(const key of Object.keys(WARM_METAL))if(key!=='color')material[key]=mix(WARM_METAL[key],MATTE_BLUE[key],blend);
      studies.configureEffect('material',material);phase('transition','Color, roughness and metalness gradually change into a matte blue finish.');
    }else if(t<18){
      progress=1;if(!materialFinalized){studies.configureEffect('material',MATTE_BLUE);state.materialProgress=1;materialFinalized=true;}
      phase('effect','The matte blue surface has softer reflections. The carved geometry is unchanged.');
    }else if(t<21){progress=1-ease((t-18)/3);phase('fading','The blue finish gently fades back to the original marble.');}
    else{progress=0;phase('before','The original material is restored before the next sculpture.');}
    state.effectProgress=progress;return studies.setEffectStrength('material',progress);
  }
  function applyEffect(stop,t){
    if(!effectAvailable){state.effectProgress=0;phase('unavailable','This study is unavailable. The tour will continue with the other sculptures.');return;}
    let success;
    if(stop.effect==='material')success=applyMaterial(t);
    else{
      const fadeStart=stop.duration-3.5,fadeEnd=stop.duration-1;
      if(t<3){state.effectProgress=0;phase('before',stop.before);}
      else if(t<6){state.effectProgress=ease((t-3)/3);phase('transition',stop.after);}
      else if(t<fadeStart){state.effectProgress=1;phase('effect',stop.after);}
      else if(t<fadeEnd){state.effectProgress=1-ease((t-fadeStart)/2.5);phase('fading','The effect gently fades away, revealing the original sculpture again.');}
      else{state.effectProgress=0;phase('before','The original sculpture is restored before the view changes.');}
      success=getStudies().setEffectStrength(stop.effect,state.effectProgress);
    }
    if(!success){effectAvailable=false;state.effectProgress=0;phase('unavailable','This study is unavailable. The tour will continue with the other sculptures.');}
  }
  function applyFinish(t){
    const studies=getStudies(),progress=ease((t-1)/5);state.effectProgress=progress;
    if(roof&&savedRoof&&!roofManuallyChanged)roof.setAmount(mix(entryRoofAmount,savedRoof.amount,progress));
    if(!restorePrepared){
      for(const [id,settings] of Object.entries(savedConfiguration.settings))studies.configureEffect(id,settingsFor(settings));
      restorePrepared=true;
    }
    for(const id of Object.keys(savedConfiguration.enabled))studies.setEffectStrength(id,strengthOf(savedConfiguration,id)*progress);
    const environment={intensity:mix(entryConfiguration.environment.intensity,savedConfiguration.environment.intensity,progress)};
    const entrySun=entryConfiguration.environment,savedSun=savedConfiguration.environment;
    if(Number.isFinite(entrySun.sunAzimuth)&&Number.isFinite(savedSun.sunAzimuth))environment.sunAzimuth=mixAzimuth(entrySun.sunAzimuth,savedSun.sunAzimuth,progress);
    if(Number.isFinite(entrySun.sunElevation)&&Number.isFinite(savedSun.sunElevation))environment.sunElevation=mix(entrySun.sunElevation,savedSun.sunElevation,progress);
    studies.setEnvironment(environment);
    studies.setEnvironmentBlend(mix(lightBlend(entryConfiguration),lightBlend(savedConfiguration),progress));
    applyFinishGlobals(progress);
    phase(progress===1?'effect':progress===0?'before':'transition',progress===1?'Your previous lighting, shadows, reflections, and effects are restored. Explore freely or replay the tour.':STOPS[state.index].before);
  }
  function applyMusicScreen(stop,t){
    const screen=getMusicScreen();
    if(!screen){phase('unavailable','The screen is unavailable. The gallery tour will continue.');return;}
    let amount;
    if(t<1.5){amount=0;phase('before',stop.before);}
    else if(t<5){amount=ease((t-1.5)/3.5);phase('transition','The gallery lighting dims gradually as the music screen comes alive.');}
    else if(t<22){amount=1;phase('effect',stop.after);}
    else{amount=1-ease((t-22)/3);phase('fading','The screen gently fades and daylight returns before we rise to the sky.');}
    state.effectProgress=amount;screen.setAmount(amount);
  }
  function applySunStudy(stop,t){
    const studies=getStudies(),base=entryConfiguration.environment;
    if(!studies.hdrLighting||!base.enabled||base.blend===0){phase('unavailable','Sunlight is unavailable. The tour will continue with the other studies.');return;}
    let progress;
    if(t<1.5){progress=0;phase('before',stop.before);}
    else if(t<6.5){progress=ease((t-1.5)/5);phase('transition',stop.after);}
    else if(t<8.5){progress=1;phase('effect','Notice the new direction of the shadows on the floor and pedestals.');}
    else if(t<13.5){progress=1-ease((t-8.5)/5);phase('fading','The sun gently returns to its original position.');}
    else{progress=0;phase('before','The original sunlight and shadows are restored before we continue.');}
    const elevation=base.sunElevation<28?14:-14;
    state.effectProgress=progress;
    studies.setTourSunOffset(45*progress,elevation*progress);
  }
  function applyStep(){
    const stop=STOPS[state.index],t=state.stepElapsed;
    if(stop.id==='welcome')applyWelcome(t);
    else if(stop.id==='finish')applyFinish(t);
    else if(stop.id==='music-screen')applyMusicScreen(stop,t);
    else if(stop.id==='original-f2')applySunStudy(stop,t);
    else if(stop.effect)applyEffect(stop,t);
  }
  function play({restart=false,repeatCycle=false}={}){
    if(disposed||!state.ready)return false;
    onBeforePlay();
    void onPlayMusic();
    const fresh=restart||state.index<0||state.mode==='complete';
    if(fresh){
      getStudies().clearTourSunOffset();
      if(!savedConfiguration||state.index<0||state.mode==='complete'){savedScreenAmount=getMusicScreen()?.capture()??0;savedConfiguration=getStudies().getConfiguration();savedGlobals=captureGlobals(savedConfiguration);savedRoof=roof?.capture();if(!repeatCycle)savedFullscreen=fullscreen?.capture();}
      if(!repeatCycle)fullscreen?.enter({automatic:true});
      getMusicScreen()?.setAmount(0);state.history=[];state.elapsed=0;state.index=0;state.stop=STOPS[0].id;state.title=STOPS[0].title;state.stepElapsed=0;state.travel=null;state.relocation=null;state.flight=null;state.roofTransition=null;travel=null;relocation=null;flight=null;roofTransition=null;returnTransition=null;roofManuallyChanged=false;canvas.style.opacity='1';planDurations();roof?.setAmount(1);
      const overview=cameraRig.getPose('overview'),current=cameraRig.getPose();
      if(Math.hypot(...current.position.map((v,i)=>v-overview.position[i]))>.01){relocate(overview,()=>enterStep(0),'Returning to the gallery overview before the walk begins.');refreshDuration(RELOCATION_DURATION+STOPS[0].duration);}
      else{cameraRig.applyPose(overview);enterStep(0);}
    }else if(state.reason==='manual'){
      getMusicScreen()?.setAmount(0);
      // Keep the visitor's camera while their manual effects fade away, then
      // return to this stop's original view without a material discontinuity.
      travel=null;relocation=null;flight=null;roofTransition=null;state.travel=null;state.relocation=null;state.flight=null;state.roofTransition=null;canvas.style.opacity='1';
      returnTransition={elapsed:0,index:state.index,configuration:getStudies().getConfiguration()};
      refreshDuration(2+STOPS[state.index].duration+plannedLegs[state.index]);
      phase('fading','Your manual effects gently fade before the guided view resumes.');
    }
    state.mode='playing';state.reason=null;lastFrame=null;if(!fresh&&!returnTransition&&!travel&&!relocation&&!flight&&!roofTransition)applyStep();updateUI();return true;
  }
  function pause(reason='button'){
    if(disposed||state.mode==='complete'||state.mode==='unavailable')return;
    if(state.mode==='waiting'||state.mode==='countdown')manualBeforeStart=true;
    if(state.mode==='paused'&&state.reason==='manual')return;
    state.mode='paused';state.reason=reason;lastFrame=null;animation?.cancel();
    if(reason==='manual')getStudies()?.clearTourSunOffset();
    if(reason==='manual'&&relocation){relocation=null;state.relocation=null;canvas.style.opacity='1';}
    const nextAction=state.index>=0?'Resume tour':'Play tour';
    label(reason==='page-hidden'?`Tour paused while this tab is hidden. Press ${nextAction} when you return.`:reason==='manual'?`Tour paused. Explore freely, then press ${nextAction} to continue.`:'Tour paused. Transition values stay fixed until you resume.');updateUI();
  }
  function finish(){
    getStudies().clearTourSunOffset({immediate:true});
    const configuration=structuredClone(savedConfiguration);
    if(media.matches)for(const id of ['deform','fog','caustics'])if(configuration.settings[id])configuration.settings[id].speed=0;
    const studies=getStudies();studies.restoreConfiguration(configuration);getMusicScreen()?.restore(savedScreenAmount);
    for(const {key,method} of GLOBAL_STUDIES)if(savedGlobals[key])studies[method](savedGlobals[key]);
    if(roof&&savedRoof&&!roofManuallyChanged)roof.restore(savedRoof);
    state.totalDuration=state.elapsed;state.mode='complete';state.phase='complete';state.reason=null;
    const repeat=state.repeat&&!document.hidden;
    if(!repeat&&savedFullscreen&&!savedFullscreen.active&&fullscreen?.state.active)fullscreen.exit();
    label('Tour complete. Explore freely, or replay the guided tour.');updateUI();if(repeat)play({restart:true,repeatCycle:true});
  }
  function skip(){
    if(disposed||!state.ready)return false;
    const studies=getStudies();
    animation?.cancel();animation=null;
    travel=relocation=flight=roofTransition=returnTransition=null;
    state.travel=state.relocation=state.flight=state.roofTransition=null;
    canvas.style.opacity='1';lastFrame=null;manualBeforeStart=true;
    studies.clearTourSunOffset({immediate:true});
    if(savedConfiguration)studies.restoreConfiguration(structuredClone(savedConfiguration));
    getMusicScreen()?.setAmount(0);
    savedConfiguration=null;savedGlobals={};savedRoof=null;savedFullscreen=null;
    state.mode='paused';state.reason='skipped';state.phase='skipped';state.index=-1;
    state.stop=null;state.title='Explore at your own pace';state.elapsed=0;state.stepElapsed=0;state.effectProgress=0;
    state.history.push({event:'skipped',camera:'interior',at:0});
    label('Tour skipped. Explore from the gallery entrance, or press Play tour to start again.');updateUI();
    return true;
  }
  function update(now){
    if(disposed||!Number.isFinite(now))return;
    const delta=lastFrame===null?0:Math.max(0,Math.min((now-lastFrame)/1000,.25));lastFrame=now;
    if(!state.ready){
      const studies=getStudies();if(studies?.state.status==='error'){state.mode='unavailable';label('The guided tour is unavailable. You can still explore the gallery manually.');updateUI();return;}
      if(studies?.state.status!=='ready')return;
      state.ready=true;state.reducedMotion=media.matches;
      planDurations();
      if(!autoStart||manualBeforeStart||media.matches||document.hidden){state.mode='paused';state.reason=media.matches?'reduced-motion':!autoStart?'entry':'manual';label(media.matches?'Automatic playback is off for reduced motion. Press Play tour to begin.':'Explore freely, or press Play tour to begin.');}
      else{state.mode='countdown';label('The tour starts in 3 seconds. Use any manual control to pause it.');}
      updateUI();return;
    }
    if(state.mode==='countdown'){countdownElapsed+=delta;state.countdown=Math.max(0,Math.ceil(3-countdownElapsed));if(countdownElapsed>=3)play();return;}
    if(state.mode!=='playing')return;if(document.hidden){pause('page-hidden');return;}
    if(returnTransition){
      const amount=Math.min(delta,2-returnTransition.elapsed);returnTransition.elapsed+=amount;state.elapsed+=amount;const progress=ease(returnTransition.elapsed/2);fadeConfiguration(returnTransition.configuration,1-progress);state.effectProgress=1-progress;
      if(progress===1){const index=returnTransition.index;returnTransition=null;if(index===0){relocate(cameraRig.getPose('overview'),()=>enterStep(0),'Returning to the gallery overview.');refreshDuration(RELOCATION_DURATION+STOPS[0].duration);}else beginTravel(index);}updateUI();return;
    }
    let remaining=delta;
    while(remaining>0&&state.mode==='playing'){
      if(roofTransition){
        const moving=roofTransition,amount=Math.min(remaining,moving.duration-moving.elapsed);moving.elapsed+=amount;state.elapsed+=amount;remaining-=amount;state.roofTransition.elapsed=moving.elapsed;
        if(!roofManuallyChanged)roof.setAmount(mix(moving.from,moving.to,ease(moving.elapsed/moving.duration)));
        if(moving.elapsed>=moving.duration){roofTransition=null;state.roofTransition=null;moving.complete();}continue;
      }
      if(flight){
        const moving=flight,amount=Math.min(remaining,moving.route.duration-moving.elapsed);moving.elapsed+=amount;state.elapsed+=amount;remaining-=amount;state.flight.elapsed=moving.elapsed;cameraRig.applyPose(moving.route.sample(moving.elapsed/moving.route.duration));
        if(moving.elapsed>=moving.route.duration){flight=null;state.flight=null;moving.complete();}continue;
      }
      if(relocation){
        const moving=relocation,amount=Math.min(remaining,moving.duration-moving.elapsed);moving.elapsed+=amount;state.elapsed+=amount;remaining-=amount;state.relocation.elapsed=moving.elapsed;
        const t=moving.elapsed/moving.duration;canvas.style.opacity=String(t<.4?1-ease(t/.4):t>.6?ease((t-.6)/.4):0);
        if(t>=.5&&!moving.moved){cameraRig.applyPose(moving.pose);moving.moved=true;}
        if(t>=1){relocation=null;state.relocation=null;canvas.style.opacity='1';moving.complete();}continue;
      }
      if(travel){
        const moving=travel,amount=Math.min(remaining,moving.route.duration-moving.elapsed);moving.elapsed+=amount;state.elapsed+=amount;remaining-=amount;state.travel.elapsed=moving.elapsed;cameraRig.applyPose(moving.route.sample(moving.elapsed/moving.route.duration));
        if(moving.elapsed>=moving.route.duration){travel=null;state.travel=null;if(moving.index===STOPS.length-1)beginExit(moving.index);else enterStep(moving.index);}continue;
      }
      const stop=STOPS[state.index],amount=Math.min(remaining,stop.duration-state.stepElapsed);
      state.stepElapsed=Math.min(stop.duration,state.stepElapsed+amount);state.elapsed+=amount;remaining-=amount;applyStep();
      if(state.stepElapsed>=stop.duration){if(state.index===STOPS.length-1)finish();else if(state.index===0)beginEntry(1);else beginTravel(state.index+1);}
    }
    el('tour-progress').value=state.elapsed;
  }
  function manualInput(event){if(panel.contains(event.target)||event.target.closest?.('[data-preserve-tour]'))return;if(event.type==='keydown'&&['Tab','Shift','Control','Alt','Meta','Escape'].includes(event.key))return;if(event.target.closest?.('button,input,select,canvas'))pause('manual');}
  // Read explicit sun edits after the studies controls have applied them.
  // Tour completion should retain the visitor's new choice, not a prior angle.
  function rememberSunEdit(event){
    if(!savedConfiguration)return;
    const id=event.target.id,environment=getStudies().state.environment;
    if(event.type==='input'&&id==='sun-azimuth'||event.type==='click'&&id==='sun-reset')savedConfiguration.environment.sunAzimuth=environment.sunAzimuth;
    if(event.type==='input'&&id==='sun-elevation'||event.type==='click'&&id==='sun-reset')savedConfiguration.environment.sunElevation=environment.sunElevation;
  }
  function visibility(){if(document.hidden)pause('page-hidden');}
  function motionChange(){state.reducedMotion=media.matches;if(media.matches){const wasPlaying=state.mode==='playing';pause('reduced-motion');if(wasPlaying){const studies=getStudies();for(const id of ['deform','fog','caustics'])if(studies.state.effects?.enabled[id])studies.configureEffect(id,{speed:0});}}}
  const main=document.querySelector('main'),events=['pointerdown','wheel','keydown','input','change'];events.forEach(type=>main.addEventListener(type,manualInput,{capture:true,passive:true}));
  main.addEventListener('input',rememberSunEdit);main.addEventListener('click',rememberSunEdit);
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',motionChange);
  function setRepeat(value){state.repeat=Boolean(value);el('tour-repeat').checked=state.repeat;}
  el('tour-toggle').addEventListener('click',()=>state.mode==='playing'?pause():play());el('tour-skip').addEventListener('click',onSkip);el('tour-restart').addEventListener('click',()=>play({restart:true}));el('tour-repeat').addEventListener('change',event=>setRepeat(event.target.checked));
  return{state,update,play,pause,skip,setRepeat,restart:()=>play({restart:true}),noteRoofManualChange(){roofManuallyChanged=true;savedRoof=roof?.capture();},get navigation(){return navigation;},get entryFlight(){return entryFlight;},get stops(){return STOPS.map(({id,camera,effect,duration},i)=>({id,camera,effect,duration,travelDuration:plannedLegs[i]??0}));},dispose(){if(disposed)return;getStudies()?.clearTourSunOffset({immediate:true});disposed=true;animation?.cancel();canvas.style.opacity='1';if(roof&&savedRoof&&!roofManuallyChanged)roof.restore(savedRoof);getMusicScreen()?.restore(savedScreenAmount);navigation.dispose();entryFlight.dispose();events.forEach(type=>main.removeEventListener(type,manualInput,{capture:true}));document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motionChange);main.removeEventListener('input',rememberSunEdit);main.removeEventListener('click',rememberSunEdit);panel.remove();document.body.classList.remove('has-guided-tour');}};
}
