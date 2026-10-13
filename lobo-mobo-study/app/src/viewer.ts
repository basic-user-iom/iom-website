import { DepthOfField } from './depth-of-field';
import { Moonlight } from './moonlight';
import { createFloorReflection } from './floor-reflection';
import { createWindowReflection } from './window-reflection';
import { createTileEnvironment } from './tile-environment';
import { CabinetLight } from './cabinet-light';
import { CordTextile } from './cord-textile';
import { ENABLE_ROOM_INSPECTION } from './features';
import { RoomInspection, type InspectionAction } from './room-inspection';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { applyFinish, type ExportedFinish, type StudyState } from './materials';

export type CameraAction = 'left'|'right'|'up'|'down'|'in'|'out'|'reset';
export type ViewMode = 'room'|'lamp';
type RoomConfig = {camera:{position:number[];target:number[];fov:number;shiftY?:number};lamps:{position:number[];scale:number}[];table?:{minX:number;maxX:number;minZ:number;maxZ:number;top:number}};
export class StudyViewer {
  private renderer:THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private roomScene = new THREE.Scene();
  private floorReflection?:ReturnType<typeof createFloorReflection>;
  private windowReflection?:ReturnType<typeof createWindowReflection>;
  private tileEnvironment?:THREE.WebGLRenderTarget;
  private tileMaterials:THREE.MeshStandardMaterial[]=[];
  private cabinetLight?:CabinetLight;
  private cordTextile?:CordTextile;
  private roomCamera = new THREE.PerspectiveCamera(32,1,.05,60);
  private roomLamps:THREE.Group[] = [];
  private roomLights:THREE.SpotLight[] = [];
  private pendantReflections:THREE.RectAreaLight[] = [];
  private roomGlowMaterials:THREE.MeshStandardMaterial[] = [];
  private daylight = 1;
  private moonlight:Moonlight;
  private lampLevel = 1;
  private lampBrightness = .7;
  private currentLit = false;
  private roomFill = new THREE.HemisphereLight('#fff8eb','#bab1a1',.85);
  private inspection?:RoomInspection;
  private inspectRequested=false;
  private mode:ViewMode = 'room';
  private roomConfig?:RoomConfig;
  private roomEnvironment?:THREE.WebGLRenderTarget;
  private panorama?:THREE.Texture;
  private environmentSettings?:{rotationY:number;backgroundIntensity:number;environmentIntensity:number;sunDirection:number[];sunIntensity:number;asset:string};
  private camera = new THREE.OrthographicCamera(-1,1,1,-1,.05,40);
  private controls:OrbitControls;
  private exterior?:THREE.MeshPhysicalMaterial;
  private materials = new Map<string,THREE.MeshStandardMaterial>();
  private lamp?:THREE.Group;
  private light = new THREE.SpotLight('#ffd6a0', 0, 3, .9, 1, 2);
  private observer:ResizeObserver;
  private environment:THREE.WebGLRenderTarget;
  private frame = 0;
  private dead = false;
  private ready = false;
  private renders = 0;
  private dof:DepthOfField;private dofEnabled=true;
  private startPosition = new THREE.Vector3(2.2,1.05,8);
  private target = new THREE.Vector3(0,.12,0);
  constructor(private host:HTMLElement, private onFailure:(message:string)=>void) {
    RectAreaLightUniformsLib.init();
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    this.dof=new DepthOfField(this.renderer);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.background = new THREE.Color('#e8e2d8');
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Interactive MOBO concept. Arrow keys rotate; plus and minus zoom; Home resets.');
    canvas.setAttribute('aria-describedby','view-help');
    canvas.addEventListener('keydown',this.onKey);
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    this.host.append(canvas);
    this.camera.position.copy(this.startPosition);
    this.controls = new OrbitControls(this.camera,canvas);
    this.controls.target.copy(this.target);
    this.controls.enablePan = false;
    this.controls.enabled = false;
    this.controls.enableDamping = false;
    this.controls.autoRotate = false;
    this.controls.minPolarAngle = 1.2;
    this.controls.maxPolarAngle = 1.49;
    this.controls.minAzimuthAngle = -.8;
    this.controls.maxAzimuthAngle = .95;
    this.controls.minZoom = .85;
    this.controls.maxZoom = 1.25;
    this.controls.rotateSpeed = .55;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.controls.update();
    this.controls.saveState();
    this.controls.addEventListener('change',this.invalidate);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new THREE.Scene();
    room.background = new THREE.Color().setRGB(.18,.18,.18);
    for (const [x,y,z,strength] of [[-3,3,4,5],[4,2,3,3],[-1,5,-3,2]]) {
      const softbox = new THREE.Mesh(new THREE.SphereGeometry(1,24,16), new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(strength,strength,strength)}));
      softbox.position.set(x,y,z); softbox.scale.set(1.1,1.5,1); room.add(softbox);
    }
    this.environment = pmrem.fromScene(room,.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .65;
    this.roomScene.background = new THREE.Color('#dfdfcf');
    this.roomScene.environment = this.environment.texture;
    this.roomScene.environmentIntensity = .48;
    this.roomFill.name='Room_Daylight_Fill';this.roomScene.add(this.roomFill);
    const sun = new THREE.DirectionalLight('#ffe3b6',3.0);
    sun.name='Room_Sun';
    sun.position.set(-4,3.4,2);sun.target.position.set(0,1,-.5);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});
    sun.shadow.bias=-.00004;sun.shadow.normalBias=.002;sun.shadow.radius=2;
    this.roomScene.add(sun,sun.target);
    this.moonlight=new Moonlight(this.roomScene);
    this.disposeObject(room); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#fff8ec','#a49c90',.65));
    const key = new THREE.DirectionalLight('#fff5e5',1.1); key.position.set(-3,4,5); this.scene.add(key);
    const fill = new THREE.DirectionalLight('#ffffff',.4); fill.position.set(4,2,1); this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#e8e2d8',roughness:1,metalness:0}));
    floor.rotation.x = -Math.PI/2; floor.position.y = -.78; this.scene.add(floor);
    // Soft contact cue, purely illustrative; no baked photographic artwork.
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const context = shadowCanvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(67,54,36,.24)'); gradient.addColorStop(.35,'rgba(67,54,36,.12)'); gradient.addColorStop(1,'rgba(67,54,36,0)');
    context.fillStyle = gradient; context.fillRect(0,0,128,128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
    shadow.rotation.x = -Math.PI/2; shadow.position.y = -.778; this.scene.add(shadow);
    this.scene.add(this.light,this.light.target);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(host);
    document.addEventListener('visibilitychange',this.onVisibility);
    this.resize();
  }
  async load(data:ExportedFinish[]) {
    const gltf = await new GLTFLoader().loadAsync('./assets/mobo-study.glb');
    if (this.dead) { this.disposeObject(gltf.scene); return; }
    this.lamp = gltf.scene;
    for (const name of ['MOBO_Ceramic','MOBO_Cord','MOBO_CordGrip','MOBO_Bulb','Light_Origin']) if (!this.lamp.getObjectByName(name)) throw new Error('Model does not match the reviewed contract.');
    this.lamp.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) this.materials.set(material.name,material);
    });
    const exterior = this.materials.get('Ceramic_Exterior');
    if (!(exterior instanceof THREE.MeshPhysicalMaterial) || !exterior.normalMap) throw new Error('Reviewed ceramic material is missing.');
    this.exterior = exterior;
    this.cordTextile=await CordTextile.create(this.lamp);
    applyFinish(exterior,data[0]);
    this.scene.add(this.lamp); this.lamp.updateMatrixWorld(true);
    this.lamp.getObjectByName('Light_Origin')!.getWorldPosition(this.light.position);
    if (this.light.position.distanceTo(new THREE.Vector3(0,-.44915664196014404,0)) > .00001) throw new Error('Unexpected light origin.');
    this.light.target.position.copy(this.light.position).add(new THREE.Vector3(0,-1,0));
    const [room,configResponse] = await Promise.all([new GLTFLoader().loadAsync('./room/room-stage.glb'),fetch('./room/room-config.json')]);
    if(this.dead) {this.disposeObject(room.scene);return;}
    if(!configResponse.ok) throw new Error('Room camera data unavailable.');
    const config:RoomConfig=await configResponse.json();
    if(this.dead) {this.disposeObject(room.scene);return;}
    if(config.lamps.length!==2 || !config.camera.position.every(Number.isFinite)) throw new Error('Invalid room configuration.');
    this.roomConfig=config;
    const [panorama,hdr,environmentResponse]=await Promise.all([
      new THREE.TextureLoader().loadAsync('./room/day108-panorama-2k.jpg'),
      new EXRLoader().loadAsync('./room/day108-lighting-1k.exr'),
      fetch('./room/environment-config.json')
    ]);
    if(this.dead){panorama.dispose();hdr.dispose();this.disposeObject(room.scene);return;}
    if(!environmentResponse.ok){panorama.dispose();hdr.dispose();throw new Error('Room environment settings unavailable.');}
    const environmentSettings=await environmentResponse.json();
    if(this.dead){panorama.dispose();hdr.dispose();this.disposeObject(room.scene);return;}
    this.environmentSettings=environmentSettings;
    panorama.colorSpace=THREE.SRGBColorSpace;panorama.mapping=THREE.EquirectangularReflectionMapping;
    this.panorama=panorama;this.roomScene.background=panorama;
    this.roomScene.backgroundRotation.y=environmentSettings.rotationY;
    this.roomScene.backgroundIntensity=environmentSettings.backgroundIntensity;
    hdr.mapping=THREE.EquirectangularReflectionMapping;
    const roomPMREM=new THREE.PMREMGenerator(this.renderer);
    this.tileEnvironment=createTileEnvironment(this.renderer,hdr);this.roomEnvironment=roomPMREM.fromEquirectangular(hdr);roomPMREM.dispose();hdr.dispose();
    this.roomScene.environment=this.roomEnvironment.texture;
    this.roomScene.environmentRotation.y=environmentSettings.rotationY;
    this.roomScene.environmentIntensity=environmentSettings.environmentIntensity;
    const roomSun=this.roomScene.getObjectByName('Room_Sun') as THREE.DirectionalLight;
    roomSun.target.position.set(0,1,0);
    roomSun.position.fromArray(environmentSettings.sunDirection).multiplyScalar(9).add(roomSun.target.position);
    roomSun.intensity=environmentSettings.sunIntensity;
    room.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=!materials.some(m=>/Soft sky|Foliage|Window clear glazing|gray brown stone floor/.test(m.name));}});
    room.scene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m instanceof THREE.MeshStandardMaterial&&(m.name==='PBR | ambientCG Tiles036 | glazed backsplash'||m.name==='PBR | warm mineral plaster | ceiling')){m.envMap=this.tileEnvironment!.texture;m.envMapRotation.y=environmentSettings.rotationY;m.envMapIntensity=environmentSettings.environmentIntensity;this.tileMaterials.push(m);}});
    this.roomScene.add(room.scene);
    this.cordTextile.attachRoomExtensions(room.scene);
    this.cabinetLight=new CabinetLight(this.roomScene,room.scene);
    this.floorReflection=createFloorReflection();this.roomScene.add(this.floorReflection);this.windowReflection=createWindowReflection();this.roomScene.add(this.windowReflection);
    this.roomCamera.position.fromArray(config.camera.position);
    this.roomCamera.lookAt(new THREE.Vector3().fromArray(config.camera.target));
    for(const placement of config.lamps) {
      const lamp=this.lamp.clone(true);lamp.position.fromArray(placement.position);lamp.scale.setScalar(placement.scale);
      lamp.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      lamp.traverse(o=>{if(o instanceof THREE.Mesh){const original=Array.isArray(o.material)?o.material:[o.material];const adjusted=original.map(m=>{if(m instanceof THREE.MeshStandardMaterial&&/Ceramic_Interior|Bulb_Illustrative/.test(m.name)){const glow=m.clone();glow.emissive.set('#ffcf94');glow.emissiveIntensity=0;this.roomGlowMaterials.push(glow);return glow;}return m;});o.material=Array.isArray(o.material)?adjusted:adjusted[0];}});
      this.roomScene.add(lamp);this.roomLamps.push(lamp);lamp.updateMatrixWorld(true);
      const pool=new THREE.SpotLight('#ffcd85',0,7,1.0,.7,2);
      pool.name=`Pendant_${this.roomLights.length+1}_Light`;pool.castShadow=true;pool.shadow.mapSize.set(1024,1024);
      pool.shadow.camera.near=.015;pool.shadow.bias=-.00008;pool.shadow.normalBias=.002;
      lamp.getObjectByName('Light_Origin')!.getWorldPosition(pool.position);
      // Place the effective emitter just below the opening, so the unchanged shell cannot occlude its own beam.
      const shellBounds=new THREE.Box3().setFromObject(lamp.getObjectByName('MOBO_Ceramic')!);
      pool.position.y=shellBounds.min.y-.012;
      pool.target.position.set(pool.position.x,config.table?.top??1.02,pool.position.z);
      this.roomScene.add(pool,pool.target);this.roomLights.push(pool);
      // Approximate the first reflection from the lit stone. This is pendant-derived,
      // not ambient fill: it uses the same dimmer and becomes exactly zero when off.
      const reflection=new THREE.RectAreaLight('#ffd4a2',0,.75,.6);
      reflection.name=`Pendant_${this.roomLights.length}_Table_Reflection`;
      reflection.position.set(pool.position.x,(config.table?.top??1.02)+.025,pool.position.z);
      reflection.lookAt(reflection.position.clone().add(new THREE.Vector3(0,1,0)));
      this.roomScene.add(reflection);this.pendantReflections.push(reflection);
    }
    if(ENABLE_ROOM_INSPECTION)this.inspection=new RoomInspection(this.roomCamera,this.renderer.domElement,this.invalidate);
    this.resize();
    this.ready = true;
  }
  setMode(mode:ViewMode) {
    if(this.dead)return;
    this.mode=mode;this.controls.enabled=mode==='lamp';
    this.inspection?.setEnabled(mode==='room'&&this.inspectRequested);
    this.renderer.domElement.style.touchAction=mode==='room'&&!this.inspectRequested?'pan-y':'none';
    this.renderer.domElement.style.cursor=mode==='room'&&!this.inspectRequested?'default':'grab';
    this.resize();this.invalidate();
  }
  setInspection(enabled:boolean) {
    this.inspectRequested=ENABLE_ROOM_INSPECTION&&enabled;
    this.inspection?.setEnabled(this.mode==='room'&&this.inspectRequested);
    this.renderer.domElement.style.touchAction=this.mode==='lamp'||this.inspectRequested?'none':'pan-y';
    this.renderer.domElement.style.cursor=this.mode==='lamp'||this.inspectRequested?'grab':'default';
    if(!this.inspectRequested)this.inspection?.reset();
    this.invalidate();
  }
  inspectMove(action:InspectionAction){this.inspection?.action(action);}
  apply(state:StudyState,data:ExportedFinish[]) {
    if (!this.exterior || this.dead) return;
    applyFinish(this.exterior,data.find(f => f.id === state.finish)!);
    this.cordTextile?.apply(state.finish);
    this.currentLit=state.lit;this.updateLighting();
    this.renderer.domElement.setAttribute('aria-label',`${data.find(f=>f.id===state.finish)!.label}, Light ${state.lit?'on':'off'}. ${this.mode==='room'?(this.inspectRequested?'Free fly. Drag to look; WASD or arrows fly; Q down and E up; wheel or pinch zoom; Home resets; Escape exits.':'MOBO in a modelled kitchen. Fixed camera.'):'Interactive MOBO concept. Arrow keys rotate; plus and minus zoom; Home resets.'}`);
    this.invalidate();
  }
  setLighting(progress:number,brightness:number,lampLevel:number) {
    const t=THREE.MathUtils.clamp(progress,0,1);
    this.daylight=1-t*t*(3-2*t);
    const previousMoon=this.moonlight.light.intensity;this.moonlight.setProgress(t);
    if(previousMoon===0&&this.moonlight.light.intensity>0)this.renderer.shadowMap.needsUpdate=true;
    this.lampBrightness=THREE.MathUtils.clamp(brightness,0,1);
    this.lampLevel=THREE.MathUtils.clamp(lampLevel,0,1);
    this.updateLighting();this.invalidate();
  }
  setCabinetLight(enabled:boolean,brightness:number) {
    this.cabinetLight?.set(enabled,brightness);
    // This shadowless area light changes radiance only; cached geometry shadows stay valid.
    this.invalidate();
  }
  private updateLighting() {
    const power=this.currentLit?this.lampLevel*this.lampBrightness:0;
    if(power>0&&this.roomLights.some(l=>l.intensity===0))this.renderer.shadowMap.needsUpdate=true;
    this.light.intensity=1.1*power;
    this.roomLights.forEach(l=>l.intensity=9*power);
    this.pendantReflections.forEach(l=>l.intensity=2.8*power);
    this.roomGlowMaterials.forEach(m=>m.emissiveIntensity=.65*power);
    const sun=this.roomScene.getObjectByName('Room_Sun') as THREE.DirectionalLight;
    if(this.daylight>0&&sun.intensity===0)this.renderer.shadowMap.needsUpdate=true;
    sun.intensity=(this.environmentSettings?.sunIntensity??3)*this.daylight;
    this.roomFill.intensity=.85*this.daylight;
    this.roomScene.environmentIntensity=(this.environmentSettings?.environmentIntensity??1.5)*this.daylight;this.tileMaterials.forEach(m=>m.envMapIntensity=this.roomScene.environmentIntensity*(m.name.includes("warm mineral plaster")?2.2:1));
    this.roomScene.backgroundIntensity=(this.environmentSettings?.backgroundIntensity??1)*this.daylight;
    // Exposure remains fixed; at full night all daylight terms are exactly zero.
  }
  setDepthOfField(enabled:boolean){this.dofEnabled=enabled;this.invalidate();}
  captureCameras(){return{lampPosition:this.camera.position.toArray(),lampTarget:this.controls.target.toArray(),lampZoom:this.camera.zoom,roomPosition:this.roomCamera.position.toArray(),roomQuaternion:this.roomCamera.quaternion.toArray(),roomZoom:this.roomCamera.zoom};}
  restoreCameras(s:ReturnType<StudyViewer['captureCameras']>){this.camera.position.fromArray(s.lampPosition);this.controls.target.fromArray(s.lampTarget);this.camera.zoom=s.lampZoom;this.camera.updateProjectionMatrix();this.controls.update();this.roomCamera.position.fromArray(s.roomPosition);this.roomCamera.quaternion.fromArray(s.roomQuaternion);this.roomCamera.zoom=s.roomZoom;this.roomCamera.updateProjectionMatrix();this.roomCamera.updateMatrixWorld();this.inspection?.syncPose();this.invalidate();}
  tourCamera(amount:number){if(this.mode==='room'){const p=this.roomConfig!.camera.position;this.roomCamera.position.set(p[0]+amount*.13,p[1]+amount*.025,p[2]);this.roomCamera.lookAt(new THREE.Vector3().fromArray(this.roomConfig!.camera.target));this.roomCamera.updateMatrixWorld();}else{const offset=this.startPosition.clone().sub(this.target),s=new THREE.Spherical().setFromVector3(offset);s.theta+=amount*.22;this.camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(s));this.controls.update();}this.invalidate();}
  move(action:CameraAction) {
    if (!this.ready || this.dead) return;
    if(this.mode==='room') {if(action==='reset'){this.inspection?.reset();this.resize();}return;}
    if (action === 'reset') this.controls.reset();
    else if (action === 'in' || action === 'out') { this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * (action === 'in'?1.1:1/1.1),.85,1.25); this.camera.updateProjectionMatrix(); }
    else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += action==='left'?-.12:action==='right'?.12:0;
      spherical.phi += action==='up'?-.04:action==='down'?.04:0;
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    }
    this.controls.update(); this.invalidate();
  }
  snapshot() {
    const pbr:Record<string,unknown>={};
    this.roomScene.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m instanceof THREE.MeshStandardMaterial&&m.name.startsWith('PBR')){const im=m.map?.image as {width:number;height:number}|undefined;pbr[m.name]={hasBaseColorMap:!!m.map,hasRoughnessMap:!!m.roughnessMap,hasNormalMap:!!m.normalMap,hasAOMap:!!m.aoMap,metalness:m.metalness,roughnessFactor:m.roughness,uvCount:o.geometry.getAttribute("uv")?.count,baseColorSpace:m.map?.colorSpace,roughnessSpace:m.roughnessMap?.colorSpace,normalSpace:m.normalMap?.colorSpace,normalScale:m.normalScale.toArray(),baseSize:[im?.width,im?.height]};}});
    const sun=this.roomScene.getObjectByName('Room_Sun') as THREE.DirectionalLight;
    const tableHits=this.roomLights.map(l=>{const ray=new THREE.Raycaster(l.position,new THREE.Vector3(0,-1,0),0,3);const hit=ray.intersectObjects(this.roomScene.children,true)[0];return {point:hit?.point.toArray(),object:hit?.object.name,targetNdc:l.target.position.clone().project(this.roomCamera).toArray()};});
    const illumination={daylight:this.daylight,lampLevel:this.lampLevel,brightness:this.lampBrightness,exposure:this.renderer.toneMappingExposure,environment:this.roomScene.environmentIntensity,background:this.roomScene.backgroundIntensity,lights:this.roomScene.children.filter(o=>o instanceof THREE.Light).map(o=>({name:o.name,type:o.type,intensity:(o as THREE.Light).intensity})),emitters:this.roomLights.map(l=>({position:l.position.toArray(),target:l.target.position.toArray(),castShadow:l.castShadow})),table:this.roomConfig?.table,footprints:this.roomLamps.map(l=>{const b=new THREE.Box3().setFromObject(l.getObjectByName('MOBO_Ceramic')!);return {min:b.min.toArray(),max:b.max.toArray()};})};
    return {depthOfField:{enabled:this.dofEnabled,...this.dof.snapshot()},moonlight:this.moonlight.snapshot(),cordBounds:this.roomLamps.map(l=>{const m=l.getObjectByName("MOBO_Cord") as THREE.Mesh,b=new THREE.Box3().setFromObject(m);return{min:b.min.toArray(),max:b.max.toArray(),sharedMaterial:m.material===this.cordTextile?.material};}),cordTextile:this.cordTextile?.snapshot(),cabinet:this.cabinetLight?.snapshot(),inspection:this.inspection?.snapshot(),tableHits,illumination,ready:this.ready, mode:this.mode, memory:{...this.renderer.info.memory},drawCalls:this.renderer.info.render.calls, room:{pbr,sunDirection:sun.position.clone().sub(sun.target.position).normalize().toArray(),environment:this.environmentSettings,lamps:this.roomLamps.length,sharedReviewedGeometry:this.roomLamps.every(l=>(l.getObjectByName('MOBO_Ceramic') as THREE.Mesh).geometry===(this.lamp!.getObjectByName('MOBO_Ceramic') as THREE.Mesh).geometry),sharedGlaze:this.roomLamps.every(l=>((l.getObjectByName('MOBO_Ceramic') as THREE.Mesh).material===(this.lamp!.getObjectByName('MOBO_Ceramic') as THREE.Mesh).material)),lights:this.roomLights.map(l=>l.intensity),camera:this.roomCamera.position.toArray(),fov:this.roomCamera.fov, projectedLamps:this.roomLamps.map(l=>{const b=new THREE.Box3().setFromObject(l.getObjectByName('MOBO_Ceramic')!);return [b.min.x,b.max.x].flatMap(x=>[b.min.y,b.max.y].flatMap(y=>[b.min.z,b.max.z].map(z=>new THREE.Vector3(x,y,z).project(this.roomCamera).toArray())));})}, renders:this.renders, camera:{position:this.camera.position.toArray(),target:this.controls.target.toArray(),zoom:this.camera.zoom,polar:this.controls.getPolarAngle(),azimuth:this.controls.getAzimuthalAngle()},
      light:{position:this.light.position.toArray(),target:this.light.target.position.toArray(),intensity:this.light.intensity},
      materials:Object.fromEntries([...this.materials].map(([name,m])=>[name,{color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.transparent,emissive:m.emissive.toArray(),normalScale:m.normalScale.toArray(),clearcoat:(m as THREE.MeshPhysicalMaterial).clearcoat,clearcoatRoughness:(m as THREE.MeshPhysicalMaterial).clearcoatRoughness,transmission:(m as THREE.MeshPhysicalMaterial).transmission}])),
      pixelRatio:this.renderer.getPixelRatio(),autoRotate:this.controls.autoRotate, damping:this.controls.enableDamping};
  }
  private onKey = (event:KeyboardEvent) => {
    if(this.mode==='room'&&this.inspection?.enabled)return;
    const action:Record<string,CameraAction> = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down','+':'in','=':'in','-':'out',Home:'reset'};
    if (action[event.key]) {event.preventDefault(); this.move(action[event.key]);}
  };
  private onContextLost = (event:Event) => {event.preventDefault(); this.onFailure('3D view interrupted. Showing the matching rendered poster.');};
  private onVisibility = () => { if (document.hidden) {cancelAnimationFrame(this.frame);this.frame=0;} else this.invalidate(); };
  private resize = () => {
    if (this.dead) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    const aspect = width/height;
    const halfHeight = Math.max(1.02,.72/aspect);
    this.roomCamera.aspect=aspect;
    // Keep both pendants entirely visible even on narrow phones; no crop-to-cover.
    this.roomCamera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad((this.roomConfig?.camera.fov??26.5)/2))*Math.max(1,.68/aspect)));
    this.roomCamera.setViewOffset(width,height,0,-(this.roomConfig?.camera.shiftY??0)*height,width,height);
    this.roomCamera.updateProjectionMatrix();this.roomCamera.updateMatrixWorld();
    this.camera.left = -halfHeight*aspect; this.camera.right = halfHeight*aspect;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width,height,false); this.invalidate();
  };
  private invalidate = () => {
    if (this.dead || this.frame || document.hidden) return;
    this.frame = requestAnimationFrame(()=>{
      this.frame=0;
      if (this.dead) return;
      try {if(this.mode==='room'&&!this.inspectRequested&&this.dofEnabled&&this.dof.supported){try{this.dof.render(this.roomScene,this.roomCamera,this.roomLamps);}catch{this.dof.fail();this.renderer.render(this.roomScene,this.roomCamera);}}else{this.dof.disable();this.renderer.render(this.mode==='room'?this.roomScene:this.scene,this.mode==='room'?this.roomCamera:this.camera);}this.renders++;}
      catch {this.onFailure('3D rendering failed. Showing the matching rendered poster.');}
    });
  };
  private disposeObject(object:THREE.Object3D) {
    const textures = new Set<THREE.Texture>();
    object.traverse(child=>{
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      for (const m of (Array.isArray(child.material)?child.material:[child.material])) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      }
    });
    textures.forEach(t=>t.dispose());
  }
  dispose() {
    if (this.dead) return; this.dead = true;
    cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose();this.inspection?.dispose();
    document.removeEventListener('visibilitychange',this.onVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost',this.onContextLost);
    this.renderer.domElement.removeEventListener('keydown',this.onKey);
    // Room lamp clones share the reviewed geometry/materials with the isolated lamp.
    this.roomLamps.forEach(l=>l.removeFromParent());
    this.roomGlowMaterials.forEach(m=>m.dispose());
    this.floorReflection?.dispose();this.windowReflection?.dispose();
    this.disposeObject(this.roomScene);this.disposeObject(this.scene); this.cordTextile?.dispose();this.tileEnvironment?.dispose();this.roomEnvironment?.dispose();this.panorama?.dispose();this.environment.dispose(); this.dof.dispose();this.renderer.dispose(); this.renderer.domElement.remove();
  }
}





