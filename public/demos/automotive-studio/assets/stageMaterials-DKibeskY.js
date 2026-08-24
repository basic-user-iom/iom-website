import{n as N,a as A,Q as b,c as g,C as L,S as F,ag as I}from"./three-xRHWo4Jt.js";import{z as G}from"./runtime-core-BOhhGRKD.js";const P=new N,M=new Map,v=new Map,T=new Map;let p=1;function $(t){const a=Math.max(1,Math.floor(t)||1);if(a!==p){p=a;for(const i of M.values())i.anisotropy=p,i.needsUpdate=!0}}async function B(t){const a=M.get(t);if(a)return a;const i=v.get(t);if(i)return i;const e=(async()=>{try{const n=await G(t);if(!n)return null;const o=T.get(t);o&&URL.revokeObjectURL(o);const u=URL.createObjectURL(n);T.set(t,u);const l=await new Promise((m,S)=>{P.load(u,m,void 0,S)});return l.wrapS=g,l.wrapT=g,l.generateMipmaps=!0,l.minFilter=I,l.anisotropy=p,M.set(t,l),l}finally{v.delete(t)}})();return v.set(t,e),e}async function f(t){if(!t)return null;const a=await B(t);if(!a)return null;const i=a.clone();return i.wrapS=g,i.wrapT=g,i.generateMipmaps=a.generateMipmaps,i.minFilter=a.minFilter,i.anisotropy=p,i}function ee(){for(const t of M.values())t.dispose();M.clear(),v.clear();for(const t of T.values())URL.revokeObjectURL(t);T.clear()}const h=new WeakMap,H=`
uniform float uTileVariation;
uniform float uTileSeed;
vec2 iomDetileUv( vec2 uv, float scale, float seedMul ) {
  float s = sin( uTileSeed * seedMul );
  float c = cos( uTileSeed * seedMul );
  return mat2( c, -s, s, c ) * uv * scale
    + vec2( fract( uTileSeed * 0.37 * seedMul ), fract( uTileSeed * 0.61 * seedMul ) );
}
float iomDetileCell( vec2 uv, float seedMul ) {
  float cell = floor( uv.x * 0.41 ) + floor( uv.y * 0.41 ) * 19.0;
  return fract( sin( ( cell + uTileSeed * seedMul ) * 12.9898 ) * 43758.5453 );
}
float iomDetileSampleG( sampler2D tex, vec2 uv, float seedMul ) {
  float w = smoothstep( 0.18, 0.82, iomDetileCell( uv, seedMul ) );
  float a = texture2D( tex, iomDetileUv( uv, 1.0, seedMul ) ).g;
  float b = texture2D( tex, iomDetileUv( uv, 0.91, seedMul + 1.17 ) ).g;
  return mix( a, b, w );
}
vec3 iomDetileSampleRgb( sampler2D tex, vec2 uv, float seedMul ) {
  float w = smoothstep( 0.18, 0.82, iomDetileCell( uv, seedMul ) );
  vec3 a = texture2D( tex, iomDetileUv( uv, 1.0, seedMul ) ).rgb;
  vec3 b = texture2D( tex, iomDetileUv( uv, 0.91, seedMul + 1.17 ) ).rgb;
  return mix( a, b, w );
}
`,j=`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( uTileVariation > 0.001 ) {
    sampledDiffuseColor.rgb = mix(
      sampledDiffuseColor.rgb,
      iomDetileSampleRgb( map, vMapUv, 1.0 ),
      uTileVariation
    );
  }
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`,z=`
#if defined( USE_NORMALMAP_TANGENTSPACE )
  if ( uTileVariation > 0.001 ) {
    float nW = smoothstep( 0.18, 0.82, iomDetileCell( vNormalMapUv, 1.17 ) ) * uTileVariation;
    vec2 nUv = iomDetileUv( vNormalMapUv, 0.97, 1.17 );
    vec3 mapN2 = texture2D( normalMap, nUv ).xyz * 2.0 - 1.0;
    mapN2.xy *= normalScale;
    vec3 nAlt = normalize( tbn * mapN2 );
    normal = normalize( mix( normal, nAlt, nW * 0.9 ) );
  }
#endif
`,W=`
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  float roughnessTexel = texture2D( roughnessMap, vRoughnessMapUv ).g;
  if ( uTileVariation > 0.001 ) {
    roughnessTexel = mix(
      roughnessTexel,
      iomDetileSampleG( roughnessMap, vRoughnessMapUv, 1.31 ),
      uTileVariation
    );
  }
  roughnessFactor *= roughnessTexel;
#endif
`,k=`
float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  float metalnessTexel = texture2D( metalnessMap, vMetalnessMapUv ).b;
  if ( uTileVariation > 0.001 ) {
    // ORM packs metalness in B; sampleG uses .g — use rgb.b via a dedicated blend.
    float w = smoothstep( 0.18, 0.82, iomDetileCell( vMetalnessMapUv, 1.47 ) );
    float a = texture2D( metalnessMap, iomDetileUv( vMetalnessMapUv, 1.0, 1.47 ) ).b;
    float b = texture2D( metalnessMap, iomDetileUv( vMetalnessMapUv, 0.91, 2.64 ) ).b;
    metalnessTexel = mix( metalnessTexel, mix( a, b, w ), uTileVariation );
  }
  metalnessFactor *= metalnessTexel;
#endif
`,X=`
#ifdef USE_AOMAP
  float ambientOcclusionTexel = texture2D( aoMap, vAoMapUv ).r;
  if ( uTileVariation > 0.001 ) {
    float w = smoothstep( 0.18, 0.82, iomDetileCell( vAoMapUv, 1.63 ) );
    float a = texture2D( aoMap, iomDetileUv( vAoMapUv, 1.0, 1.63 ) ).r;
    float b = texture2D( aoMap, iomDetileUv( vAoMapUv, 0.91, 2.8 ) ).r;
    ambientOcclusionTexel = mix( ambientOcclusionTexel, mix( a, b, w ), uTileVariation );
  }
  float ambientOcclusion = ( ambientOcclusionTexel - 1.0 ) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
#endif
`,K=`
#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
  if ( uTileVariation > 0.001 ) {
    emissiveColor.rgb = mix(
      emissiveColor.rgb,
      iomDetileSampleRgb( emissiveMap, vEmissiveMapUv, 1.79 ),
      uTileVariation
    );
  }
  #ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
    emissiveColor = sRGBTransferEOTF( emissiveColor );
  #endif
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif
`;function Q(t,a,i){let e=h.get(t);e||(e={uTileVariation:{value:0},uTileSeed:{value:0}},h.set(t,e));const n=e;t.onBeforeCompile=o=>{o.uniforms.uTileVariation=n.uTileVariation,o.uniforms.uTileSeed=n.uTileSeed,o.fragmentShader=H+o.fragmentShader.replace("#include <map_fragment>",j).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
`+z).replace("#include <roughnessmap_fragment>",W).replace("#include <metalnessmap_fragment>",k).replace("#include <aomap_fragment>",X).replace("#include <emissivemap_fragment>",K)},t.customProgramCacheKey=()=>"iom-stage-detile-v4-blend",e.uTileVariation.value=Math.max(0,Math.min(1,a||0)),e.uTileSeed.value=Number.isFinite(i)?i:1}function y(t,a){const i=new L;try{i.set(t||a)}catch{i.setHex(a)}return i}async function te(t,a,i){const e=t.material instanceof b?t.material:new b;if(t.material!==e){const s=t.material;t.material=e,Array.isArray(s)?s.forEach(r=>r.dispose()):s.dispose?.()}e.color.copy(y(a.color,657930)),e.metalness=Math.max(0,Math.min(1,a.metalness)),e.roughness=Math.max(0,Math.min(1,a.roughness));const n=.2126*e.color.r+.7152*e.color.g+.0722*e.color.b;n>.35?(e.envMapIntensity=Math.min(.4,.85-n*.5),e.roughness=Math.max(e.roughness,.72),e.metalness=Math.min(e.metalness,.05)):e.envMapIntensity=1;const o=y(a.emissive,0),u=Math.max(0,Math.min(8,a.emissiveIntensity));u>0&&o.r+o.g+o.b<.004&&o.copy(e.color),e.emissive.copy(o),e.emissiveIntensity=u,e.displacementScale=Math.max(0,Math.min(1,a.displacementScale)),e.displacementBias=e.displacementScale>0?-e.displacementScale*.5:0,i?.polygonOffset?(e.polygonOffset=!0,e.polygonOffsetFactor=-2,e.polygonOffsetUnits=-2):t.name==="StudioFloor"?(e.polygonOffset=!0,e.polygonOffsetFactor=2,e.polygonOffsetUnits=2):t.name==="StudioCyclorama"&&(e.polygonOffset=!0,e.polygonOffsetFactor=-1,e.polygonOffsetUnits=-1);const l=Math.max(.0625,Math.min(1024,a.mapRepeat||1)),m=a.maps??{},[S,E,O,_,C,D,R]=await Promise.all([f(m.mapAssetId),f(m.normalMapAssetId),f(m.roughnessMapAssetId),f(m.metalnessMapAssetId),f(m.displacementMapAssetId),f(m.aoMapAssetId),f(m.emissiveMapAssetId)]),x=Math.max(0,Math.min(1,a.tileVariation??0)),U=Number.isFinite(a.tileSeed)?a.tileSeed:1,c=(s,r,V,w=!1)=>{const d=e[s];d&&d!==r&&!q(d)&&d.dispose(),e[s]=r,r&&(r.repeat.set(l,l),Y(r,U,x,V),r.anisotropy=p,r.needsUpdate=!0,w&&(r.colorSpace=F))};if(c("map",S,0,!0),c("normalMap",E,1),c("roughnessMap",O,2),c("metalnessMap",_,3),c("displacementMap",C,4),c("aoMap",D,5),c("emissiveMap",R,6,!0),E&&(e.normalScale=new A(1,a.normalYFlip?-1:1)),D){e.aoMapIntensity=1;const s=t.geometry;s?.attributes?.uv&&!s.attributes.uv2&&s.setAttribute("uv2",s.attributes.uv)}Q(e,x,U),e.needsUpdate=!0}function ae(t,a,i=new A){if(!(a>0))return i.set(0,0);const e=Number.isFinite(t)?t:1,n=o=>(o%1+1)%1;return i.set(n(e*.37),n(e*.61))}function Y(t,a,i,e=0){if(t.center.set(.5,.5),!(i>0)){t.offset.set(0,0),t.rotation=0;return}const n=(Number.isFinite(a)?a:1)+e*17.23,o=u=>(u%1+1)%1;t.offset.set(o(n*.37)*i,o(n*.61)*i),t.rotation=o(n*.19)*Math.PI*2*(.2+.8*i)}function q(t){for(const a of M.values())if(a===t)return!0;return!1}export{te as applyStageSurfaceMaterial,Y as applyTileVariationTransform,ee as disposeStageTextureCache,f as loadStageTexture,$ as setStageTextureAnisotropy,ae as tileVariationUvOffset};
