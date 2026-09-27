import * as THREE from 'three';
import { translations, detectLanguage } from './i18n.js';
let language = detectLanguage();
let t = translations[language];
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadGltf } from './model-loader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ui = Object.fromEntries(['viewer', 'canvas-host', 'loading', 'loading-label', 'load-progress', 'status', 'play', 'pause', 'restart', 'elapsed', 'duration', 'timeline', 'retry'].map(id => [id, document.getElementById(id)]));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, .05, 180);
let renderer, controls, model, mixer, actions = [], duration = 0;
let playing = false, ready = false, needsRender = true, previousTime = 0, uiTime = 0;
let frames = 0, disposed = false;
const diagnosticOutput = new URLSearchParams(location.search).has('inspect') ? document.createElement('output') : null;
if (diagnosticOutput) {
  diagnosticOutput.id = 'diagnostics';
  diagnosticOutput.style.cssText = 'position:absolute;top:85px;left:24px;max-width:500px;font:11px/1.5 monospace;overflow-wrap:anywhere;z-index:4;background:#fffffff2;padding:10px';
  ui.viewer.append(diagnosticOutput);
}

function applyLanguage() {
  t = translations[language];
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t[node.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t[node.dataset.i18nAria]); });
  document.querySelector('#language').value = language;
  document.querySelector('.brand').href = language === 'en' ? '/#robot-cell' : '/' + language + '/#robot-cell';
  renderer?.domElement.setAttribute('aria-label', t.canvas);
  ui.status.textContent = t[ui.viewer.dataset.state] || t.loading;
  if (!ready) ui['loading-label'].textContent = ui.viewer.dataset.state === 'error' ? t.errorMessage : t.preparing;
}

function formatTime(seconds) {
  const n = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function updateTime() {
  const time = duration > 0 && actions[0] ? actions[0].time % duration : 0;
  ui.elapsed.textContent = formatTime(time);
  ui.timeline.value = time;
  ui.viewer.dataset.time = time.toFixed(4);
  if (diagnosticOutput) {
    model?.updateMatrixWorld(true);
    let pose = 0;
    model?.traverse(node => { for (let i = 0; i < 16; i++) pose += node.matrixWorld.elements[i] * (i + 1); });
    diagnosticOutput.textContent = JSON.stringify({ ...ui.viewer.dataset, pose: +pose.toFixed(7), camera: camera.position.toArray(), target: controls.target.toArray(), calls: renderer.info.render.calls, renderTriangles: renderer.info.render.triangles });
  }
}

function setPlaying(value) {
  if (!ready) return;
  playing = value;
  previousTime = performance.now();
  ui.viewer.dataset.state = value ? 'playing' : 'paused';
  ui.status.textContent = value ? t.playing : t.paused;
  ui.play.disabled = value;
  ui.pause.disabled = !value;
  ui.restart.disabled = false;
}

function restart() {
  if (!ready) return;
  for (const action of actions) action.reset().play();
  mixer.setTime(0);
  updateTime();
  needsRender = true;
  setPlaying(true);
}

function fitCamera() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const direction = new THREE.Vector3(10, 7.0, 14.5).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const relative = new THREE.Vector3(x, y, z).sub(center);
        const depth = relative.dot(direction);
        distance = Math.max(distance, depth + Math.abs(relative.dot(right)) / tanH, depth + Math.abs(relative.dot(up)) / tanV);
      }
    }
  }
  center.y -= .65;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance * .98);
  camera.lookAt(center);
  controls.minDistance = 2;
  controls.maxDistance = 48;
  controls.update();
  controls.saveState();
}

function resize() {
  if (!renderer) return;
  const { width, height } = ui['canvas-host'].getBoundingClientRect();
  if (!width || !height) return;
  const oldAspect = camera.aspect;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (model && Math.abs(camera.aspect - oldAspect) > .5) fitCamera();
  needsRender = true;
}

