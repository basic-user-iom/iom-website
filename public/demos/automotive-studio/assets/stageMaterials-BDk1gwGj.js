import{n as I,a as O,Q as y,c as S,C as P,S as G,ag as B}from"./three-xRHWo4Jt.js";import{z as H}from"./runtime-core-BOhhGRKD.js";const j=new I,d=new Map,T=new Map,E=new Map,z=8;let m=1;function ne(e){const a=Math.max(1,Math.min(z,Math.floor(e)||1));if(a!==m){m=a;for(const i of d.values())i.anisotropy=m,i.needsUpdate=!0}}function W(e){return e>=32?Math.min(m,2):e>=12?Math.min(m,4):m}async function K(e){const a=d.get(e);if(a)return a;const i=T.get(e);if(i)return i;const t=(async()=>{try{const o=await H(e);if(!o)return null;const n=E.get(e);n&&URL.revokeObjectURL(n);const s=URL.createObjectURL(o);E.set(e,s);const r=await new Promise((M,v)=>{j.load(s,M,void 0,v)});return r.wrapS=S,r.wrapT=S,r.generateMipmaps=!0,r.minFilter=B,r.anisotropy=m,d.set(e,r),r}finally{T.delete(e)}})();return T.set(e,t),t}async function p(e){if(!e)return null;const a=await K(e);if(!a)return null;const i=a.clone();return i.wrapS=S,i.wrapT=S,i.generateMipmaps=a.generateMipmaps,i.minFilter=a.minFilter,i.anisotropy=m,i}function se(){for(const e of d.values())e.dispose();d.clear(),T.clear();for(const e of E.values())URL.revokeObjectURL(e);E.clear()}const D=new WeakMap,X=`
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
`,k=`
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
`,Y=`
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
`,Q=`
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
`,q=`
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
`,J=`
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
`,Z=`
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
`;function $(e){if(!D.has(e)){e.onBeforeCompile=()=>{},e.customProgramCacheKey=()=>"";return}D.delete(e),e.onBeforeCompile=()=>{},e.customProgramCacheKey=()=>"",e.needsUpdate=!0}function ee(e,a,i){const t=Math.max(0,Math.min(1,a||0));if(t<=.001){$(e);return}let o=D.get(e);o||(o={uTileVariation:{value:0},uTileSeed:{value:0}},D.set(e,o));const n=o;e.onBeforeCompile=s=>{s.uniforms.uTileVariation=n.uTileVariation,s.uniforms.uTileSeed=n.uTileSeed,s.fragmentShader=X+s.fragmentShader.replace("#include <map_fragment>",k).replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
`+Y).replace("#include <roughnessmap_fragment>",Q).replace("#include <metalnessmap_fragment>",q).replace("#include <aomap_fragment>",J).replace("#include <emissivemap_fragment>",Z)},e.customProgramCacheKey=()=>"iom-stage-detile-v4-blend",o.uTileVariation.value=t,o.uTileSeed.value=Number.isFinite(i)?i:1}function A(e,a){const i=new P;try{i.set(e||a)}catch{i.setHex(a)}return i}async function le(e,a,i){const t=e.material instanceof y?e.material:new y;if(e.material!==t){const l=e.material;e.material=t,Array.isArray(l)?l.forEach(u=>u.dispose()):l.dispose?.()}t.color.copy(A(a.color,657930)),t.metalness=Math.max(0,Math.min(1,a.metalness)),t.roughness=Math.max(0,Math.min(1,a.roughness));const o=.2126*t.color.r+.7152*t.color.g+.0722*t.color.b;o>.35?(t.envMapIntensity=Math.min(.4,.85-o*.5),t.roughness=Math.max(t.roughness,.72),t.metalness=Math.min(t.metalness,.05)):t.envMapIntensity=1;const n=A(a.emissive,0),s=Math.max(0,Math.min(8,a.emissiveIntensity));s>0&&n.r+n.g+n.b<.004&&n.copy(t.color),t.emissive.copy(n),t.emissiveIntensity=s;const r=Math.max(0,Math.min(1,a.displacementScale)),M=r>.001;t.displacementScale=M?r:0,t.displacementBias=M?-t.displacementScale*.5:0,i?.polygonOffset?(t.polygonOffset=!0,t.polygonOffsetFactor=-2,t.polygonOffsetUnits=-2):e.name==="StudioFloor"?(t.polygonOffset=!0,t.polygonOffsetFactor=2,t.polygonOffsetUnits=2):e.name==="StudioCyclorama"&&(t.polygonOffset=!0,t.polygonOffsetFactor=-1,t.polygonOffsetUnits=-1);const v=Math.max(.0625,Math.min(1024,a.mapRepeat||1)),_=W(v),c=a.maps??{},[C,U,R,V,w,x,N]=await Promise.all([p(c.mapAssetId),p(c.normalMapAssetId),p(c.roughnessMapAssetId),p(c.metalnessMapAssetId),M?p(c.displacementMapAssetId):Promise.resolve(null),p(c.aoMapAssetId),p(c.emissiveMapAssetId)]),b=Math.max(0,Math.min(1,a.tileVariation??0)),h=Number.isFinite(a.tileSeed)?a.tileSeed:1,f=(l,u,F,L=!1)=>{const g=t[l];g&&g!==u&&!ae(g)&&g.dispose(),t[l]=u,u&&(u.repeat.set(v,v),te(u,h,b,F),u.anisotropy=_,u.needsUpdate=!0,L&&(u.colorSpace=G))};if(f("map",C,0,!0),f("normalMap",U,1),f("roughnessMap",R,2),f("metalnessMap",V,3),f("displacementMap",M?w:null,4),f("aoMap",x,5),f("emissiveMap",N,6,!0),U&&(t.normalScale=new O(1,a.normalYFlip?-1:1)),x){t.aoMapIntensity=1;const l=e.geometry;l?.attributes?.uv&&!l.attributes.uv2&&l.setAttribute("uv2",l.attributes.uv)}ee(t,b,h),t.needsUpdate=!0}function re(e,a,i=new O){if(!(a>0))return i.set(0,0);const t=Number.isFinite(e)?e:1,o=n=>(n%1+1)%1;return i.set(o(t*.37),o(t*.61))}function te(e,a,i,t=0){if(e.center.set(.5,.5),!(i>0)){e.offset.set(0,0),e.rotation=0;return}const o=(Number.isFinite(a)?a:1)+t*17.23,n=s=>(s%1+1)%1;e.offset.set(n(o*.37)*i,n(o*.61)*i),e.rotation=n(o*.19)*Math.PI*2*(.2+.8*i)}function ae(e){for(const a of d.values())if(a===e)return!0;return!1}export{le as applyStageSurfaceMaterial,te as applyTileVariationTransform,se as disposeStageTextureCache,p as loadStageTexture,ne as setStageTextureAnisotropy,re as tileVariationUvOffset};
