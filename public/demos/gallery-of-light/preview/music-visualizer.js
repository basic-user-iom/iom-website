import * as THREE from 'three';

// One depth-tested screen: a still from the original ribbon artwork at rest,
// smoothly replaced by the audio-reactive shader while the active screen plays.
export function createMusicVisualizer({scene,galleryModel,renderer,sourceName='ai66_Ceiling_Screen',facing=1}) {
  const source=galleryModel.getObjectByName(sourceName);
  if(!source)throw new Error('The gallery projection screen is missing');
  galleryModel.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  facing=facing<0?-1:1;
  const width=size.z-.24,height=size.y-.28,screenX=facing>0?bounds.max.x+.012:bounds.min.x-.012;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={ready:true,active:false,amount:0,animationMix:0,mode:'poster',posterStatus:'loading',reducedMotion:reducedMotion.matches,
    source:source.name,screenBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    surface:{width,height,position:[screenX,bounds.min.y+.08+height/2,center.z],triangles:2},
    bands:{bass:0,mid:0,treble:0,energy:0},rawBands:{bass:0,mid:0,treble:0,energy:0},
    response:{onset:0,activity:0,motionTime:0},lightIntensity:0,
    quality:{drawCalls:1,renderTargets:0,posterTextures:1,shadowMapSize:512,shadowUpdates:'On audible activation; fixed room geometry'},
    illumination:'One cinema-limited spotlight, with cached occlusion shadows',disposed:false};
  const uniforms={uTime:{value:0},uBands:{value:new THREE.Vector4()},uOnset:{value:0},uMotion:{value:1},uAmount:{value:0},uAspect:{value:width/height},uPoster:{value:null},uPosterReady:{value:0}};
  const posterURL=new URL('../assets/music-screen/visualizer-poster.webp',import.meta.url).href;
  const poster=new THREE.TextureLoader().load(posterURL,texture=>{
    if(state.disposed){texture.dispose();return;}
    state.posterStatus='ready';uniforms.uPosterReady.value=1;
  },undefined,()=>{if(!state.disposed)state.posterStatus='fallback';});
  poster.colorSpace=THREE.SRGBColorSpace;
  poster.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()??1);
  uniforms.uPoster.value=poster;
  const geometry=new THREE.PlaneGeometry(width,height);
  const material=new THREE.ShaderMaterial({
    name:'music_screen_luminous_ribbons',uniforms,transparent:false,depthWrite:true,
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vUv;
      uniform float uTime,uAmount,uAspect,uOnset,uMotion,uPosterReady;
      uniform sampler2D uPoster;
      uniform vec4 uBands;
      float ribbon(vec2 p,float phase,float width,float bend){
        float ridge=.18*sin(p.x*1.22+phase+uTime*.19)
          +.075*sin(p.x*2.74-phase*.8-uTime*.13)
          +bend*sin(p.x*.86+uTime*.10+phase*.7);
        float d=abs(p.y-ridge);
        float body=exp(-d*d/(width*width));
        float halo=exp(-d*d/(width*width*15.));
        return body+.14*halo;
      }
      void main(){
        // The idle screen needs only one texture sample; no ribbon loops or
        // extra pass. sRGB texture decoding keeps the captured image faithful.
        if(uPosterReady>.5&&uAmount<.0001){
          gl_FragColor=vec4(texture2D(uPoster,vUv).rgb,1.);
          #include <colorspace_fragment>
          return;
        }
        vec2 p=(vUv-.5)*vec2(uAspect,1.)*2.;
        float bass=uBands.x,mid=uBands.y,high=uBands.z,energy=uBands.w;
        // Bass displaces the folds, mids separate the strands, and the real
        // high band adds fine detail. Silence leaves a still, dim composition.
        p.y+=uMotion*(.22*bass+.10*uOnset)*sin(p.x*1.5+uTime*.12);
        vec3 teal=vec3(.055,.63,.58),amber=vec3(1.0,.37,.105);
        vec3 color=vec3(.003,.009,.019);
        float haze=exp(-dot(p*vec2(.36,1.2),p*vec2(.36,1.2)));
        color+=vec3(.009,.035,.046)*haze;
        for(int i=0;i<6;i++){
          float fi=float(i),phase=fi*.43;
          vec2 q=p;
          float localBand=fi<2.?bass:(fi<4.?mid:high);
          q.y+=(fi-2.5)*(.075+uMotion*(.105*mid+.035*uOnset));
          q.y+=uMotion*(.10*mid*sin(p.x*4.8+fi*1.1+uTime*.2)
            +.032*high*sin(p.x*14.+phase*3.)+.06*localBand*sin(phase*2.));
          float w=.012+.004*sin(fi*1.7+1.)+.006*mid+.004*uOnset;
          float bend=.035+uMotion*(bass*.28+uOnset*.09);
          float fold=ribbon(q,phase,w,bend);
          vec3 hue=mix(teal,amber,smoothstep(2.,5.,fi));
          float flow=.58+.42*sin(p.x*.7+fi*.9-uTime*.15);
          color+=hue*fold*flow*(.38+energy*1.7+localBand*.22+uOnset*.22);
          float filament=ribbon(q+vec2(0.,.025),phase,w*.23,bend);
          color+=mix(hue,vec3(.76,.94,.9),.52)*filament*(.10+high*.75);
        }
        float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x)
          *smoothstep(0.,.13,vUv.y)*smoothstep(0.,.13,1.-vUv.y);
        color*=edge;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        if(uPosterReady>.5)gl_FragColor.rgb=mix(texture2D(uPoster,vUv).rgb,gl_FragColor.rgb,uAmount);
        #include <colorspace_fragment>
      }`,
  });
  const plane=new THREE.Mesh(geometry,material);plane.name='runtime_music_screen';
  plane.rotation.y=facing*Math.PI/2;plane.position.fromArray(state.surface.position);
  plane.castShadow=false;plane.receiveShadow=false;scene.add(plane);

  // A broad but finite cone reaches the cinema seats, not the next gallery.
  // Existing wall/chair shadow casters occlude it. Changes in its color and
  // intensity need no new shadow render while the room geometry is stationary.
  const light=new THREE.SpotLight('#a0d9cf',0,11.6,.88,.92,2);
  light.name='runtime_music_screen_bounce';light.position.set(screenX+facing*.12,3.65,center.z);
  light.target.position.set(screenX+facing*6.6857,.45,center.z);light.castShadow=true;
  light.shadow.mapSize.set(512,512);light.shadow.camera.near=.12;light.shadow.camera.far=11.6;
  light.shadow.bias=-.0002;light.shadow.normalBias=.035;light.shadow.radius=2;
  light.shadow.autoUpdate=false;light.visible=false;scene.add(light,light.target);
  const cold=new THREE.Color('#8ccec8'),warm=new THREE.Color('#ffd09c');
  const motionChange=event=>{state.reducedMotion=event.matches;};reducedMotion.addEventListener('change',motionChange);
  let previousTime=null,artTime=0,slowEnergy=0;
  // These are visual display ranges, never audio gain. A bounded, slow peak
  // follower makes this quiet soundtrack readable without promoting silence.
  const peaks={bass:.22,mid:.05,treble:.008,energy:.36};
  const floors={bass:.14,mid:.035,treble:.006,energy:.25};
  const unit=value=>THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1);
  const cameraPose={position:[screenX+facing*10.3857,1.7,center.z],target:[screenX,2.91,center.z],fov:54,aspect:1.1};
  return {
    state,cameraPose,
    // time is seconds, matching the gallery's studies update clock.
    update(time,analysis={},amount=0){
      if(state.disposed)return;
      const delta=previousTime===null?0:THREE.MathUtils.clamp(time-previousTime,0,.1);previousTime=time;
      state.amount=unit(amount);const active=state.amount>.0001;
      const shadowAvailable=!!renderer?.shadowMap?.enabled;
      state.active=active;
      const playing=active&&!!analysis.playing;
      const rawEnergy=playing?unit(analysis.energy):0;
      const audible=playing&&rawEnergy>.002;
      const animationTarget=audible?state.amount:0;
      state.animationMix+=(animationTarget-state.animationMix)*(1-Math.exp(-delta/(animationTarget>state.animationMix?.4:.3)));
      if(Math.abs(animationTarget-state.animationMix)<.0005)state.animationMix=animationTarget;
      state.mode=state.animationMix<.0001?'poster':state.animationMix>.999?'animated':'transition';
      const illuminate=state.animationMix>.0001&&shadowAvailable;
      if(illuminate&&(!light.visible||shadowAvailable!==state.shadowAvailable))light.shadow.needsUpdate=true;
      light.visible=illuminate;
      const activity=THREE.MathUtils.smoothstep(rawEnergy,.004,.065);
      const onset=playing?unit((rawEnergy-slowEnergy-.008)*5):0;
      slowEnergy+=(rawEnergy-slowEnergy)*(1-Math.exp(-delta/1.2));
      for(const band of ['bass','mid','treble','energy']){
        const raw=playing?unit(analysis[band]):0;
        state.rawBands[band]=raw;
        peaks[band]=Math.max(floors[band],raw,peaks[band]*Math.exp(-delta/8));
        const target=activity*(1-Math.exp(-raw/Math.max(floors[band],peaks[band]*.8)));
        const smoothing=1-Math.exp(-delta/(target>state.bands[band] ? .045 : .18));
        state.bands[band]+=(target-state.bands[band])*smoothing;
        if(state.bands[band]<.0001)state.bands[band]=0;
      }
      state.response.onset+=(onset-state.response.onset)*(1-Math.exp(-delta/(onset>state.response.onset ? .045 : .22)));
      state.response.activity=activity;
      // No autonomous clock motion when paused or muted. Reduced motion keeps
      // the spectrum visible mostly through brightness, with a quieter shape.
      if(audible)artTime+=delta*(state.reducedMotion?.035:.7)*state.bands.energy;
      state.response.motionTime=artTime;
      uniforms.uTime.value=artTime;uniforms.uAmount.value=state.animationMix;
      uniforms.uOnset.value=state.response.onset;uniforms.uMotion.value=state.reducedMotion?.18:1;
      uniforms.uBands.value.set(state.bands.bass,state.bands.mid,state.bands.treble,state.bands.energy);
      // If the visitor disables shadow rendering, keep the emissive artwork
      // but suppress its bounce rather than illuminate through room walls.
      state.lightIntensity=shadowAvailable?state.animationMix*(32+state.bands.energy*20+state.response.onset*5):0;
      light.intensity=state.lightIntensity;light.color.copy(cold).lerp(warm,.26+state.bands.mid*.25);
      state.shadowAvailable=shadowAvailable;
    },
    dispose(){
      if(state.disposed)return;state.disposed=true;state.active=false;state.ready=false;state.lightIntensity=0;state.animationMix=0;state.mode='disposed';
      reducedMotion.removeEventListener('change',motionChange);
      scene.remove(plane,light,light.target);geometry.dispose();material.dispose();poster.dispose();light.shadow.map?.dispose();light.shadow.mapPass?.dispose();
    },
  };
}
