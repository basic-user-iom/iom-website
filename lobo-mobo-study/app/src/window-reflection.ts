import {BufferGeometry,Float32BufferAttribute,ShaderMaterial,Matrix4,Color} from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
export function createWindowReflection(){
 const vertices:number[]=[];for(const [a,b] of [[-1.375,-.475],[-.425,1.375],[-2.975,-1.425],[-4.575,-3.025],[-6.175,-4.625]])vertices.push(a,-1.535,0,b,-1.535,0,b,1.535,0,a,-1.535,0,b,1.535,0,a,1.535,0);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const plane=new Reflector(geometry,{textureWidth:256,textureHeight:256,multisample:0,clipBias:.001,shader:{name:'Subtle window reflection',uniforms:{color:{value:new Color(1,1,1)},tDiffuse:{value:null},textureMatrix:{value:new Matrix4()}},
 vertexShader:`uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vEye; varying vec3 vNormal;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vUv=textureMatrix*vec4(position,1.);vec4 mv=modelViewMatrix*vec4(position,1.);vEye=-mv.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*mv;
 #include <logdepthbuf_vertex>
 }`,fragmentShader:`uniform sampler2D tDiffuse; varying vec4 vUv; varying vec3 vEye; varying vec3 vNormal;
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 float facing=clamp(abs(dot(normalize(vEye),normalize(vNormal))),0.,1.);float alpha=.04+.15*pow(1.-facing,3.);
 gl_FragColor=vec4(texture2DProj(tDiffuse,vUv).rgb,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`}});
 plane.name='Subtle angle-dependent window reflection';plane.rotation.y=Math.PI/2;plane.position.set(-1.929,1.65,-.2);const m=plane.material as ShaderMaterial;m.transparent=true;m.depthWrite=false;plane.renderOrder=3;return plane;
}
