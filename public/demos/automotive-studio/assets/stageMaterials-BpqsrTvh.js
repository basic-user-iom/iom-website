import{m as w,a as y,z as x,c as T,C as N,S as L,ac as F}from"./three-7zx0NNHW.js";import{z as I}from"./runtime-core-D3XVd8PF.js";const G=new w,p=new Map,v=new Map,g=new Map;let f=1;function Z(e){const a=Math.max(1,Math.floor(e)||1);if(a!==f){f=a;for(const i of p.values())i.anisotropy=f,i.needsUpdate=!0}}async function P(e){const a=p.get(e);if(a)return a;const i=v.get(e);if(i)return i;const t=(async()=>{try{const o=await I(e);if(!o)return null;const n=g.get(e);n&&URL.revokeObjectURL(n);const m=URL.createObjectURL(o);g.set(e,m);const s=await new Promise((S,M)=>{G.load(m,S,void 0,M)});return s.wrapS=T,s.wrapT=T,s.generateMipmaps=!0,s.minFilter=F,s.anisotropy=f,p.set(e,s),s}finally{v.delete(e)}})();return v.set(e,t),t}async function c(e){if(!e)return null;const a=await P(e);if(!a)return null;const i=a.clone();return i.wrapS=T,i.wrapT=T,i.generateMipmaps=a.generateMipmaps,i.minFilter=a.minFilter,i.anisotropy=f,i}function $(){for(const e of p.values())e.dispose();p.clear(),v.clear();for(const e of g.values())URL.revokeObjectURL(e);g.clear()}const b=new WeakMap,B=`
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
`,H=`
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
`,j=`
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
`,W=`
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
`,k=`
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
`,X=`
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
`;function K(e,a,i){let t=b.get(e);t||(t={uTileVariation:{value:0},uTileSeed:{value:0}},b.set(e,t));const o=t;e.onBeforeCompile=n=>{n.uniforms.uTileVariation=o.uTileVariation,n.uniforms.uTileSeed=o.uTileSeed,n.fragmentShader=B+n.fragmentShader.replace("#include <map_fragment>",H).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
`+z).replace("#include <roughnessmap_fragment>",j).replace("#include <metalnessmap_fragment>",W).replace("#include <aomap_fragment>",k).replace("#include <emissivemap_fragment>",X)},e.customProgramCacheKey=()=>"iom-stage-detile-v4-blend",t.uTileVariation.value=Math.max(0,Math.min(1,a||0)),t.uTileSeed.value=Number.isFinite(i)?i:1}function A(e,a){const i=new N;try{i.set(e||a)}catch{i.setHex(a)}return i}async function ee(e,a,i){const t=e.material instanceof x?e.material:new x;if(e.material!==t){const l=e.material;e.material=t,Array.isArray(l)?l.forEach(r=>r.dispose()):l.dispose?.()}t.color.copy(A(a.color,1448482)),t.metalness=Math.max(0,Math.min(1,a.metalness)),t.roughness=Math.max(0,Math.min(1,a.roughness));const o=A(a.emissive,0),n=Math.max(0,Math.min(8,a.emissiveIntensity));n>0&&o.r+o.g+o.b<.004&&o.copy(t.color),t.emissive.copy(o),t.emissiveIntensity=n,t.displacementScale=Math.max(0,Math.min(1,a.displacementScale)),t.displacementBias=t.displacementScale>0?-t.displacementScale*.5:0,i?.polygonOffset?(t.polygonOffset=!0,t.polygonOffsetFactor=-2,t.polygonOffsetUnits=-2):e.name==="StudioFloor"?(t.polygonOffset=!0,t.polygonOffsetFactor=2,t.polygonOffsetUnits=2):e.name==="StudioCyclorama"&&(t.polygonOffset=!0,t.polygonOffsetFactor=-1,t.polygonOffsetUnits=-1);const m=Math.max(.0625,Math.min(1024,a.mapRepeat||1)),s=a.maps??{},[S,M,h,O,_,E,C]=await Promise.all([c(s.mapAssetId),c(s.normalMapAssetId),c(s.roughnessMapAssetId),c(s.metalnessMapAssetId),c(s.displacementMapAssetId),c(s.aoMapAssetId),c(s.emissiveMapAssetId)]),D=Math.max(0,Math.min(1,a.tileVariation??0)),U=Number.isFinite(a.tileSeed)?a.tileSeed:1,u=(l,r,R,V=!1)=>{const d=t[l];d&&d!==r&&!q(d)&&d.dispose(),t[l]=r,r&&(r.repeat.set(m,m),Y(r,U,D,R),r.anisotropy=f,r.needsUpdate=!0,V&&(r.colorSpace=L))};if(u("map",S,0,!0),u("normalMap",M,1),u("roughnessMap",h,2),u("metalnessMap",O,3),u("displacementMap",_,4),u("aoMap",E,5),u("emissiveMap",C,6,!0),M&&(t.normalScale=new y(1,a.normalYFlip?-1:1)),E){t.aoMapIntensity=1;const l=e.geometry;l?.attributes?.uv&&!l.attributes.uv2&&l.setAttribute("uv2",l.attributes.uv)}K(t,D,U),t.needsUpdate=!0}function te(e,a,i=new y){if(!(a>0))return i.set(0,0);const t=Number.isFinite(e)?e:1,o=n=>(n%1+1)%1;return i.set(o(t*.37),o(t*.61))}function Y(e,a,i,t=0){if(e.center.set(.5,.5),!(i>0)){e.offset.set(0,0),e.rotation=0;return}const o=(Number.isFinite(a)?a:1)+t*17.23,n=m=>(m%1+1)%1;e.offset.set(n(o*.37)*i,n(o*.61)*i),e.rotation=n(o*.19)*Math.PI*2*(.2+.8*i)}function q(e){for(const a of p.values())if(a===e)return!0;return!1}export{ee as applyStageSurfaceMaterial,Y as applyTileVariationTransform,$ as disposeStageTextureCache,c as loadStageTexture,Z as setStageTextureAnisotropy,te as tileVariationUvOffset};
