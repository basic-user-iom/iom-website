import {PlaneGeometry,Color,Matrix4,ShaderMaterial} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

// A low-resolution, softly filtered reflection of the actual scene, not a baked photo.
// It follows the current camera and lighting; at zero light it contributes black.
export function createFloorReflection(){
 const reflection=new Reflector(new PlaneGeometry(7.94,9),{textureWidth:256,textureHeight:256,multisample:0,clipBias:.001,
  shader:{name:'Soft stone reflection',uniforms:{color:{value:new Color(.5,.5,.5)},tDiffuse:{value:null},textureMatrix:{value:new Matrix4()}},
   vertexShader:`uniform mat4 textureMatrix; varying vec4 vUv;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){vUv=textureMatrix*vec4(position,1.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
   #include <logdepthbuf_vertex>
   }`,
   fragmentShader:`uniform sampler2D tDiffuse; varying vec4 vUv;
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    vec2 uv=vUv.xy/vUv.w;vec2 d=vec2(1.5/256.0);vec3 c=texture2D(tDiffuse,uv).rgb*4.0;
    c+=(texture2D(tDiffuse,uv+vec2(d.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(d.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,d.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,d.y)).rgb)*2.0;
    c+=texture2D(tDiffuse,uv+d).rgb+texture2D(tDiffuse,uv-d).rgb+texture2D(tDiffuse,uv+vec2(d.x,-d.y)).rgb+texture2D(tDiffuse,uv+vec2(-d.x,d.y)).rgb;
    gl_FragColor=vec4(c/16.0,.20);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}
 });
 reflection.name='Soft floor reflection';reflection.rotation.x=-Math.PI/2;reflection.position.set(2.03,.006,1.5);const material=reflection.material as ShaderMaterial;material.transparent=true;material.depthWrite=false;reflection.renderOrder=2;
 return reflection;
}
