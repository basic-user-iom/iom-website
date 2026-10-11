import * as THREE from 'three';
import { loadGalleryEnvironment } from './gallery-environment.js';
import { createSculptureEffects } from './sculpture-effects.js';
import { createGalleryShadows } from './gallery-shadows.js';
import { createGalleryReflections } from './gallery-reflections.js';
import { createHDRLighting } from './hdr-lighting.js';

const definitions = {
  refraction: {camera:'A', label:'A · Refraction', help:'The HDR panorama refracts through the surface of the first relief.', fields:[['ratio','Refraction',.75,1,.005]]},
  wireframe: {camera:'B001', label:'B1 · Wireframe', help:'The triangle mesh reveals the structure of the sculpture.', fields:[['color','Wireframe color','color']]},
  subsurface: {camera:'B002', label:'B2 · Subsurface scattering', help:'A transparent, amber-like relief with warm scattered light. Translucency reveals the wall behind it; Light intensity adjusts this sculpture only. The internal glow is a visual approximation.', fields:[['translucency','Translucency',0,1,.01],['lightIntensity','Light intensity',0,4,.05],['amount','Scattering amount',0,2,.05],['thickness','Optical thickness',.1,3,.05],['distortion','Light wrap',.05,1,.01],['power','Backlight focus',1,8,.1],['color','Scattering color','color']]},
  deform: {camera:'C001', label:'C1 · Deformation', help:'Twist the projecting figure while its relief backing stays fixed to the wall. Set speed to 0 to pause the animation.', fields:[['amount','Twist',-1.5,1.5,.01],['speed','Speed',0,1,.01]]},
  fog: {camera:'floor-fog', scope:'gallery', label:'Gallery · Floor mist', help:'A low, drifting mist settles across the gallery floors. Sculptures remain clear above it. Set speed to 0 to pause the drift.', fields:[['density','Density',0,2,.05],['height','Height (m)',.15,1.2,.05],['speed','Speed',0,1,.01],['color','Fog color','color']]},
  spotlight: {camera:'D', label:'D · Spotlight', help:'A focused beam with an adjustable angle and projected pattern.', fields:[['intensity','Intensity',0,1500,10],['angle','Beam width',.15,.9,.01],['color','Light color','color'],['projected','Light pattern','checkbox']]},
  material: {camera:'E', label:'E · Material lab', help:'Adjust E’s color, surface finish, and reflections. Changes apply only to this preview; the original model is preserved.', fields:[['color','Color tint','color'],['roughness','Roughness',0,1,.01],['metalness','Metalness',0,1,.01],['clearcoat','Clearcoat',0,1,.01],['clearcoatRoughness','Coat roughness',0,1,.01],['normalStrength','Surface detail',0,2,.01],['envMapIntensity','Reflection intensity',0,3,.05]]},
  caustics: {camera:'F001', label:'F1 · Glass and caustics', help:'A glass torso with soft floor caustics estimated from its shape and a dedicated light. Light animation gently changes the brightness.', fields:[['intensity','Caustic intensity',0,2,.05],['ior','Glass refraction',1,2,.01],['speed','Light animation speed',0,1,.01]]},
};
const studyCount=Object.keys(definitions).length;