function animate(now) {
  if (disposed) return;
  requestAnimationFrame(animate);
  const dt = previousTime ? Math.max((now - previousTime) / 1000, 0) : 0;
  previousTime = now;
  if (document.hidden || !renderer) return;
  if (ready && playing) { mixer.update(dt); needsRender = true; }
  if (controls?.update()) needsRender = true;
  if (needsRender) {
    renderer.render(scene, camera);
    frames++;
    needsRender = false;
  }
  if (ready && now - uiTime > 150) {
    updateTime();
    ui.viewer.dataset.renderFrames = String(frames);
    uiTime = now;
  }
}

function inspectLoop() {
  // Check every animated node and bone at both endpoints, without changing playback.
  for (const action of actions) action.setLoop(THREE.LoopOnce, 1);
  mixer.setTime(0);
  model.updateMatrixWorld(true);
  const before = [];
  model.traverse(node => before.push([node, node.matrixWorld.elements.slice()]));
  mixer.setTime(duration);
  model.updateMatrixWorld(true);
  let maxDifference = 0;
  for (const [node, values] of before) {
    for (let i = 0; i < 16; i++) maxDifference = Math.max(maxDifference, Math.abs(values[i] - node.matrixWorld.elements[i]));
  }
  for (const action of actions) action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  mixer.setTime(0);
  ui.viewer.dataset.loopError = String(maxDifference);
  return maxDifference;
}

