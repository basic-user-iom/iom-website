import{cW as Ye,V as f,aI as F,R as Xe,co as xe,aD as Re,ck as Qe,aH as L,cq as I,B as _e,cs as Te,M as r,cX as ue,cY as Y,cZ as ie,aN as Be,E as Ze,i as ce,e as je,b as Ue,r as G,c_ as qe,S as Ve,P as $e,D as He,q as Ke,c$ as Je,g as Ee,Q as et,d0 as tt,c as nt,G as it,j as Le,a as ot,s as we,d1 as at}from"./panorama-index-D0qZ0_NV.js";const U=new Xe,C=new f,X=new f,S=new F,Me={X:new f(1,0,0),Y:new f(0,1,0),Z:new f(0,0,1)},Se={type:"change"},Ae={type:"mouseDown",mode:null},ke={type:"mouseUp",mode:null},We={type:"objectChange"};class rt extends Ye{constructor(t,n=null){super(void 0,n);const a=new ut(this);this._root=a;const i=new pt;this._gizmo=i,a.add(i);const o=new vt;this._plane=o,a.add(o);const e=this;function s(y,R){let M=R;Object.defineProperty(e,y,{get:function(){return M!==void 0?M:R},set:function(m){M!==m&&(M=m,o[y]=m,i[y]=m,e.dispatchEvent({type:y+"-changed",value:m}),e.dispatchEvent(Se))}}),e[y]=R,o[y]=R,i[y]=R}s("camera",t),s("object",void 0),s("enabled",!0),s("axis",null),s("mode","translate"),s("translationSnap",null),s("rotationSnap",null),s("scaleSnap",null),s("space","world"),s("size",1),s("dragging",!1),s("showX",!0),s("showY",!0),s("showZ",!0),s("minX",-1/0),s("maxX",1/0),s("minY",-1/0),s("maxY",1/0),s("minZ",-1/0),s("maxZ",1/0);const _=new f,k=new f,W=new F,H=new F,b=new f,Q=new F,d=new f,P=new f,h=new f,l=0,x=new f;s("worldPosition",_),s("worldPositionStart",k),s("worldQuaternion",W),s("worldQuaternionStart",H),s("cameraPosition",b),s("cameraQuaternion",Q),s("pointStart",d),s("pointEnd",P),s("rotationAxis",h),s("rotationAngle",l),s("eye",x),this._offset=new f,this._startNorm=new f,this._endNorm=new f,this._cameraScale=new f,this._parentPosition=new f,this._parentQuaternion=new F,this._parentQuaternionInv=new F,this._parentScale=new f,this._worldScaleStart=new f,this._worldQuaternionInv=new F,this._worldScale=new f,this._positionStart=new f,this._quaternionStart=new F,this._scaleStart=new f,this._getPointer=st.bind(this),this._onPointerDown=lt.bind(this),this._onPointerHover=ct.bind(this),this._onPointerMove=ft.bind(this),this._onPointerUp=ht.bind(this),n!==null&&this.connect(n)}connect(t){super.connect(t),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointermove",this._onPointerHover),this.domElement.addEventListener("pointerup",this._onPointerUp),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerHover),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.style.touchAction="auto"}getHelper(){return this._root}pointerHover(t){if(this.object===void 0||this.dragging===!0)return;t!==null&&U.setFromCamera(t,this.camera);const n=Pe(this._gizmo.picker[this.mode],U);n?this.axis=n.object.name:this.axis=null}pointerDown(t){if(!(this.object===void 0||this.dragging===!0||t!=null&&t.button!==0)&&this.axis!==null){t!==null&&U.setFromCamera(t,this.camera);const n=Pe(this._plane,U,!0);n&&(this.object.updateMatrixWorld(),this.object.parent.updateMatrixWorld(),this._positionStart.copy(this.object.position),this._quaternionStart.copy(this.object.quaternion),this._scaleStart.copy(this.object.scale),this.object.matrixWorld.decompose(this.worldPositionStart,this.worldQuaternionStart,this._worldScaleStart),this.pointStart.copy(n.point).sub(this.worldPositionStart)),this.dragging=!0,Ae.mode=this.mode,this.dispatchEvent(Ae)}}pointerMove(t){const n=this.axis,a=this.mode,i=this.object;let o=this.space;if(a==="scale"?o="local":(n==="E"||n==="XYZE"||n==="XYZ")&&(o="world"),i===void 0||n===null||this.dragging===!1||t!==null&&t.button!==-1)return;t!==null&&U.setFromCamera(t,this.camera);const e=Pe(this._plane,U,!0);if(e){if(this.pointEnd.copy(e.point).sub(this.worldPositionStart),a==="translate")this._offset.copy(this.pointEnd).sub(this.pointStart),o==="local"&&n!=="XYZ"&&this._offset.applyQuaternion(this._worldQuaternionInv),n.indexOf("X")===-1&&(this._offset.x=0),n.indexOf("Y")===-1&&(this._offset.y=0),n.indexOf("Z")===-1&&(this._offset.z=0),o==="local"&&n!=="XYZ"?this._offset.applyQuaternion(this._quaternionStart).divide(this._parentScale):this._offset.applyQuaternion(this._parentQuaternionInv).divide(this._parentScale),i.position.copy(this._offset).add(this._positionStart),this.translationSnap&&(o==="local"&&(i.position.applyQuaternion(S.copy(this._quaternionStart).invert()),n.search("X")!==-1&&(i.position.x=Math.round(i.position.x/this.translationSnap)*this.translationSnap),n.search("Y")!==-1&&(i.position.y=Math.round(i.position.y/this.translationSnap)*this.translationSnap),n.search("Z")!==-1&&(i.position.z=Math.round(i.position.z/this.translationSnap)*this.translationSnap),i.position.applyQuaternion(this._quaternionStart)),o==="world"&&(i.parent&&i.position.add(C.setFromMatrixPosition(i.parent.matrixWorld)),n.search("X")!==-1&&(i.position.x=Math.round(i.position.x/this.translationSnap)*this.translationSnap),n.search("Y")!==-1&&(i.position.y=Math.round(i.position.y/this.translationSnap)*this.translationSnap),n.search("Z")!==-1&&(i.position.z=Math.round(i.position.z/this.translationSnap)*this.translationSnap),i.parent&&i.position.sub(C.setFromMatrixPosition(i.parent.matrixWorld)))),i.position.x=Math.max(this.minX,Math.min(this.maxX,i.position.x)),i.position.y=Math.max(this.minY,Math.min(this.maxY,i.position.y)),i.position.z=Math.max(this.minZ,Math.min(this.maxZ,i.position.z));else if(a==="scale"){if(n.search("XYZ")!==-1){let s=this.pointEnd.length()/this.pointStart.length();this.pointEnd.dot(this.pointStart)<0&&(s*=-1),X.set(s,s,s)}else C.copy(this.pointStart),X.copy(this.pointEnd),C.applyQuaternion(this._worldQuaternionInv),X.applyQuaternion(this._worldQuaternionInv),X.divide(C),n.search("X")===-1&&(X.x=1),n.search("Y")===-1&&(X.y=1),n.search("Z")===-1&&(X.z=1);i.scale.copy(this._scaleStart).multiply(X),this.scaleSnap&&(n.search("X")!==-1&&(i.scale.x=Math.round(i.scale.x/this.scaleSnap)*this.scaleSnap||this.scaleSnap),n.search("Y")!==-1&&(i.scale.y=Math.round(i.scale.y/this.scaleSnap)*this.scaleSnap||this.scaleSnap),n.search("Z")!==-1&&(i.scale.z=Math.round(i.scale.z/this.scaleSnap)*this.scaleSnap||this.scaleSnap))}else if(a==="rotate"){this._offset.copy(this.pointEnd).sub(this.pointStart);const s=20/this.worldPosition.distanceTo(C.setFromMatrixPosition(this.camera.matrixWorld));let _=!1;n==="XYZE"?(this.rotationAxis.copy(this._offset).cross(this.eye).normalize(),this.rotationAngle=this._offset.dot(C.copy(this.rotationAxis).cross(this.eye))*s):(n==="X"||n==="Y"||n==="Z")&&(this.rotationAxis.copy(Me[n]),C.copy(Me[n]),o==="local"&&C.applyQuaternion(this.worldQuaternion),C.cross(this.eye),C.length()===0?_=!0:this.rotationAngle=this._offset.dot(C.normalize())*s),(n==="E"||_)&&(this.rotationAxis.copy(this.eye),this.rotationAngle=this.pointEnd.angleTo(this.pointStart),this._startNorm.copy(this.pointStart).normalize(),this._endNorm.copy(this.pointEnd).normalize(),this.rotationAngle*=this._endNorm.cross(this._startNorm).dot(this.eye)<0?1:-1),this.rotationSnap&&(this.rotationAngle=Math.round(this.rotationAngle/this.rotationSnap)*this.rotationSnap),o==="local"&&n!=="E"&&n!=="XYZE"?(i.quaternion.copy(this._quaternionStart),i.quaternion.multiply(S.setFromAxisAngle(this.rotationAxis,this.rotationAngle)).normalize()):(this.rotationAxis.applyQuaternion(this._parentQuaternionInv),i.quaternion.copy(S.setFromAxisAngle(this.rotationAxis,this.rotationAngle)),i.quaternion.multiply(this._quaternionStart).normalize())}this.dispatchEvent(Se),this.dispatchEvent(We)}}pointerUp(t){t!==null&&t.button!==0||(this.dragging&&this.axis!==null&&(ke.mode=this.mode,this.dispatchEvent(ke)),this.dragging=!1,this.axis=null)}dispose(){this.disconnect(),this._root.dispose()}attach(t){return this.object=t,this._root.visible=!0,this}detach(){return this.object=void 0,this.axis=null,this._root.visible=!1,this}reset(){this.enabled&&this.dragging&&(this.object.position.copy(this._positionStart),this.object.quaternion.copy(this._quaternionStart),this.object.scale.copy(this._scaleStart),this.dispatchEvent(Se),this.dispatchEvent(We),this.pointStart.copy(this.pointEnd))}getRaycaster(){return U}getMode(){return this.mode}setMode(t){this.mode=t}setTranslationSnap(t){this.translationSnap=t}setRotationSnap(t){this.rotationSnap=t}setScaleSnap(t){this.scaleSnap=t}setSize(t){this.size=t}setSpace(t){this.space=t}setColors(t,n,a,i){const o=this._gizmo.materialLib;o.xAxis.color.set(t),o.yAxis.color.set(n),o.zAxis.color.set(a),o.active.color.set(i),o.xAxisTransparent.color.set(t),o.yAxisTransparent.color.set(n),o.zAxisTransparent.color.set(a),o.activeTransparent.color.set(i),o.xAxis._color&&o.xAxis._color.set(t),o.yAxis._color&&o.yAxis._color.set(n),o.zAxis._color&&o.zAxis._color.set(a),o.active._color&&o.active._color.set(i),o.xAxisTransparent._color&&o.xAxisTransparent._color.set(t),o.yAxisTransparent._color&&o.yAxisTransparent._color.set(n),o.zAxisTransparent._color&&o.zAxisTransparent._color.set(a),o.activeTransparent._color&&o.activeTransparent._color.set(i)}}function st(v){if(this.domElement.ownerDocument.pointerLockElement)return{x:0,y:0,button:v.button};{const t=this.domElement.getBoundingClientRect();return{x:(v.clientX-t.left)/t.width*2-1,y:-(v.clientY-t.top)/t.height*2+1,button:v.button}}}function ct(v){if(this.enabled)switch(v.pointerType){case"mouse":case"pen":this.pointerHover(this._getPointer(v));break}}function lt(v){this.enabled&&(document.pointerLockElement||this.domElement.setPointerCapture(v.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.pointerHover(this._getPointer(v)),this.pointerDown(this._getPointer(v)))}function ft(v){this.enabled&&this.pointerMove(this._getPointer(v))}function ht(v){this.enabled&&(this.domElement.releasePointerCapture(v.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.pointerUp(this._getPointer(v)))}function Pe(v,t,n){const a=t.intersectObject(v,!0);for(let i=0;i<a.length;i++)if(a[i].object.visible||n)return a[i];return!1}const pe=new Ze,g=new f(0,1,0),Ne=new f(0,0,0),Oe=new ce,ve=new F,de=new F,z=new f,Ge=new ce,re=new f(1,0,0),q=new f(0,1,0),se=new f(0,0,1),me=new f,oe=new f,ae=new f;class ut extends xe{constructor(t){super(),this.isTransformControlsRoot=!0,this.controls=t,this.visible=!1}updateMatrixWorld(t){const n=this.controls;n.object!==void 0&&(n.object.updateMatrixWorld(),n.object.parent===null?console.error("TransformControls: The attached 3D object must be a part of the scene graph."):n.object.parent.matrixWorld.decompose(n._parentPosition,n._parentQuaternion,n._parentScale),n.object.matrixWorld.decompose(n.worldPosition,n.worldQuaternion,n._worldScale),n._parentQuaternionInv.copy(n._parentQuaternion).invert(),n._worldQuaternionInv.copy(n.worldQuaternion).invert()),n.camera.updateMatrixWorld(),n.camera.matrixWorld.decompose(n.cameraPosition,n.cameraQuaternion,n._cameraScale),n.camera.isOrthographicCamera?n.camera.getWorldDirection(n.eye).negate():n.eye.copy(n.cameraPosition).sub(n.worldPosition).normalize(),super.updateMatrixWorld(t)}dispose(){this.traverse(function(t){t.geometry&&t.geometry.dispose(),t.material&&t.material.dispose()})}}class pt extends xe{constructor(){super(),this.isTransformControlsGizmo=!0,this.type="TransformControlsGizmo";const t=new Re({depthTest:!1,depthWrite:!1,fog:!1,toneMapped:!1,transparent:!0}),n=new Qe({depthTest:!1,depthWrite:!1,fog:!1,toneMapped:!1,transparent:!0}),a=t.clone();a.opacity=.15;const i=n.clone();i.opacity=.5;const o=t.clone();o.color.setHex(16711680);const e=t.clone();e.color.setHex(65280);const s=t.clone();s.color.setHex(255);const _=t.clone();_.color.setHex(16711680),_.opacity=.5;const k=t.clone();k.color.setHex(65280),k.opacity=.5;const W=t.clone();W.color.setHex(255),W.opacity=.5;const H=t.clone();H.opacity=.25;const b=t.clone();b.color.setHex(16776960),b.opacity=.25;const Q=t.clone();Q.color.setHex(16776960);const d=t.clone();d.color.setHex(7895160),this.materialLib={xAxis:o,yAxis:e,zAxis:s,active:Q,xAxisTransparent:_,yAxisTransparent:k,zAxisTransparent:W,activeTransparent:b};const P=new L(0,.04,.1,12);P.translate(0,.05,0);const h=new I(.08,.08,.08);h.translate(0,.04,0);const l=new _e;l.setAttribute("position",new Te([0,0,0,1,0,0],3));const x=new L(.0075,.0075,.5,3);x.translate(0,.25,0);function y(T,K){const E=new ie(T,.0075,3,64,K*Math.PI*2);return E.rotateY(Math.PI/2),E.rotateX(Math.PI/2),E}function R(){const T=new _e;return T.setAttribute("position",new Te([0,0,0,1,1,1],3)),T}const M={X:[[new r(P,o),[.5,0,0],[0,0,-Math.PI/2]],[new r(P,o),[-.5,0,0],[0,0,Math.PI/2]],[new r(x,o),[0,0,0],[0,0,-Math.PI/2]]],Y:[[new r(P,e),[0,.5,0]],[new r(P,e),[0,-.5,0],[Math.PI,0,0]],[new r(x,e)]],Z:[[new r(P,s),[0,0,.5],[Math.PI/2,0,0]],[new r(P,s),[0,0,-.5],[-Math.PI/2,0,0]],[new r(x,s),null,[Math.PI/2,0,0]]],XYZ:[[new r(new ue(.1,0),H),[0,0,0]]],XY:[[new r(new I(.15,.15,.01),W),[.15,.15,0]]],YZ:[[new r(new I(.15,.15,.01),_),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new r(new I(.15,.15,.01),k),[.15,0,.15],[-Math.PI/2,0,0]]]},m={X:[[new r(new L(.2,0,.6,4),a),[.3,0,0],[0,0,-Math.PI/2]],[new r(new L(.2,0,.6,4),a),[-.3,0,0],[0,0,Math.PI/2]]],Y:[[new r(new L(.2,0,.6,4),a),[0,.3,0]],[new r(new L(.2,0,.6,4),a),[0,-.3,0],[0,0,Math.PI]]],Z:[[new r(new L(.2,0,.6,4),a),[0,0,.3],[Math.PI/2,0,0]],[new r(new L(.2,0,.6,4),a),[0,0,-.3],[-Math.PI/2,0,0]]],XYZ:[[new r(new ue(.2,0),a)]],XY:[[new r(new I(.2,.2,.01),a),[.15,.15,0]]],YZ:[[new r(new I(.2,.2,.01),a),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new r(new I(.2,.2,.01),a),[.15,0,.15],[-Math.PI/2,0,0]]]},V={START:[[new r(new ue(.01,2),i),null,null,null,"helper"]],END:[[new r(new ue(.01,2),i),null,null,null,"helper"]],DELTA:[[new Y(R(),i),null,null,null,"helper"]],X:[[new Y(l,i),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new Y(l,i),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new Y(l,i),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]},$={XYZE:[[new r(y(.5,1),d),null,[0,Math.PI/2,0]]],X:[[new r(y(.5,.5),o)]],Y:[[new r(y(.5,.5),e),null,[0,0,-Math.PI/2]]],Z:[[new r(y(.5,.5),s),null,[0,Math.PI/2,0]]],E:[[new r(y(.75,1),b),null,[0,Math.PI/2,0]]]},ee={AXIS:[[new Y(l,i),[-1e3,0,0],null,[1e6,1,1],"helper"]]},le={XYZE:[[new r(new Be(.25,10,8),a)]],X:[[new r(new ie(.5,.1,4,24),a),[0,0,0],[0,-Math.PI/2,-Math.PI/2]]],Y:[[new r(new ie(.5,.1,4,24),a),[0,0,0],[Math.PI/2,0,0]]],Z:[[new r(new ie(.5,.1,4,24),a),[0,0,0],[0,0,-Math.PI/2]]],E:[[new r(new ie(.75,.1,2,24),a)]]},B={X:[[new r(h,o),[.5,0,0],[0,0,-Math.PI/2]],[new r(x,o),[0,0,0],[0,0,-Math.PI/2]],[new r(h,o),[-.5,0,0],[0,0,Math.PI/2]]],Y:[[new r(h,e),[0,.5,0]],[new r(x,e)],[new r(h,e),[0,-.5,0],[0,0,Math.PI]]],Z:[[new r(h,s),[0,0,.5],[Math.PI/2,0,0]],[new r(x,s),[0,0,0],[Math.PI/2,0,0]],[new r(h,s),[0,0,-.5],[-Math.PI/2,0,0]]],XY:[[new r(new I(.15,.15,.01),W),[.15,.15,0]]],YZ:[[new r(new I(.15,.15,.01),_),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new r(new I(.15,.15,.01),k),[.15,0,.15],[-Math.PI/2,0,0]]],XYZ:[[new r(new I(.1,.1,.1),H)]]},te={X:[[new r(new L(.2,0,.6,4),a),[.3,0,0],[0,0,-Math.PI/2]],[new r(new L(.2,0,.6,4),a),[-.3,0,0],[0,0,Math.PI/2]]],Y:[[new r(new L(.2,0,.6,4),a),[0,.3,0]],[new r(new L(.2,0,.6,4),a),[0,-.3,0],[0,0,Math.PI]]],Z:[[new r(new L(.2,0,.6,4),a),[0,0,.3],[Math.PI/2,0,0]],[new r(new L(.2,0,.6,4),a),[0,0,-.3],[-Math.PI/2,0,0]]],XY:[[new r(new I(.2,.2,.01),a),[.15,.15,0]]],YZ:[[new r(new I(.2,.2,.01),a),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new r(new I(.2,.2,.01),a),[.15,0,.15],[-Math.PI/2,0,0]]],XYZ:[[new r(new I(.2,.2,.2),a),[0,0,0]]]},fe={X:[[new Y(l,i),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new Y(l,i),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new Y(l,i),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]};function A(T){const K=new xe;for(const E in T)for(let N=T[E].length;N--;){const D=T[E][N][0].clone(),O=T[E][N][1],Z=T[E][N][2],J=T[E][N][3],ye=T[E][N][4];D.name=E,D.tag=ye,O&&D.position.set(O[0],O[1],O[2]),Z&&D.rotation.set(Z[0],Z[1],Z[2]),J&&D.scale.set(J[0],J[1],J[2]),D.updateMatrix();const he=D.geometry.clone();he.applyMatrix4(D.matrix),D.geometry=he,D.renderOrder=1/0,D.position.set(0,0,0),D.rotation.set(0,0,0),D.scale.set(1,1,1),K.add(D)}return K}this.gizmo={},this.picker={},this.helper={},this.add(this.gizmo.translate=A(M)),this.add(this.gizmo.rotate=A($)),this.add(this.gizmo.scale=A(B)),this.add(this.picker.translate=A(m)),this.add(this.picker.rotate=A(le)),this.add(this.picker.scale=A(te)),this.add(this.helper.translate=A(V)),this.add(this.helper.rotate=A(ee)),this.add(this.helper.scale=A(fe)),this.picker.translate.visible=!1,this.picker.rotate.visible=!1,this.picker.scale.visible=!1}updateMatrixWorld(t){const a=(this.mode==="scale"?"local":this.space)==="local"?this.worldQuaternion:de;this.gizmo.translate.visible=this.mode==="translate",this.gizmo.rotate.visible=this.mode==="rotate",this.gizmo.scale.visible=this.mode==="scale",this.helper.translate.visible=this.mode==="translate",this.helper.rotate.visible=this.mode==="rotate",this.helper.scale.visible=this.mode==="scale";let i=[];i=i.concat(this.picker[this.mode].children),i=i.concat(this.gizmo[this.mode].children),i=i.concat(this.helper[this.mode].children);for(let o=0;o<i.length;o++){const e=i[o];e.visible=!0,e.rotation.set(0,0,0),e.position.copy(this.worldPosition);let s;if(this.camera.isOrthographicCamera?s=(this.camera.top-this.camera.bottom)/this.camera.zoom:s=this.worldPosition.distanceTo(this.cameraPosition)*Math.min(1.9*Math.tan(Math.PI*this.camera.fov/360)/this.camera.zoom,7),e.scale.set(1,1,1).multiplyScalar(s*this.size/4),e.tag==="helper"){e.visible=!1,e.name==="AXIS"?(e.visible=!!this.axis,this.axis==="X"&&(S.setFromEuler(pe.set(0,0,0)),e.quaternion.copy(a).multiply(S),Math.abs(g.copy(re).applyQuaternion(a).dot(this.eye))>.9&&(e.visible=!1)),this.axis==="Y"&&(S.setFromEuler(pe.set(0,0,Math.PI/2)),e.quaternion.copy(a).multiply(S),Math.abs(g.copy(q).applyQuaternion(a).dot(this.eye))>.9&&(e.visible=!1)),this.axis==="Z"&&(S.setFromEuler(pe.set(0,Math.PI/2,0)),e.quaternion.copy(a).multiply(S),Math.abs(g.copy(se).applyQuaternion(a).dot(this.eye))>.9&&(e.visible=!1)),this.axis==="XYZE"&&(S.setFromEuler(pe.set(0,Math.PI/2,0)),g.copy(this.rotationAxis),e.quaternion.setFromRotationMatrix(Oe.lookAt(Ne,g,q)),e.quaternion.multiply(S),e.visible=this.dragging),this.axis==="E"&&(e.visible=!1)):e.name==="START"?(e.position.copy(this.worldPositionStart),e.visible=this.dragging):e.name==="END"?(e.position.copy(this.worldPosition),e.visible=this.dragging):e.name==="DELTA"?(e.position.copy(this.worldPositionStart),e.quaternion.copy(this.worldQuaternionStart),C.set(1e-10,1e-10,1e-10).add(this.worldPositionStart).sub(this.worldPosition).multiplyScalar(-1),C.applyQuaternion(this.worldQuaternionStart.clone().invert()),e.scale.copy(C),e.visible=this.dragging):(e.quaternion.copy(a),this.dragging?e.position.copy(this.worldPositionStart):e.position.copy(this.worldPosition),this.axis&&(e.visible=this.axis.search(e.name)!==-1));continue}e.quaternion.copy(a),this.mode==="translate"||this.mode==="scale"?(e.name==="X"&&Math.abs(g.copy(re).applyQuaternion(a).dot(this.eye))>.99&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1),e.name==="Y"&&Math.abs(g.copy(q).applyQuaternion(a).dot(this.eye))>.99&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1),e.name==="Z"&&Math.abs(g.copy(se).applyQuaternion(a).dot(this.eye))>.99&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1),e.name==="XY"&&Math.abs(g.copy(se).applyQuaternion(a).dot(this.eye))<.2&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1),e.name==="YZ"&&Math.abs(g.copy(re).applyQuaternion(a).dot(this.eye))<.2&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1),e.name==="XZ"&&Math.abs(g.copy(q).applyQuaternion(a).dot(this.eye))<.2&&(e.scale.set(1e-10,1e-10,1e-10),e.visible=!1)):this.mode==="rotate"&&(ve.copy(a),g.copy(this.eye).applyQuaternion(S.copy(a).invert()),e.name.search("E")!==-1&&e.quaternion.setFromRotationMatrix(Oe.lookAt(this.eye,Ne,q)),e.name==="X"&&(S.setFromAxisAngle(re,Math.atan2(-g.y,g.z)),S.multiplyQuaternions(ve,S),e.quaternion.copy(S)),e.name==="Y"&&(S.setFromAxisAngle(q,Math.atan2(g.x,g.z)),S.multiplyQuaternions(ve,S),e.quaternion.copy(S)),e.name==="Z"&&(S.setFromAxisAngle(se,Math.atan2(g.y,g.x)),S.multiplyQuaternions(ve,S),e.quaternion.copy(S))),e.visible=e.visible&&(e.name.indexOf("X")===-1||this.showX),e.visible=e.visible&&(e.name.indexOf("Y")===-1||this.showY),e.visible=e.visible&&(e.name.indexOf("Z")===-1||this.showZ),e.visible=e.visible&&(e.name.indexOf("E")===-1||this.showX&&this.showY&&this.showZ),e.material._color=e.material._color||e.material.color.clone(),e.material._opacity=e.material._opacity||e.material.opacity,e.material.color.copy(e.material._color),e.material.opacity=e.material._opacity,this.enabled&&this.axis&&(e.name===this.axis?(e.material.color.copy(this.materialLib.active.color),e.material.opacity=1):this.axis.split("").some(function(_){return e.name===_})&&(e.material.color.copy(this.materialLib.active.color),e.material.opacity=1))}super.updateMatrixWorld(t)}}class vt extends r{constructor(){super(new je(1e5,1e5,2,2),new Re({visible:!1,wireframe:!0,side:Ue,transparent:!0,opacity:.1,toneMapped:!1})),this.isTransformControlsPlane=!0,this.type="TransformControlsPlane"}updateMatrixWorld(t){let n=this.space;switch(this.position.copy(this.worldPosition),this.mode==="scale"&&(n="local"),me.copy(re).applyQuaternion(n==="local"?this.worldQuaternion:de),oe.copy(q).applyQuaternion(n==="local"?this.worldQuaternion:de),ae.copy(se).applyQuaternion(n==="local"?this.worldQuaternion:de),g.copy(oe),this.mode){case"translate":case"scale":switch(this.axis){case"X":g.copy(this.eye).cross(me),z.copy(me).cross(g);break;case"Y":g.copy(this.eye).cross(oe),z.copy(oe).cross(g);break;case"Z":g.copy(this.eye).cross(ae),z.copy(ae).cross(g);break;case"XY":z.copy(ae);break;case"YZ":z.copy(me);break;case"XZ":g.copy(ae),z.copy(oe);break;case"XYZ":case"E":z.set(0,0,0);break}break;case"rotate":default:z.set(0,0,0)}z.length()===0?this.quaternion.copy(this.cameraQuaternion):(Ge.lookAt(C.set(0,0,0),z,g),this.quaternion.setFromRotationMatrix(Ge)),super.updateMatrixWorld(t)}}const mt=`// Spout - @P_Malin

//#define LOW_QUALITY

#ifdef LOW_QUALITY
    #define kRaymarchMaxIter 16
#else
    #define kRaymarchMaxIter 32
    
    #define ENABLE_AMBIENT_OCCLUSION
    #define DOUBLE_SIDED_TRANSPARENCY
#endif

#define ENABLE_SPECULAR
#define ENABLE_REFLECTIONS
#define ENABLE_TRANSPARENCY
#define ENABLE_SHADOWS
#define ENABLE_FOG

#define ENABLE_DIRECTIONAL_LIGHT
#define ENABLE_DIRECTIONAL_LIGHT_FLARE

//#define ENABLE_POINT_LIGHT
//#define ENABLE_POINT_LIGHT_FLARE

const float kPipeRadius = 0.4;
const float kPipeThickness = 0.15;
const float kPipeHeight = 2.0;
const float kPipeLength = 2.0;
//float kPipeHeight = 2.0 + sin(iTime);

const float kWaterNoiseScale = 0.025;

const float kWaterVelocity = 1.0;

const float kWaterAccel = -1.0;

const float kWaterAnimSpeed = 80.0;
const float kTrenchWaterAnimSpeed = 20.0;



float kRipplePos = sqrt(abs(2.0 * kPipeHeight / kWaterAccel)) * kWaterVelocity;

const float kPI = 3.141592654;
const float kTwoPI = kPI * 2.0;

const float kNoTransparency = -1.0;
const float kTransparency = 1.0;
const float kInverseTransparency = 0.0;

struct C_Ray
{
    vec3 vOrigin;
    vec3 vDir;
    float fStartDistance;
    float fLength;
};

struct C_HitInfo
{
    vec3 vPos;
    float fDistance;
    vec3 vObjectId;
};
    
struct C_Surface
{
    vec3 vNormal;
    vec3 cReflection;
    vec3 cTransmission;    
};

struct C_Material
{
    vec3 cAlbedo;
    float fR0;
    float fSmoothness;
    vec2 vParam;

    float fTransparency;
    float fRefractiveIndex;
};

struct C_Shading
{
    vec3 cDiffuse;
    vec3 cSpecular;
};

struct C_PointLight
{
    vec3 vPos;
    vec3 cColour;
};

struct C_DirectionalLight
{
    vec3 vDir;
    vec3 cColour;
};

vec3 RotateX( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( vPos.x, c * vPos.y + s * vPos.z, -s * vPos.y + c * vPos.z);
    
    return vResult;
}

vec3 RotateY( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( c * vPos.x + s * vPos.z, vPos.y, -s * vPos.x + c * vPos.z);
    
    return vResult;
}

vec3 RotateZ( const in vec3 vPos, const in float fAngle )
{
    float s = sin(fAngle);
    float c = cos(fAngle);
    
    vec3 vResult = vec3( c * vPos.x + s * vPos.y, -s * vPos.x + c * vPos.y, vPos.z);
    
    return vResult;
}

/////////////////////////////////////
// Distance Field CSG
// These carry with them the material parameters in yzw

vec4 DistCombineUnion( const in vec4 v1, const in vec4 v2 )
{
    //if(v1.x < v2.x) return v1; else return v2;
    return mix(v1, v2, step(v2.x, v1.x));
}

vec4 DistCombineUnionTransparent( const in vec4 v1, const in vec4 v2, const in float fTransparentScale )
{    
	//if( fCondition < 0.0 )
	//            return v1;
	
	// Negate the distance to the transparency object if transparent scale is 0.0     
	// This allows us to ratrace "out" of transparency
	
	vec4 vScaled = vec4(v2.x * (fTransparentScale * 2.0 - 1.0), v2.yzw);
                
	// The condition allows us to ignore transparency for secondary rays
    return mix(v1, vScaled, step(vScaled.x, v1.x) * step(0.0, fTransparentScale));
}

vec4 DistCombineIntersect( const in vec4 v1, const in vec4 v2 )
{
    return mix(v2, v1, step(v2.x,v1.x));
}

vec4 DistCombineSubtract( const in vec4 v1, const in vec4 v2 )
{
    return DistCombineIntersect(v1, vec4(-v2.x, v2.yzw));
}

/////////////////////////////////////
// Scene Description 

const float kMaterialIdWall = 1.0;
const float kMaterialIdPipe = 2.0;
const float kMaterialIdWater = 3.0;

float Noise(vec2 p)
{
    vec2 s = sin(p * 0.6345) + sin(p * 1.62423);
    return dot(s, vec2(0.125)) + 0.5;
}

// result is x=scene distance y=material or object id; zw are material specific parameters (maybe uv co-ordinates)
vec4 GetDistanceScene( const in vec3 vPos, const in float fTransparentScale )
{          
    vec4 vResult = vec4(10000.0, -1.0, 0.0, 0.0);
            
	float fDistFloor = vPos.y;
	float fDistBrick = fDistFloor;
	
	float fDistTrench = length(vPos.yz + vec2(-0.4, 0.0)) - 1.0;
	fDistBrick = max(fDistBrick, -(fDistTrench));
	
	float fDistWall = vPos.x + 1.0;
	fDistBrick = min(fDistBrick, fDistWall);
	
    vec4 vDistFloor = vec4(fDistBrick, kMaterialIdWall, vPos.xz + vec2(vPos.y, 0.0));
    vResult = DistCombineUnion(vResult, vDistFloor);    

    vec3 vWaterDomain = vPos - vec3(0.0, kPipeHeight, 0.0);

    float t= max(vWaterDomain.x / kWaterVelocity, 0.0);
	
	// Equations of motion
	float s = 0.5 * kWaterAccel * t * t;
	float v = -kWaterAccel * t;
	
	vWaterDomain.y -= s;    
                
    float fDistWater = (length(vWaterDomain.yz) - kPipeRadius);
                
    float fDistPipe = max(fDistWater - kPipeThickness, vWaterDomain.x);
    fDistPipe = max(fDistPipe, -vWaterDomain.x - kPipeLength);
    fDistPipe = max(fDistPipe, -fDistWater); // subtract the water from the pipe to make the hole
    vec4 vDistPipe = vec4(fDistPipe, kMaterialIdPipe, vPos.xy);        
        
    vResult = DistCombineUnion(vResult, vDistPipe);    
	
	// compensate for domain distortion of water, otherwise ray sometimes misses
	fDistWater /= (1.0 + v * 0.5);
	
    vec2 vNoiseDomain = vPos.xz;
                
	// modify noise for water in trench
	float fInTrench = step(vPos.y, (-0.1 + 0.05));        
	vec2 vRippleCentre1 = vPos.xz - vec2(kRipplePos, 0.0);
	vNoiseDomain.x = mix(vNoiseDomain.x, length(vRippleCentre1), fInTrench);
	float fNoiseScale = mix(t * t, 1.0 / (1.0 + vNoiseDomain.x), fInTrench) * kWaterNoiseScale;
	float fWaterSpeed = mix(kWaterAnimSpeed * kWaterVelocity, kTrenchWaterAnimSpeed, fInTrench);
	
	vNoiseDomain *= 30.0; 
	vNoiseDomain.x += -iTime * fWaterSpeed;
	
	float fTrenchWaterDist = vPos.y + 0.1;
	fDistWater = min(fDistWater, fTrenchWaterDist);
	
	fDistWater += Noise(vNoiseDomain) * fNoiseScale;
	
	vec4 vDistWater = vec4(fDistWater, kMaterialIdWater, vPos.xy);        
	vResult = DistCombineUnionTransparent(vResult, vDistWater, fTransparentScale);
              
    return vResult;
}

float GetRayFirstStep( const in C_Ray ray )
{
    return ray.fStartDistance;  
}

C_Material GetObjectMaterial( const in C_HitInfo hitInfo )
{
    C_Material mat;
              
    if(hitInfo.vObjectId.x == kMaterialIdWall)
    {
        // floor
        mat.fR0 = 0.02;
                                
		// Textureless tiles (avoids shipping Shadertoy CDN wall texture)
		vec2 vTile = step(vec2(0.15), fract(hitInfo.vObjectId.yz));
		float fTile = vTile.x * vTile.y;
        mat.cAlbedo = vec3(1.0) * (fTile * 0.8 + 0.2);
        mat.fSmoothness = mat.cAlbedo.r;
        mat.fTransparency = 0.0;
    }
    else
    if(hitInfo.vObjectId.x == kMaterialIdPipe)
    {
        // pipe
        mat.fR0 = 0.8;
        mat.fSmoothness = 1.0;
        mat.cAlbedo = vec3(0.5);
        mat.fTransparency = 0.0;
    }
    else
    {
        // water
        mat.fR0 = 0.01;
        mat.fSmoothness = 1.0;
        mat.fTransparency = 1.0;
        mat.fRefractiveIndex = 1.0 / 1.3330;
        const float fExtinctionScale = 2.0;
		const vec3 vExtinction = vec3(0.3, 0.7, 0.9);
        mat.cAlbedo = (vec3(1.0) - vExtinction) * fExtinctionScale; // becomes extinction for transparency
    }
    
    return mat;
}

vec3 GetSkyGradient( const in vec3 vDir )
{
    const vec3 cColourTop = vec3(0.7, 0.8, 1.0);
    const vec3 cColourHorizon = cColourTop * 0.5;

    float fBlend = clamp(vDir.y, 0.0, 1.0);
    return mix(cColourHorizon, cColourTop, fBlend);
}

C_PointLight GetPointLight()
{
    C_PointLight result;

    result.vPos = vec3(0.5, 1.0, -2.0);
    result.cColour = vec3(32.0, 6.0, 1.0) * 10.0;

    return result;
}

C_DirectionalLight GetDirectionalLight()
{
    C_DirectionalLight result;

    result.vDir = normalize(vec3(-0.2, -0.3, 0.5));
    result.cColour = vec3(8.0, 7.5, 7.0);

    return result;
}

vec3 GetAmbientLight(const in vec3 vNormal)
{
    return GetSkyGradient(vNormal);
}

/////////////////////////////////////
// Raymarching 

vec3 GetSceneNormal( const in vec3 vPos, const in float fTransparentScale )
{
    // tetrahedron normal
    const float fDelta = 0.025;

    vec3 vOffset1 = vec3( fDelta, -fDelta, -fDelta);
    vec3 vOffset2 = vec3(-fDelta, -fDelta,  fDelta);
    vec3 vOffset3 = vec3(-fDelta,  fDelta, -fDelta);
    vec3 vOffset4 = vec3( fDelta,  fDelta,  fDelta);

    float f1 = GetDistanceScene( vPos + vOffset1, fTransparentScale ).x;
    float f2 = GetDistanceScene( vPos + vOffset2, fTransparentScale ).x;
    float f3 = GetDistanceScene( vPos + vOffset3, fTransparentScale ).x;
    float f4 = GetDistanceScene( vPos + vOffset4, fTransparentScale ).x;

    vec3 vNormal = vOffset1 * f1 + vOffset2 * f2 + vOffset3 * f3 + vOffset4 * f4;

    return normalize( vNormal );
}

#define kRaymarchEpsilon 0.01
// This is an excellent resource on ray marching -> https://iquilezles.org/articles/distfunctions
void Raymarch( const in C_Ray ray, out C_HitInfo result, const int maxIter, const float fTransparentScale )
{        
    result.fDistance = GetRayFirstStep( ray );
    result.vObjectId.x = 0.0;
        
    for(int i=0;i<=kRaymarchMaxIter;i++)              
    {
        result.vPos = ray.vOrigin + ray.vDir * result.fDistance;
        vec4 vSceneDist = GetDistanceScene( result.vPos, fTransparentScale );
        result.vObjectId = vSceneDist.yzw;
        
        // abs allows backward stepping - should only be necessary for non uniform distance functions
        if((abs(vSceneDist.x) <= kRaymarchEpsilon) || (result.fDistance >= ray.fLength) || (i > maxIter))
        {
            break;
        }                        

        result.fDistance = result.fDistance + vSceneDist.x; 
    }


    if(result.fDistance >= ray.fLength)
    {
        result.fDistance = 1000.0;
        result.vPos = ray.vOrigin + ray.vDir * result.fDistance;
        result.vObjectId.x = 0.0;
    }
}

float GetShadow( const in vec3 vPos, const in vec3 vNormal, const in vec3 vLightDir, const in float fLightDistance )
{
    #ifdef ENABLE_SHADOWS
		C_Ray shadowRay;
		shadowRay.vDir = vLightDir;
		shadowRay.vOrigin = vPos;
		const float fShadowBias = 0.05;
		shadowRay.fStartDistance = fShadowBias / abs(dot(vLightDir, vNormal));
		shadowRay.fLength = fLightDistance - shadowRay.fStartDistance;
	
		C_HitInfo shadowIntersect;
		Raymarch(shadowRay, shadowIntersect, 32, kNoTransparency);
		
		float fShadow = step(0.0, shadowIntersect.fDistance) * step(fLightDistance, shadowIntersect.fDistance );
		
		return fShadow;          
    #else
    	return 1.0;
    #endif
}

// use distance field to evaluate ambient occlusion
float GetAmbientOcclusion(const in C_HitInfo intersection, const in C_Surface surface)
{
    #ifdef ENABLE_AMBIENT_OCCLUSION    
		vec3 vPos = intersection.vPos;
		vec3 vNormal = surface.vNormal;
	
		float fAmbientOcclusion = 1.0;
	
		float fDist = 0.0;
		for(int i=0; i<=5; i++)
		{
			fDist += 0.1;
	
			vec4 vSceneDist = GetDistanceScene(vPos + vNormal * fDist, kNoTransparency);
	
			fAmbientOcclusion *= 1.0 - max(0.0, (fDist - vSceneDist.x) * 0.2 / fDist );                                  
		}
	
		return fAmbientOcclusion;
    #else
	    return 1.0;
    #endif    
}

/////////////////////////////////////
// Lighting and Shading

#define kFogDensity 0.05

void ApplyAtmosphere(inout vec3 col, const in C_Ray ray, const in C_HitInfo hitInfo)
{
    #ifdef ENABLE_FOG
    // fog
    float fFogAmount = exp(hitInfo.fDistance * -kFogDensity);
    vec3 cFog = GetSkyGradient(ray.vDir);

    #ifdef ENABLE_DIRECTIONAL_LIGHT_FLARE
    C_DirectionalLight directionalLight = GetDirectionalLight();
    float fDirDot = clamp(dot(-directionalLight.vDir, ray.vDir), 0.0, 1.0);
    cFog += directionalLight.cColour * pow(fDirDot, 10.0);
    #endif 

    col = mix(cFog, col, fFogAmount);
    #endif

    // glare from light (a bit hacky - use length of closest approach from ray to light)
    #ifdef ENABLE_POINT_LIGHT_FLARE
    C_PointLight pointLight = GetPointLight();

    vec3 vToLight = pointLight.vPos - ray.vOrigin;
    float fPointDot = dot(vToLight, ray.vDir);
    fPointDot = clamp(fPointDot, 0.0, hitInfo.fDistance);

    vec3 vClosestPoint = ray.vOrigin + ray.vDir * fPointDot;
    float fDist = length(vClosestPoint - pointLight.vPos);
    col += pointLight.cColour * 0.01/ (fDist * fDist);
    #endif    
}

// http://en.wikipedia.org/wiki/Schlick's_approximation
float Schlick( const in vec3 vHalf, const in vec3 vView, const in float fR0, const in float fSmoothFactor)
{
    float fDot = dot(vHalf, -vView);
    fDot = clamp((1.0 - fDot), 0.0, 1.0);
    float fDotPow = pow(fDot, 5.0);
    return fR0 + (1.0 - fR0) * fDotPow * fSmoothFactor;
}

vec3 ApplyFresnel(const in vec3 vDiffuse, const in vec3 vSpecular, const in vec3 vNormal, const in vec3 vView, const in C_Material material)
{
	vec3 vReflect = reflect(vView, vNormal);
	vec3 vHalf = normalize(vReflect + -vView);
    float fFresnel = Schlick(vHalf, vView, material.fR0, material.fSmoothness * 0.9 + 0.1);
    return mix(vDiffuse, vSpecular, fFresnel);    
}

float GetBlinnPhongIntensity(const in vec3 vIncidentDir, const in vec3 vLightDir, const in vec3 vNormal, const in float fSmoothness)
{          
    vec3 vHalf = normalize(vLightDir - vIncidentDir);
    float fNdotH = max(0.0, dot(vHalf, vNormal));

    float fSpecPower = exp2(4.0 + 6.0 * fSmoothness);
    float fSpecIntensity = (fSpecPower + 2.0) * 0.125;

    return pow(fNdotH, fSpecPower) * fSpecIntensity;
}

C_Shading ApplyPointLight( const in C_PointLight light, const in vec3 vSurfacePos, const in vec3 vIncidentDir, const in vec3 vNormal, const in C_Material material )
{
    C_Shading shading;
    
    vec3 vToLight = light.vPos - vSurfacePos;
    vec3 vLightDir = normalize(vToLight);
    float fLightDistance = length(vToLight);
    
    float fAttenuation = 1.0 / (fLightDistance * fLightDistance);
    
    float fShadowFactor = GetShadow( vSurfacePos, vNormal, vLightDir, fLightDistance );
    vec3 vIncidentLight = light.cColour * fShadowFactor * fAttenuation * max(0.0, dot(vLightDir, vNormal));
    
    shading.cDiffuse = vIncidentLight;                                  
    shading.cSpecular = GetBlinnPhongIntensity( vIncidentDir, vLightDir, vNormal, material.fSmoothness ) * vIncidentLight;
    
    return shading;
}  

C_Shading ApplyDirectionalLight( const in C_DirectionalLight light, const in vec3 vSurfacePos, const in vec3 vIncidentDir, const in vec3 vNormal, const in C_Material material )
{
    C_Shading shading;

    const float kShadowRayLength = 10.0;      
    vec3 vLightDir = -light.vDir;
    float fShadowFactor = GetShadow( vSurfacePos, vNormal, vLightDir, kShadowRayLength );
    vec3 vIncidentLight = light.cColour * fShadowFactor * max(0.0, dot(vLightDir, vNormal));
    
    shading.cDiffuse = vIncidentLight;                                  
    shading.cSpecular = GetBlinnPhongIntensity( vIncidentDir, vLightDir, vNormal, material.fSmoothness ) * vIncidentLight;
    
    return shading;
}  


vec3 ShadeSurface(const in C_Ray ray, const in C_HitInfo hitInfo, const in C_Surface surface, const in C_Material material)
{
    vec3 cScene;
    
    C_Shading shading;

    shading.cDiffuse = vec3(0.0);
    shading.cSpecular = vec3(0.0);
    
    float fAmbientOcclusion = GetAmbientOcclusion(hitInfo, surface);
    vec3 vAmbientLight = GetAmbientLight(surface.vNormal) * fAmbientOcclusion;
    
    shading.cDiffuse += vAmbientLight;
    shading.cSpecular += surface.cReflection;
              
    #ifdef ENABLE_POINT_LIGHT
    C_PointLight pointLight = GetPointLight(); 
    C_Shading pointLighting = ApplyPointLight(pointLight, hitInfo.vPos,ray.vDir, surface.vNormal, material);
    shading.cDiffuse += pointLighting.cDiffuse;
    shading.cSpecular += pointLighting.cSpecular;
    #endif

    #ifdef ENABLE_DIRECTIONAL_LIGHT
	C_DirectionalLight directionalLight = GetDirectionalLight();
    C_Shading directionLighting = ApplyDirectionalLight(directionalLight, hitInfo.vPos, ray.vDir, surface.vNormal, material);
    shading.cDiffuse += directionLighting.cDiffuse;
    shading.cSpecular += directionLighting.cSpecular;
    #endif

    vec3 vDiffuseReflection = shading.cDiffuse * material.cAlbedo;              

    // swap diffuse for transmission
    vDiffuseReflection = mix(vDiffuseReflection, surface.cTransmission, material.fTransparency);    

    #ifdef ENABLE_SPECULAR
    cScene = ApplyFresnel(vDiffuseReflection , shading.cSpecular, surface.vNormal, ray.vDir, material);
    #else
    cScene = vDiffuseReflection;
    #endif
    
    return cScene;
}

vec3 GetSceneColourSecondary( const in C_Ray ray );

vec3 GetReflection( const in C_Ray ray, const in C_HitInfo hitInfo, const in C_Surface surface )
{
    #ifdef ENABLE_REFLECTIONS    
    {
        // get colour from reflected ray
        const float fSeparation    = 0.1;

        C_Ray reflectRay;
        reflectRay.vDir = reflect(ray.vDir, surface.vNormal);
        reflectRay.vOrigin = hitInfo.vPos;
        reflectRay.fLength = 16.0;
        reflectRay.fStartDistance = fSeparation / abs(dot(reflectRay.vDir, surface.vNormal));
        
        return GetSceneColourSecondary(reflectRay);      
    }
    #else
        return GetSkyGradient(reflect(ray.vDir, surface.vNormal));                              
    #endif
}

vec3 GetTransmission( const in C_Ray ray, const in C_HitInfo hitInfo, const in C_Surface surface, const in C_Material material )
{
    #ifdef ENABLE_TRANSPARENCY  
    {
        const float fSeparation = 0.05;

        // Trace until outside transparent object
        C_Ray refractRay;
        // we dont handle total internal reflection (in that case refract returns a zero length vector)
        refractRay.vDir = refract(ray.vDir, surface.vNormal, material.fRefractiveIndex);
        refractRay.vOrigin = hitInfo.vPos;
        refractRay.fLength = 16.0;
        refractRay.fStartDistance = fSeparation / abs(dot(refractRay.vDir, surface.vNormal));

		#ifdef DOUBLE_SIDED_TRANSPARENCY
		
			C_HitInfo hitInfo2;
			Raymarch(refractRay, hitInfo2, 32, kInverseTransparency);
			vec3 vNormal = GetSceneNormal(hitInfo2.vPos, kInverseTransparency);
			
			// get colour from rest of scene
			C_Ray refractRay2;
			refractRay2.vDir = refract(refractRay.vDir, vNormal, 1.0 / material.fRefractiveIndex);
			refractRay2.vOrigin = hitInfo2.vPos;
			refractRay2.fLength = 16.0;
			refractRay2.fStartDistance = 0.0;//fSeparation / abs(dot(refractRay2.vDir, vNormal));
			
			float fExtinctionDist = hitInfo2.fDistance;
			vec3 vSceneColour = GetSceneColourSecondary(refractRay2);
		
		#else
		
			vec3 vSceneColour = GetSceneColourSecondary(refractRay);                                                                        
			float fExtinctionDist = 0.5;
		
		#endif
                                
        vec3 cMaterialExtinction = material.cAlbedo;
        // extinction should really be exp(-) but this is a nice hack to get RGB
        vec3 cExtinction = (1.0 / (1.0 + (cMaterialExtinction * fExtinctionDist)));		
		
		//vec3 cExtinction = exp2(-cMaterialExtinction * fExtinctionDist);
                                
        return vSceneColour * cExtinction;
    }
    #else
        return GetSkyGradient(reflect(ray.vDir, surface.vNormal));                              
    #endif
}

// no reflections, no transparency, used for secondary rays
vec3 GetSceneColourSecondary( const in C_Ray ray )
{
    C_HitInfo hitInfo;
    Raymarch(ray, hitInfo, 32, kNoTransparency);
                        
    vec3 cScene;

    if(hitInfo.vObjectId.x < 0.5)
    {
        cScene = GetSkyGradient(ray.vDir);
    }
    else
    {
        C_Surface surface;        
        surface.vNormal = GetSceneNormal(hitInfo.vPos, kNoTransparency);

        C_Material material = GetObjectMaterial(hitInfo);

        // use sky gradient instead of reflection
        surface.cReflection = GetSkyGradient(reflect(ray.vDir, surface.vNormal));
        
        material.fTransparency = 0.0;

        // apply lighting
        cScene = ShadeSurface(ray, hitInfo, surface, material);
    }

    ApplyAtmosphere(cScene, ray, hitInfo);

    return cScene;
}

vec3 GetSceneColourPrimary( const in C_Ray ray )
{                                                          
    C_HitInfo intersection;
    Raymarch(ray, intersection, 256, kTransparency);
                
    vec3 cScene;

    if(intersection.vObjectId.x < 0.5)
    {
        cScene = GetSkyGradient(ray.vDir);
    }
    else
    {
        C_Surface surface;
        
        surface.vNormal = GetSceneNormal(intersection.vPos, kTransparency);

        C_Material material = GetObjectMaterial(intersection);

        surface.cReflection = GetReflection(ray, intersection, surface);

        if(material.fTransparency > 0.0)
        {    
            surface.cTransmission = GetTransmission(ray, intersection, surface, material);
        }

        // apply lighting
        cScene = ShadeSurface(ray, intersection, surface, material);
    }

    ApplyAtmosphere(cScene, ray, intersection);

    return cScene;
}

float kFarClip = 30.0;

void GetCameraRay( const in vec3 vPos, const in vec3 vForwards, const in vec3 vWorldUp, const in vec2 fragCoord, out C_Ray ray)
{
    vec2 vUV = ( fragCoord.xy / iResolution.xy );
    vec2 vViewCoord = vUV * 2.0 - 1.0;

    float fRatio = iResolution.x / iResolution.y;
    vViewCoord.y /= fRatio;                          

    ray.vOrigin = vPos;

    vec3 vRight = normalize(cross(vForwards, vWorldUp));
    vec3 vUp = cross(vRight, vForwards);
        
    ray.vDir = normalize( vRight * vViewCoord.x + vUp * vViewCoord.y + vForwards); 
    ray.fStartDistance = 0.0;
    ray.fLength = kFarClip;      
}

void GetCameraRayLookat( const in vec3 vPos, const in vec3 vInterest, const in vec2 fragCoord, out C_Ray ray)
{
    vec3 vForwards = normalize(vInterest - vPos);
    vec3 vUp = vec3(0.0, 1.0, 0.0);

    GetCameraRay(vPos, vForwards, vUp, fragCoord, ray);
}

vec3 OrbitPoint( const in float fHeading, const in float fElevation )
{
    return vec3(sin(fHeading) * cos(fElevation), sin(fElevation), cos(fHeading) * cos(fElevation));
}

vec3 Tonemap( const in vec3 cCol )
{ 
    vec3 vResult = 1.0 -exp2(-cCol);

    return vResult;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    C_Ray ray;

    vec2 vMouseUV = iMouse.xy / iResolution.xy;    
    
    if(iMouse.z < 0.5)
    {
        vMouseUV = vec2(0.2, 0.8);
    }

    float fHeading = mix(-0.5, kPI + 0.5, vMouseUV.x);
    float fElevation = mix(1.5, -0.25, vMouseUV.y);
    float fCameraDist = mix(4.0, 2.5, vMouseUV.y);
    
    vec3 vCameraPos = OrbitPoint(fHeading, fElevation) * fCameraDist;
    vec3 vCameraIntrest = vec3(1.0, 0.9, 0.0);

    GetCameraRayLookat( vCameraIntrest + vCameraPos, vCameraIntrest, fragCoord, ray);

    vec3 cScene = GetSceneColourPrimary( ray );  

    const float fExposure = 1.5;    
    fragColor = vec4( Tonemap(cScene * fExposure), 1.0 );
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{	
    C_Ray ray;
    
    fragRayOri.x += 2.0;
    fragRayOri.y += 1.5;
    fragRayOri.z += 3.0;
    

    ray.vOrigin = fragRayOri;
    ray.vDir = fragRayDir;
    ray.fStartDistance = 0.0;
    ray.fLength = kFarClip;
        
    vec3 cScene = GetSceneColourPrimary( ray );  

    const float fExposure = 1.5;    
    fragColor = vec4( Tonemap(cScene * fExposure), 1.0 );
    
}
`,dt=`
in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,yt=`
precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrame;
uniform vec4 iMouse;
uniform sampler2D iChannel0;

uniform vec3 uCameraPos;
uniform vec3 uCameraForward;
uniform vec3 uCameraUp;
uniform float uFovY;
uniform mat4 uInvSpoutWorld;
uniform float uPipeRadius;
uniform float uPipeThickness;
uniform float uPipeHeight;
uniform float uPipeLength;
uniform float uWaterSpeed;
uniform float uShowFloor;
uniform float uShowPipe;
uniform float uExposure;
uniform vec3 uPipeColor;
uniform float uPipeRoughness;
uniform vec3 uWaterColor;
uniform float uWaterOpacity;
uniform float uWaterRoughness;
uniform float uWaterIor;
uniform float uWaterTint;

out vec4 outColor;

#define kPipeRadius uPipeRadius
#define kPipeThickness uPipeThickness
#define kPipeHeight uPipeHeight
#define kPipeLength uPipeLength
`,gt=`
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  C_Ray ray;

  vec2 vUV = fragCoord.xy / iResolution.xy;
  vec2 vViewCoord = vUV * 2.0 - 1.0;
  float fRatio = iResolution.x / max(iResolution.y, 1.0);
  vViewCoord.x *= fRatio;

  float tanHalf = tan(radians(uFovY) * 0.5);
  vec3 vForward = normalize(uCameraForward);
  vec3 vRight = normalize(cross(vForward, normalize(uCameraUp)));
  vec3 vUp = cross(vRight, vForward);

  vec3 worldOrigin = uCameraPos;
  vec3 worldDir = normalize(vRight * vViewCoord.x * tanHalf + vUp * vViewCoord.y * tanHalf + vForward);

  // Transform camera ray into spout local space (position / rotation / scale).
  vec4 oLocal = uInvSpoutWorld * vec4(worldOrigin, 1.0);
  vec4 dLocal = uInvSpoutWorld * vec4(worldDir, 0.0);
  ray.vOrigin = oLocal.xyz;
  ray.vDir = normalize(dLocal.xyz);
  ray.fStartDistance = 0.0;
  ray.fLength = kFarClip;

  C_HitInfo intersection;
  Raymarch(ray, intersection, 256, kTransparency);

  if (intersection.vObjectId.x < 0.5) {
    fragColor = vec4(0.0);
    return;
  }

  C_Surface surface;
  surface.vNormal = GetSceneNormal(intersection.vPos, kTransparency);

  C_Material material = GetObjectMaterial(intersection);
  surface.cReflection = GetReflection(ray, intersection, surface);

  if (material.fTransparency > 0.0) {
    surface.cTransmission = GetTransmission(ray, intersection, surface, material);
  }

  vec3 cScene = ShadeSurface(ray, intersection, surface, material);
  fragColor = vec4(Tonemap(cScene * uExposure), 1.0);
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  outColor = color;
}
`;function wt(v){let t=v;const n=t.indexOf("void mainImage");return n>=0&&(t=t.slice(0,n)),t=t.replace(/const float kPipeRadius = [\d.]+;/,"// kPipeRadius → uniform"),t=t.replace(/const float kPipeThickness = [\d.]+;/,"// kPipeThickness → uniform"),t=t.replace(/const float kPipeHeight = [\d.]+;/,"// kPipeHeight → uniform"),t=t.replace(/const float kPipeLength = [\d.]+;/,"// kPipeLength → uniform"),t=t.replace(/float kRipplePos = sqrt\(abs\(2\.0 \* kPipeHeight \/ kWaterAccel\)\) \* kWaterVelocity;/,"// kRipplePos computed inline (uniform-safe)"),t=t.replace(/vec2 vRippleCentre1 = vPos\.xz - vec2\(kRipplePos, 0\.0\);/,`float kRipplePos = sqrt(abs(2.0 * kPipeHeight / kWaterAccel)) * kWaterVelocity;
	vec2 vRippleCentre1 = vPos.xz - vec2(kRipplePos, 0.0);`),t=t.replace(/float fDistFloor = vPos\.y;[\s\S]*?vResult = DistCombineUnion\(vResult, vDistFloor\);/,`if (uShowFloor > 0.5) {
	float fDistFloor = vPos.y;
	float fDistBrick = fDistFloor;
	
	float fDistTrench = length(vPos.yz + vec2(-0.4, 0.0)) - 1.0;
	fDistBrick = max(fDistBrick, -(fDistTrench));
	
	float fDistWall = vPos.x + 1.0;
	fDistBrick = min(fDistBrick, fDistWall);
	
    vec4 vDistFloor = vec4(fDistBrick, kMaterialIdWall, vPos.xz + vec2(vPos.y, 0.0));
    vResult = DistCombineUnion(vResult, vDistFloor);
	}`),t=t.replace(/float fDistPipe = max\(fDistWater - kPipeThickness, vWaterDomain\.x\);[\s\S]*?vResult = DistCombineUnion\(vResult, vDistPipe\);/,`if (uShowPipe > 0.5) {
    float fDistPipe = max(fDistWater - kPipeThickness, vWaterDomain.x);
    fDistPipe = max(fDistPipe, -vWaterDomain.x - kPipeLength);
    fDistPipe = max(fDistPipe, -fDistWater); // subtract the water from the pipe to make the hole
    vec4 vDistPipe = vec4(fDistPipe, kMaterialIdPipe, vPos.xy);
    vResult = DistCombineUnion(vResult, vDistPipe);
	}`),t=t.replace(/float fDistWater = \(length\(vWaterDomain\.yz\) - kPipeRadius\);/,`float fDistWater = (length(vWaterDomain.yz) - kPipeRadius);
    fDistWater = max(fDistWater, -vWaterDomain.x - kPipeLength);`),t=t.replace(/\/\/ pipe\s*mat\.fR0 = 0\.8;\s*mat\.fSmoothness = 1\.0;\s*mat\.cAlbedo = vec3\(0\.5\);\s*mat\.fTransparency = 0\.0;/,`// pipe
        mat.fR0 = mix(0.04, 0.8, 1.0 - uPipeRoughness);
        mat.fSmoothness = clamp(1.0 - uPipeRoughness, 0.0, 1.0);
        mat.cAlbedo = uPipeColor;
        mat.fTransparency = 0.0;`),t=t.replace(/\/\/ water\s*mat\.fR0 = 0\.01;\s*mat\.fSmoothness = 1\.0;\s*mat\.fTransparency = 1\.0;\s*mat\.fRefractiveIndex = 1\.0 \/ 1\.3330;\s*const float fExtinctionScale = 2\.0;\s*const vec3 vExtinction = vec3\(0\.3, 0\.7, 0\.9\);\s*mat\.cAlbedo = \(vec3\(1\.0\) - vExtinction\) \* fExtinctionScale; \/\/ becomes extinction for transparency/,`// water
        mat.fR0 = 0.01;
        mat.fSmoothness = clamp(1.0 - uWaterRoughness, 0.0, 1.0);
        mat.fTransparency = clamp(uWaterOpacity, 0.0, 1.0);
        mat.fRefractiveIndex = 1.0 / max(uWaterIor, 1.001);
        // Desired tint stays; complementary channels absorb → blue/cyan look by default.
        mat.cAlbedo = (vec3(1.0) - uWaterColor) * uWaterTint; // extinction for transmission`),t=t.replace(/float fInTrench = step\(vPos\.y, \(-0\.1 \+ 0\.05\)\);/,"float fInTrench = uShowFloor > 0.5 ? step(vPos.y, (-0.1 + 0.05)) : 0.0;"),t=t.replace(/float fTrenchWaterDist = vPos\.y \+ 0\.1;\s*fDistWater = min\(fDistWater, fTrenchWaterDist\);/,`if (uShowFloor > 0.5) {
	float fTrenchWaterDist = vPos.y + 0.1;
	fDistWater = min(fDistWater, fTrenchWaterDist);
	}`),t=t.replace(/vNoiseDomain\.x \+= -iTime \* fWaterSpeed;/,"vNoiseDomain.x += -iTime * fWaterSpeed * uWaterSpeed;"),t=t.replace(/#define kFogDensity 0\.05/,"#define kFogDensity 0.0"),t}function St(){return dt}function Pt(){return yt+wt(mt)+gt}const ze=320,Fe=36,De=He.fov;function xt({settings:v,liveLookRef:t,onStatusChange:n,onGizmoChange:a}){const i=G.useRef(null),o=G.useRef(v),e=G.useRef(t);e.current=t;const s=G.useRef(n),_=G.useRef(a),[k,W]=G.useState(null);G.useEffect(()=>{o.current=v},[v]),G.useEffect(()=>{s.current=n},[n]),G.useEffect(()=>{_.current=a},[a]),G.useEffect(()=>{const b=i.current;if(!b)return;let Q=!1,d=null,P=null,h=null,l=null,x=null,y=null,R=null,M=null,m=null,V=null,$=!1,ee=0,le=performance.now(),B=!1,te=!1;const fe=new f,A=new f,T=new ce,K=new ce().makeTranslation(-1,-.9,0),E=new f,N=new ot,D=(c,w)=>{if(!(!c||typeof c.dispose!="function"))try{c.dispose()}catch(p){console.debug(`[Panorama360Spout] ${w} dispose skipped:`,p)}},O=(c,w)=>{W(w),s.current?.(c,w),$=!1},Z=()=>{if(!l||B)return;const c=o.current;te=!0,A.copy(we(c.viewYaw,c.viewPitch,ze)),l.position.copy(A),l.rotation.set(c.rotationX,c.rotationY,c.rotationZ);const w=Math.max(.05,c.size)*Fe;l.scale.setScalar(w),l.updateMatrixWorld(!0),te=!1},J=()=>{if(!h)return;const c=e.current?.current??He,w=c.yaw,p=c.pitch,u=typeof c.fov=="number"&&Number.isFinite(c.fov)?c.fov:De;Math.abs(h.fov-u)>1e-4&&(h.fov=u,h.updateProjectionMatrix()),fe.copy(we(w,p,1)),h.position.set(0,0,0),h.up.set(0,1,0),h.lookAt(fe),h.updateMatrixWorld(),h.getWorldDirection(E)},ye=(c,w)=>{if(!R||!h||!l||!d)return;const p=o.current;l.updateMatrixWorld(!0);const u=R.uniforms;d.getSize(N);const j=d.getPixelRatio();u.iResolution.value.set(N.x*j,N.y*j,1),u.iTime.value=w*.001,u.iTimeDelta.value=c,u.iFrame.value=ee,u.uCameraPos.value.copy(h.position),u.uCameraForward.value.copy(E),u.uCameraUp.value.copy(h.up),u.uFovY.value=h.fov,T.copy(l.matrixWorld).multiply(K).invert(),u.uInvSpoutWorld.value.copy(T),u.uPipeRadius.value=p.pipeRadius,u.uPipeThickness.value=p.pipeThickness,u.uPipeHeight.value=p.pipeHeight,u.uPipeLength.value=p.pipeLength,u.uWaterSpeed.value=Math.max(.05,p.speed),u.uShowFloor.value=p.showFloor?1:0,u.uShowPipe.value=p.showPipe?1:0,u.uExposure.value=p.exposure,u.uPipeColor.value.set(p.pipeColor||"#808080"),u.uPipeRoughness.value=Math.min(1,Math.max(0,p.pipeRoughness??0)),u.uWaterColor.value.set(p.waterColor||"#4CB3E6"),u.uWaterOpacity.value=Math.min(1,Math.max(0,p.waterOpacity??1)),u.uWaterRoughness.value=Math.min(1,Math.max(0,p.waterRoughness??0)),u.uWaterIor.value=Math.min(2.5,Math.max(1,p.waterIor??1.333)),u.uWaterTint.value=Math.min(6,Math.max(.2,p.waterTint??2))},he=()=>{if(!m)return;const c=o.current,w=c.editTransform===!0;m.visible=w,m.enabled=w;const p=c.gizmoMode==="translate"||c.gizmoMode==="scale"?c.gizmoMode:"rotate";m.setMode(p),m.showX=!0,m.showY=!0,m.showZ=!0,x&&(x.visible=w)},Ie=()=>{if(!l)return;const c=at(l.position),w=Math.max(l.scale.x,l.scale.y,l.scale.z);l.scale.setScalar(w),l.position.copy(we(c.yaw,c.pitch,ze)),_.current?.({viewYaw:c.yaw,viewPitch:c.pitch,rotationX:l.rotation.x,rotationY:l.rotation.y,rotationZ:l.rotation.z,size:Math.min(3,Math.max(.2,w/Fe))})},Ce=()=>{if(!b||!h||!d)return;const c=b.clientWidth,w=b.clientHeight;c===0||w===0||(h.aspect=c/w,h.updateProjectionMatrix(),d.setSize(c,w,!1))},be=c=>{if(Q||!$||!d||!P||!h)return;requestAnimationFrame(be);const w=Math.min(.05,Math.max(.001,(c-le)/1e3));le=c,ee+=1,J(),B||Z(),he(),ye(w,c);try{const p=m?.getHelper(),u=o.current.editTransform===!0;if(y&&(y.visible=!0),p&&(p.visible=!1),d.autoClear=!0,d.render(P,h),ee===1&&R){const j=R.program,ne=d.getContext();if(j?.program&&ne&&!ne.getProgramParameter(j.program,ne.LINK_STATUS)){O("error","Spout shader failed to compile — WebGL2 overlay disabled.");return}}u&&p&&m&&(y&&(y.visible=!1),p.visible=!0,d.autoClear=!1,d.clearDepth(),d.render(P,h),y&&(y.visible=!0)),d.autoClear=!0}catch(p){console.error("[Panorama360Spout] render error:",p),O("error","Spout effect crashed — panorama left intact.")}};try{const c=document.createElement("canvas"),w=c.getContext("webgl2",{alpha:!0,antialias:!1,premultipliedAlpha:!0,powerPreference:"high-performance"});if(!w){O("unsupported","WebGL2 is required for the Spout effect. Try a current Chromium, Firefox, or Safari.");return}d=new qe({canvas:c,context:w,alpha:!0,antialias:!1,premultipliedAlpha:!0,powerPreference:"high-performance"}),d.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),d.setClearColor(0,0),d.autoClear=!0,b.appendChild(d.domElement),P=new Ve,h=new $e(De,1,.1,5e3),M=new Ke(new Uint8Array([255,255,255,255]),1,1),M.needsUpdate=!0;let p;try{p=Pt()}catch(ge){console.error(ge),O("error","Failed to build Spout shader.");return}R=new Je({glslVersion:tt,transparent:!0,depthTest:!1,depthWrite:!1,uniforms:{iResolution:{value:new f(1,1,1)},iTime:{value:0},iTimeDelta:{value:.016},iFrame:{value:0},iMouse:{value:new et(0,0,0,0)},iChannel0:{value:M},uCameraPos:{value:new f},uCameraForward:{value:new f(0,0,-1)},uCameraUp:{value:new f(0,1,0)},uFovY:{value:De},uInvSpoutWorld:{value:new ce},uPipeRadius:{value:o.current.pipeRadius},uPipeThickness:{value:o.current.pipeThickness},uPipeHeight:{value:o.current.pipeHeight},uPipeLength:{value:o.current.pipeLength},uWaterSpeed:{value:1},uShowFloor:{value:0},uShowPipe:{value:o.current.showPipe?1:0},uExposure:{value:1.5},uPipeColor:{value:new Ee(o.current.pipeColor||"#808080")},uPipeRoughness:{value:o.current.pipeRoughness??0},uWaterColor:{value:new Ee(o.current.waterColor||"#4CB3E6")},uWaterOpacity:{value:o.current.waterOpacity??1},uWaterRoughness:{value:o.current.waterRoughness??0},uWaterIor:{value:o.current.waterIor??1.333},uWaterTint:{value:o.current.waterTint??2}},vertexShader:St(),fragmentShader:p});const u=new _e;u.setAttribute("position",new nt(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3)),y=new r(u,R),y.frustumCulled=!1,y.raycast=()=>{},P.add(y),l=new it,P.add(l);const j=new I(1.2,2.4,1.2),ne=new Re({color:4890367,wireframe:!0,transparent:!0,opacity:.35,depthTest:!1});x=new r(j,ne),x.visible=!1,l.add(x),m=new rt(h,d.domElement),m.setSize(.85),m.attach(l),m.visible=!1,m.enabled=!1,P.add(m.getHelper()),m.addEventListener("dragging-changed",ge=>{B=!!ge.value,!B&&l&&Ie()}),m.addEventListener("objectChange",()=>{te||!l||!B||Ie()}),Z(),Ce(),V=new ResizeObserver(Ce),V.observe(b),$=!0,s.current?.("ready"),W(null),requestAnimationFrame(be)}catch(c){console.error("[Panorama360Spout] init error:",c),O("error","Spout effect failed to initialize.")}return()=>{Q=!0,$=!1,V?.disconnect(),V=null;try{m&&(m.detach(),m.dispose())}catch(c){console.debug("[Panorama360Spout] controls dispose skipped:",c)}if(m=null,l&&P&&P.remove(l),y&&P&&P.remove(y),D(x?.geometry,"proxyGeom"),D(x?.material,"proxyMat"),D(y?.geometry,"quadGeom"),D(R,"material"),D(M,"dummyTex"),x=null,y=null,R=null,M=null,l=null,d)try{d.dispose();const c=d.domElement;c.parentElement===b&&b.removeChild(c)}catch(c){console.debug("[Panorama360Spout] renderer dispose skipped:",c)}d=null,P=null,h=null}},[]);const H=v.editTransform===!0;return Le.jsx("div",{ref:i,className:`panorama-360-spout-overlay${H?" is-editing":""}`,"aria-hidden":!H,children:k&&Le.jsx("div",{className:"panorama-360-spout-overlay-status",role:"status",children:k})})}export{xt as default};
