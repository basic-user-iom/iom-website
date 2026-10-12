import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { studioEnvironment } from './environment';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type Stage = 1 | 2 | 3;
export type Band = 'low' | 'mid' | 'high';
type CameraSpec = { stage: Stage; position: number[]; target: number[]; FOV: number; mobile?: { position: number[]; target: number[]; FOV: number } };
type Manifest = { schemaVersion: string; assetVersion: string; assetFile: string; byteSize: number; sha256: string; requiredNodes: string[]; productBounds: { min: number[]; max: number[]; size: number[] }; visibility: Record<string, string[]>; cameras: CameraSpec[]; animation: { clipName: string; durationSeconds: number }; triangleCount: number };
const vec = (a: number[]) => new THREE.Vector3().fromArray(a);
const bandNodes: Record<Band, string[]> = { low: ['SD_Woofer_Upper', 'SD_Woofer_Lower'], mid: ['SD_Midrange'], high: ['SD_Tweeter'] };
const hotspotParts = ['Cone', 'Basket', 'VoiceCoil'];
export class Viewer {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, .01, 30);
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  model?: THREE.Group;
  manifest?: Manifest;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  stage: Stage = 1;
  band: Band = 'low';
  playing = false;
  ready = false;
  disposed = false;
  frameCount = 0;
  private raf = 0;
  private lastTime = 0;
  private abort = new AbortController();
  private observer: ResizeObserver;
  private envTarget?: THREE.WebGLRenderTarget;
  private environmentStatus: 'loading' | 'ready' | 'fallback' = 'loading';
  private floor: THREE.Mesh;
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private highlighted: THREE.Material[] = [];
  private raycaster = new THREE.Raycaster();
  private transition?: { start: number; from: THREE.Vector3; targetFrom: THREE.Vector3; to: THREE.Vector3; targetTo: THREE.Vector3 };
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private touchCapable = navigator.maxTouchPoints > 0;
  private touchOrbit = false;
  private hotspotButtons: HTMLButtonElement[] = [];
  constructor(private host: HTMLElement, private hotspotHost: HTMLElement, private onFailure: (error: unknown) => void, private onPart: (part: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 761 ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '3D-conceptmodel; de uitleg en bediening staan naast het model.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .09;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * .48;
    this.controls.minPolarAngle = Math.PI * .14;
    this.controls.autoRotateSpeed = .65;
    this.controls.addEventListener('change', this.request);
    this.controls.addEventListener('start', this.request);
    this.scene.environmentIntensity = studioEnvironment.intensity;
    this.scene.environmentRotation.set(0, studioEnvironment.rotationY, 0);
    this.scene.add(new THREE.HemisphereLight(0xf6f2ee, 0x474a50, .7));
    const key = new THREE.DirectionalLight(0xffead9, 2);
    key.position.set(2, 3, 3); key.castShadow = false;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2, bottom: -1, near: .1, far: 10 });
    key.shadow.bias = -.00015; key.shadow.normalBias = .002;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd6e5ff, 1.8); rim.position.set(-2, 1.4, -1); this.scene.add(rim);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64,64,8,64,64,64);
    gradient.addColorStop(0, 'rgba(0,0,0,.48)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(.65, .8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -.002; this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    const opts = { signal: this.abort.signal };
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(this.raf); this.raf = 0; this.lastTime = 0;
      if (!document.hidden) this.request();
    }, opts);
    this.reduced.addEventListener('change', () => {
      if (this.reduced.matches) {
        this.controls.autoRotate = false;
        this.finishTransition();
      }
      this.request();
    }, opts);
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.onFailure(new Error('De 3D-weergave is onderbroken.'));
    }, opts);
    hotspotParts.forEach((part, index) => {
      const button = document.createElement('button');
      button.className = 'hotspot'; button.textContent = String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', ['Conus', 'Open korf', 'Spreekspoel'][index]);
      button.hidden = true; button.addEventListener('click', () => this.onPart(part), opts);
      hotspotHost.append(button); this.hotspotButtons.push(button);
    });
    this.resize();
  }
  async load() {
    await Promise.all([this.loadEnvironment(), this.loadModel()]);
    if (this.disposed) return;
    this.applyVisibility(); // Both groups are set before the first frame.
    this.scene.add(this.model!);
    this.ready = true;
    this.setStage(this.stage, false);
  }
  private async loadEnvironment() {
    let source: THREE.DataTexture | undefined;
    let generator: THREE.PMREMGenerator | undefined;
    try {
      const response = await fetch(studioEnvironment.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error('HDRI could not be loaded.');
      const bytes = await response.arrayBuffer();
      if (this.disposed) return;
      const hdr = new HDRLoader().parse(bytes);
      source = new THREE.DataTexture(hdr.data, hdr.width, hdr.height, THREE.RGBAFormat, hdr.type);
      source.colorSpace = THREE.LinearSRGBColorSpace;
      source.mapping = THREE.EquirectangularReflectionMapping;
      source.minFilter = source.magFilter = THREE.LinearFilter;
      source.generateMipmaps = false;
      source.flipY = true; // Match HDRLoader's Radiance convention.
      source.needsUpdate = true;
      generator = new THREE.PMREMGenerator(this.renderer);
      this.envTarget = generator.fromEquirectangular(source);
      this.scene.environment = this.envTarget.texture;
      this.environmentStatus = 'ready';
    } catch (error) {
      if (this.disposed) return;
      // A missing reflection asset must not make the product or controls unusable.
      const room = new RoomEnvironment();
      const fallback = new THREE.PMREMGenerator(this.renderer);
      try {
        this.envTarget = fallback.fromScene(room, .04);
        this.scene.environment = this.envTarget.texture;
        this.scene.environmentIntensity = .65;
        this.scene.environmentRotation.set(0, 0, 0);
        this.environmentStatus = 'fallback';
        console.info('HDRI fallback:', error instanceof Error ? error.message : String(error));
      } finally { room.dispose(); fallback.dispose(); }
    } finally { source?.dispose(); generator?.dispose(); }
  }
  private async loadModel() {
    const response = await fetch(import.meta.env.BASE_URL + 'assets/export/stradivari_amantes_s3_manifest_v05.json', { signal: this.abort.signal });
    if (!response.ok) throw new Error('Het manifest kon niet worden geladen.');
    const manifest: Manifest = await response.json();
    if (manifest.schemaVersion !== 'iom.stradivari.amantes-s3.demo.v1' || manifest.assetVersion !== 'v05') throw new Error('Onverwachte assetversie.');
    this.manifest = manifest;
    const assetResponse = await fetch(import.meta.env.BASE_URL + 'assets/export/' + manifest.assetFile, { signal: this.abort.signal });
    if (!assetResponse.ok) throw new Error('Het 3D-model kon niet worden geladen.');
    const bytes = await assetResponse.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== manifest.byteSize || hash !== manifest.sha256) throw new Error('Het model komt niet overeen met het manifest.');
    const gltf = await new GLTFLoader().parseAsync(bytes, import.meta.env.BASE_URL + 'assets/export/');
    if (this.disposed) { this.disposeObject(gltf.scene); return; }
    this.model = gltf.scene;
    for (const name of manifest.requiredNodes) if (!this.model.getObjectByName(name)) throw new Error('Ontbrekend onderdeel: ' + name);
    this.model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.node('SD_Product'), true);
    if (bounds.min.distanceTo(vec(manifest.productBounds.min)) > .00001 || bounds.max.distanceTo(vec(manifest.productBounds.max)) > .00001) throw new Error('De modelafmetingen wijken af van het manifest.');
    const textureFiltering = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      // glTF owns map colour spaces and orientation; improve only oblique sampling.
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.anisotropy = textureFiltering;
        }
      }
    });
    const clip = gltf.animations.find(item => item.name === manifest.animation.clipName);
    if (!clip || Math.abs(clip.duration - manifest.animation.durationSeconds) > .001) throw new Error('De afgesproken animatie ontbreekt.');
    this.mixer = new THREE.AnimationMixer(this.model);
    this.action = this.mixer.clipAction(clip); // Created but not playing.

  }
  setLabels(canvasLabel: string, parts: string[]) {
    this.renderer.domElement.setAttribute('aria-label', canvasLabel);
    this.hotspotButtons.forEach((button, index) => button.setAttribute('aria-label', parts[index]));
  }
  node(name: string) { return this.model!.getObjectByName(name)!; }
  private applyVisibility() {
    if (!this.model || !this.manifest) return;
    const visible = this.manifest.visibility['stage' + this.stage];
    for (const name of ['SD_Product', 'SD_EduDriver']) this.node(name).visible = visible.includes(name);
    this.floor.visible = this.stage !== 2;
  }
  private fittedCamera() {
    const base = this.manifest!.cameras.find(item => item.stage === this.stage)!;
    const spec = this.camera.aspect < .8 && base.mobile ? base.mobile : base;
    this.camera.fov = spec.FOV; this.camera.updateProjectionMatrix();
    const target = vec(spec.target);
    const position = vec(spec.position);
    const outward = position.clone().sub(target).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
    const up = new THREE.Vector3().crossVectors(outward, right);
    const box = new THREE.Box3().setFromObject(this.node(this.stage === 2 ? 'SD_EduDriver' : 'SD_Product'), true);
    const tanY = Math.tan(THREE.MathUtils.degToRad(spec.FOV / 2));
    let distance = position.distanceTo(target);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const rel = new THREE.Vector3(x, y, z).sub(target);
      const depth = rel.dot(outward);
      distance = Math.max(distance, depth + Math.abs(rel.dot(right)) / (tanY * this.camera.aspect * .8), depth + Math.abs(rel.dot(up)) / (tanY * (innerWidth < 761 ? .6 : .72)));
    }
    this.controls.minDistance = this.stage === 2 ? .28 : .78;
    this.controls.maxDistance = Math.max(distance * 1.8, this.stage === 2 ? .8 : 3.8);
    return { position: outward.multiplyScalar(distance).add(target), target };
  }
  setStage(stage: Stage, animate = true) {
    this.stage = stage; this.stopMotion(); this.controls.autoRotate = false;
    if (!this.ready) return;
    this.applyVisibility(); this.highlight(this.band);
    const frame = this.fittedCamera();
    // Flush damping from an interrupted drag before defining a new transition.
    this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = true;
    if (animate && !this.reduced.matches) {
      this.transition = { start: performance.now(), from: this.camera.position.clone(), targetFrom: this.controls.target.clone(), to: frame.position, targetTo: frame.target };
      this.controls.enabled = false;
    } else {
      this.transition = undefined;
      this.camera.position.copy(frame.position); this.controls.target.copy(frame.target);
      this.camera.lookAt(frame.target); this.syncControls();
      this.renderer.domElement.style.opacity = '1';
    }
    this.request();
  }
  private finishTransition() {
    if (this.transition) {
      this.camera.position.copy(this.transition.to); this.controls.target.copy(this.transition.targetTo);
      this.transition = undefined; this.renderer.domElement.style.opacity = '1';
      this.camera.lookAt(this.controls.target); this.syncControls();
    }
  }
  private syncControls() { this.controls.enabled = this.ready && !this.transition && (!this.touchCapable || this.touchOrbit); }
  setTouchOrbit(enabled: boolean) { this.touchOrbit = enabled; this.host.parentElement!.classList.toggle('touch-active', enabled); this.syncControls(); }
  setAutoRotate(enabled: boolean) { this.controls.autoRotate = enabled && !this.reduced.matches; this.request(); return this.controls.autoRotate; }
  toggleMotion() {
    if (!this.action || this.stage !== 2) return false;
    this.playing = !this.playing;
    if (this.playing) { this.action.play(); this.action.paused = false; } else this.action.paused = true;
    this.lastTime = 0; this.request(); return this.playing;
  }
  stopMotion() { this.playing = false; this.action?.stop(); this.mixer?.update(0); }
  highlight(band: Band) {
    this.band = band;
    for (const [mesh, original] of this.originals) mesh.material = original;
    this.originals.clear(); for (const material of this.highlighted) material.dispose(); this.highlighted = [];
    if (!this.ready || this.stage !== 3) { this.request(); return; }
    for (const name of bandNodes[band]) this.node(name).traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.originals.set(object, object.material);
      const clone = (material: THREE.Material) => {
        const copy = material.clone();
        if (copy instanceof THREE.MeshStandardMaterial) { copy.emissive.set('#b9703c'); copy.emissiveIntensity = .5; }
        this.highlighted.push(copy); return copy;
      };
      object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
    });
    this.request();
  }
  private updateHotspots() {
    this.model?.updateMatrixWorld(true);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.hotspotButtons.forEach((button, index) => {
      button.hidden = true;
      if (!this.ready || this.stage !== 2 || this.transition) return;
      const point = this.node('HS_' + hotspotParts[index]).getWorldPosition(new THREE.Vector3());
      const projected = point.clone().project(this.camera);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > .88 || projected.y > .8 || projected.y < -.62) return;
      const delta = point.clone().sub(this.camera.position);
      const distance = delta.length();
      this.raycaster.set(this.camera.position, delta.normalize());
      this.raycaster.far = distance - .002;
      const occluder = this.raycaster.intersectObject(this.node('SD_EduDriver'), true)[0];
      if (occluder) {
        // Some exported anchors sit inside their own component (HS_Basket in v04).
        // Its nearest visible surface is a valid label target; a different part is not.
        const component = this.node('SD_' + hotspotParts[index]);
        let ancestor: THREE.Object3D | null = occluder.object;
        while (ancestor && ancestor !== component) ancestor = ancestor.parent;
        if (!ancestor) return;
        projected.copy(occluder.point).project(this.camera);
      }
      button.hidden = false;
      button.style.left = ((projected.x + 1) * w / 2) + 'px';
      button.style.top = ((1 - projected.y) * h / 2) + 'px';
    });
  }
  private resize() {
    if (this.disposed) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 761 ? 1.5 : 2));
    this.renderer.setSize(w, h);
    if (this.ready) {
      this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = true;
      const frame = this.fittedCamera(); this.transition = undefined;
      this.camera.position.copy(frame.position); this.controls.target.copy(frame.target);
      this.camera.lookAt(frame.target); this.camera.updateMatrixWorld(true); this.renderer.domElement.style.opacity = '1'; this.syncControls();
    }
    this.request();
  }
  request = () => {
    if (!this.raf && !this.disposed && !document.hidden) this.raf = requestAnimationFrame(this.render);
  };
  private render = (time: number) => {
    this.raf = 0;
    if (this.disposed || document.hidden) return;
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0;
    this.lastTime = time;
    if (this.transition) {
      const p = Math.min((time - this.transition.start) / 650, 1);
      const t = p * p * (3 - 2 * p);
      this.camera.position.lerpVectors(this.transition.from, this.transition.to, t);
      this.controls.target.lerpVectors(this.transition.targetFrom, this.transition.targetTo, t);
      this.camera.lookAt(this.controls.target);
      this.renderer.domElement.style.opacity = String(.55 + .45 * Math.abs(2 * p - 1));
      if (p === 1) this.finishTransition();
    }
    const changed = this.transition ? false : this.controls.update(delta);
    if (this.playing) this.mixer!.update(delta);
    this.camera.updateMatrixWorld(true);
    this.updateHotspots();
    this.renderer.render(this.scene, this.camera); this.frameCount++;
    if (this.transition || this.playing || this.controls.autoRotate || changed) this.request();
    else this.lastTime = 0;
  };
  diagnostics() {
    const product = this.model ? new THREE.Box3().setFromObject(this.node('SD_Product'), true) : undefined;
    const names = ['SD_MovingAssembly', 'SD_Cone', 'SD_VoiceCoil', 'SD_Basket', 'SD_Magnet', 'SD_Surround', 'SD_Spider'];
    return { environment: { id: this.environmentStatus === 'ready' ? studioEnvironment.id : this.environmentStatus, status: this.environmentStatus, intensity: this.scene.environmentIntensity, rotationY: this.scene.environmentRotation.y }, assetVersion: this.manifest?.assetVersion, stage: this.stage, ready: this.ready, playing: this.playing, transitioning: !!this.transition, frames: this.frameCount,
      groups: this.model ? { product: this.node('SD_Product').visible, driver: this.node('SD_EduDriver').visible } : null,
      bounds: product ? { min: product.min.toArray(), max: product.max.toArray() } : null,
      camera: this.camera.position.toArray(), target: this.controls.target.toArray(), band: this.band,
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      transforms: this.model ? Object.fromEntries(names.map(name => { const n = this.node(name); return [name, { position: n.getWorldPosition(new THREE.Vector3()).toArray(), morph: (n as THREE.Mesh).morphTargetInfluences?.slice() }]; })) : null,
      projectedBounds: this.model ? this.projectedBounds() : null,
      visibleHotspots: this.hotspotButtons.filter(b => !b.hidden).map(b => b.getAttribute('aria-label')),
      controlsEnabled: this.controls.enabled, highlightedMeshes: this.originals.size,
      root: this.model ? { position: this.node('SD_Root').position.toArray(), scale: this.node('SD_Root').scale.toArray(), quaternion: this.node('SD_Root').quaternion.toArray() } : null };
  }
  private projectedBounds() {
    this.camera.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(this.node(this.stage === 2 ? 'SD_EduDriver' : 'SD_Product'), true);
    const points: number[][] = [];
    for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) points.push(new THREE.Vector3(x,y,z).project(this.camera).toArray());
    return points;
  }
  private disposeObject(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    for (const t of textures) { if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) t.image.close(); t.dispose(); }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.abort.abort(); cancelAnimationFrame(this.raf);
    this.observer.disconnect(); this.controls.dispose();
    this.mixer?.stopAllAction(); if (this.model) this.mixer?.uncacheRoot(this.model);
    for (const [mesh, original] of this.originals) mesh.material = original;
    for (const material of this.highlighted) material.dispose();
    if (this.model && !this.model.parent) this.disposeObject(this.model);
    this.disposeObject(this.scene); this.scene.environment = null; this.envTarget?.dispose();
    this.renderer.dispose(); this.renderer.domElement.remove();
    this.hotspotHost.replaceChildren();
  }
}