function batchRigidParts(root, clips) {
  const animated = new Set();
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const node = root.getObjectByName(parsed.nodeName) || root.getObjectByProperty('uuid', parsed.nodeName);
      if (node) animated.add(node);
    }
  }
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse(node => {
    if (!node.isMesh || node.isSkinnedMesh || animated.has(node) || node.children.length ||
        Array.isArray(node.material) || node.material.transparent || node.material.transmission > 0 ||
        Object.keys(node.geometry.morphAttributes).length || node.matrixWorld.determinant() < 0) return;
    let anchor = node.parent;
    while (anchor && anchor !== root && !animated.has(anchor)) anchor = anchor.parent;
    anchor ||= root;
    const attributes = Object.entries(node.geometry.attributes).map(([name, attr]) =>
      name + ':' + attr.itemSize + ':' + attr.normalized + ':' + attr.array.constructor.name).sort().join(',');
    const key = [anchor.uuid, node.material.uuid, attributes, !!node.geometry.index, node.castShadow].join('|');
    if (!groups.has(key)) groups.set(key, { anchor, material: node.material, shadow: node.castShadow, nodes: [] });
    groups.get(key).nodes.push(node);
  });
  let removedDraws = 0;
  for (const group of groups.values()) {
    if (group.nodes.length < 2) continue;
    const inverse = group.anchor.matrixWorld.clone().invert();
    const geometries = group.nodes.map(node => node.geometry.clone().applyMatrix4(
      inverse.clone().multiply(node.matrixWorld)));
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const batch = new THREE.Mesh(merged, group.material);
    batch.name = 'WebBatch_' + group.anchor.name + '_' + group.material.name;
    batch.castShadow = group.shadow;
    batch.receiveShadow = true;
    group.anchor.add(batch);
    for (const node of group.nodes) node.removeFromParent();
    removedDraws += group.nodes.length - 1;
  }
  return removedDraws;
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const gl = renderer.getContext();
    const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuName = debugRenderer ? String(gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL)) : '';
    const softwareRenderer = /swiftshader|llvmpipe|software|basic[ ]render/i.test(gpuName);
    renderer.setPixelRatio(softwareRenderer ? .7 : Math.min(window.devicePixelRatio || 1, 1.5));
    ui.viewer.dataset.softwareRenderer = String(softwareRenderer);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = !softwareRenderer;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xf3f4f0, 0);
    renderer.domElement.setAttribute('aria-label', t.canvas);
    ui['canvas-host'].append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.maxPolarAngle = Math.PI * .485;
    controls.screenSpacePanning = true;
    controls.addEventListener('change', () => { needsRender = true; });
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .3;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xdce8fa, 0x687159, .18));
    resize();
    requestAnimationFrame(animate);

    const modelUrl = new URL('./models/scene_01_robot_cell_v012.glb.gz', import.meta.url);
    const gltf = await loadGltf(modelUrl, (progress, bytes) => {
      if (progress !== null) ui['load-progress'].value = progress;
      ui['loading-label'].textContent = progress >= .95 ? t.materials : `${t.loading} · ${(bytes / 1048576).toFixed(1)} MB`;
    });
    model = gltf.scene;
    scene.add(model);
    let lightCount = 0, meshCount = 0, triangleCount = 0;
    model.traverse(node => {
      if (node.isMesh) {
        meshCount++;
        triangleCount += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
        node.receiveShadow = true;
        node.castShadow = /ROBOT_|AGV_|CASE_|PALLET_|CONVEYOR_/.test(node.name);
      }
      if (node.isLight) {
        lightCount++;
        if (node.isDirectionalLight && node.name.includes('Daylight_Key')) {
          node.castShadow = true;
          node.shadow.mapSize.set(2048, 2048);
          node.shadow.camera.left = -9;
          node.shadow.camera.right = 9;
          node.shadow.camera.top = 9;
          node.shadow.camera.bottom = -9;
          node.shadow.camera.near = .1;
          node.shadow.camera.far = 35;
          node.shadow.normalBias = .035;
          node.shadow.bias = -.0001;
        }
      }
    });
    if (!gltf.animations.length) throw new Error('The model has no animation clip.');
    const savedDraws = batchRigidParts(model, gltf.animations);
    ui.viewer.dataset.savedDraws = String(savedDraws);
    mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find(item => item.name.includes('Palletizing_Cell_Loop')) || gltf.animations[0];
    duration = clip.duration;
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopRepeat, Infinity).play();
    actions = [action];
    const loopError = inspectLoop();
    if (!Number.isFinite(loopError) || loopError > .001) console.warn('Animation endpoint transform difference:', loopError);
    fitCamera();
    ui.duration.textContent = formatTime(duration);
    ui.timeline.max = duration;
    ui.viewer.dataset.duration = String(duration);
    ui.viewer.dataset.clipCount = String(gltf.animations.length);
    ui.viewer.dataset.lightCount = String(lightCount);
    ui.viewer.dataset.meshCount = String(meshCount);
    ui.viewer.dataset.triangles = String(triangleCount);
    ui.viewer.dataset.clip = clip.name;
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    ui.loading.hidden = true;
    ready = true;
    setPlaying(false);
    ui.status.textContent = t.ready;
    ui.viewer.dataset.state = 'ready';
    updateTime();
    needsRender = true;
    console.info('RobotCellReady', JSON.stringify({ lights: lightCount, meshes: meshCount, triangles: triangleCount, clips: gltf.animations.length, duration, loopError, clip: clip.name, tracks: clip.tracks.length, savedDraws }));
  } catch (error) {
    console.error('Robot cell viewer:', error);
    ui.viewer.dataset.state = 'error';
    ui.status.textContent = t.error;
    ui['loading-label'].textContent = t.errorMessage;
    ui['load-progress'].hidden = true;
    ui.retry.hidden = false;
    ui.loading.hidden = false;
  }
}

ui.play.addEventListener('click', () => setPlaying(true));
ui.pause.addEventListener('click', () => setPlaying(false));
ui.restart.addEventListener('click', restart);
ui.retry.addEventListener('click', () => location.reload());
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { previousTime = performance.now(); needsRender = true; });
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['BUTTON', 'INPUT', 'TEXTAREA', 'A'].includes(event.target.tagName)) {
    event.preventDefault();
    setPlaying(!playing);
  }
});
document.querySelector('#language').addEventListener('change', event => {
  language = event.target.value;
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  applyLanguage();
});
window.addEventListener('pagehide', () => { disposed = true; });
window.addEventListener('pageshow', event => {
  if (event.persisted) { disposed = false; previousTime = performance.now(); needsRender = true; requestAnimationFrame(animate); }
});
applyLanguage();
init();
