import {createIntroduction} from './intro.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadModel} from './assets.js';
import {createLighting,selectedProfile} from './lighting.js';
import {createReflections} from './reflections.js';
import {createBackdrop} from './background.js';
const host=document.querySelector('#view'),status=document.querySelector('#status');
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(max-width:800px)').matches?1:1.25));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive Stradivari cable cutaway');
const lightRig=createLighting(scene,renderer);
const backdrop=createBackdrop(scene,renderer,requestRender);
// Millimetre scene: keep sufficient depth precision for the 0.002 mm clearances.
const heroCamera=new THREE.PerspectiveCamera(20,1,10,2000);
const technicalCamera=new THREE.OrthographicCamera(-85,85,60,-60,.1,2000);
let camera=heroCamera,mode='hero',model,meshes=[],frames=0,ready=false,queued=0,dirty=true,renderTimes=[];
let lodLevel='overview';
const detailFrustum=new THREE.Frustum(),detailMatrix=new THREE.Matrix4(),detailBox=new THREE.Box3();
const lodKey=m=>m.name.slice(0,2)+(m.name.startsWith('03')?(m.name.includes('WHITE')?'A':'B'):'');
const detailFiles={'03A':'detail-1.bin','03B':'detail-2.bin','07':'detail-3.bin','09':'detail-4.bin'};
const detailLoads=new Map(),detailReady=new Set();
// Coarse inner bundles stay readable until individual wires have enough screen pixels.
const innerDetailDemand=new Map(),screenCenter=new THREE.Vector3(),screenEdge=new THREE.Vector3(),screenUp=new THREE.Vector3();
function innerDetailVisible(m,key){
 const height=renderer.domElement.clientHeight;screenCenter.set(.044,0,0).applyMatrix4(m.matrixWorld);
 screenUp.set(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(1.55);
 screenEdge.copy(screenCenter).add(screenUp).project(camera);screenCenter.project(camera);
 const diameterPx=screenCenter.distanceTo(screenEdge)*height;
 const enabled=diameterPx>(innerDetailDemand.get(key)?72:88);innerDetailDemand.set(key,enabled);return enabled;
}
let detailPending=0;
async function ensureDetail(key){
 if(detailLoads.has(key))return detailLoads.get(key);
 detailPending++;document.querySelector('#detail-status').textContent='Loading fine braid detail…';
 const task=loadModel(detailFiles[key]).then(gltf=>{
  const materials=new Map(meshes.map(m=>[m.material.name,m.material]));
  gltf.scene.scale.setScalar(1000);scene.add(gltf.scene);
  gltf.scene.traverse(o=>{if(!o.isMesh)return;o.visible=false;if(o.morphTargetInfluences)o.morphTargetInfluences[0]=mode==='hero'?1:0;
   const old=o.material,reused=materials.get(old.name);if(reused){o.material=reused;for(const v of Object.values(old))if(v?.isTexture)v.dispose();old.dispose();}meshes.push(o);});
  detailReady.add(key);reflections.refresh();requestRender();
 }).catch(()=>{document.querySelector('#detail-status').textContent='Fine detail could not load. The overview remains available.';});
 detailLoads.set(key,task);await task;detailPending--;if(!detailPending&&detailReady.size===detailLoads.size)document.querySelector('#detail-status').textContent='';
}
function updateDetail(){
 const detail=mode!=='section'&&(camera.isOrthographicCamera?camera.zoom>2:camera.position.distanceTo(controls.target)/camera.zoom<240);
 lodLevel=detail?'closeup':'overview';
 scene.updateMatrixWorld(true);camera.updateMatrixWorld();detailFrustum.setFromProjectionMatrix(detailMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const active=new Map();
 for(const m of meshes){if(m.userData.lod_role!=='overview')continue;if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();detailBox.copy(m.geometry.boundingBox);const prefix=m.name.slice(0,2);if(prefix==='03'){detailBox.min.x=.0375;detailBox.max.x=.050}else if(prefix==='07'){detailBox.min.x=-.0045;detailBox.max.x=.011}detailBox.applyMatrix4(m.matrixWorld);const toggle=document.querySelector('#layers input[data-group="'+prefix+'"]');const key=lodKey(m),wanted=detail&&(prefix!=='03'||innerDetailVisible(m,key))&&(toggle?.checked??true)&&detailFrustum.intersectsBox(detailBox);if(wanted)ensureDetail(key);active.set(key,wanted&&detailReady.has(key));}
 for(const m of meshes){if(!m.userData.lod_role)continue;const toggle=document.querySelector('#layers input[data-group="'+m.name.slice(0,2)+'"]');m.visible=(toggle?.checked??true)&&m.userData.lod_role===(active.get(lodKey(m))?'closeup':'overview');}
}

const reflections=createReflections(renderer,scene,()=>camera,()=>meshes);
let measureCompletion=false,completedTimes=[];
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=50;controls.maxDistance=1200;controls.minZoom=.4;controls.maxZoom=15;

// Soft, local contact shadow. No recurring shadow-map pass or directional cast.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=1024;shadowCanvas.height=256;
const shadowTexture=new THREE.CanvasTexture(shadowCanvas);shadowTexture.colorSpace=THREE.SRGBColorSpace;
const shadow=new THREE.Mesh(new THREE.PlaneGeometry(180,44),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.65,depthWrite:false}));
shadow.rotation.x=-Math.PI/2;shadow.position.set(2.5,-7.65,0);scene.add(shadow);
function updateShadow(){const c=shadowCanvas.getContext('2d');c.clearRect(0,0,1024,256);
 for(let x=-65;x<70;x+=1.5){const bend=mode==='hero'&&x< -18?160*(1-Math.cos((x+18)/160)):0;const xx=mode==='hero'&&x< -18?-18+160*Math.sin((x+18)/160):x;const z=-bend*Math.cos(55*Math.PI/180);const bulk=x< -3;const spread=bulk?3.3+bend*.22:4.2;const opacity=bulk?.055:.012;
 c.save();c.translate((xx+87.5)/180*1024,(22-z)/44*256);c.scale(3.5/180*1024,spread/44*256);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(0,0,0,${opacity})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore()}
 shadowTexture.needsUpdate=true;
}
function requestRender(){dirty=true;if(document.visibilityState!=='visible'||queued)return;queued=requestAnimationFrame(()=>{queued=0;if(document.visibilityState!=='visible')return;camera.near=Math.max(.1,camera.position.length()-100);camera.far=camera.isPerspectiveCamera?Math.max(2000,camera.position.length()+200):camera.position.length()+200;camera.updateProjectionMatrix();updateDetail();const start=performance.now();backdrop.prepare(camera);reflections.draw(camera,mode);if(measureCompletion){renderer.getContext().finish();completedTimes.push(performance.now()-start)}renderTimes.push(performance.now()-start);if(renderTimes.length>100)renderTimes.shift();frames++;dirty=false})}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){if(queued)cancelAnimationFrame(queued);queued=0}else if(dirty)requestRender()});
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);reflections.resize();const aspect=w/h;heroCamera.aspect=aspect;heroCamera.fov=THREE.MathUtils.radToDeg(2*Math.atan(36/(2*100*aspect)));heroCamera.updateProjectionMatrix();technicalCamera.left=-85;technicalCamera.right=85;technicalCamera.top=85/aspect;technicalCamera.bottom=-85/aspect;technicalCamera.updateProjectionMatrix();requestRender()}
function morph(value){for(const m of meshes)if(m.morphTargetInfluences)m.morphTargetInfluences[0]=value}
function setMode(next){mode=next;camera=next==='hero'?heroCamera:technicalCamera;controls.object=camera;
 morph(next==='hero'?1:0);camera.up.set(0,1,0);camera.zoom=1;
 if(next==='section'){camera.position.set(-180,0,0);controls.target.set(-65,0,0);camera.zoom=Math.min((camera.right-camera.left)/20,(camera.top-camera.bottom)/20)}
 else if(next==='hero'){camera.position.set(195,225,370);controls.target.set(2.5,1,0)}
 else{camera.position.set(110,125,210);controls.target.set(2.5,0,0)}
 camera.updateProjectionMatrix();controls.update();updateShadow();shadow.visible=next!=='section';
 for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===next));
 document.querySelector('#mode-note').textContent=next==='hero'?'Presentation curve only — no product bend-radius claim.':next==='section'?'True circular section of the straight reference geometry.':'Straight reference geometry — specified diameters preserved.';
 requestRender();
}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
document.querySelector('#reset').onclick=()=>setMode(mode);
document.querySelector('#all').onclick=()=>{for(const m of meshes)m.visible=true;for(const c of document.querySelectorAll('#layers input'))c.checked=true;requestRender()};
const groups=[['01','OCC copper','Ø2.1 mm · two conductors'],['02','Primary insulation — PTFE','Ø2.9 mm · white / light grey'],['10','Inner tinned foil','Under inner braid'],['03','Inner shield braid','Ø3.1 mm · tinned copper'],['04','Secondary insulation — PE','Ø4.2 mm · white / light grey'],['05','Two PE fillers','Ø2.9 mm · white'],['06','Common shielding foil','Ø8.9 mm · tinned copper'],['07','Outer shield braid','Ø9.2 mm · tinned copper'],['08','PE jacket','Ø13.4 mm · dark navy'],['09','PET textile braid','Ø14.6 mm · dark navy fibres']];
for(const [prefix,title,detail] of groups){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.disabled=true;input.dataset.group=prefix;input.setAttribute('aria-label',title);const span=document.createElement('span');span.textContent=title;const small=document.createElement('small');small.textContent=detail;span.append(small);label.append(input,span);document.querySelector('#layers').append(label);input.onchange=()=>{for(const m of meshes)if(m.name.startsWith(prefix))m.visible=input.checked;requestRender()}}
controls.addEventListener('change',requestRender);window.addEventListener('resize',resize);resize();setMode('hero');
window.__cable={requestRender,snapshot:()=>({ready,mode,lodLevel,detailReady:[...detailReady],detailPending,background:backdrop.snapshot(),reflections:reflections.snapshot(),completedFrameMs:completedTimes.slice(),lighting:lightRig.snapshot(),threeRevision:THREE.REVISION,logicalParts:16,meshCount:meshes.length,visibleCount:meshes.filter(m=>m.visible).length,visibleByGroup:Object.fromEntries(groups.map(([prefix])=>[prefix,meshes.filter(m=>m.visible&&m.name.startsWith(prefix)).length])),frames,queued,visibility:document.visibilityState,camera:camera.position.toArray(),cameraType:camera.type,zoom:camera.zoom,morphWeights:[...new Set(meshes.map(m=>m.morphTargetInfluences?.[0]))],materials:[...new Set(meshes.map(m=>m.material.name))],texturedMaterials:meshes.filter(m=>m.material.normalMap&&m.material.roughnessMap).length,environmentLoaded:!!scene.environment,triangles:meshes.filter(m=>m.visible).reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),drawCalls:renderer.info.render.calls,gpuGeometries:renderer.info.memory.geometries,gpuTextures:renderer.info.memory.textures,renderSubmissionMs:renderTimes.slice(),pixelRatio:renderer.getPixelRatio()})};
async function setReflections(value){await reflections.set(value);requestRender()}
window.__reflectionStudy={set:setReflections,measure:value=>{measureCompletion=value;completedTimes=[]},opacity:value=>{reflections.setOpacity(value);requestRender()}};
window.__inspection={focus:(part)=>{setMode('technical');const specs={all:[2.5,170,32],plastic:[54,20,10],metal:[3,24,18],pet:[-42,46,22],copper:[65,18,10],jacket:[-14,29,18]};const [x,width,height]=specs[part]||specs.all;controls.target.set(x,0,0);camera.position.set(x+110,125,210);camera.zoom=Math.min(170/width,(camera.top-camera.bottom)/height);controls.maxZoom=70;camera.updateProjectionMatrix();controls.update();requestRender()},zoom:(factor)=>{camera.zoom=Math.max(.4,Math.min(70,camera.zoom*factor));camera.updateProjectionMatrix();requestRender()},meshes:()=>meshes};
window.__backgroundStudy={set:backdrop.use,adjust:backdrop.adjust};
window.__lightingStudy={set:async(name)=>{await lightRig.use(name);requestRender()},reset:()=>setMode('hero')};
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;if(queued)cancelAnimationFrame(queued);queued=0;document.querySelector('#loading').style.display='grid';status.textContent='The 3D view was interrupted. The render remains available.';document.querySelector('#retry').hidden=false;});
try{
 const [gltf]=await Promise.all([loadModel('overview.bin',percent=>{status.textContent=percent!==null?`Loading 3D model. ${percent}%`:'Loading 3D model.';}),lightRig.use(selectedProfile),backdrop.use('studio')]);
 model=gltf.scene;model.scale.setScalar(1000);scene.add(model);model.traverse(o=>{if(o.isMesh)meshes.push(o)});
 resize();setMode('hero');const reflectionsReady=new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(async()=>{await setReflections(true);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 ready=true;document.querySelector('#jacket-detail').onclick=()=>window.__inspection.focus('jacket');document.querySelector('#tip-detail').onclick=()=>window.__inspection.focus('copper');const initialFocus=new URLSearchParams(location.search).get('focus');if(['copper','jacket'].includes(initialFocus))window.__inspection.focus(initialFocus);document.querySelector('#loading').style.display='none';for(const c of document.querySelectorAll('#layers input'))c.disabled=false;document.querySelector('#ready').textContent='30 strands/conductor · 10 layer groups';requestRender();
 const introduction=createIntroduction({host,canvas:renderer.domElement,controls,getCamera:()=>camera,render:requestRender,prepare:async(index)=>{await reflectionsReady;const required=[[],['09'],[],[],[],['07','09']][index]||[];await Promise.all(required.map(ensureDetail));}});window.__cableTour=introduction;
}catch(error){status.textContent='The model could not be loaded. The render remains available.';document.querySelector('#retry').hidden=false;console.warn('Cable model could not load:',error.message);}
