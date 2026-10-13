import * as THREE from 'three';
// Preserve the HDRI's direction and luminance, but reduce its foliage colour
// cast only for the ceramic backsplash. The visible panorama is untouched.
export function createTileEnvironment(renderer:THREE.WebGLRenderer,hdr:THREE.DataTexture){
 const source=hdr.image.data as Uint16Array|Float32Array,data=source.slice(),half=hdr.type===THREE.HalfFloatType;
 for(let i=0;i<data.length;i+=4){const r=half?THREE.DataUtils.fromHalfFloat(data[i]):data[i],g=half?THREE.DataUtils.fromHalfFloat(data[i+1]):data[i+1],b=half?THREE.DataUtils.fromHalfFloat(data[i+2]):data[i+2],y=.2126*r+.7152*g+.0722*b;for(let c=0;c<3;c++){const value=y*.65+[r,g,b][c]*.35;data[i+c]=half?THREE.DataUtils.toHalfFloat(value):value;}}
 const neutral=new THREE.DataTexture(data,hdr.image.width,hdr.image.height,THREE.RGBAFormat,hdr.type);neutral.colorSpace=hdr.colorSpace;neutral.mapping=THREE.EquirectangularReflectionMapping;neutral.needsUpdate=true;
 const generator=new THREE.PMREMGenerator(renderer),result=generator.fromEquirectangular(neutral);generator.dispose();neutral.dispose();return result;
}