export function initializeStudies({renderer,scene,galleryModel,sculptureModel,camera,groundReceiver=null,selectSculpture,selectCamera}) {
  const state={status:'loading',active:null,selectedCamera:null,environment:{status:'loading',enabled:true,background:true,intensity:1,blend:1,sunAzimuth:0,sunElevation:1,bytes:0},effects:null,shadows:null,reflections:null,errors:[]};
  let engine,shadowManager,reflectionManager,hdrLighting,texture,environmentBundle,disposed=false,renderedEffect,renderedEngine;
  let cinemaAmount=0,subsurfaceAmount=0,previousLightingTime=null;
  state.viewLighting={subsurfaceAmount:0,exteriorScale:1};
  let sunReturn=null,sunOffsetDirty=false;
  state.sunStudy={azimuthOffset:0,elevationOffset:0,returning:false,effectiveAzimuth:0,effectiveElevation:1};
  const fieldControls=new Map();
  const originalBackground=scene.background;
  const originalSceneSettings={environment:scene.environment,environmentIntensity:scene.environmentIntensity,backgroundBlurriness:scene.backgroundBlurriness,backgroundIntensity:scene.backgroundIntensity};
  const lights=scene.children.filter(o=>o.isLight).map(light=>({light,intensity:light.intensity}));
  const hdrKey=lights.find(({light})=>light.isDirectionalLight)?.light;
  const viewport=document.getElementById('viewport'),layout=document.createElement('div'),panel=document.createElement('aside');
  layout.className='viewer-layout';panel.className='studies-panel';panel.setAttribute('aria-label','Light and materials');viewport.before(layout);layout.append(viewport,panel);
  panel.innerHTML=`
    <h2>Light and materials</h2>
    <p class="studies-intro">Explore sculpture materials, floor mist and gallery lighting.</p>
    <fieldset class="environment-controls"><legend>Gallery lighting</legend>
      <label class="study-check"><input id="environment-enabled" type="checkbox" checked disabled> HDR panorama</label>
      <p class="study-fieldset-help">Evening sky · 2K</p>
      <label class="study-check"><input id="environment-background" type="checkbox" checked disabled> Show background</label>
      <label class="study-range" for="environment-intensity"><span>Intensity <output id="environment-value">1</output></span><input id="environment-intensity" type="range" min="0" max="2" step="0.05" value="1" disabled></label>
      <p id="sun-help" class="study-fieldset-help">Adjust direct sunlight.</p>
      <label class="study-range" for="sun-azimuth"><span>Sun azimuth <output id="sun-azimuth-value" for="sun-azimuth">—</output></span><input id="sun-azimuth" type="range" min="-180" max="180" step="0.1" value="0" disabled></label>
      <label class="study-range" for="sun-elevation"><span>Sun elevation <output id="sun-elevation-value" for="sun-elevation">—</output></span><input id="sun-elevation" type="range" min="1" max="89" step="0.1" value="1" disabled></label>
      <button id="sun-reset" type="button" disabled>Reset sun</button>
    </fieldset>
    <fieldset class="shadow-controls"><legend>Gallery shadows</legend>
      <label class="study-check"><input id="shadows-enabled" type="checkbox" checked disabled> Soft shadows</label>
      <p class="study-fieldset-help">Walls, sculptures, furniture, and roof supports cast shadows from the adjustable sunlight.</p>
      <label class="study-range" for="shadows-intensity"><span>Shadow strength <output id="shadows-intensity-value" for="shadows-intensity">1</output></span><input id="shadows-intensity" type="range" min="0" max="1" step="0.05" value="1" disabled></label>
      <label class="study-range" for="shadows-softness"><span>Softness <output id="shadows-softness-value" for="shadows-softness">2.5</output></span><input id="shadows-softness" type="range" min="0.5" max="5" step="0.1" value="2.5" disabled></label>
    </fieldset>
    <fieldset class="reflection-controls"><legend>Floor reflections</legend>
      <label class="study-check"><input id="reflections-enabled" type="checkbox" checked disabled> Reflections</label>
      <p class="study-fieldset-help">Soft floor reflections of the gallery.</p>
      <label class="study-range" for="reflections-intensity"><span>Reflection strength <output id="reflections-intensity-value" for="reflections-intensity">0.28</output></span><input id="reflections-intensity" type="range" min="0" max="1" step="0.01" value="0.28" disabled></label>
      <label class="study-range" for="reflections-roughness"><span>Roughness <output id="reflections-roughness-value" for="reflections-roughness">0.38</output></span><input id="reflections-roughness" type="range" min="0" max="1" step="0.01" value="0.38" disabled></label>
    </fieldset>
    <label class="study-picker" for="study-select">Materials and atmosphere</label>
    <select id="study-select" disabled><option value="">Choose an effect</option>${Object.entries(definitions).map(([id,d])=>`<option value="${id}">${d.label}</option>`).join('')}</select>
    <p id="study-context" aria-live="polite"></p>
    <label class="study-check effect-enable"><input id="study-enabled" type="checkbox" disabled> Enable effect</label>
    <label class="study-range effect-strength" for="study-strength" hidden><span>Effect amount <output id="study-strength-value" for="study-strength">0</output></span><input id="study-strength" type="range" min="0" max="1" step="0.01" value="0" disabled></label>
    <p id="study-description">Choose a study to visit its view and enable the effect.</p>
    <button id="study-suggestion" type="button" hidden></button>
    <div id="study-parameters"></div>
    <button id="studies-reset" type="button" disabled>Original materials</button>
    <p id="studies-active" aria-live="polite">No effects are enabled in the gallery.</p>
    <p id="studies-status" role="status">Preparing lighting…</p>
  `;
  // Keep the selected sculpture's controls beside its view. Less frequently
  // adjusted room settings remain accessible in native keyboard disclosures.
  const effectSection=document.createElement('section');effectSection.className='sculpture-studies';effectSection.setAttribute('aria-label','Sculpture study');
  const firstFieldset=panel.querySelector('fieldset'),firstEffect=panel.querySelector('.study-picker');
  for(let node=firstEffect;node&&node.id!=='studies-status';){const next=node.nextSibling;effectSection.append(node);node=next;}
  panel.insertBefore(effectSection,firstFieldset);
  for(const fieldset of panel.querySelectorAll('fieldset')){
    const details=document.createElement('details'),summary=document.createElement('summary'),legend=fieldset.querySelector('legend');
    details.className='study-section';details.id=fieldset.className+'-section';summary.textContent=legend.textContent;legend.className='visually-hidden';
    fieldset.before(details);details.append(summary,fieldset);
  }
  for(const input of panel.querySelectorAll('input[type=range]')){
    const label=input.closest('label').querySelector('span');input.setAttribute('aria-label',label.firstChild.textContent.trim());
  }
  for(const output of panel.querySelectorAll('output')){output.setAttribute('aria-hidden','true');output.setAttribute('aria-live','off');}
  panel.addEventListener('focusin',event=>{
    // Native focus scrolling does not account for the compact sticky 3D view.
    // Keep a keyboard-selected setting visible below it on stacked layouts.
    requestAnimationFrame(()=>{
      if(!event.target.isConnected||!window.matchMedia('(max-width:980px)').matches||viewport.contains(document.activeElement))return;
      const setting=event.target.getBoundingClientRect(),view=viewport.getBoundingClientRect();
      if(setting.top<view.bottom+16)window.scrollBy({top:setting.top-view.bottom-24,behavior:'instant'});
    });
  });
  const el=id=>document.getElementById(id);
  const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  const numberFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
  const format=value=>numberFormat.format(Number(value));
  const fieldValue=(element,value)=>{const next=String(value);if(element.value!==next)element.value=next;};
  const note=(message,error=false)=>{text(el('studies-status'),message);el('studies-status').classList.toggle('error',error);};
  const isReady=()=>!disposed&&state.status==='ready'&&!!engine;
  const effectStrength=id=>engine?.state.strength?.[id]??(engine?.state.enabled[id]?1:0);
  function applyEnvironment(syncUI=true){
    const enabled=!!texture&&state.environment.enabled;
    // Temporary view lighting never overwrites the visitor's HDR settings.
    // Use the stronger dimmer during handover, rather than multiplying them.
    const exteriorScale=1-Math.max(.94*cinemaAmount,.90*subsurfaceAmount);
    state.viewLighting.exteriorScale=exteriorScale;
    const blend=enabled?state.environment.blend:0;
    scene.environment=enabled?(hdrLighting?.skyTexture??texture):null;
    scene.environmentIntensity=state.environment.intensity*blend*exteriorScale;
    scene.background=enabled&&state.environment.background?(environmentBundle?.sun?.hasDirectSun===false&&environmentBundle.skyTexture?environmentBundle.skyTexture:texture):originalBackground;
    scene.backgroundBlurriness=0;scene.backgroundIntensity=.7*(1-.7*Math.max(cinemaAmount,subsurfaceAmount));
    for(const {light,intensity} of lights){
      if(hdrLighting&&light===hdrKey)continue;
      light.intensity=intensity*exteriorScale*(hdrLighting?1-blend:THREE.MathUtils.lerp(1,light.isHemisphereLight?.32:.65,blend));
    }
    const azimuth=((state.environment.sunAzimuth+state.sunStudy.azimuthOffset+180)%360+360)%360-180;
    const elevation=THREE.MathUtils.clamp(state.environment.sunElevation+state.sunStudy.elevationOffset,1,89);
    state.sunStudy.effectiveAzimuth=azimuth;state.sunStudy.effectiveElevation=elevation;
    hdrLighting?.configure({enabled,intensity:state.environment.intensity,blend,azimuth,elevation});
    if(hdrLighting&&hdrKey)hdrKey.intensity*=exteriorScale;
    shadowManager?.update();
    if(cinemaAmount>.0001)renderer.shadowMap.enabled=true;
    if(!syncUI)return;
    el('environment-enabled').checked=state.environment.enabled;
    el('environment-background').checked=state.environment.background;
    el('environment-intensity').value=String(state.environment.intensity);
    el('environment-value').value=state.environment.intensity.toLocaleString('en-US',{maximumFractionDigits:2});
    syncSunControls();
  }
  function syncSunControls(){
    const available=isReady()&&!!hdrLighting&&!hdrLighting.state.disposed;
    for(const id of ['sun-azimuth','sun-elevation','sun-reset'])el(id).disabled=!available;
    for(const [id,key]of [['sun-azimuth','sunAzimuth'],['sun-elevation','sunElevation']]){
      fieldValue(el(id),state.environment[key]);
      fieldValue(el(id+'-value'),state.environment[key].toLocaleString('en-US',{maximumFractionDigits:2})+'°');
      el(id).setAttribute('aria-valuetext',state.environment[key].toLocaleString('en-US',{maximumFractionDigits:2})+' degrees');
    }
  }
  function updateViewLighting(seconds){
    if(!Number.isFinite(seconds))return false;
    const delta=previousLightingTime===null?0:THREE.MathUtils.clamp(seconds-previousLightingTime,0,.1);
    previousLightingTime=seconds;
    const target=state.selectedCamera==='B002'?effectStrength('subsurface'):0;
    let next=subsurfaceAmount+(target-subsurfaceAmount)*(1-Math.exp(-delta/.5));
    if(Math.abs(target-next)<.0001)next=target;
    let changed=next!==subsurfaceAmount||sunOffsetDirty;sunOffsetDirty=false;
    subsurfaceAmount=next;state.viewLighting.subsurfaceAmount=next;
    if(sunReturn){
      sunReturn.elapsed=Math.min(1,sunReturn.elapsed+delta);
      const t=sunReturn.elapsed,remaining=1-t*t*(3-2*t);
      state.sunStudy.azimuthOffset=sunReturn.azimuth*remaining;
      state.sunStudy.elevationOffset=sunReturn.elevation*remaining;changed=true;
      if(t===1){sunReturn=null;state.sunStudy.returning=false;}
    }
    if(changed)applyEnvironment(false);return changed;
  }
  function setTourSunOffset(azimuth,elevation){
    if(!isReady()||!hdrLighting||![azimuth,elevation].every(Number.isFinite))return false;
    sunReturn=null;state.sunStudy.returning=false;
    if(state.sunStudy.azimuthOffset===azimuth&&state.sunStudy.elevationOffset===elevation)return true;
    state.sunStudy.azimuthOffset=azimuth;state.sunStudy.elevationOffset=elevation;sunOffsetDirty=true;return true;
  }
  function clearTourSunOffset({immediate=false}={}){
    if(disposed)return;
    const {azimuthOffset:azimuth,elevationOffset:elevation}=state.sunStudy;
    if(immediate){sunReturn=null;sunOffsetDirty=false;state.sunStudy.returning=false;if(azimuth||elevation){state.sunStudy.azimuthOffset=state.sunStudy.elevationOffset=0;applyEnvironment(false);}return;}
    if(!sunReturn&&(azimuth||elevation)){sunReturn={azimuth,elevation,elapsed:0};state.sunStudy.returning=true;}
  }
  const cameraLabel=id=>id==='floor-fog'?'Gallery floor':id?.replace(/00([12])$/,'$1')??'';
  const relatedStudies={F002:'caustics'};
  function syncShadowControls(){
    for(const id of ['shadows-enabled','shadows-intensity','shadows-softness'])el(id).disabled=!isReady()||!shadowManager;
    if(!shadowManager)return;
    const {enabled,intensity,softness}=shadowManager.state;
    el('shadows-enabled').checked=enabled;
    fieldValue(el('shadows-intensity'),intensity);fieldValue(el('shadows-intensity-value'),format(intensity));
    fieldValue(el('shadows-softness'),softness);fieldValue(el('shadows-softness-value'),format(softness));
  }
  function setShadows(settings={}){
    if(!isReady()||!shadowManager||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    if('enabled' in settings&&typeof settings.enabled!=='boolean')return false;
    if(['intensity','softness'].some(key=>key in settings&&!Number.isFinite(settings[key])))return false;
    try{
      if(!shadowManager.configure(settings)){note('The shadow setting could not be applied.',true);return false;}
      shadowManager.update();syncShadowControls();return true;
    }catch(error){state.errors.push(String(error));note('The shadow setting could not be applied.',true);return false;}
  }
  function syncReflectionControls(){
    for(const id of ['reflections-enabled','reflections-intensity','reflections-roughness'])el(id).disabled=!isReady()||!reflectionManager;
    if(!reflectionManager)return;
    const {enabled,intensity,roughness}=reflectionManager.state;
    el('reflections-enabled').checked=enabled;
    fieldValue(el('reflections-intensity'),intensity);fieldValue(el('reflections-intensity-value'),format(intensity));
    fieldValue(el('reflections-roughness'),roughness);fieldValue(el('reflections-roughness-value'),format(roughness));
  }
  function setReflections(settings={}){
    if(!isReady()||!reflectionManager||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    if('enabled' in settings&&typeof settings.enabled!=='boolean')return false;
    if(['intensity','roughness'].some(key=>key in settings&&!Number.isFinite(settings[key])))return false;
    try{
      if(!reflectionManager.configure(settings)){note('The reflection setting could not be applied.',true);return false;}
      syncReflectionControls();return true;
    }catch(error){state.errors.push(String(error));note('The reflection setting could not be applied.',true);return false;}
  }
  function syncCount(){const active=engine?Object.keys(definitions).filter(id=>engine.state.enabled[id]):[];text(el('studies-active'),active.length?`Enabled in the gallery: ${active.length} / ${studyCount} effects (${active.map(id=>cameraLabel(definitions[id].camera)).join(', ')}).`:'No effects are enabled in the gallery.');}
  function syncControls(){
    const id=state.active,definition=definitions[id];el('study-select').value=id??'';el('study-enabled').disabled=!engine||!definition;el('study-enabled').checked=!!engine?.state.enabled[id];
    const camera=state.selectedCamera,related=relatedStudies[camera];
    el('study-enabled').closest('label').hidden=!definition;
    el('study-strength').closest('label').hidden=!definition;el('study-strength').disabled=!engine||!definition;
    const strength=definition?effectStrength(id):0;
    fieldValue(el('study-strength'),strength);fieldValue(el('study-strength-value'),format(strength));
    text(el('study-context'),definition?`${definition.scope==='gallery'?'Floor mist':'Effect on '+cameraLabel(definition.camera)}: ${engine?.state.enabled[id]?'on':'off'}.`:camera?`Sculpture ${cameraLabel(camera)} has no assigned effect.`:'Choose a sculpture material or the gallery floor mist.');
    text(el('study-description'),definition?.help??(camera?(related?'Choose a study from the list, or open the related study.':`Choose a material or atmosphere effect from the list to open one of the ${studyCount} studies.`):'Choose a study to visit its view and enable the effect.'));
    el('study-suggestion').hidden=!related||!!definition;el('study-suggestion').disabled=!engine;
    text(el('study-suggestion'),related?({wireframe:'View wireframe on B1',caustics:'View glass and caustics on F1'})[related]:'');
    syncCount();
    if(renderedEffect!==id||!engine)return;
    for(const [key,{input,output}] of fieldControls){
      const value=engine.state.settings[id][key];
      if(input.type==='checkbox')input.checked=Boolean(value);
      else fieldValue(input,value);
      if(output)fieldValue(output,format(value));
    }
  }
  function drawControls(){
    const id=state.active,definition=definitions[id];
    if(renderedEffect===id&&renderedEngine===engine){syncControls();return;}
    renderedEffect=id;renderedEngine=engine;fieldControls.clear();el('study-parameters').replaceChildren();
    if(!definition||!engine){syncControls();return;}
    for(const [key,label,min,max,step] of definition.fields){
      const wrapper=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.id=`study-${id}-${key}`;input.dataset.setting=key;input.setAttribute('aria-label',label);wrapper.htmlFor=input.id;span.textContent=label;
      let output;
      if(min==='color'){input.type='color';wrapper.className='study-color';wrapper.append(span,input);}
      else if(min==='checkbox'){input.type='checkbox';wrapper.className='study-check';wrapper.append(input,span);}
      else{input.type='range';input.min=min;input.max=max;input.step=step;wrapper.className='study-range';output=document.createElement('output');output.setAttribute('for',input.id);output.setAttribute('aria-hidden','true');output.setAttribute('aria-live','off');span.append(output);wrapper.append(span,input);}
      fieldControls.set(key,{input,output});
      input.addEventListener('input',()=>{
        const value=input.type==='checkbox'?input.checked:input.type==='color'?input.value:Number(input.value);
        if(configureEffect(id,{[key]:value})&&id==='material'&&effectStrength(id)===0)setEffectStrength(id,1);
      });
      el('study-parameters').append(wrapper);
    }
    syncControls();
  }
  function setEffectStrength(id,value){
    if(!isReady()||!definitions[id]||!Number.isFinite(value))return false;
    try{
      const success=engine.setStrength(id,THREE.MathUtils.clamp(value,0,1));
      if(!success){note('This effect is currently unavailable. Other views remain available.',true);return false;}
      shadowManager?.update();
      note(state.environment.status==='error'?'HDR did not load; other studies are available.':'');syncControls();return true;
    }catch(error){state.errors.push(String(error));note('The effect could not be applied. You can restore the original materials.',true);return false;}
  }
  function setEnabled(id,enabled){return setEffectStrength(id,enabled?1:0);}
  function configureEffect(id,settings){
    if(!isReady()||!definitions[id]||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    try{
      const success=engine.configure(id,settings);
      if(!success){note('The setting could not be applied.',true);return false;}
      shadowManager?.update();
      syncControls();return true;
    }catch(error){state.errors.push(String(error));note('The setting could not be applied.',true);return false;}
  }
  function setEffect(id,enabled,settings={}){
    if(!isReady()||!definitions[id]||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    if(Object.keys(settings).length&&!configureEffect(id,settings))return false;
    return setEnabled(id,enabled);
  }
  function resetEffects(){
    if(!isReady())return false;
    let success=true;
    for(const id of Object.keys(definitions))if(!setEnabled(id,false))success=false;
    syncControls();
    return success;
  }
  function setEnvironment(settings={}){
    if(!isReady()||!settings||typeof settings!=='object'||Array.isArray(settings))return false;
    if('intensity' in settings&&!Number.isFinite(settings.intensity))return false;
    if('blend' in settings&&!Number.isFinite(settings.blend))return false;
    if(['sunAzimuth','sunElevation'].some(key=>key in settings&&(!Number.isFinite(settings[key])||!hdrLighting)))return false;
    if(settings.enabled&&!texture)return false;
    if('sunAzimuth' in settings||'sunElevation' in settings)clearTourSunOffset({immediate:true});
    if('enabled' in settings)state.environment.enabled=Boolean(settings.enabled);
    if('background' in settings)state.environment.background=Boolean(settings.background);
    if('intensity' in settings)state.environment.intensity=THREE.MathUtils.clamp(settings.intensity,0,2);
    if('blend' in settings)state.environment.blend=THREE.MathUtils.clamp(settings.blend,0,1);
    if('sunAzimuth' in settings)state.environment.sunAzimuth=THREE.MathUtils.clamp(settings.sunAzimuth,-180,180);
    if('sunElevation' in settings)state.environment.sunElevation=THREE.MathUtils.clamp(settings.sunElevation,1,89);
    applyEnvironment();
    return true;
  }
  function setEnvironmentBlend(value){
    if(!isReady()||!Number.isFinite(value))return false;
    state.environment.blend=THREE.MathUtils.clamp(value,0,1);applyEnvironment(false);return true;
  }
  function resetSunPosition(){
    if(!isReady()||!hdrLighting)return false;
    return setEnvironment({sunAzimuth:hdrLighting.state.defaultAzimuth,sunElevation:hdrLighting.state.defaultElevation});
  }
  function getConfiguration(){
    if(!isReady())return null;
    const {enabled,background,intensity,blend,sunAzimuth,sunElevation}=state.environment;
    const strength=Object.fromEntries(Object.keys(definitions).map(id=>[id,effectStrength(id)]));
    const shadows=shadowManager?{enabled:shadowManager.state.enabled,intensity:shadowManager.state.intensity,softness:shadowManager.state.softness}:undefined;
    const reflections=reflectionManager?{enabled:reflectionManager.state.enabled,intensity:reflectionManager.state.intensity,roughness:reflectionManager.state.roughness}:undefined;
    return structuredClone({environment:{enabled,background,intensity,blend,sunAzimuth,sunElevation},enabled:engine.state.enabled,strength,settings:engine.state.settings,shadows,reflections});
  }
  function restoreConfiguration(config){
    if(!isReady()||!config?.environment||!config.enabled||!config.settings)return false;
    if(typeof config.environment!=='object'||Array.isArray(config.environment))return false;
    if(['sunAzimuth','sunElevation'].some(key=>key in config.environment&&!Number.isFinite(config.environment[key])))return false;
    if(typeof config.enabled!=='object'||Array.isArray(config.enabled)||typeof config.settings!=='object'||Array.isArray(config.settings))return false;
    if(config.strength!==undefined&&(!config.strength||typeof config.strength!=='object'||Array.isArray(config.strength)))return false;
    if(config.shadows!==undefined){
      if(!config.shadows||typeof config.shadows!=='object'||Array.isArray(config.shadows))return false;
      if('enabled' in config.shadows&&typeof config.shadows.enabled!=='boolean')return false;
      if(['intensity','softness'].some(key=>key in config.shadows&&!Number.isFinite(config.shadows[key])))return false;
    }
    if(config.reflections!==undefined){
      if(!config.reflections||typeof config.reflections!=='object'||Array.isArray(config.reflections))return false;
      if('enabled' in config.reflections&&typeof config.reflections.enabled!=='boolean')return false;
      if(['intensity','roughness'].some(key=>key in config.reflections&&!Number.isFinite(config.reflections[key])))return false;
    }
    if(!Object.keys(definitions).every(id=>(!(id in config.enabled)||typeof config.enabled[id]==='boolean')&&(!(id in config.settings)||(config.settings[id]&&typeof config.settings[id]==='object'&&!Array.isArray(config.settings[id])))&&(!config.strength||!(id in config.strength)||Number.isFinite(config.strength[id]))))return false;
    const snapshot=structuredClone(config);
    let success=setEnvironment({blend:1,...snapshot.environment});
    for(const id of Object.keys(definitions)){
      if(snapshot.settings[id]&&!configureEffect(id,snapshot.settings[id]))success=false;
      const strength=snapshot.strength?.[id]??(snapshot.enabled[id]?1:0);
      if(!setEffectStrength(id,strength))success=false;
    }
    if(snapshot.shadows!==undefined&&!setShadows(snapshot.shadows))success=false;
    if(snapshot.reflections!==undefined&&!setReflections(snapshot.reflections))success=false;
    syncControls();
    return success;
  }
  el('environment-enabled').addEventListener('change',event=>setEnvironment({enabled:event.target.checked,blend:1}));
  el('environment-background').addEventListener('change',event=>setEnvironment({background:event.target.checked}));
  el('environment-intensity').addEventListener('input',event=>setEnvironment({intensity:Number(event.target.value)}));
  el('sun-azimuth').addEventListener('input',event=>setEnvironment({sunAzimuth:Number(event.target.value)}));
  el('sun-elevation').addEventListener('input',event=>setEnvironment({sunElevation:Number(event.target.value)}));
  el('sun-reset').addEventListener('click',resetSunPosition);
  el('shadows-enabled').addEventListener('change',event=>setShadows({enabled:event.target.checked}));
  el('shadows-intensity').addEventListener('input',event=>setShadows({intensity:Number(event.target.value)}));
  el('shadows-softness').addEventListener('input',event=>setShadows({softness:Number(event.target.value)}));
  el('reflections-enabled').addEventListener('change',event=>setReflections({enabled:event.target.checked}));
  el('reflections-intensity').addEventListener('input',event=>setReflections({intensity:Number(event.target.value)}));
  el('reflections-roughness').addEventListener('input',event=>setReflections({roughness:Number(event.target.value)}));
  function selectStudy(id){state.active=id||null;if(state.active){const definition=definitions[state.active];if(definition.scope==='gallery')selectCamera(definition.camera);else selectSculpture(definition.camera);state.active=id;setEnabled(id,true);}else selectSculpture('');drawControls();}
  el('study-select').addEventListener('change',event=>selectStudy(event.target.value));
  el('study-suggestion').addEventListener('click',()=>selectStudy(relatedStudies[state.selectedCamera]));
  el('study-enabled').addEventListener('change',event=>setEnabled(state.active,event.target.checked));
  el('study-strength').addEventListener('input',event=>setEffectStrength(state.active,Number(event.target.value)));
  el('studies-reset').addEventListener('click',resetEffects);
  loadGalleryEnvironment(renderer).then(bundle=>{
    if(disposed){bundle.dispose();return;}
    environmentBundle=bundle;texture=bundle.texture;
    try{
      hdrLighting=createHDRLighting({scene,texture,galleryModel,key:hdrKey,
        fallbackIntensity:lights.find(({light})=>light===hdrKey)?.intensity,
        preparedSun:bundle.sun,preparedSkyTexture:bundle.skyTexture});
      state.environment.status='ready';state.environment.size=bundle.diagnostics.resolution;
      state.environment.delivery=bundle.diagnostics;state.environment.bytes=bundle.diagnostics.bytes;
      state.environment.sun=hdrLighting.state;state.environment.sunAzimuth=hdrLighting.state.defaultAzimuth;
      state.environment.sunElevation=hdrLighting.state.defaultElevation;
      text(el('sun-help'),hdrLighting.state.hasDirectSun?'Adjust direct sunlight. Reset restores the HDR sun.':'This evening sky has no direct sun. These controls position an additional light.');
      text(el('sun-reset'),hdrLighting.state.hasDirectSun?'Reset HDR sun':'Reset sun');
      applyEnvironment();
      for(const id of ['environment-enabled','environment-background','environment-intensity'])el(id).disabled=false;
      startEngine();
    }catch(error){environmentBundle.dispose();environmentBundle=null;texture=null;environmentFailed(error);}
  }).catch(environmentFailed);
  function environmentFailed(error){
    if(disposed)return;state.environment.status='error';state.environment.enabled=false;
    state.errors.push(String(error));applyEnvironment();startEngine();
  }
  function startEngine(){
    try{engine=createSculptureEffects({renderer,scene,galleryModel,sculptureModel,refractionEnvironment:texture});state.effects=engine.state;shadowManager=createGalleryShadows({renderer,scene,galleryModel,sculptureModel,groundReceiver,effects:engine.state});state.shadows=shadowManager.state;shadowManager.update();reflectionManager=createGalleryReflections({renderer,scene,galleryModel,camera});state.reflections=reflectionManager.state;state.status='ready';el('study-select').disabled=false;el('studies-reset').disabled=false;drawControls();syncShadowControls();syncReflectionControls();syncSunControls();note(state.environment.status==='error'?'HDR did not load; other studies are available.':'');}
    catch(error){state.status='error';state.errors.push(String(error));note('Studies are unavailable. The gallery and camera views remain available.',true);}
  }
  return {
    state,setEffect,setEffectStrength,configureEffect,resetEffects,setEnvironment,setEnvironmentBlend,resetSunPosition,setShadows,setReflections,getConfiguration,restoreConfiguration,setTourSunOffset,clearTourSunOffset,
    update:seconds=>{if(!disposed){engine?.update(seconds);if(!updateViewLighting(seconds))shadowManager?.update();if(cinemaAmount>.0001)renderer.shadowMap.enabled=true;}},
    render:camera=>{if(disposed)return false;reflectionManager?.render(camera);return Boolean(engine?.render?.(camera));},
    onSelectSculpture(cameraId){if(disposed)return;if(cameraId!=='F002')clearTourSunOffset();state.selectedCamera=cameraId;state.active=Object.keys(definitions).find(id=>definitions[id].camera===cameraId)??null;drawControls();},
    get engine(){return engine;},
    get shadows(){return shadowManager;},
    get reflections(){return reflectionManager;},
    get hdrLighting(){return hdrLighting;},
    setCinemaAmount(value){if(disposed)return;const next=THREE.MathUtils.clamp(Number(value)||0,0,1);if(Math.abs(next-cinemaAmount)<1e-6)return;cinemaAmount=next;state.cinemaAmount=next;applyEnvironment(false);},
    dispose(){if(disposed)return;disposed=true;engine?.dispose();shadowManager?.dispose();reflectionManager?.dispose();hdrLighting?.dispose();environmentBundle?.dispose();Object.assign(scene,originalSceneSettings);scene.background=originalBackground;lights.forEach(({light,intensity})=>light.intensity=intensity);layout.replaceWith(viewport);state.status='disposed';},
  };
}
