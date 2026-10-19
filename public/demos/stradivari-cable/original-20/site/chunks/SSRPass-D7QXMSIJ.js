import{a as T}from"./chunk-AHNDUMLA.js";import{a as I,b as U}from"./chunk-3GDF4QOC.js";import{A as E,Aa as N,C as M,Fa as A,N as P,S as v,W as D,Y as w,_ as C,e as n,ea as m,f as x,fa as p,g as S,h as b,i as R,u as r}from"./chunk-B7VF4DY3.js";var l={name:"SSRShader",defines:{MAX_STEP:0,PERSPECTIVE_CAMERA:!0,DISTANCE_ATTENUATION:!0,FRESNEL:!0,INFINITE_THICK:!1,SELECTIVE:!1},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tMetalness:{value:null},tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null},resolution:{value:new P},cameraProjectionMatrix:{value:new D},cameraInverseProjectionMatrix:{value:new D},opacity:{value:.5},maxDistance:{value:180},cameraRange:{value:0},thickness:{value:.018}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}

	`,fragmentShader:`
		// precision highp float;
		precision highp sampler2D;
		varying vec2 vUv;
		uniform sampler2D tDepth;
		uniform sampler2D tNormal;
		uniform sampler2D tMetalness;
		uniform sampler2D tDiffuse;
		uniform float cameraRange;
		uniform vec2 resolution;
		uniform float opacity;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform float maxDistance;
		uniform float thickness;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;
		#include <packing>
		float pointToLineDistance(vec3 x0, vec3 x1, vec3 x2) {
			//x0: point, x1: linePointA, x2: linePointB
			//https://mathworld.wolfram.com/Point-LineDistance3-Dimensional.html
			return length(cross(x0-x1,x0-x2))/length(x2-x1);
		}
		float pointPlaneDistance(vec3 point,vec3 planePoint,vec3 planeNormal){
			// https://mathworld.wolfram.com/Point-PlaneDistance.html
			//// https://en.wikipedia.org/wiki/Plane_(geometry)
			//// http://paulbourke.net/geometry/pointlineplane/
			float a=planeNormal.x,b=planeNormal.y,c=planeNormal.z;
			float x0=point.x,y0=point.y,z0=point.z;
			float x=planePoint.x,y=planePoint.y,z=planePoint.z;
			float d=-(a*x+b*y+c*z);
			float distance=(a*x0+b*y0+c*z0+d)/sqrt(a*a+b*b+c*c);
			return distance;
		}
		float getDepth( const in vec2 uv ) {
			return texture2D( tDepth, uv ).x;
		}
		float getViewZ( const in float depth ) {
			#ifdef PERSPECTIVE_CAMERA
				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}
		vec3 getViewPosition( const in vec2 uv, const in float depth/*clip space*/, const in float clipW ) {
			vec4 clipPosition = vec4( ( vec3( uv, depth ) - 0.5 ) * 2.0, 1.0 );//ndc
			clipPosition *= clipW; //clip
			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;//view
		}
		vec3 getViewNormal( const in vec2 uv ) {
			return unpackRGBToNormal( texture2D( tNormal, uv ).xyz );
		}
		vec2 viewPositionToXY(vec3 viewPosition){
			vec2 xy;
			vec4 clip=cameraProjectionMatrix*vec4(viewPosition,1);
			xy=clip.xy;//clip
			float clipW=clip.w;
			xy/=clipW;//NDC
			xy=(xy+1.)/2.;//uv
			xy*=resolution;//screen
			return xy;
		}
		void main(){
			#ifdef SELECTIVE
				float metalness=texture2D(tMetalness,vUv).r;
				if(metalness==0.) return;
			#endif

			float depth = getDepth( vUv );
			float viewZ = getViewZ( depth );
			if(-viewZ>=cameraFar) return;

			float clipW = cameraProjectionMatrix[2][3] * viewZ+cameraProjectionMatrix[3][3];
			vec3 viewPosition=getViewPosition( vUv, depth, clipW );

			vec2 d0=gl_FragCoord.xy;
			vec2 d1;

			vec3 viewNormal=getViewNormal( vUv );

			#ifdef PERSPECTIVE_CAMERA
				vec3 viewIncidentDir=normalize(viewPosition);
				vec3 viewReflectDir=reflect(viewIncidentDir,viewNormal);
			#else
				vec3 viewIncidentDir=vec3(0,0,-1);
				vec3 viewReflectDir=reflect(viewIncidentDir,viewNormal);
			#endif

			float maxReflectRayLen=maxDistance/dot(-viewIncidentDir,viewNormal);
			// dot(a,b)==length(a)*length(b)*cos(theta) // https://www.mathsisfun.com/algebra/vectors-dot-product.html
			// if(a.isNormalized&&b.isNormalized) dot(a,b)==cos(theta)
			// maxDistance/maxReflectRayLen=cos(theta)
			// maxDistance/maxReflectRayLen==dot(a,b)
			// maxReflectRayLen==maxDistance/dot(a,b)

			vec3 d1viewPosition=viewPosition+viewReflectDir*maxReflectRayLen;
			#ifdef PERSPECTIVE_CAMERA
				if(d1viewPosition.z>-cameraNear){
					//https://tutorial.math.lamar.edu/Classes/CalcIII/EqnsOfLines.aspx
					float t=(-cameraNear-viewPosition.z)/viewReflectDir.z;
					d1viewPosition=viewPosition+viewReflectDir*t;
				}
			#endif
			d1=viewPositionToXY(d1viewPosition);

			float totalLen=length(d1-d0);
			float xLen=d1.x-d0.x;
			float yLen=d1.y-d0.y;
			float totalStep=max(abs(xLen),abs(yLen));
			float xSpan=xLen/totalStep;
			float ySpan=yLen/totalStep;
			for(float i=0.;i<float(MAX_STEP);i++){
				if(i>=totalStep) break;
				vec2 xy=vec2(d0.x+i*xSpan,d0.y+i*ySpan);
				if(xy.x<0.||xy.x>resolution.x||xy.y<0.||xy.y>resolution.y) break;
				float s=length(xy-d0)/totalLen;
				vec2 uv=xy/resolution;

				float d = getDepth(uv);
				float vZ = getViewZ( d );
				if(-vZ>=cameraFar) continue;
				float cW = cameraProjectionMatrix[2][3] * vZ+cameraProjectionMatrix[3][3];
				vec3 vP=getViewPosition( uv, d, cW );

				#ifdef PERSPECTIVE_CAMERA
					// https://comp.nus.edu.sg/~lowkl/publications/lowk_persp_interp_techrep.pdf
					float recipVPZ=1./viewPosition.z;
					float viewReflectRayZ=1./(recipVPZ+s*(1./d1viewPosition.z-recipVPZ));
				#else
					float viewReflectRayZ=viewPosition.z+s*(d1viewPosition.z-viewPosition.z);
				#endif

				// if(viewReflectRayZ>vZ) continue; // will cause "npm run make-screenshot webgl_postprocessing_ssr" high probability hang.
				// https://github.com/mrdoob/three.js/pull/21539#issuecomment-821061164
				if(viewReflectRayZ<=vZ){

					bool hit;
					#ifdef INFINITE_THICK
						hit=true;
					#else
						float away=pointToLineDistance(vP,viewPosition,d1viewPosition);

						float minThickness;
						vec2 xyNeighbor=xy;
						xyNeighbor.x+=1.;
						vec2 uvNeighbor=xyNeighbor/resolution;
						vec3 vPNeighbor=getViewPosition(uvNeighbor,d,cW);
						minThickness=vPNeighbor.x-vP.x;
						minThickness*=3.;
						float tk=max(minThickness,thickness);

						hit=away<=tk;
					#endif

					if(hit){
						vec3 vN=getViewNormal( uv );
						if(dot(viewReflectDir,vN)>=0.) continue;
						float distance=pointPlaneDistance(vP,viewPosition,viewNormal);
						if(distance>maxDistance) break;
						float op=opacity;
						#ifdef DISTANCE_ATTENUATION
							float ratio=1.-(distance/maxDistance);
							float attenuation=ratio*ratio;
							op=opacity*attenuation;
						#endif
						#ifdef FRESNEL
							float fresnelCoe=(dot(viewIncidentDir,viewReflectDir)+1.)/2.;
							op*=fresnelCoe;
						#endif
						vec4 reflectColor=texture2D(tDiffuse,uv);
						gl_FragColor.xyz=reflectColor.xyz;
						gl_FragColor.a=op;
						break;
					}
				}
			}
		}
	`},g={name:"SSRDepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}

	`,fragmentShader:`

		uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;

		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 uv ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, uv ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, uv ).x;

			#endif

		}

		void main() {

			float depth = getLinearDepth( vUv );
			float d = 1.0 - depth;
			// d=(d-.999)*1000.;
			gl_FragColor = vec4( vec3( d ), 1.0 );

		}

	`},h={name:"SSRBlurShader",uniforms:{tDiffuse:{value:null},resolution:{value:new P},opacity:{value:.5}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}

	`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;
		void main() {
			//reverse engineering from PhotoShop blur filter, then change coefficient

			vec2 texelSize = ( 1.0 / resolution );

			vec4 c=texture2D(tDiffuse,vUv);

			vec2 offset;

			offset=(vec2(-1,0))*texelSize;
			vec4 cl=texture2D(tDiffuse,vUv+offset);

			offset=(vec2(1,0))*texelSize;
			vec4 cr=texture2D(tDiffuse,vUv+offset);

			offset=(vec2(0,-1))*texelSize;
			vec4 cb=texture2D(tDiffuse,vUv+offset);

			offset=(vec2(0,1))*texelSize;
			vec4 ct=texture2D(tDiffuse,vUv+offset);

			// float coeCenter=.5;
			// float coeSide=.125;
			float coeCenter=.2;
			float coeSide=.2;
			float a=c.a*coeCenter+cl.a*coeSide+cr.a*coeSide+cb.a*coeSide+ct.a*coeSide;
			vec3 rgb=(c.rgb*c.a*coeCenter+cl.rgb*cl.a*coeSide+cr.rgb*cr.a*coeSide+cb.rgb*cb.a*coeSide+ct.rgb*ct.a*coeSide)/a;
			gl_FragColor=vec4(rgb,a);

		}
	`};var _=class f extends I{constructor({renderer:e,scene:a,camera:s,width:i=512,height:o=512,selects:c=null,bouncing:u=!1,groundReflector:y=null}){super(),this.width=i,this.height=o,this.clear=!0,this.renderer=e,this.scene=a,this.camera=s,this.groundReflector=y,this.opacity=l.uniforms.opacity.value,this.output=0,this.maxDistance=l.uniforms.maxDistance.value,this.thickness=l.uniforms.thickness.value,this.tempColor=new w,this._selects=c,this._resolutionScale=1,this.selective=Array.isArray(this._selects),Object.defineProperty(this,"selects",{get(){return this._selects},set(t){this._selects!==t&&(this._selects=t,Array.isArray(t)?(this.selective=!0,this.ssrMaterial.defines.SELECTIVE=!0,this.ssrMaterial.needsUpdate=!0):(this.selective=!1,this.ssrMaterial.defines.SELECTIVE=!1,this.ssrMaterial.needsUpdate=!0))}}),this._bouncing=u,Object.defineProperty(this,"bouncing",{get(){return this._bouncing},set(t){this._bouncing!==t&&(this._bouncing=t,t?this.ssrMaterial.uniforms.tDiffuse.value=this.prevRenderTarget.texture:this.ssrMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture)}}),this.blur=!0,this._distanceAttenuation=l.defines.DISTANCE_ATTENUATION,Object.defineProperty(this,"distanceAttenuation",{get(){return this._distanceAttenuation},set(t){this._distanceAttenuation!==t&&(this._distanceAttenuation=t,this.ssrMaterial.defines.DISTANCE_ATTENUATION=t,this.ssrMaterial.needsUpdate=!0)}}),this._fresnel=l.defines.FRESNEL,Object.defineProperty(this,"fresnel",{get(){return this._fresnel},set(t){this._fresnel!==t&&(this._fresnel=t,this.ssrMaterial.defines.FRESNEL=t,this.ssrMaterial.needsUpdate=!0)}}),this._infiniteThick=l.defines.INFINITE_THICK,Object.defineProperty(this,"infiniteThick",{get(){return this._infiniteThick},set(t){this._infiniteThick!==t&&(this._infiniteThick=t,this.ssrMaterial.defines.INFINITE_THICK=t,this.ssrMaterial.needsUpdate=!0)}});let d=new N;d.type=E,d.minFilter=r,d.magFilter=r,this.beautyRenderTarget=new v(this.width,this.height,{minFilter:r,magFilter:r,type:M,depthTexture:d,depthBuffer:!0}),this.prevRenderTarget=new v(this.width,this.height,{minFilter:r,magFilter:r}),this.normalRenderTarget=new v(this.width,this.height,{minFilter:r,magFilter:r,type:M}),this.metalnessRenderTarget=new v(this.width,this.height,{minFilter:r,magFilter:r,type:M}),this.ssrRenderTarget=new v(this.width,this.height,{minFilter:r,magFilter:r}),this.blurRenderTarget=this.ssrRenderTarget.clone(),this.blurRenderTarget2=this.ssrRenderTarget.clone(),this.ssrMaterial=new p({defines:Object.assign({},l.defines,{MAX_STEP:Math.sqrt(this.width*this.width+this.height*this.height)}),uniforms:m.clone(l.uniforms),vertexShader:l.vertexShader,fragmentShader:l.fragmentShader,blending:n}),this.ssrMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture,this.ssrMaterial.uniforms.tNormal.value=this.normalRenderTarget.texture,this.ssrMaterial.defines.SELECTIVE=this.selective,this.ssrMaterial.needsUpdate=!0,this.ssrMaterial.uniforms.tMetalness.value=this.metalnessRenderTarget.texture,this.ssrMaterial.uniforms.tDepth.value=this.beautyRenderTarget.depthTexture,this.ssrMaterial.uniforms.cameraNear.value=this.camera.near,this.ssrMaterial.uniforms.cameraFar.value=this.camera.far,this.ssrMaterial.uniforms.thickness.value=this.thickness,this.ssrMaterial.uniforms.resolution.value.set(this.width,this.height),this.ssrMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.ssrMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse),this.normalMaterial=new A,this.normalMaterial.blending=n,this.metalnessOnMaterial=new C({color:"white"}),this.metalnessOffMaterial=new C({color:"black"}),this.blurMaterial=new p({defines:Object.assign({},h.defines),uniforms:m.clone(h.uniforms),vertexShader:h.vertexShader,fragmentShader:h.fragmentShader}),this.blurMaterial.uniforms.tDiffuse.value=this.ssrRenderTarget.texture,this.blurMaterial.uniforms.resolution.value.set(this.width,this.height),this.blurMaterial2=new p({defines:Object.assign({},h.defines),uniforms:m.clone(h.uniforms),vertexShader:h.vertexShader,fragmentShader:h.fragmentShader}),this.blurMaterial2.uniforms.tDiffuse.value=this.blurRenderTarget.texture,this.blurMaterial2.uniforms.resolution.value.set(this.width,this.height),this.depthRenderMaterial=new p({defines:Object.assign({},g.defines),uniforms:m.clone(g.uniforms),vertexShader:g.vertexShader,fragmentShader:g.fragmentShader,blending:n}),this.depthRenderMaterial.uniforms.tDepth.value=this.beautyRenderTarget.depthTexture,this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new p({uniforms:m.clone(T.uniforms),vertexShader:T.vertexShader,fragmentShader:T.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:b,blendDst:R,blendEquation:S,blendSrcAlpha:b,blendDstAlpha:R,blendEquationAlpha:S}),this.fsQuad=new U(null),this.originalClearColor=new w}get resolutionScale(){return this._resolutionScale}set resolutionScale(e){this._resolutionScale=e,this.setSize(this.width,this.height)}dispose(){this.beautyRenderTarget.dispose(),this.prevRenderTarget.dispose(),this.normalRenderTarget.dispose(),this.metalnessRenderTarget.dispose(),this.ssrRenderTarget.dispose(),this.blurRenderTarget.dispose(),this.blurRenderTarget2.dispose(),this.normalMaterial.dispose(),this.metalnessOnMaterial.dispose(),this.metalnessOffMaterial.dispose(),this.blurMaterial.dispose(),this.blurMaterial2.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this.fsQuad.dispose()}render(e,a){switch(e.setRenderTarget(this.beautyRenderTarget),e.clear(),this.groundReflector&&(this.groundReflector.visible=!1,this.groundReflector.doRender(this.renderer,this.scene,this.camera),this.groundReflector.visible=!0),e.render(this.scene,this.camera),this.groundReflector&&(this.groundReflector.visible=!1),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,0,0),this.selective&&this._renderMetalness(e,this.metalnessOnMaterial,this.metalnessRenderTarget,0,0),this.ssrMaterial.uniforms.opacity.value=this.opacity,this.ssrMaterial.uniforms.maxDistance.value=this.maxDistance,this.ssrMaterial.uniforms.thickness.value=this.thickness,this._renderPass(e,this.ssrMaterial,this.ssrRenderTarget),this.blur&&(this._renderPass(e,this.blurMaterial,this.blurRenderTarget),this._renderPass(e,this.blurMaterial2,this.blurRenderTarget2)),this.output){case f.OUTPUT.Default:this.bouncing?(this.copyMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.prevRenderTarget),this.blur?this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget2.texture:this.copyMaterial.uniforms.tDiffuse.value=this.ssrRenderTarget.texture,this.copyMaterial.blending=x,this._renderPass(e,this.copyMaterial,this.prevRenderTarget),this.copyMaterial.uniforms.tDiffuse.value=this.prevRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a)):(this.copyMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a),this.blur?this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget2.texture:this.copyMaterial.uniforms.tDiffuse.value=this.ssrRenderTarget.texture,this.copyMaterial.blending=x,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a));break;case f.OUTPUT.SSR:this.blur?this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget2.texture:this.copyMaterial.uniforms.tDiffuse.value=this.ssrRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a),this.bouncing&&(this.blur?this.copyMaterial.uniforms.tDiffuse.value=this.blurRenderTarget2.texture:this.copyMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.prevRenderTarget),this.copyMaterial.uniforms.tDiffuse.value=this.ssrRenderTarget.texture,this.copyMaterial.blending=x,this._renderPass(e,this.copyMaterial,this.prevRenderTarget));break;case f.OUTPUT.Beauty:this.copyMaterial.uniforms.tDiffuse.value=this.beautyRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a);break;case f.OUTPUT.Depth:this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:a);break;case f.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a);break;case f.OUTPUT.Metalness:this.copyMaterial.uniforms.tDiffuse.value=this.metalnessRenderTarget.texture,this.copyMaterial.blending=n,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:a);break;default:console.warn("THREE.SSRPass: Unknown output type.")}}setSize(e,a){this.width=e,this.height=a;let s=Math.round(this.resolutionScale*e),i=Math.round(this.resolutionScale*a);this.ssrMaterial.defines.MAX_STEP=Math.sqrt(s*s+i*i),this.ssrMaterial.needsUpdate=!0,this.beautyRenderTarget.setSize(e,a),this.normalRenderTarget.setSize(e,a),this.metalnessRenderTarget.setSize(e,a),this.ssrRenderTarget.setSize(s,i),this.prevRenderTarget.setSize(s,i),this.blurRenderTarget.setSize(s,i),this.blurRenderTarget2.setSize(s,i),this.ssrMaterial.uniforms.resolution.value.set(s,i),this.ssrMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.ssrMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse),this.blurMaterial.uniforms.resolution.value.set(s,i),this.blurMaterial2.uniforms.resolution.value.set(s,i)}_renderPass(e,a,s,i,o){this.originalClearColor.copy(e.getClearColor(this.tempColor));let c=e.getClearAlpha(this.tempColor),u=e.autoClear;e.setRenderTarget(s),e.autoClear=!1,i!=null&&(e.setClearColor(i),e.setClearAlpha(o||0),e.clear()),this.fsQuad.material=a,this.fsQuad.render(e),e.autoClear=u,e.setClearColor(this.originalClearColor),e.setClearAlpha(c)}_renderOverride(e,a,s,i,o){this.originalClearColor.copy(e.getClearColor(this.tempColor));let c=e.getClearAlpha(this.tempColor),u=e.autoClear;e.setRenderTarget(s),e.autoClear=!1,i=a.clearColor||i,o=a.clearAlpha||o,i!=null&&(e.setClearColor(i),e.setClearAlpha(o||0),e.clear()),this.scene.overrideMaterial=a,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=u,e.setClearColor(this.originalClearColor),e.setClearAlpha(c)}_renderMetalness(e,a,s,i,o){this.originalClearColor.copy(e.getClearColor(this.tempColor));let c=e.getClearAlpha(this.tempColor),u=e.autoClear,y=this.scene.background,d=this.scene.fog;e.setRenderTarget(s),e.autoClear=!1,this.scene.background=null,this.scene.fog=null,i=a.clearColor||i,o=a.clearAlpha||o,i!=null&&(e.setClearColor(i),e.setClearAlpha(o||0),e.clear()),this.scene.traverseVisible(t=>{t._SSRPassBackupMaterial=t.material,this._selects.includes(t)?t.material=this.metalnessOnMaterial:t.material=this.metalnessOffMaterial}),e.render(this.scene,this.camera),this.scene.traverseVisible(t=>{t.material=t._SSRPassBackupMaterial}),e.autoClear=u,e.setClearColor(this.originalClearColor),e.setClearAlpha(c),this.scene.background=y,this.scene.fog=d}};_.OUTPUT={Default:0,SSR:1,Beauty:3,Depth:4,Normal:5,Metalness:7};export{_ as SSRPass};
