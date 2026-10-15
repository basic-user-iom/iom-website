import type {ReceptionDesk} from './ReceptionDesk';
import type {LinarCamera,LinarTarget} from './LinarCamera';
import type {LinarWalls,Application,LinarSettings} from './LinarWalls';
import {LINAR_MDF_COLOURS,LINAR_FELT_COLOURS,LINAR_FLEECE_COLOURS} from './linar-reference/materialData';
import {LINAR_VENEERS,LINAR_BACKINGS} from './linar-reference/types';
export function setupLinarControls(linar:LinarWalls,changed:(final?:boolean)=>void,focus:(id:LinarTarget)=>void,camera:LinarCamera,desk:ReceptionDesk){
 const el=(id:string)=>document.getElementById(id)!,panel=el('linar-panel');
 let furniture=false;const selected=():LinarTarget=>furniture?'desk':linar.selected,settings=()=>furniture?desk.settings:linar.settings;
 const options=(items:readonly {id:string;label:string}[])=>items.map(o=>`<option value="${o.id}">${o.label}</option>`).join('');
 const select=(id:string,label:string,items:readonly {id:string;label:string}[])=>`<label id="${id}-row">${label}<select id="${id}">${options(items)}</select></label>`;
 const range=(id:string,label:string,min:number,max:number,step:number)=>`<label id="${id}-row">${label}<output id="${id}-value"></output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
 panel.setAttribute('aria-label','LINAR settings');el('linar-toggle').textContent='LINAR settings';
 panel.innerHTML=`<div class="linar-heading"><h2>dukta LINAR</h2><button id="linar-close" aria-label="Close LINAR settings">×</button></div><p>Select a panel in the room or choose an application.</p>
 ${select('linar-section','Section',[{id:'panels',label:'Panels'},{id:'furniture',label:'Furniture'}])}
 ${select('linar-application','Application',[{id:'wall',label:'Wall panels'},{id:'freestanding',label:'Freestanding divider'},{id:'ceiling',label:'Ceiling canopy'}])}<div id="linar-camera-views" class="linar-camera-views" role="group" aria-label="Wall panel views"><button id="linar-view-1" type="button" aria-pressed="true">View 1</button><button id="linar-view-2" type="button" aria-pressed="false">View 2</button></div><div class="linar-camera-actions"><button id="linar-focus">Focus selected</button><button id="linar-camera-unlock" type="button" aria-pressed="false">Unlock camera</button></div><small id="linar-camera-status" aria-live="polite"></small>
 <label id="linar-light-row" class="check"><input id="linar-light" type="checkbox"> Diffuse LED above canopy</label><small id="linar-light-note">Curved milky diffuser above the open cuts. Ambient lighting concept.</small>
 <label class="check"><input id="linar-enabled" type="checkbox"> Show this application</label>
 ${select('linar-finish','Base material',[{id:'birch',label:'Birch plywood'},{id:'spruce',label:'Three-layer spruce'},{id:'mdf',label:'MDF'}])}
 ${range('linar-thickness','Panel thickness',4,15,1)}${select('linar-veneer','Veneer',LINAR_VENEERS)}${select('linar-mdf-variant','MDF variant',[{id:'natural',label:'MDF Natural'},{id:'valchromat',label:'Valchromat'}])}${select('linar-colour','Colour',LINAR_MDF_COLOURS)}
 ${range('linar-bend','Bend · left / flat / right',-100,100,1)}${range('linar-scurve','S-curve progression',0,100,1)}<small id="linar-clearance" aria-live="polite"></small>
 ${select('linar-coverage','Wall coverage',[{id:'both',label:'Both sides of reception'},{id:'front',label:'Left wall area only'}])}
 ${range('linar-width','Width per wall area',1.2,2.6,.1)}${range('linar-panels','Modules · 1.2 m',1,4,1)}${range('linar-height','Height',1.2,3.6,.1)}${range('linar-curve','Maximum depth in this room',0,.7,.01)}${range('linar-incision','Incision length · regular 4/4',40,400,1)}
 ${select('linar-backing','Backing',LINAR_BACKINGS)}${select('linar-fleece-colour','Fleece colour',LINAR_FLEECE_COLOURS)}${select('linar-felt-colour','Felt colour',LINAR_FELT_COLOURS)}
 <div class="linar-actions"><button id="linar-reset">Reset selected</button><button id="linar-reset-all">Reset all</button></div><small>Colours are screen approximations from the existing configurator. Room dimensions and bend limits describe this visual concept; installation requires confirmation.</small>`;
 const bindings:Record<string,keyof LinarSettings>={'linar-enabled':'enabled','linar-finish':'finish','linar-veneer':'veneer','linar-mdf-variant':'mdfVariant','linar-colour':'colour','linar-bend':'bend','linar-scurve':'sCurve','linar-coverage':'coverage','linar-width':'width','linar-panels':'panels','linar-height':'height','linar-curve':'curve','linar-incision':'incision','linar-thickness':'thicknessMm','linar-backing':'backing','linar-fleece-colour':'fleeceColour','linar-felt-colour':'feltColour'};
 let activeRange=false,pending:{id:LinarTarget}|undefined,frame=0;
 const flush=()=>{if(frame)cancelAnimationFrame(frame);frame=0;if(pending){const id=pending.id;pending=undefined;if(id==='desk')desk.rebuild();else linar.rebuild(id);sync();}changed(true);};
 const schedule=(id:LinarTarget)=>{pending={id};if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!pending)return;const current=pending.id;pending=undefined;if(current==='desk')desk.rebuild();else linar.rebuild(current);sync();changed(!activeRange);});};
 panel.addEventListener('pointerdown',e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='range')activeRange=true;});
 const endDrag=()=>{if(!activeRange&&!pending)return;activeRange=false;flush();};
 document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);window.addEventListener('blur',endDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag();});
 panel.addEventListener('change',endDrag);
 const numeric=new Set(['bend','sCurve','width','panels','height','curve','incision','thicknessMm']);
 function sync(){const s=settings(),id=selected();(el('linar-section') as HTMLSelectElement).value=furniture?'furniture':'panels';
  const application=el('linar-application') as HTMLSelectElement,applicationOptions=furniture?[{id:'desk',label:'Reception desk'}]:[{id:'wall',label:'Wall panels'},{id:'freestanding',label:'Freestanding divider'},{id:'ceiling',label:'Ceiling canopy'}];if(application.options[0]?.value!==applicationOptions[0].id)application.innerHTML=options(applicationOptions);
  el('linar-camera-views').setAttribute('aria-label',furniture?'Reception desk views':'Panel views');
  el('linar-camera-views').hidden=camera.views(id)<2;el('linar-focus').hidden=camera.views(id)>1;
  for(let i=0;i<2;i++)el(`linar-view-${i+1}`).setAttribute('aria-pressed',String(camera.selectedView(id)===i));
  el('linar-camera-unlock').textContent=camera.unlocked?'Lock camera':'Unlock camera';el('linar-camera-unlock').setAttribute('aria-pressed',String(camera.unlocked));
  el('linar-camera-status').textContent=!camera.hasPreset(id)?'Camera is free for this application.':camera.unlocked?'Camera free. Settings keep your view.':`Camera locked to View ${camera.selectedView(id)+1} while editing.`;
 (el('linar-light') as HTMLInputElement).checked=linar.canopyLightEnabled;el('linar-light-row').hidden=id!=='ceiling';el('linar-light-note').hidden=id!=='ceiling';(el('linar-application') as HTMLSelectElement).value=id;
  for(const [name,key] of Object.entries(bindings)){const input=el(name) as HTMLInputElement;if(key==='enabled')input.checked=s.enabled;else input.value=String(s[key]);const out=document.getElementById(`${name}-value`);if(out)out.textContent=key==='curve'?`${Math.round(s.curve*100)} cm`:key==='width'||key==='height'?`${Number(s[key]).toFixed(1)} m`:key==='incision'?`${s.incision} mm`:key==='thicknessMm'?`${s.thicknessMm} mm`:key==='bend'?`${Math.round(s.bend)}`:key==='sCurve'?`${Math.round(s.sCurve)}%`:String(s[key]);}
  for(const field of ['bend','scurve','height','curve','backing'])el(`linar-${field}-row`).hidden=false;
  if(id==='ceiling')el('linar-backing-row').hidden=true;
  el('linar-coverage-row').hidden=id!=='wall';el('linar-width-row').hidden=id!=='wall';el('linar-panels-row').hidden=id==='wall';el('linar-mdf-variant-row').hidden=s.finish!=='mdf';el('linar-colour-row').hidden=s.finish!=='mdf'||s.mdfVariant!=='valchromat'||s.veneer!=='none';el('linar-fleece-colour-row').hidden=s.backing!=='acoustic-fleece';el('linar-felt-colour-row').hidden=s.backing!=='felt';
  const height=el('linar-height') as HTMLInputElement;height.min=id==='wall'?'1.5':'1.2';height.max=id==='wall'?'3.6':id==='freestanding'?'2.8':'2.8';height.parentElement!.firstChild!.textContent=id==='ceiling'?'Canopy depth ':'Height ';(el('linar-curve') as HTMLInputElement).max=id==='wall'?'.2':id==='freestanding'?'.7':'.45';
  for(const field of ['bend','scurve','width','panels','height','curve','backing','fleece-colour','felt-colour']){const row=el(`linar-${field}-row`);if(furniture)row.hidden=true;}
  if(furniture){el('linar-clearance').textContent='Front and sides - matte charcoal backing - 3 mm air gap.';return;}
  const shape=linar.inspect().applications[id as Application].shape;el('linar-clearance').textContent=shape.roomLimited?'Bend is limited to keep this installation clear of the room.':s.bend===0?'Flat. Move the bend slider to see the C/S shape.':'Room clearance preserved.';
 }
 for(const [name,key] of Object.entries(bindings))el(name).addEventListener('input',()=>{camera.edit(selected());const input=el(name) as HTMLInputElement;(settings() as unknown as Record<string,unknown>)[key]=key==='enabled'?input.checked:numeric.has(key)?Number(input.value):input.value;if(key==='panels')linar.settings.width=linar.settings.panels*1.2;if(activeRange){schedule(selected());const out=document.getElementById(`${name}-value`);if(out)out.textContent=input.value;}else{if(furniture)desk.rebuild();else linar.rebuild();sync();changed(true);}});
 const selectApplication=(id:LinarTarget,open=true,focus=true)=>{if(pending)flush();furniture=id==='desk';if(id!=='desk')linar.selected=id;if(open){panel.hidden=false;el('help-panel').hidden=true;el('help').setAttribute('aria-expanded','false');el('linar-toggle').setAttribute('aria-expanded','true');}if(focus)camera.enter(id,!panel.hidden);else camera.context(id,!panel.hidden);sync();};
 el('linar-section').addEventListener('change',e=>selectApplication((e.target as HTMLSelectElement).value==='furniture'?'desk':linar.selected));
 el('linar-application').addEventListener('change',e=>selectApplication((e.target as HTMLSelectElement).value as LinarTarget));
 el('linar-light').addEventListener('change',()=>{camera.edit(selected());linar.setCanopyLight((el('linar-light') as HTMLInputElement).checked);changed();});
 el('linar-reset').onclick=()=>{if(pending)flush();camera.edit(selected());if(furniture)desk.reset();else linar.reset();sync();changed();};el('linar-reset-all').onclick=()=>{if(pending)flush();camera.edit(selected());linar.reset(true);desk.reset();sync();changed();};el('linar-focus').onclick=()=>focus(selected());
 el('linar-camera-unlock').onclick=()=>{camera.context(selected(),!panel.hidden);camera.setUnlocked(!camera.unlocked);sync();};
 for(let i=0;i<2;i++)el(`linar-view-${i+1}`).onclick=()=>{camera.choose(selected(),i);sync();};
 el('linar-close').onclick=()=>{camera.context(selected(),false);panel.hidden=true;el('linar-toggle').setAttribute('aria-expanded','false');};el('linar-toggle').onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden){el('help-panel').hidden=true;el('help').setAttribute('aria-expanded','false');}el('linar-toggle').setAttribute('aria-expanded',String(!panel.hidden));camera.context(selected(),!panel.hidden);sync();};sync();return{selectApplication,sync,flush,selected,isPending:()=>!!pending};
}
