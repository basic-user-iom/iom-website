import * as THREE from 'three';

// Low mist integrated in the existing surface draw. Unlike a fullscreen volume
// pass, this never renders the million-triangle gallery twice. The fragment's
// visible world position is the integration endpoint, so walls occlude the mist.
// The floor footprint is measured from the upward faces of the imported floors.
export function createSculptureFog({renderer, floorMeshes = [], bounds, floorY = 0, settings}) {
  const floorBounds = new THREE.Box3(), triangles = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (const mesh of floorMeshes) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(b, a); ac.subVectors(c, a);
      // Ignore the slab underside, bevels, and vertical edges.
      if (ab.cross(ac).normalize().y < .99) continue;
      triangles.push([a.x, a.z, b.x, b.z, c.x, c.z]);
      floorBounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    }
  }
  if (floorBounds.isEmpty()) {
    if (!bounds || bounds.isEmpty()) throw new Error('Gallery floor fog needs the imported interior floor meshes.');
    floorBounds.copy(bounds); floorBounds.min.y = floorBounds.max.y = floorY;
    const {min, max} = floorBounds;
    triangles.push([min.x,min.z,max.x,min.z,max.x,max.z],[min.x,min.z,max.x,max.z,min.x,max.z]);
  }
  floorY = floorBounds.max.y;
  const size = floorBounds.getSize(new THREE.Vector3());
  const width = 256, height = Math.max(32, Math.round(width * size.z / size.x));
  const footprint = new Uint8Array(width * height);
  const px = x => (x - floorBounds.min.x) / size.x * width;
  const pz = z => (z - floorBounds.min.z) / size.z * height;
  for (const t of triangles) {
    const x0=px(t[0]),z0=pz(t[1]),x1=px(t[2]),z1=pz(t[3]),x2=px(t[4]),z2=pz(t[5]);
    const denominator=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);
    if (Math.abs(denominator)<1e-8) continue;
    const left=Math.max(0,Math.floor(Math.min(x0,x1,x2))),right=Math.min(width-1,Math.ceil(Math.max(x0,x1,x2)));
    const near=Math.max(0,Math.floor(Math.min(z0,z1,z2))),far=Math.min(height-1,Math.ceil(Math.max(z0,z1,z2)));
    for(let z=near;z<=far;z++) for(let x=left;x<=right;x++) {
      const u=((z1-z2)*(x+.5-x2)+(x2-x1)*(z+.5-z2))/denominator;
      const v=((z2-z0)*(x+.5-x2)+(x0-x2)*(z+.5-z2))/denominator;
      if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001) footprint[z*width+x]=255;
    }
  }
  // A one-cell inward margin prevents bilinear sampling from bleeding onto the
  // lawn or through the floor boundary; it also feathers the mist at doorways.
  const inset = footprint.slice();
  for(let z=0;z<height;z++) for(let x=0;x<width;x++) {
    if(!x||!z||x===width-1||z===height-1) {inset[z*width+x]=0;continue;}
    for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) {
      if(!footprint[(z+dz)*width+x+dx]) inset[z*width+x]=0;
    }
  }
  const mask = new THREE.DataTexture(inset,width,height,THREE.RedFormat,THREE.UnsignedByteType);
  mask.name='runtime_gallery_floor_fog_footprint';
  mask.minFilter=mask.magFilter=THREE.LinearFilter; mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;
  mask.generateMipmaps=false; mask.unpackAlignment=1; mask.needsUpdate=true;
  const state={method:'Low floor mist integrated into existing surface shaders',scope:'Gallery interior floors',
    phase:0,renderCount:0,steps:6,additionalScenePasses:0,additionalDrawCalls:0,
    compositing:'Depth-correct surface integration before tone mapping',bufferSize:[0,0],
    footprintBytes:inset.byteLength,footprintSize:[width,height],floorMeshCount:floorMeshes.length,
    sourceFloorTriangles:triangles.length,footprintCoverage:inset.reduce((n,v)=>n+Number(v>0),0)/inset.length,
    bounds:null,patchedMaterials:0,skippedMaterials:[],disposed:false};
  const uniforms={
    iomFloorFogMask:{value:mask},iomFloorFogMin:{value:floorBounds.min.clone()},
    iomFloorFogMax:{value:floorBounds.max.clone()},iomFloorFogDensity:{value:0},
    iomFloorFogTime:{value:0},iomFloorFogSteps:{value:6},iomFloorFogColor:{value:new THREE.Color(settings.color)},
  };
  const records=new Map(); let phase=0,disposed=false;
  const vertexDeclaration='\nvarying vec3 iomFloorFogWorldPosition;\n';
  const worldPosition=`
    vec4 iomFogWorld=vec4(transformed,1.0);
    #ifdef USE_BATCHING
      iomFogWorld=batchingMatrix*iomFogWorld;
    #endif
    #ifdef USE_INSTANCING
      iomFogWorld=instanceMatrix*iomFogWorld;
    #endif
    iomFloorFogWorldPosition=(modelMatrix*iomFogWorld).xyz;
  `;
  const fragmentDeclaration=`
    varying vec3 iomFloorFogWorldPosition;
    uniform sampler2D iomFloorFogMask;
    uniform vec3 iomFloorFogMin,iomFloorFogMax,iomFloorFogColor;
    uniform float iomFloorFogDensity,iomFloorFogTime;
    uniform int iomFloorFogSteps;
    float iomFloorMist(vec3 surface) {
      if(iomFloorFogDensity<=0.00001) return 0.0;
      vec3 ray=surface-cameraPosition;
      float distanceToSurface=length(ray);
      vec3 direction=ray/max(distanceToSurface,0.00001);
      vec3 inverseDirection=mix(vec3(-1.0),vec3(1.0),greaterThanEqual(direction,vec3(0.0)))/max(abs(direction),vec3(0.00001));
      vec3 t0=(iomFloorFogMin-cameraPosition)*inverseDirection;
      vec3 t1=(iomFloorFogMax-cameraPosition)*inverseDirection;
      vec3 nearHit=min(t0,t1),farHit=max(t0,t1);
      float entry=max(max(nearHit.x,nearHit.y),max(nearHit.z,0.0));
      float exit=min(min(farHit.x,farHit.y),min(farHit.z,distanceToSurface));
      if(exit<=entry) return 0.0;
      vec3 extent=iomFloorFogMax-iomFloorFogMin;
      float stepLength=(exit-entry)/float(iomFloorFogSteps);
      // Midpoint quadrature is stable when the camera moves; no screen-space
      // dither or animated random seed that could sparkle on mobile displays.
      vec3 samplePosition=cameraPosition+direction*(entry+stepLength*.5);
      float opticalDepth=0.0;
      for(int i=0;i<6;i++) {
        if(i>=iomFloorFogSteps) break;
        vec3 q=clamp((samplePosition-iomFloorFogMin)/extent,0.0,1.0);
        float floorMask=smoothstep(.80,1.0,texture2D(iomFloorFogMask,q.xz).r);
        float vertical=exp(-3.5*q.y)*pow(1.0-q.y,2.0);
        float drift=.8+.14*sin(samplePosition.x*.44+samplePosition.z*.31+iomFloorFogTime*.32)
          +.10*sin(samplePosition.z*.63-samplePosition.x*.17-iomFloorFogTime*.21);
        opticalDepth+=floorMask*vertical*drift*stepLength;
        samplePosition+=direction*stepLength;
      }
      return 1.0-exp(-opticalDepth*iomFloorFogDensity*.8);
    }
  `;
  function patch(material) {
    if(!material||records.has(material)||material.isMeshDepthMaterial||material.isMeshDistanceMaterial) return;
    // Additive caustic overlays retain their blending. Their receiving floor is
    // already misted; editing the custom overlay shader would add light to fog.
    if(material.isShaderMaterial||material.isRawShaderMaterial) return;
    const before=material.onBeforeCompile,cache=material.customProgramCacheKey;
    const previousKey=cache.call(material);
    const hook=function(shader,...args) {
      before.call(this,shader,...args);
      const vertexMarker='#include <project_vertex>',fragmentMarker='#include <tonemapping_fragment>';
      if(!shader.vertexShader.includes(vertexMarker)||!shader.fragmentShader.includes(fragmentMarker)) {
        if(!state.skippedMaterials.includes(material.name)) state.skippedMaterials.push(material.name);
        return;
      }
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=vertexDeclaration+shader.vertexShader.replace(vertexMarker,worldPosition+'\n'+vertexMarker);
      shader.fragmentShader=fragmentDeclaration+shader.fragmentShader.replace(fragmentMarker,
        'gl_FragColor.rgb=mix(gl_FragColor.rgb,iomFloorFogColor,iomFloorMist(iomFloorFogWorldPosition));\n'+fragmentMarker);
    };
    const key=()=>previousKey+'|iom-gallery-floor-mist-v1';
    material.onBeforeCompile=hook; material.customProgramCacheKey=key; material.needsUpdate=true;
    const onDispose=()=>{records.delete(material);state.patchedMaterials=records.size;};
    material.addEventListener('dispose',onDispose);
    records.set(material,{before,cache,hook,key,onDispose}); state.patchedMaterials=records.size;
  }
  function configure(options) {
    if(disposed) return;
    uniforms.iomFloorFogDensity.value=Math.max(0,options.density);
    uniforms.iomFloorFogColor.value.set(options.color);
    uniforms.iomFloorFogMin.value.set(floorBounds.min.x,floorY+.008,floorBounds.min.z);
    uniforms.iomFloorFogMax.value.set(floorBounds.max.x,floorY+THREE.MathUtils.clamp(options.height,.15,1.2),floorBounds.max.z);
    state.bounds={min:uniforms.iomFloorFogMin.value.toArray(),max:uniforms.iomFloorFogMax.value.toArray()};
    state.density=uniforms.iomFloorFogDensity.value;
  }
  function update(delta,speed) {
    if(disposed) return;
    phase+=delta*speed;uniforms.iomFloorFogTime.value=phase;state.phase=phase;
  }
  function render(scene) {
    if(disposed||uniforms.iomFloorFogDensity.value<=0) return false;
    const compact=renderer.domElement.clientWidth<700||globalThis.matchMedia?.('(pointer: coarse)').matches;
    state.steps=compact?4:6;uniforms.iomFloorFogSteps.value=state.steps;
    // Effects can swap live materials after initialization. Patch each new one
    // once; stable materials require no allocations or recompilation per frame.
    scene.traverse(object=>{
      if(!object.isMesh) return;
      if(Array.isArray(object.material)) object.material.forEach(patch); else patch(object.material);
    });
    state.renderCount++;
    return false; // The viewer performs its existing single scene render.
  }
  function dispose() {
    if(disposed) return;
    uniforms.iomFloorFogDensity.value=0;
    for(const [material,record] of records) {
      if(material.onBeforeCompile===record.hook) material.onBeforeCompile=record.before;
      if(material.customProgramCacheKey===record.key) material.customProgramCacheKey=record.cache;
      material.removeEventListener('dispose',record.onDispose);material.needsUpdate=true;
    }
    records.clear();mask.dispose();disposed=true;state.disposed=true;state.patchedMaterials=0;
  }
  configure(settings);
  return {state,configure,update,render,dispose};
}
