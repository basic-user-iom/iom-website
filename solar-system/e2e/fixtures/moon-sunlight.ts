import { AmbientLight, Color, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, SphereGeometry, WebGLRenderer } from 'three';
import { attachMoonSunlight, updateMoonSunlight } from '../../src/rendering/satellites/MoonSunlight';

// Real GPU coverage: a string assertion cannot detect a broken GLSL lighting path.
const renderer = new WebGLRenderer({ antialias: false });
renderer.setSize(128, 128);
document.body.append(renderer.domElement);
const material = new MeshStandardMaterial({ color: new Color(.4,.4,.4), roughness: .9, metalness: 0 });
const light = attachMoonSunlight(material);
const geometry = new SphereGeometry(1,48,32);
const moon = new Mesh(geometry,material);
const scene = new Scene();
scene.add(moon, new AmbientLight(0xffffff,10), new PointLight(0xffffff,100));
const camera = new PerspectiveCamera(50,1,.01,100);
function sample(sunwardY:number, eclipsed=false, scale=1, offset=0):number {
  moon.position.set(offset,0,0);moon.scale.setScalar(scale);
  camera.position.set(offset,0,3*scale);camera.near=scale*.01;camera.far=scale*10;
  camera.lookAt(moon.position);camera.updateProjectionMatrix();
  updateMoonSunlight(light,{x:0,y:sunwardY,z:0},eclipsed);
  renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(16*16*4);
  gl.readPixels(56,56,16,16,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let total=0;for(let i=0;i<pixels.length;i+=4)total+=pixels[i]!*.2126+pixels[i+1]!*.7152+pixels[i+2]!*.0722;
  return total/256;
}
const result={day:sample(-1e11),night:sample(1e11),eclipse:sample(-1e11,true),
  farSun:sample(-1e13),rebased:sample(-1e11,false,1,10000),tiny:sample(-1e11,false,1e-6)};
const output=document.createElement('output');output.id='lighting-results';output.textContent=JSON.stringify(result);document.body.append(output);
geometry.dispose();material.dispose();renderer.dispose();
