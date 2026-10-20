// Desktop V08 settings retained. Small screens use smaller reflection targets.
export function createReflections(renderer,scene,getCamera,getMeshes){
 const compact=matchMedia('(max-width:800px)').matches;
 const gl=renderer.getContext();
 let supported=!!gl.getExtension('EXT_color_buffer_float'),reason=supported?'':'This device uses environment reflections; screen-space reflections are unavailable.';
 const modules=Promise.all([import('three/addons/postprocessing/EffectComposer.js'),import('three/addons/postprocessing/SSRPass.js'),import('three/addons/postprocessing/OutputPass.js')]);
 let enabled=false,composer,pass,loading,generation=0;
 const resolutionScale=compact?.35:.5,maxSteps=compact?96:128;
 function notice(){const el=document.querySelector('#reflection-status');if(el)el.textContent=reason;}
 function resize(){if(!composer)return;const c=renderer.domElement;composer.setPixelRatio(1);composer.setSize(c.width,c.height);pass.ssrMaterial.defines.MAX_STEP=maxSteps;pass.ssrMaterial.needsUpdate=true;}
 function refresh(){if(pass)pass.selects=getMeshes().filter(m=>m.material.metalness>.5);}
 async function set(value){const id=++generation;if(value&&!supported){enabled=false;notice();return false;}
  try{if(value&&!composer){loading??=modules.then(([{EffectComposer},{SSRPass},{OutputPass}])=>{
   composer=new EffectComposer(renderer);pass=new SSRPass({renderer,scene,camera:getCamera(),selects:getMeshes().filter(m=>m.material.metalness>.5),bouncing:false});
   const samples=compact?0:Math.min(4,gl.getParameter(gl.MAX_SAMPLES));
   pass.beautyRenderTarget.samples=samples;pass.normalRenderTarget.samples=samples;pass.metalnessRenderTarget.samples=samples;pass.opacity=.25;pass.maxDistance=20;pass.thickness=.15;pass.blur=true;pass.resolutionScale=resolutionScale;
   composer.addPass(pass);composer.addPass(new OutputPass());resize();
  });await loading;}
  if(id===generation)enabled=!!value;
  }catch(error){enabled=false;supported=false;reason='This device uses environment reflections; screen-space reflections could not start.';composer?.dispose();composer=undefined;pass=undefined;notice();}
  return enabled;
 }
 function draw(camera,mode){if(!enabled||mode==='section'){renderer.render(scene,camera);return;}
  pass.camera=camera;const u=pass.ssrMaterial.uniforms;u.cameraNear.value=camera.near;u.cameraFar.value=camera.far;u.cameraProjectionMatrix.value.copy(camera.projectionMatrix);u.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  const perspective=!!camera.isPerspectiveCamera;if(pass.ssrMaterial.defines.PERSPECTIVE_CAMERA!==perspective){pass.ssrMaterial.defines.PERSPECTIVE_CAMERA=perspective;pass.ssrMaterial.needsUpdate=true;}
  composer.render();
 }
 return {set,draw,resize,refresh,setOpacity:v=>{if(pass)pass.opacity=v;},snapshot:()=>({enabled,supported,reason,allocated:!!composer,resolutionScale,maxSteps,opacity:pass?.opacity??.25,metalMeshes:pass?.selects.length??0,crossSectionBypassed:true})};
}
