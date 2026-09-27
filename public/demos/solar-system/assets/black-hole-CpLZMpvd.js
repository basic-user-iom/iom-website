import{q as M,a as Je,r as et,s as tt,t as it,u as st,v as Se,w as Re,G as ot,c as we,m as Ee,M as A,T as nt,x as ke,A as F,S as V,d as ee,h as rt,F as ae,g as ce,B as at,l as ct}from"./three-D3Pg0kCM.js";const lt=1e3,dt=60,ut=60*dt,ye=24*ut,qe=365.25,ht=qe/12,vi=qe*ye,bi=ht*ye,pt=149597870700,Q=66743e-15,ft=299792458;function Si(e){return e*lt}const xe=["sun","mercury","venus","earth","mars","jupiter","saturn","uranus","neptune"],Ri=["sun","mercury","venus","earth","moon","mars","jupiter","saturn","uranus","neptune"],mt=["balanced","high","ultra"],Ve="Nonphysical cinematic mode: artificial orbital damping is applied to guarantee that every body spirals inward.",Ke="Educational approximation: Newtonian gravity is integrated in double precision; lensing is visual only and outcomes are not guaranteed.",U=198847e25,x=1/30,te=Object.freeze([14400,3600,900,300,60,10]),$e=Object.freeze({balanced:14400,high:3600,ultra:900});function wi(e){return ve({bodyIds:e.bodyIds,positionsM:new Float64Array(e.positionsM),velocitiesMps:new Float64Array(e.velocitiesMps),massesKg:new Float64Array(e.massesKg),radiiM:new Float64Array(e.radiiM)})}function gt(e){const t=ve(e),i=Math.max(vt(t),10*pt),s=36,o=2*ye,n=s*o*.5,r=[i*1.35,-i*.18,i*.04],a=[0,i*.08,0],c=[(a[0]-r[0])/n,(a[1]-r[1])/n,(a[2]-r[2])/n];return Me({initialState:t,blackHole:{massSolarMasses:10,initialPositionM:r,initialVelocityMps:c,closestApproachTargetM:a,closestApproachTimeSeconds:n,spinVisualization:.35,accretionDiskEnabled:!0,captureRadiusMultiple:8},accuracy:"high",durationSeconds:s,physicsSecondsPerScenarioSecond:o,playbackRate:1,seed:10031,ejectionRadiusM:i*4})}function Ei(e){const t=gt(e);return Ge({...t,blackHole:{...t.blackHole,massSolarMasses:20,spinVisualization:.68,captureRadiusMultiple:12},durationSeconds:42,seed:10032,infall:{angularMomentumDampingPerPhysicalSecond:24e-8,inwardBiasMps2:.018,stagingStartSeconds:5,stagingIntervalSeconds:3.4}})}function Me(e){const t=O(e.durationSeconds,"durationSeconds"),i=O(e.physicsSecondsPerScenarioSecond,"physicsSecondsPerScenarioSecond"),s=i*x;if(!bt(s))throw new RangeError("physicsSecondsPerScenarioSecond must make each fixed scenario tick a multiple of 10 physical seconds.");const o=D(e.playbackRate,.05,20,"playbackRate");if(!Number.isSafeInteger(e.seed)||e.seed<0)throw new RangeError("seed must be a non-negative safe integer.");if(!mt.includes(e.accuracy))throw new RangeError(`Unknown black-hole accuracy ${String(e.accuracy)}.`);return{initialState:ve(e.initialState),blackHole:Mt(e.blackHole),accuracy:e.accuracy,durationSeconds:t,physicsSecondsPerScenarioSecond:i,playbackRate:o,seed:e.seed,ejectionRadiusM:O(e.ejectionRadiusM,"ejectionRadiusM")}}function Ge(e){const t=Me(e),i=D(e.infall.stagingStartSeconds,0,t.durationSeconds,"infall.stagingStartSeconds"),s=O(e.infall.stagingIntervalSeconds,"infall.stagingIntervalSeconds");if(i+(t.initialState.bodyIds.length-1)*s+s*.8>=t.durationSeconds)throw new RangeError("Cinematic staging must capture every body before completion.");return{...t,infall:{angularMomentumDampingPerPhysicalSecond:D(e.infall.angularMomentumDampingPerPhysicalSecond,0,.01,"infall.angularMomentumDampingPerPhysicalSecond"),inwardBiasMps2:D(e.infall.inwardBiasMps2,0,1e3,"infall.inwardBiasMps2"),stagingStartSeconds:i,stagingIntervalSeconds:s}}}function yt(e){return{bodyIds:Object.freeze([...e.bodyIds]),positionsM:e.positionsM.slice(),velocitiesMps:e.velocitiesMps.slice(),massesKg:e.massesKg.slice(),radiiM:e.radiiM.slice()}}function ve(e){const t=e.bodyIds.length;if(t<xe.length)throw new RangeError("Black-hole encounters require the Sun and all eight planets.");const i=new Set(e.bodyIds);if(i.size!==t||e.bodyIds.some(s=>s.length===0))throw new TypeError("Captured black-hole body ids must be non-empty and unique.");for(const s of xe)if(!i.has(s))throw new RangeError(`Captured black-hole state is missing ${s}.`);if(e.positionsM.length!==t*3||e.velocitiesMps.length!==t*3)throw new RangeError("Captured position and velocity arrays must contain three values per body.");if(e.massesKg.length!==t||e.radiiM.length!==t)throw new RangeError("Captured mass and radius arrays must contain one value per body.");Te(e.positionsM,"positionsM"),Te(e.velocitiesMps,"velocitiesMps");for(let s=0;s<t;s+=1)O(e.massesKg[s]??Number.NaN,`massesKg[${s}]`),O(e.radiiM[s]??Number.NaN,`radiiM[${s}]`);return yt(e)}function Mt(e){return{massSolarMasses:D(e.massSolarMasses,.1,1e6,"blackHole.massSolarMasses"),initialPositionM:le(e.initialPositionM,"blackHole.initialPositionM"),initialVelocityMps:le(e.initialVelocityMps,"blackHole.initialVelocityMps"),closestApproachTargetM:le(e.closestApproachTargetM,"blackHole.closestApproachTargetM"),closestApproachTimeSeconds:O(e.closestApproachTimeSeconds,"blackHole.closestApproachTimeSeconds"),spinVisualization:D(e.spinVisualization,-1,1,"blackHole.spinVisualization"),accretionDiskEnabled:!!e.accretionDiskEnabled,captureRadiusMultiple:D(e.captureRadiusMultiple,1,1e4,"blackHole.captureRadiusMultiple")}}function vt(e){let t=0;for(let i=0;i<e.positionsM.length;i+=3)t=Math.max(t,Math.hypot(e.positionsM[i]??0,e.positionsM[i+1]??0,e.positionsM[i+2]??0));return t}function bt(e){const t=te.at(-1)??10;return Math.abs(e/t-Math.round(e/t))<1e-9}function le(e,t){if(e.length!==3||e.some(i=>!Number.isFinite(i)))throw new RangeError(`${t} must contain three finite components.`);return[e[0],e[1],e[2]]}function Te(e,t){for(const i of e)if(!Number.isFinite(i))throw new RangeError(`${t} must be finite.`)}function O(e,t){if(!Number.isFinite(e)||e<=0)throw new RangeError(`${t} must be finite and positive.`);return e}function D(e,t,i,s){if(!Number.isFinite(e)||e<t||e>i)throw new RangeError(`${s} must be in [${t}, ${i}].`);return e}class St{#e;constructor(t){this.#e=Object.freeze({...t})}serialize(){return JSON.stringify({angularMomentumDampingPerPhysicalSecond:this.#e.angularMomentumDampingPerPhysicalSecond,inwardBiasMps2:this.#e.inwardBiasMps2,stagingStartSeconds:this.#e.stagingStartSeconds,stagingIntervalSeconds:this.#e.stagingIntervalSeconds})}addAccelerations(t,i){const s=t.blackHoleIndex*3,o=t.positionsM[s]??0,n=t.positionsM[s+1]??0,r=t.positionsM[s+2]??0,a=t.velocitiesMps[s]??0,c=t.velocitiesMps[s+1]??0,d=t.velocitiesMps[s+2]??0;for(let l=0;l<t.bodyCount;l+=1){if((t.outcomeCodes[l]??0)===4)continue;const u=l*3,g=o-(t.positionsM[u]??0),y=n-(t.positionsM[u+1]??0),p=r-(t.positionsM[u+2]??0),h=Math.hypot(g,y,p);if(h<=0)continue;const f=g/h,m=y/h,v=p/h,b=(t.velocitiesMps[u]??0)-a,R=(t.velocitiesMps[u+1]??0)-c,T=(t.velocitiesMps[u+2]??0)-d,E=b*f+R*m+T*v,S=b-E*f,w=R-E*m,K=T-E*v,k=this.#e.angularMomentumDampingPerPhysicalSecond,z=this.#e.inwardBiasMps2;i[u]=(i[u]??0)-S*k+f*z,i[u+1]=(i[u+1]??0)-w*k+m*z,i[u+2]=(i[u+2]??0)-K*k+v*z}}}const ie=4,Rt=5,W=te.at(-1)??10;function j(e){if(!Number.isFinite(e)||e<=0)throw new RangeError("Black-hole mass must be finite and positive.");return 2*Q*e/ft**2}function fe(e,t){const i=e.bodyIds.length,s=i+1,o=i,n=new Float64Array(s*3),r=new Float64Array(s*3),a=new Float64Array(s),c=new Float64Array(s);n.set(e.positionsM),r.set(e.velocitiesMps),a.set(e.massesKg),c.set(e.radiiM),n.set(t.initialPositionM,o*3),r.set(t.initialVelocityMps,o*3);const d=t.massSolarMasses*U;a[o]=d,c[o]=j(d);const l=new Float64Array(3),u=new Float64Array(3);It(n,r,a,l,u);const g={bodyIds:Object.freeze([...e.bodyIds]),bodyCount:i,blackHoleIndex:o,positionsM:n,velocitiesMps:r,massesKg:a,radiiM:c,outcomeCodes:new Uint8Array(i),originM:l,originVelocityMps:u,initialTotalEnergyJ:0,initialLinearMomentumMagnitudeKgMps:0,initialAngularMomentumMagnitudeKgM2ps:0,integratedPhysicalTimeSeconds:0,completedSubsteps:0,chosenSubstepSeconds:te[0]},y=X(g),p={...g,initialTotalEnergyJ:y.totalEnergyJ,initialLinearMomentumMagnitudeKgMps:y.linearMomentumMagnitudeKgMps,initialAngularMomentumMagnitudeKgM2ps:y.angularMomentumMagnitudeKgM2ps};return{state:p,diagnostics:X(p)}}function wt(e,t,i){Pt(e,t,i);const s=Et(e),o=t.cinematicInfall===null?null:new St(t.cinematicInfall);let n=i,r=0,a=e.completedSubsteps,c=e.chosenSubstepSeconds;for(;n>1e-9;){const u=Ye(s,o);c=kt(t.accuracy,u.minimumPairDistanceM,u.maximumAccelerationMps2,n),xt(s,t,u.accelerationsMps2,o,c,e.integratedPhysicalTimeSeconds+r+c),n-=c,r+=c,a+=1}const d={...s,integratedPhysicalTimeSeconds:e.integratedPhysicalTimeSeconds+i,completedSubsteps:a,chosenSubstepSeconds:c},l=X(d);if(!l.finite)throw new Error("Black-hole kernel produced non-finite state or diagnostics.");return{state:d,diagnostics:l}}function Et(e){return{...e,bodyIds:Object.freeze([...e.bodyIds]),positionsM:e.positionsM.slice(),velocitiesMps:e.velocitiesMps.slice(),massesKg:e.massesKg.slice(),radiiM:e.radiiM.slice(),outcomeCodes:e.outcomeCodes.slice(),originM:e.originM.slice(),originVelocityMps:e.originVelocityMps.slice()}}function kt(e,t,i,s=Number.POSITIVE_INFINITY){const o=$e[e],n=i>0&&Number.isFinite(t)?Math.sqrt(Math.max(t,1)/i):o/.04,r=Math.max(W,n*.04);for(const a of te)if(a<=o&&a<=r&&a<=s+1e-9)return a;if(s+1e-9<W)throw new RangeError("Kernel advance duration left a non-discrete substep remainder.");return W}function X(e){let t=0,i=0;const s=new Float64Array(3),o=new Float64Array(3);let n=Number.POSITIVE_INFINITY;const r=e.bodyCount+1;for(let p=0;p<r;p+=1){if(P(e,p))continue;const h=p*3,f=e.massesKg[p]??0,m=(e.velocitiesMps[h]??0)+(e.originVelocityMps[0]??0),v=(e.velocitiesMps[h+1]??0)+(e.originVelocityMps[1]??0),b=(e.velocitiesMps[h+2]??0)+(e.originVelocityMps[2]??0),R=(e.positionsM[h]??0)+(e.originM[0]??0),T=(e.positionsM[h+1]??0)+(e.originM[1]??0),E=(e.positionsM[h+2]??0)+(e.originM[2]??0);t+=.5*f*(m*m+v*v+b*b),s[0]=(s[0]??0)+f*m,s[1]=(s[1]??0)+f*v,s[2]=(s[2]??0)+f*b,o[0]=(o[0]??0)+f*(T*b-E*v),o[1]=(o[1]??0)+f*(E*m-R*b),o[2]=(o[2]??0)+f*(R*v-T*m);for(let S=p+1;S<r;S+=1){if(P(e,S))continue;const w=S*3,K=(e.positionsM[w]??0)-(e.positionsM[h]??0),k=(e.positionsM[w+1]??0)-(e.positionsM[h+1]??0),z=(e.positionsM[w+2]??0)-(e.positionsM[h+2]??0),$=Math.hypot(K,k,z);n=Math.min(n,$);const se=Math.max($,(e.radiiM[p]??0)+(e.radiiM[S]??0),1);i-=Q*f*(e.massesKg[S]??0)/se}}Number.isFinite(n)||(n=0);const a=t+i,c=Math.hypot(...s),d=Math.hypot(...o),l=e.initialTotalEnergyJ===0?0:(a-e.initialTotalEnergyJ)/Math.max(Math.abs(e.initialTotalEnergyJ),1),u=(c-e.initialLinearMomentumMagnitudeKgMps)/Math.max(e.initialLinearMomentumMagnitudeKgMps,1),g=(d-e.initialAngularMomentumMagnitudeKgM2ps)/Math.max(e.initialAngularMomentumMagnitudeKgM2ps,1),y=[t,i,a,...s,c,...o,d,l,u,g,n,e.chosenSubstepSeconds,e.completedSubsteps,e.integratedPhysicalTimeSeconds,...e.positionsM,...e.velocitiesMps,...e.originM,...e.originVelocityMps];return{kineticEnergyJ:t,potentialEnergyJ:i,totalEnergyJ:a,linearMomentumKgMps:Ae(s),linearMomentumMagnitudeKgMps:c,angularMomentumKgM2ps:Ae(o),angularMomentumMagnitudeKgM2ps:d,relativeEnergyDrift:l,relativeLinearMomentumDrift:u,relativeAngularMomentumDrift:g,minimumPairDistanceM:n,chosenSubstepSeconds:e.chosenSubstepSeconds,completedSubsteps:e.completedSubsteps,integratedPhysicalTimeSeconds:e.integratedPhysicalTimeSeconds,finite:y.every(Number.isFinite)}}function xt(e,t,i,s,o,n){const r=e.bodyCount+1,a=o*.5;for(let d=0;d<r;d+=1){if(P(e,d))continue;const l=d*3;e.velocitiesMps[l]=(e.velocitiesMps[l]??0)+(i[l]??0)*a,e.velocitiesMps[l+1]=(e.velocitiesMps[l+1]??0)+(i[l+1]??0)*a,e.velocitiesMps[l+2]=(e.velocitiesMps[l+2]??0)+(i[l+2]??0)*a,e.positionsM[l]=(e.positionsM[l]??0)+(e.velocitiesMps[l]??0)*o,e.positionsM[l+1]=(e.positionsM[l+1]??0)+(e.velocitiesMps[l+1]??0)*o,e.positionsM[l+2]=(e.positionsM[l+2]??0)+(e.velocitiesMps[l+2]??0)*o}e.originM[0]=(e.originM[0]??0)+(e.originVelocityMps[0]??0)*o,e.originM[1]=(e.originM[1]??0)+(e.originVelocityMps[1]??0)*o,e.originM[2]=(e.originM[2]??0)+(e.originVelocityMps[2]??0)*o,Tt(e,t,n),_t(e);const c=Ye(e,s).accelerationsMps2;for(let d=0;d<r;d+=1){if(P(e,d))continue;const l=d*3;e.velocitiesMps[l]=(e.velocitiesMps[l]??0)+(c[l]??0)*a,e.velocitiesMps[l+1]=(e.velocitiesMps[l+1]??0)+(c[l+1]??0)*a,e.velocitiesMps[l+2]=(e.velocitiesMps[l+2]??0)+(c[l+2]??0)*a}At(e)}function Ye(e,t){const i=e.bodyCount+1,s=new Float64Array(i*3);let o=Number.POSITIVE_INFINITY;for(let r=0;r<i;r+=1){if(P(e,r))continue;const a=r*3;for(let c=r+1;c<i;c+=1){if(P(e,c))continue;const d=c*3,l=(e.positionsM[d]??0)-(e.positionsM[a]??0),u=(e.positionsM[d+1]??0)-(e.positionsM[a+1]??0),g=(e.positionsM[d+2]??0)-(e.positionsM[a+2]??0),y=Math.hypot(l,u,g);o=Math.min(o,y);const h=1/Math.max(y,(e.radiiM[r]??0)+(e.radiiM[c]??0),1)**3,f=Q*(e.massesKg[c]??0)*h,m=Q*(e.massesKg[r]??0)*h;s[a]=(s[a]??0)+l*f,s[a+1]=(s[a+1]??0)+u*f,s[a+2]=(s[a+2]??0)+g*f,s[d]=(s[d]??0)-l*m,s[d+1]=(s[d+1]??0)-u*m,s[d+2]=(s[d+2]??0)-g*m}}t?.addAccelerations(e,s);let n=0;for(let r=0;r<i;r+=1){const a=r*3;n=Math.max(n,Math.hypot(s[a]??0,s[a+1]??0,s[a+2]??0))}return{accelerationsMps2:s,minimumPairDistanceM:Number.isFinite(o)?o:0,maximumAccelerationMps2:n}}function Tt(e,t,i){const s=e.blackHoleIndex*3,o=Math.max(j(e.massesKg[e.blackHoleIndex]??1)*t.captureRadiusMultiple,e.radiiM[e.blackHoleIndex]??1);for(let n=0;n<e.bodyCount;n+=1){const r=e.outcomeCodes[n]??0;if(r===ie)continue;const a=n*3,c=(e.positionsM[a]??0)-(e.positionsM[s]??0),d=(e.positionsM[a+1]??0)-(e.positionsM[s+1]??0),l=(e.positionsM[a+2]??0)-(e.positionsM[s+2]??0),u=Math.hypot(c,d,l);if(t.cinematicInfall!==null){const m=zt(e.bodyIds,n),b=(i/t.physicsSecondsPerScenarioSecond-t.cinematicInfall.stagingStartSeconds-m*t.cinematicInfall.stagingIntervalSeconds)/t.cinematicInfall.stagingIntervalSeconds;b>=.8?Ie(e,n):b>=.5?e.outcomeCodes[n]=3:b>=.28?e.outcomeCodes[n]=2:b>0&&(e.outcomeCodes[n]=1);continue}if(u<=o+(e.radiiM[n]??0)){Ie(e,n);continue}const g=Math.hypot(e.positionsM[a]??0,e.positionsM[a+1]??0,e.positionsM[a+2]??0),y=(e.positionsM[a]??0)*(e.velocitiesMps[a]??0)+(e.positionsM[a+1]??0)*(e.velocitiesMps[a+1]??0)+(e.positionsM[a+2]??0)*(e.velocitiesMps[a+2]??0);if(g>=t.ejectionRadiusM&&y>0){e.outcomeCodes[n]=Rt;continue}const p=e.massesKg[n]??1,f=(e.radiiM[n]??1)*Math.cbrt(2*(e.massesKg[e.blackHoleIndex]??1)/p);u<=f*.55?e.outcomeCodes[n]=3:u<=f?e.outcomeCodes[n]=Math.max(r,2):u<=f*2&&(e.outcomeCodes[n]=Math.max(r,1))}}function At(e){const t=e.blackHoleIndex*3;for(let i=0;i<e.bodyCount;i+=1){if((e.outcomeCodes[i]??0)!==ie)continue;const s=i*3;for(let o=0;o<3;o+=1)e.positionsM[s+o]=e.positionsM[t+o]??0,e.velocitiesMps[s+o]=e.velocitiesMps[t+o]??0}}function It(e,t,i,s,o){let n=0;for(let r=0;r<i.length;r+=1){const a=i[r]??0;n+=a;const c=r*3;for(let d=0;d<3;d+=1)s[d]=(s[d]??0)+(e[c+d]??0)*a,o[d]=(o[d]??0)+(t[c+d]??0)*a}for(let r=0;r<3;r+=1)s[r]=(s[r]??0)/n,o[r]=(o[r]??0)/n;for(let r=0;r<i.length;r+=1){const a=r*3;for(let c=0;c<3;c+=1)e[a+c]=(e[a+c]??0)-(s[c]??0),t[a+c]=(t[a+c]??0)-(o[c]??0)}}function _t(e){let t=0;const i=new Float64Array(3),s=new Float64Array(3),o=e.bodyCount+1;for(let n=0;n<o;n+=1){if(P(e,n))continue;const r=e.massesKg[n]??0;t+=r;const a=n*3;for(let c=0;c<3;c+=1)i[c]=(i[c]??0)+(e.positionsM[a+c]??0)*r,s[c]=(s[c]??0)+(e.velocitiesMps[a+c]??0)*r}if(!(t<=0)){for(let n=0;n<3;n+=1)i[n]=(i[n]??0)/t,s[n]=(s[n]??0)/t,e.originM[n]=(e.originM[n]??0)+(i[n]??0),e.originVelocityMps[n]=(e.originVelocityMps[n]??0)+(s[n]??0);for(let n=0;n<o;n+=1){if(P(e,n))continue;const r=n*3;for(let a=0;a<3;a+=1)e.positionsM[r+a]=(e.positionsM[r+a]??0)-(i[a]??0),e.velocitiesMps[r+a]=(e.velocitiesMps[r+a]??0)-(s[a]??0)}}}function Pt(e,t,i){if(!Number.isFinite(i)||i<=0)throw new RangeError("Kernel advance duration must be finite and positive.");const s=i/W;if(Math.abs(s-Math.round(s))>1e-9)throw new RangeError("Kernel advance duration must align to the discrete substep set.");if(!(t.accuracy in $e))throw new RangeError("Kernel accuracy is invalid.");if(!Number.isFinite(t.physicsSecondsPerScenarioSecond)||t.physicsSecondsPerScenarioSecond<=0)throw new RangeError("Kernel scenario-time mapping must be finite and positive.");if(e.positionsM.length!==(e.bodyCount+1)*3)throw new RangeError("Kernel position storage has an invalid length.")}function P(e,t){return t<e.bodyCount&&(e.outcomeCodes[t]??0)===ie}function Ae(e){return[e[0]??0,e[1]??0,e[2]??0]}function Ie(e,t){e.outcomeCodes[t]=ie,e.massesKg[e.blackHoleIndex]=(e.massesKg[e.blackHoleIndex]??0)+(e.massesKg[t]??0)}function zt(e,t){if((e[t]??"")==="sun")return Math.max(0,e.length-1);let s=0;for(let o=0;o<t;o+=1)e[o]!=="sun"&&(s+=1);return s}const Ot="black-hole/initialize",Dt="black-hole/advance",Ct="black-hole/reset",We="black-hole/result",Bt="black-hole/reset-complete",Qe="black-hole/failure";function Nt(e){return Ft([e.initialState.positionsM,e.initialState.velocitiesMps,e.initialState.massesKg,e.initialState.radiiM])}function Ft(e){const t=new Set;for(const i of e)i.buffer instanceof ArrayBuffer&&t.add(i.buffer);return[...t]}function Ht(){return new Worker(new URL("/demos/solar-system/assets/blackHolePhysics.worker-BIu8drIj.js",import.meta.url),{type:"module",name:"iom-black-hole-physics"})}class Lt{#e;#t=new Map;#s=1;#n=!1;#c=null;constructor(t=Ht()){this.#e=t,this.#e.addEventListener("message",this.#d),this.#e.addEventListener("error",this.#o),this.#e.addEventListener("messageerror",this.#a)}initialize(t,i,s,o){const n={type:Ot,requestId:this.#r(),runId:t,initialState:{bodyIds:[...i.bodyIds],positionsM:i.positionsM.slice(),velocitiesMps:i.velocitiesMps.slice(),massesKg:i.massesKg.slice(),radiiM:i.radiiM.slice()},blackHole:s,configuration:o};return this.#i(n,Nt(n))}advance(t,i,s){return this.#i({type:Dt,requestId:this.#r(),runId:t,physicalTickSeconds:i,tickCount:s})}async reset(t){await this.#m({type:Ct,requestId:this.#r(),runId:t})}dispose(){this.#n||(this.#n=!0,this.#p(new Error("Black-hole worker client was disposed.")))}#i(t,i){return this.#m(t,i).then(s=>{if(s===void 0)throw new Error("Black-hole worker returned no result.");return s})}#m(t,i){return this.#c!==null?Promise.reject(this.#c):this.#n?Promise.reject(new Error("Black-hole worker client is disposed.")):new Promise((s,o)=>{this.#t.set(t.requestId,{resolve:s,reject:o});try{this.#e.postMessage(t,i===void 0?[]:[...i])}catch(n){this.#t.delete(t.requestId),o(jt(n))}})}#r(){const t=`black-hole-${this.#s}`;return this.#s+=1,t}#d=t=>{if(!Ut(t.data))return;const i=this.#t.get(t.data.requestId);if(i!==void 0){if(this.#t.delete(t.data.requestId),t.data.type===Qe){const s=new Error(t.data.error.message);s.name=t.data.error.name,i.reject(s);return}i.resolve(t.data.type===We?t.data.result:void 0)}};#o=t=>{this.#u(new Error(t.message||"Black-hole physics worker failed."))};#a=()=>{this.#u(new Error("Black-hole physics worker returned an unreadable message."))};#u(t){this.#c===null&&(this.#n=!0,this.#p(t))}#p(t){this.#c=t,this.#e.removeEventListener("message",this.#d),this.#e.removeEventListener("error",this.#o),this.#e.removeEventListener("messageerror",this.#a),this.#e.terminate(),this.#l(t)}#l(t){for(const i of this.#t.values())i.reject(t);this.#t.clear()}}function Ut(e){if(typeof e!="object"||e===null)return!1;const t=e;return typeof t.requestId=="string"&&typeof t.runId=="string"&&(t.type===We||t.type===Bt||t.type===Qe)}function jt(e){return e instanceof Error?e:new Error(String(e))}function _e(e){if(typeof Worker=="function")try{return new qt(e)}catch{return new Pe}return new Pe}class Pe{execution="direct-kernel-fallback";#e=null;#t=null;initialize(t,i,s){return this.#e=s,this.#t=fe(t,i),this.#t}advance(t,i){if(this.#t===null||this.#e===null)throw new Error("Direct black-hole kernel is not initialized.");for(let s=0;s<i;s+=1)this.#t=wt(this.#t.state,this.#e,t);return this.#t}reset(){this.#e=null,this.#t=null}dispose(){this.reset()}}class qt{execution="module-worker";#e;#t=new Lt;constructor(t){this.#e=t}initialize(t,i,s){return this.#t.initialize(this.#e,t,i,s)}advance(t,i){return this.#t.advance(this.#e,t,i)}reset(){return this.#t.reset(this.#e)}dispose(){this.#t.dispose()}}function be(e){const t="infall"in e;return JSON.stringify({initialState:{bodyIds:e.initialState.bodyIds,positionsM:[...e.initialState.positionsM],velocitiesMps:[...e.initialState.velocitiesMps],massesKg:[...e.initialState.massesKg],radiiM:[...e.initialState.radiiM]},blackHole:{massSolarMasses:e.blackHole.massSolarMasses,initialPositionM:e.blackHole.initialPositionM,initialVelocityMps:e.blackHole.initialVelocityMps,closestApproachTargetM:e.blackHole.closestApproachTargetM,closestApproachTimeSeconds:e.blackHole.closestApproachTimeSeconds,spinVisualization:e.blackHole.spinVisualization,accretionDiskEnabled:e.blackHole.accretionDiskEnabled,captureRadiusMultiple:e.blackHole.captureRadiusMultiple},accuracy:e.accuracy,durationSeconds:e.durationSeconds,physicsSecondsPerScenarioSecond:e.physicsSecondsPerScenarioSecond,playbackRate:e.playbackRate,seed:e.seed,ejectionRadiusM:e.ejectionRadiusM,infall:t?{angularMomentumDampingPerPhysicalSecond:e.infall.angularMomentumDampingPerPhysicalSecond,inwardBiasMps2:e.infall.inwardBiasMps2,stagingStartSeconds:e.infall.stagingStartSeconds,stagingIntervalSeconds:e.infall.stagingIntervalSeconds}:null})}function Vt(e,t){const i=`black-hole-kdk-v1/${e}/${be(t)}`;let s=2166136261;for(let o=0;o<i.length;o+=1)s^=i.charCodeAt(o),s=Math.imul(s,16777619);return`bh-${(s>>>0).toString(16).padStart(8,"0")}`}const Kt=Object.freeze(["intact","tidally-stressed","disrupted","accretion-stream","captured","ejected"]);class Xe{destructive=!0;#e=new Set;#t=null;#s=null;#n=null;#c;#i="idle";#m=null;#r=0;#d=0;#o=0;#a=0;#u=0;#p=!1;#l=0;#g=!1;constructor(t){this.#c=t}get state(){return this.#i}get physicsExecution(){return this.#n?.execution??null}init(t){this.#f()}onTick(t,i){}onRender(t,i){this.advance(i)}start(t){if(this.#f(),this.#i!=="idle")throw new Error(`Reset the active ${this.title} run before starting another one.`);const i=this.validateParameters(t);this.#t=i,this.#m=Vt(this.mode,i),this.#i="running",this.#r=0,this.#d=0,this.#o=0,this.#a=0,this.#u=0;const s=++this.#l,o=fe(i.initialState,i.blackHole);this.#s=o,this.#h(),this.#n=_e(`${this.id}-${this.#m??i.seed}`);const n=this.#n.initialize(i.initialState,i.blackHole,this.kernelConfiguration(i));if(de(n))return n.then(r=>{s!==this.#l||this.#g||(this.#s=r,this.#h())});this.#s=n,this.#h()}advance(t){if(this.#f(),!Number.isFinite(t)||t<0)throw new RangeError("Black-hole scenario delta must be finite and non-negative.");if(this.#i!=="running"||t===0)return;const i=this.#M(),s=this.#u+t*i.playbackRate,o=Math.floor((s+x*1e-9)/x);this.#u=s-o*x,Math.abs(this.#u)<1e-12&&(this.#u=0),!(o<=0)&&this.#b(o)}pause(){if(this.#f(),this.#i!=="running")return;const t=Math.max(0,this.#o-this.#a);this.#o-=t,this.#d=Math.max(this.#r,this.#d-t),this.#i="paused",this.#h()}resume(){this.#f(),this.#i==="paused"&&(this.#i="running",this.#h(),this.#v())}frameStep(t=x){if(this.#f(),this.#i!=="paused")throw new Error("Black-hole scenario frame-step is available only while paused.");if(!Number.isFinite(t)||t<=0)throw new RangeError("Black-hole frame-step duration must be finite and positive.");this.#b(Math.max(1,Math.round(t/x)),!0)}replay(){this.#f();const t=this.#M();this.#w();const i=++this.#l;this.#r=0,this.#d=0,this.#o=0,this.#a=0,this.#u=0,this.#p=!1,this.#i="running",this.#s=fe(t.initialState,t.blackHole),this.#h(),this.#n=_e(`${this.id}-${this.#m??t.seed}-replay-${i}`);const s=this.#n.initialize(t.initialState,t.blackHole,this.kernelConfiguration(t));if(de(s)){s.then(o=>{i!==this.#l||this.#g||(this.#s=o,this.#h(),this.#v())}).catch(()=>{i===this.#l&&(this.#i="paused")});return}this.#s=s,this.#h()}getSnapshot(){return this.#c}serializeParameters(){return this.#t===null?null:this.serializeValidatedParameters(this.#t)}subscribe(t){return this.#f(),this.#e.add(t),t(this.#c),()=>this.#e.delete(t)}reset(t){this.#g||(this.#l+=1,this.#w(),this.#t=null,this.#s=null,this.#m=null,this.#r=0,this.#d=0,this.#o=0,this.#a=0,this.#u=0,this.#p=!1,this.#i="idle",this.#c=this.idleSnapshot(),this.#S())}dispose(){this.#g||(this.reset(),this.#e.clear(),this.#g=!0)}skipToScenarioTime(t){this.#f();const i=this.#M();if(!Number.isFinite(t)||t<0)throw new RangeError("Black-hole skip target must be finite and non-negative.");const s=Math.min(t,i.durationSeconds),o=Math.min(this.#y(),Math.ceil(s/x));this.#b(Math.max(0,o-this.#d),!0)}#b(t,i=!1){const s=this.#y(),o=Math.min(t,s-this.#d);o<=0||(this.#d+=o,this.#o+=o,i&&(this.#a+=o),this.#v())}#v(){const t=this.#n,i=this.#t;if(t===null||i===null||this.#p||this.#o<=0)return;const s=this.#i==="running",o=this.#i==="paused"&&this.#a>0;if(!s&&!o)return;const n=s?this.#o:Math.min(this.#o,this.#a),r=Math.min(n,this.#a);this.#o-=n,this.#a-=r;const a=x*i.physicsSecondsPerScenarioSecond,c=this.#l,d=t.advance(a,n);if(!de(d)){this.#R(d,n,c),this.#v();return}this.#p=!0,d.then(l=>{c!==this.#l||this.#g||(this.#p=!1,this.#R(l,n,c),this.#v())}).catch(()=>{c!==this.#l||this.#g||(this.#p=!1,this.#o+=n,this.#a+=r,this.#i="paused",this.#h())})}#R(t,i,s){s===this.#l&&(this.#s=t,this.#r=Math.min(this.#y(),this.#r+i),this.#r>=this.#y()&&(this.#i="complete",this.#u=0),this.#h())}#h(){const t=this.#t,i=this.#s;if(t===null||i===null){this.#c=this.idleSnapshot(),this.#S();return}const s=this.#r*x,o=this.#i==="complete",n=this.createBodySnapshots(i,t,s),r=n.filter(u=>u.outcome==="captured").length,a=n.filter(u=>u.outcome==="ejected").length,c=n.length-r-a,d=this.createBlackHoleRenderState(i,t,n),l={state:this.#i,mode:this.mode,classification:this.classification,title:this.title,warning:this.warning,stage:this.stageAtTime(s,o,t),scenarioTimeSeconds:s,totalDurationSeconds:this.#y()*x,progress:this.#y()===0?0:this.#r/this.#y(),playbackRate:t.playbackRate,parameters:t,bodyStates:n,blackHole:d,diagnostics:i.diagnostics,scenarioOriginM:C(i.state.originM,0),scenarioOriginVelocityMps:C(i.state.originVelocityMps,0),runSignature:this.#m,captureCount:r,ejectionCount:a,survivorCount:c,allBodiesCaptured:r===n.length};if(!me(l))throw new Error(`${this.title} produced a non-finite snapshot.`);this.#c=Object.freeze(l),this.#S()}createBodySnapshots(t,i,s){const o=t.state,n=o.blackHoleIndex*3,r=o.positionsM[n]??0,a=o.positionsM[n+1]??0,c=o.positionsM[n+2]??0,d=j(o.massesKg[o.blackHoleIndex]??1)*this.#M().blackHole.captureRadiusMultiple;return Object.freeze(o.bodyIds.map((l,u)=>{const g=u*3,y=Kt[o.outcomeCodes[u]??0]??"intact",p=Math.hypot((o.positionsM[g]??0)-r,(o.positionsM[g+1]??0)-a,(o.positionsM[g+2]??0)-c),h=this.#M().initialState.massesKg[u]??1,f=this.#M().initialState.radiiM[u]??1,m=f*Math.cbrt(2*(o.massesKg[o.blackHoleIndex]??1)/h),v=H(1-(p-d)/Math.max(m*2-d,1));return Object.freeze({bodyId:l,massKg:h,radiusM:f,positionLocalM:C(o.positionsM,g),velocityLocalMps:C(o.velocitiesMps,g),outcome:y,tidalStress:v,streamProgress:y==="accretion-stream"?v:0,captureProgress:y==="captured"?1:H(1-p/Math.max(m*2,d))})}))}createBlackHoleRenderState(t,i,s){const o=t.state,n=o.blackHoleIndex*3,r=o.massesKg[o.blackHoleIndex]??i.blackHole.massSolarMasses*U,a=j(r);return Object.freeze({massKg:r,massSolarMasses:r/U,schwarzschildRadiusM:a,captureRadiusM:a*i.blackHole.captureRadiusMultiple,positionLocalM:C(o.positionsM,n),velocityLocalMps:C(o.velocitiesMps,n),spinVisualization:i.blackHole.spinVisualization,accretionDiskEnabled:i.blackHole.accretionDiskEnabled})}requiredResult(){if(this.#s===null)throw new Error(`${this.title} has no physics state.`);return this.#s}requiredParameters(){return this.#M()}currentDiagnostics(){return X(this.requiredResult().state)}kernelConfiguration(t){return{accuracy:t.accuracy,ejectionRadiusM:t.ejectionRadiusM,captureRadiusMultiple:t.blackHole.captureRadiusMultiple,physicsSecondsPerScenarioSecond:t.physicsSecondsPerScenarioSecond,cinematicInfall:$t(t)}}#y(){const t=this.#t;return t===null?0:Math.max(1,Math.ceil(t.durationSeconds/x))}#M(){if(this.#t===null)throw new Error(`${this.title} has no prepared run.`);return this.#t}#w(){this.#n?.dispose(),this.#n=null}#S(){for(const t of[...this.#e])t(this.#c)}#f(){if(this.#g)throw new Error(`${this.title} scenario has been disposed.`)}}function C(e,t){return[e[t]??0,e[t+1]??0,e[t+2]??0]}function H(e){return Math.min(Math.max(e,0),1)}function de(e){return typeof e.then=="function"}function me(e){return typeof e=="number"?Number.isFinite(e):ArrayBuffer.isView(e)?Array.from(e).every(Number.isFinite):Array.isArray(e)?e.every(me):typeof e=="object"&&e!==null?Object.values(e).every(me):!0}function $t(e){return"infall"in e?e.infall:null}const ze=Object.freeze([0,0,0]),Gt=Object.freeze([]),Oe=Object.freeze({state:"idle",mode:"physics-flyby",classification:"educational-approximation",title:"Physics Flyby",warning:Ke,stage:"idle",scenarioTimeSeconds:0,totalDurationSeconds:0,progress:0,playbackRate:1,parameters:null,bodyStates:Gt,blackHole:null,diagnostics:null,scenarioOriginM:ze,scenarioOriginVelocityMps:ze,runSignature:null,captureCount:0,ejectionCount:0,survivorCount:0,allBodiesCaptured:!1});class ki extends Xe{id="black-hole-physics-flyby";classification="educational-approximation";mode="physics-flyby";title="Physics Flyby";warning=Ke;constructor(){super(Oe)}skipToNextStage(){const t=this.requiredParameters(),i=Math.min(t.durationSeconds*.8,t.blackHole.closestApproachTimeSeconds/t.physicsSecondsPerScenarioSecond),s={idle:0,approach:i*.82,"closest-approach":i*1.2,aftermath:t.durationSeconds,complete:t.durationSeconds};this.skipToScenarioTime(s[this.getSnapshot().stage])}skipToEnd(){this.skipToScenarioTime(this.requiredParameters().durationSeconds)}validateParameters(t){return Me(t)}serializeValidatedParameters(t){return be(t)}idleSnapshot(){return Oe}stageAtTime(t,i,s){if(i)return"complete";const o=Math.min(s.durationSeconds*.8,s.blackHole.closestApproachTimeSeconds/s.physicsSecondsPerScenarioSecond);return t<o*.82?"approach":t<o*1.2?"closest-approach":"aftermath"}}const De=Object.freeze([0,0,0]),Yt=Object.freeze([]),Ce=Object.freeze({state:"idle",mode:"complete-consumption-cinematic",classification:"cinematic",title:"Complete Consumption — Cinematic",warning:Ve,stage:"idle",scenarioTimeSeconds:0,totalDurationSeconds:0,progress:0,playbackRate:1,parameters:null,bodyStates:Yt,blackHole:null,diagnostics:null,scenarioOriginM:De,scenarioOriginVelocityMps:De,runSignature:null,captureCount:0,ejectionCount:0,survivorCount:0,allBodiesCaptured:!1});class xi extends Xe{id="black-hole-complete-consumption";classification="cinematic";mode="complete-consumption-cinematic";title="Complete Consumption — Cinematic";warning=Ve;constructor(){super(Ce)}skipToNextStage(){const t=this.requiredParameters(),{stagingStartSeconds:i,stagingIntervalSeconds:s}=t.infall,o=i+(t.initialState.bodyIds.length-1)*s+s*.8,n={idle:0,approach:i,disruption:i+s*2,accretion:i+s*4.5,consumption:o,remnant:t.durationSeconds,complete:t.durationSeconds};this.skipToScenarioTime(n[this.getSnapshot().stage])}skipToEnd(){this.skipToScenarioTime(this.requiredParameters().durationSeconds)}validateParameters(t){return Ge(t)}serializeValidatedParameters(t){return be(t)}idleSnapshot(){return Ce}stageAtTime(t,i,s){if(i)return"complete";const{stagingStartSeconds:o,stagingIntervalSeconds:n}=s.infall,r=s.initialState.bodyIds.length,a=o+(r-1)*n+n*.8;return t<o?"approach":t<o+n*2?"disruption":t<o+n*4.5?"accretion":t<a?"consumption":"remnant"}createBodySnapshots(t,i,s){const o=super.createBodySnapshots(t,i,s),n=Wt(i.initialState.bodyIds),r=new Map(n.map((l,u)=>[l,u])),a=t.state.blackHoleIndex*3,c=[t.state.positionsM[a]??0,t.state.positionsM[a+1]??0,t.state.positionsM[a+2]??0],d=[t.state.velocitiesMps[a]??0,t.state.velocitiesMps[a+1]??0,t.state.velocitiesMps[a+2]??0];return Object.freeze(o.map(l=>{const u=r.get(l.bodyId)??0,g=i.infall.stagingStartSeconds+u*i.infall.stagingIntervalSeconds,y=H((s-g)/i.infall.stagingIntervalSeconds),p=Qt(y),h=p==="captured";return Object.freeze({...l,positionLocalM:h?c:l.positionLocalM,velocityLocalMps:h?d:l.velocityLocalMps,outcome:p,tidalStress:Math.max(l.tidalStress,H(y/.5)),streamProgress:H((y-.48)/.32),captureProgress:y})}))}createBlackHoleRenderState(t,i,s){const o=t.state,n=o.blackHoleIndex*3;let r=i.blackHole.massSolarMasses*U;for(const c of s)c.outcome==="captured"&&(r+=c.massKg);const a=j(r);return Object.freeze({massKg:r,massSolarMasses:r/U,schwarzschildRadiusM:a,captureRadiusM:a*i.blackHole.captureRadiusMultiple,positionLocalM:[o.positionsM[n]??0,o.positionsM[n+1]??0,o.positionsM[n+2]??0],velocityLocalMps:[o.velocitiesMps[n]??0,o.velocitiesMps[n+1]??0,o.velocitiesMps[n+2]??0],spinVisualization:i.blackHole.spinVisualization,accretionDiskEnabled:i.blackHole.accretionDiskEnabled})}}function Wt(e){return Object.freeze([...e.filter(t=>t!=="sun"),...e.filter(t=>t==="sun")])}function Qt(e){return e>=.8?"captured":e>=.5?"accretion-stream":e>=.28?"disrupted":e>0?"tidally-stressed":"intact"}const q=Object.freeze({active:!1,path:"off",quality:"high",highQualitySupported:!1,centerNdc:Object.freeze([0,0]),eventHorizonRadiusNdc:0,influenceRadiusNdc:0,finite:!0}),Be=Object.freeze({active:!1,mode:"none",lifecycleState:"idle",stage:"idle",runSignature:"",eventHorizonRadiusRenderUnits:0,visualRadiusRenderUnits:0,presentationRadiusExaggerated:!1,accretionDiskVisible:!1,streamPointCount:0,capturedBodyCount:0,disruptedBodyCount:0,baseBodyOverrideCount:0,finite:!0,lensing:q}),Xt="e72b3f293409893a6fa25528b29572c96fc57f57",Z=Object.freeze({id:"ray-deflection",fileName:"deflection.dat",width:512,height:512,components:2,sha256:"1080f45a12fba81321771c2071f4a31795444b110833f61384a9bdf7d057c19d"}),J=Object.freeze({id:"ray-inverse-radius",fileName:"inverse_radius.dat",width:64,height:32,components:2,sha256:"7fa22a9270e61f2842c97fb1a9398bcb13e1a965ad39b0f73169354a0d608b04"}),Ne="/demos/solar-system/assets/phase10/black-hole/",Zt=Object.freeze({deflection:`${Ne}${Z.fileName}`,inverseRadius:`${Ne}${J.fileName}`});function Fe(e,t){const i=2+t.width*t.height*t.components,s=i*Float32Array.BYTES_PER_ELEMENT;if(e.byteLength!==s)throw new RangeError(`${t.id} table has ${e.byteLength} bytes; expected ${s}.`);const o=new DataView(e),n=o.getFloat32(0,!0),r=o.getFloat32(Float32Array.BYTES_PER_ELEMENT,!0);if(n!==t.width||r!==t.height)throw new RangeError(`${t.id} table header is ${n}x${r}; expected ${t.width}x${t.height}.`);const a=new Float32Array(i-2);let c=Number.POSITIVE_INFINITY,d=Number.NEGATIVE_INFINITY;for(let l=0;l<a.length;l+=1){const u=o.getFloat32((l+2)*Float32Array.BYTES_PER_ELEMENT,!0);if(!Number.isFinite(u))throw new RangeError(`${t.id} table contains a non-finite value at ${l}.`);a[l]=u,c=Math.min(c,u),d=Math.max(d,u)}return Object.freeze({spec:t,data:a,minimum:c,maximum:d})}async function Jt(e={}){const t=e.fetchImplementation??globalThis.fetch;if(typeof t!="function")throw new Error("Fetch is unavailable; Bruneton lensing tables cannot be loaded.");const i=e.urls??Zt,[s,o]=await Promise.all([He(t,i.deflection,e.signal),He(t,i.inverseRadius,e.signal)]);return Object.freeze({deflection:Fe(s,Z),inverseRadius:Fe(o,J)})}async function He(e,t,i){const s=await e(t,{signal:i});if(!s.ok)throw new Error(`Failed to load Bruneton lensing table ${t}: HTTP ${s.status}.`);return s.arrayBuffer()}const ei=`
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,ti=`
uniform sampler2D tDiffuse;
uniform sampler2D rayDeflectionTexture;
uniform sampler2D rayInverseRadiusTexture;
uniform vec2 center;
uniform float eventHorizonRadius;
uniform float influenceRadius;
uniform float viewportAspect;
uniform float strength;
uniform float redshiftStrength;
uniform float mode;

varying vec2 vUv;

const float PI = 3.14159265358979323846;
const float kMu = 4.0 / 27.0;
const vec2 RAY_DEFLECTION_TEXTURE_SIZE = vec2(512.0, 512.0);
const vec2 RAY_INVERSE_RADIUS_TEXTURE_SIZE = vec2(64.0, 32.0);

vec2 safeUv(vec2 value) {
  return clamp(value, vec2(0.001), vec2(0.999));
}

// Manual bilinear filtering keeps RG32F lookup behavior deterministic without
// requiring OES_texture_float_linear. The uploaded textures use NEAREST.
vec2 SampleBilinearRg(sampler2D table, vec2 textureCoord, vec2 textureSize) {
  vec2 samplePosition = clamp(
    textureCoord * textureSize - 0.5,
    vec2(0.0),
    textureSize - 1.0
  );
  vec2 base = floor(samplePosition);
  vec2 fraction = fract(samplePosition);
  vec2 p0 = clamp(base, vec2(0.0), textureSize - 1.0);
  vec2 p1 = min(p0 + 1.0, textureSize - 1.0);
  vec2 a = texture2D(table, (vec2(p0.x, p0.y) + 0.5) / textureSize).rg;
  vec2 b = texture2D(table, (vec2(p1.x, p0.y) + 0.5) / textureSize).rg;
  vec2 c = texture2D(table, (vec2(p0.x, p1.y) + 0.5) / textureSize).rg;
  vec2 d = texture2D(table, (vec2(p1.x, p1.y) + 0.5) / textureSize).rg;
  return mix(mix(a, b, fraction.x), mix(c, d, fraction.x), fraction.y);
}

// The following mappings and lookup functions are direct GLSL-dialect ports
// of Bruneton's black_hole/functions.glsl at the pinned commit above.
float GetRayDeflectionTextureUFromEsquare(float eSquare) {
  if (eSquare < kMu) {
    return 0.5 - sqrt(-log(1.0 - eSquare / kMu) * (1.0 / 50.0));
  }
  return 0.5 + sqrt(-log(1.0 - kMu / eSquare) * (1.0 / 50.0));
}

float GetUapsisFromEsquare(float eSquare) {
  float x = (2.0 / kMu) * eSquare - 1.0;
  return 1.0 / 3.0 + (2.0 / 3.0) * sin(asin(x) * (1.0 / 3.0));
}

float GetRayDeflectionTextureVFromEsquareAndU(float eSquare, float u) {
  if (eSquare > kMu) {
    float x = u < 2.0 / 3.0
      ? -sqrt(2.0 / 3.0 - u)
      : sqrt(u - 2.0 / 3.0);
    return (sqrt(2.0 / 3.0) + x) /
      (sqrt(2.0 / 3.0) + sqrt(1.0 / 3.0));
  }
  return 1.0 - sqrt(max(1.0 - u / GetUapsisFromEsquare(eSquare), 0.0));
}

float GetTextureCoordFromUnitRange(float x, float textureSize) {
  return 0.5 / textureSize + x * (1.0 - 1.0 / textureSize);
}

vec2 LookupRayDeflection(float eSquare, float u, out vec2 deflectionApsis) {
  float texU = GetTextureCoordFromUnitRange(
    GetRayDeflectionTextureUFromEsquare(eSquare),
    RAY_DEFLECTION_TEXTURE_SIZE.x
  );
  float texV = GetTextureCoordFromUnitRange(
    GetRayDeflectionTextureVFromEsquareAndU(eSquare, u),
    RAY_DEFLECTION_TEXTURE_SIZE.y
  );
  float texVApsis = GetTextureCoordFromUnitRange(
    1.0,
    RAY_DEFLECTION_TEXTURE_SIZE.y
  );
  deflectionApsis = SampleBilinearRg(
    rayDeflectionTexture,
    vec2(texU, texVApsis),
    RAY_DEFLECTION_TEXTURE_SIZE
  );
  return SampleBilinearRg(
    rayDeflectionTexture,
    vec2(texU, texV),
    RAY_DEFLECTION_TEXTURE_SIZE
  );
}

float GetPhiUbFromEsquare(float eSquare) {
  return (1.0 + eSquare) /
    (1.0 / 3.0 + 2.0 * eSquare * sqrt(eSquare));
}

float GetRayInverseRadiusTextureUFromEsquare(float eSquare) {
  return 1.0 / (1.0 + 6.0 * eSquare);
}

vec2 LookupRayInverseRadius(float eSquare, float phi) {
  float texU = GetTextureCoordFromUnitRange(
    GetRayInverseRadiusTextureUFromEsquare(eSquare),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE.x
  );
  float texV = GetTextureCoordFromUnitRange(
    phi / GetPhiUbFromEsquare(eSquare),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE.y
  );
  return SampleBilinearRg(
    rayInverseRadiusTexture,
    vec2(texU, texV),
    RAY_INVERSE_RADIUS_TEXTURE_SIZE
  );
}

float TraceInwardRayDeflection(float u, float uDot, float eSquare) {
  if (eSquare < kMu && u > 2.0 / 3.0) return -1.0;
  vec2 deflectionApsis;
  vec2 deflection = LookupRayDeflection(eSquare, u, deflectionApsis);
  float rayDeflection = deflection.x;
  if (uDot > 0.0) {
    rayDeflection = eSquare < kMu
      ? 2.0 * deflectionApsis.x - rayDeflection
      : -1.0;
  }
  return rayDeflection;
}

vec3 SimplifiedLensing(
  vec2 metricDelta,
  float radius,
  float horizon,
  float influence,
  float falloff
) {
  float safeRadius = max(radius, horizon * 1.035);
  vec2 radial = metricDelta / max(safeRadius, 0.000001);
  float compactness = clamp(horizon / safeRadius, 0.0, 0.965);
  float denominator = max(1.0 - 0.78 * compactness, 0.18);
  float deflection = horizon * compactness / denominator * strength * falloff;
  vec2 metricWarp = metricDelta + radial * deflection;
  vec2 warpedUv = center + vec2(
    metricWarp.x / max(viewportAspect, 0.001),
    metricWarp.y
  );
  vec3 color = texture2D(tDiffuse, safeUv(warpedUv)).rgb;
  float redshift = redshiftStrength * compactness * falloff;
  color = mix(
    color,
    vec3(color.r * 0.92, color.g * 0.34, color.b * 0.12),
    redshift * 0.38
  );
  float silhouette = 1.0 - smoothstep(horizon * 0.9, horizon * 1.025, radius);
  return color * (1.0 - silhouette);
}

void main() {
  if (mode < 0.5 || eventHorizonRadius <= 0.0) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  vec2 delta = vUv - center;
  vec2 metricDelta = vec2(delta.x * max(viewportAspect, 0.001), delta.y);
  float radius = length(metricDelta);
  float horizon = max(eventHorizonRadius, 0.000001);
  float influence = max(influenceRadius, horizon * 2.0);
  float falloff = 1.0 - smoothstep(horizon, influence, radius);
  if (mode < 1.5) {
    gl_FragColor = vec4(
      SimplifiedLensing(metricDelta, radius, horizon, influence, falloff),
      1.0
    );
    return;
  }

  if (radius >= influence) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  // Static-observer camera-plane adapter. With p_r=64 Schwarzschild radii,
  // normalized image radius maps to tan(theta)=r/(p_r*horizon). This preserves
  // the far-observer critical impact parameter (3*sqrt(3)/2 R_s) while the
  // actual deflection comes from Bruneton's validated precomputed table.
  const float observerRadius = 64.0;
  float normalizedImageRadius = radius / horizon;
  float viewAngle = atan(normalizedImageRadius / observerRadius);
  float u = 1.0 / observerRadius;
  float uDot = 1.0 / max(normalizedImageRadius, 0.000001);
  float eSquare = uDot * uDot + u * u * (1.0 - u);
  float lookupESquare = min(eSquare, kMu * (1.0 - 0.00001));
  float rayDeflection = TraceInwardRayDeflection(u, uDot, lookupESquare);

  // The inverse-radius table is part of Bruneton's disc-intersection model.
  // This 2D adapter cannot reproduce that model, but samples the current beam
  // as a strict table-domain/finite guard before applying its direction.
  float phiUpperBound = GetPhiUbFromEsquare(lookupESquare);
  float probePhi = min(abs(rayDeflection), phiUpperBound * 0.999);
  vec2 inverseRadiusProbe = LookupRayInverseRadius(lookupESquare, probePhi);
  bool invalidProbe = !(
    inverseRadiusProbe.x >= 0.0 && inverseRadiusProbe.x <= 1024.0 &&
    inverseRadiusProbe.y >= 0.0 && inverseRadiusProbe.y <= 1024.0
  );
  if (invalidProbe) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  float sourceAngle = viewAngle - rayDeflection;
  float sourceMetricRadius = clamp(
    tan(sourceAngle) * observerRadius * horizon,
    -influence * 4.0,
    influence * 4.0
  );
  vec2 radial = metricDelta / max(radius, 0.000001);
  vec2 sourceMetricDelta = radial * sourceMetricRadius;
  vec2 sourceUv = center + vec2(
    sourceMetricDelta.x / max(viewportAspect, 0.001),
    sourceMetricDelta.y
  );
  vec2 sampleUv = mix(vUv, sourceUv, falloff);
  vec3 color = texture2D(tDiffuse, safeUv(sampleUv)).rgb;

  float compactness = clamp(horizon / max(radius, horizon), 0.0, 1.0);
  float redshift = redshiftStrength * compactness * falloff;
  color = mix(
    color,
    vec3(color.r * 0.92, color.g * 0.34, color.b * 0.12),
    redshift * 0.34
  );

  // e^2 >= mu is Bruneton's captured-ray branch. fwidth anti-aliases the
  // precomputed critical curve without inventing an image-space ring formula.
  float captureWidth = max(fwidth(eSquare) * 1.5, kMu * 0.0015);
  float captureMask = smoothstep(
    kMu - captureWidth,
    kMu + captureWidth,
    eSquare
  );
  gl_FragColor = vec4(color * (1.0 - captureMask), 1.0);
}
`;class Ti{pass;uniforms;highQualitySupported;tableAbortController=new AbortController;tableLoader;tableLoadPromise=null;deflectionTexture=G(new Float32Array([0,0]),1,1,"Bruneton deflection placeholder");inverseRadiusTexture=G(new Float32Array([0,0]),1,1,"Bruneton inverse-radius placeholder");tableStatus="deferred";tableError=null;latestFrame=null;quality;reducedMotion=!1;diagnostics=q;disposed=!1;constructor(t={}){this.quality=t.initialQuality??"high",this.highQualitySupported=t.highQualitySupported??!0;const i={tDiffuse:new M(null),center:new M(new Je(.5,.5)),eventHorizonRadius:new M(0),influenceRadius:new M(0),viewportAspect:new M(1),strength:new M(0),redshiftStrength:new M(0),mode:new M(0),rayDeflectionTexture:new M(null),rayInverseRadiusTexture:new M(null)};this.pass=new et({name:"BrunetonLookupBlackHoleLensingShader",uniforms:i,vertexShader:ei,fragmentShader:ti}),this.uniforms=this.pass.uniforms,this.uniforms.rayDeflectionTexture.value=this.deflectionTexture,this.uniforms.rayInverseRadiusTexture.value=this.inverseRadiusTexture,this.pass.enabled=!1,this.tableLoader=t.tableLoader??(()=>Jt({signal:this.tableAbortController.signal}))}update(t){this.assertNotDisposed(),ii(t),this.latestFrame=t,t.active&&this.quality!=="low"&&this.highQualitySupported&&this.ensureTablesLoaded(),this.applyFrame(t)}applyFrame(t){const i=t.active?this.pathForQuality():"off",s=i!=="off",o=t.centerNdc[0]*.5+.5,n=t.centerNdc[1]*.5+.5,r=Math.min(t.eventHorizonRadiusNdc*.5,1.5),a=Math.min(Math.max(r*(i==="schwarzschild"?18:12),.025),1.5),c=this.reducedMotion?.72:1;this.uniforms.center.value.set(o,n),this.uniforms.eventHorizonRadius.value=s?r:0,this.uniforms.influenceRadius.value=s?a:0,this.uniforms.viewportAspect.value=t.viewportAspect;const d=i==="schwarzschild"?2:s?1:0;this.uniforms.strength.value=s&&d===1?.72*c:s?1:0,this.uniforms.redshiftStrength.value=Math.min(Math.max(t.redshiftStrength??.5,0),1),this.uniforms.mode.value=d,this.pass.enabled=s,this.diagnostics=Object.freeze({active:s,path:i,quality:this.quality,highQualitySupported:this.highQualitySupported,centerNdc:Object.freeze([t.centerNdc[0],t.centerNdc[1]]),eventHorizonRadiusNdc:s?t.eventHorizonRadiusNdc:0,influenceRadiusNdc:s?a*2:0,finite:!0})}reset(){this.disposed||(this.latestFrame=null,this.pass.enabled=!1,this.uniforms.eventHorizonRadius.value=0,this.uniforms.influenceRadius.value=0,this.uniforms.strength.value=0,this.uniforms.mode.value=0,this.diagnostics=Object.freeze({...q,quality:this.quality,highQualitySupported:this.highQualitySupported}))}setQuality(t){this.assertNotDisposed(),this.quality=t,t==="low"?this.reset():this.latestFrame?.active===!0&&this.highQualitySupported&&this.ensureTablesLoaded()}setReducedMotion(t){this.assertNotDisposed(),this.reducedMotion=t,this.latestFrame!==null&&this.applyFrame(this.latestFrame)}getDiagnostics(){return this.diagnostics}getTableDiagnostics(){return Object.freeze({status:this.tableStatus,referenceCommit:Xt,deflectionDimensions:Object.freeze([Z.width,Z.height]),inverseRadiusDimensions:Object.freeze([J.width,J.height]),error:this.tableError})}whenTablesReady(){return this.assertNotDisposed(),this.ensureTablesLoaded()}dispose(){this.disposed||(this.reset(),this.disposed=!0,this.tableAbortController.abort(),this.tableStatus="disposed",this.deflectionTexture.dispose(),this.inverseRadiusTexture.dispose(),this.pass.dispose())}installTables(t){if(this.disposed)return!1;const i=G(t.deflection.data,t.deflection.spec.width,t.deflection.spec.height,"Bruneton ray deflection RG32F"),s=G(t.inverseRadius.data,t.inverseRadius.spec.width,t.inverseRadius.spec.height,"Bruneton ray inverse-radius RG32F");return this.deflectionTexture.dispose(),this.inverseRadiusTexture.dispose(),this.deflectionTexture=i,this.inverseRadiusTexture=s,this.uniforms.rayDeflectionTexture.value=i,this.uniforms.rayInverseRadiusTexture.value=s,this.tableStatus="ready",this.tableError=null,this.latestFrame!==null&&this.applyFrame(this.latestFrame),!0}ensureTablesLoaded(){return!this.highQualitySupported||this.disposed?Promise.resolve(!1):this.tableLoadPromise!==null?this.tableLoadPromise:(this.tableStatus="loading",this.tableLoadPromise=Promise.resolve().then(this.tableLoader).then(t=>this.installTables(t)).catch(t=>(this.disposed||(this.tableStatus="error",this.tableError=t instanceof Error?t.message:String(t),this.latestFrame!==null&&this.applyFrame(this.latestFrame)),!1)),this.tableLoadPromise)}pathForQuality(){return this.quality==="low"?"off":this.quality==="medium"||!this.highQualitySupported?"simplified":this.tableStatus==="ready"?"schwarzschild":"simplified"}assertNotDisposed(){if(this.disposed)throw new Error("Black-hole lensing pass is disposed.")}}function G(e,t,i,s){const o=new tt(e,t,i,it,st);return o.name=s,o.minFilter=Se,o.magFilter=Se,o.wrapS=Re,o.wrapT=Re,o.generateMipmaps=!1,o.flipY=!1,o.unpackAlignment=1,o.needsUpdate=!0,o}function ii(e){if(!Number.isFinite(e.centerNdc[0])||!Number.isFinite(e.centerNdc[1]))throw new RangeError("Black-hole lensing center must be finite.");if(!Number.isFinite(e.eventHorizonRadiusNdc)||e.eventHorizonRadiusNdc<0)throw new RangeError("Black-hole lensing event-horizon radius must be finite and non-negative.");if(!Number.isFinite(e.viewportAspect)||e.viewportAspect<=0)throw new RangeError("Black-hole lensing viewport aspect must be finite and positive.");if(e.redshiftStrength!==void 0&&(!Number.isFinite(e.redshiftStrength)||e.redshiftStrength<0))throw new RangeError("Black-hole lensing redshift strength must be finite and non-negative.")}const si=Object.freeze(["idle","approach","closest-approach","aftermath","disruption","accretion","consumption","remnant","complete"]),oi=Object.freeze(["intact","tidally-stressed","disrupted","accretion-stream","captured","ejected"]),ni=1e30;function Ai(e){if(!["physics-flyby","complete-consumption-cinematic"].includes(e.mode))throw new RangeError(`Unsupported black-hole render mode "${String(e.mode)}".`);if(!["idle","running","paused","complete","error"].includes(e.lifecycleState))throw new RangeError(`Unsupported black-hole lifecycle "${String(e.lifecycleState)}".`);if(!si.includes(e.stage))throw new RangeError(`Unsupported black-hole stage "${String(e.stage)}".`);const t=["idle","approach","closest-approach","aftermath","complete"],i=["idle","approach","disruption","accretion","consumption","remnant","complete"];if(!(e.mode==="physics-flyby"?t:i).includes(e.stage))throw new RangeError(`Black-hole stage "${e.stage}" does not belong to ${e.mode}.`);if(Le(e.scenarioTimeSeconds,"scenario time"),ue(e.progress,"progress"),_(e.scenarioOriginM,"scenario origin"),_(e.scenarioOriginVelocityMps,"scenario-origin velocity"),e.runSignature.trim().length===0)throw new RangeError("Black-hole run signature cannot be empty.");const o=e.blackHole;if(B(o.massKg,"mass"),B(o.massSolarMasses,"solar mass"),B(o.schwarzschildRadiusM,"Schwarzschild radius"),B(o.captureRadiusM,"capture radius"),o.captureRadiusM<o.schwarzschildRadiusM)throw new RangeError("Black-hole capture radius cannot be smaller than the Schwarzschild radius.");_(o.positionLocalM,"position"),_(o.velocityLocalMps,"velocity"),Ze(o.spinVisualization,"spin visualization");const n=new Set;for(const r of e.bodyStates){if(r.bodyId.trim().length===0)throw new RangeError("Black-hole body ID cannot be empty.");if(n.has(r.bodyId))throw new RangeError(`Duplicate black-hole body ID "${r.bodyId}".`);if(n.add(r.bodyId),B(r.massKg,`mass for ${r.bodyId}`),B(r.radiusM,`radius for ${r.bodyId}`),_(r.positionLocalM,`position for ${r.bodyId}`),_(r.velocityLocalMps,`velocity for ${r.bodyId}`),!oi.includes(r.outcome))throw new RangeError(`Unsupported black-hole body outcome "${String(r.outcome)}".`);Le(r.tidalStress,`tidal stress for ${r.bodyId}`),ue(r.streamProgress,`stream progress for ${r.bodyId}`),ue(r.captureProgress,`capture progress for ${r.bodyId}`)}}function ri(e){_(e.positionRenderUnits,"render position"),he(e.eventHorizonRadiusRenderUnits,"event-horizon render radius"),he(e.minimumVisualRadiusRenderUnits,"minimum visual radius"),Ze(e.spinVisualization,"spin visualization");for(const t of e.bodies)_(t.positionRenderUnits,`render position for ${t.bodyId}`),he(t.radiusRenderUnits,`render radius for ${t.bodyId}`)}function ai(e){return e==="running"||e==="paused"||e==="complete"}function ge(e){return Math.min(Math.max(e,0),1)}function _(e,t){if(e.length!==3||!Number.isFinite(e[0])||!Number.isFinite(e[1])||!Number.isFinite(e[2]))throw new RangeError(`Black-hole ${t} must be a finite xyz tuple.`)}function Le(e,t){if(!Number.isFinite(e)||e<0)throw new RangeError(`Black-hole ${t} must be finite and non-negative.`)}function B(e,t){if(!Number.isFinite(e)||e<=0)throw new RangeError(`Black-hole ${t} must be finite and positive.`)}function ue(e,t){if(!Number.isFinite(e)||e<0||e>1)throw new RangeError(`Black-hole ${t} must be in the interval [0, 1].`)}function Ze(e,t){if(!Number.isFinite(e)||e<-1||e>1)throw new RangeError(`Black-hole ${t} must be in the interval [-1, 1].`)}function he(e,t){if(!Number.isFinite(e)||e<0||e>ni)throw new RangeError(`Black-hole ${t} exceeds the finite renderer-safe magnitude.`)}const L=2048,ci=1e24,N=Math.PI*.58,I=1;class Ii{root=new ot;horizonGeometry=new we(1,64,40);horizonMaterial=new Ee({color:0,depthWrite:!0,toneMapped:!0});horizon=new A(this.horizonGeometry,this.horizonMaterial);photonRingGeometry=new nt(1.06,.018,24,192);photonRingMaterial=di();photonRing=new A(this.photonRingGeometry,this.photonRingMaterial);diskGeometry=new ke(1.85,4.6,192,8);diskMaterial=ui();accretionDisk=new A(this.diskGeometry,this.diskMaterial);lensedArchGeometry=new ke(2,4.2,128,6);lensedArchMaterial=hi();lensedArch=new A(this.lensedArchGeometry,this.lensedArchMaterial);overlayHorizon=new A(this.horizonGeometry,this.horizonMaterial);jetRibbonGeometry=pi();jetMaterialA=Ue();jetMaterialB=Ue();jetA=new A(this.jetRibbonGeometry,this.jetMaterialA);jetB=new A(this.jetRibbonGeometry,this.jetMaterialB);streams=li();bodyOverlayGeometry=new we(1,32,20);bodyOverlays=new Map;activeOverlayBodyIds=new Set;quality;reducedMotion=!1;lensingDiagnostics=q;diagnostics=Be;disposed=!1;constructor(t="high"){this.quality=t,this.root.name="black-hole-encounter-layer",this.root.visible=!1,this.horizon.name="black-hole-event-horizon",this.horizon.renderOrder=14,this.overlayHorizon.name="black-hole-overlay-horizon",this.overlayHorizon.renderOrder=14,this.photonRing.name="black-hole-photon-ring-cue",this.photonRing.renderOrder=17,this.accretionDisk.name="black-hole-accretion-disk",this.accretionDisk.renderOrder=13,this.lensedArch.name="black-hole-lensed-disk-arch",this.lensedArch.renderOrder=15,this.jetA.name="black-hole-relativistic-jet-a",this.jetB.name="black-hole-relativistic-jet-b",this.jetA.renderOrder=12,this.jetB.renderOrder=12,this.streams.points.renderOrder=12,this.horizon.layers.set(0),this.overlayHorizon.layers.set(I),this.photonRing.layers.set(I),this.accretionDisk.layers.set(I),this.lensedArch.layers.set(I),this.jetA.layers.set(I),this.jetB.layers.set(I),this.streams.points.layers.set(I),this.accretionDisk.rotation.x=N,this.lensedArch.rotation.x=N,this.photonRing.rotation.set(0,0,0),this.jetA.rotation.x=N,this.jetB.rotation.x=N+Math.PI,this.root.add(this.jetA,this.jetB,this.accretionDisk,this.lensedArch,this.streams.points,this.horizon,this.overlayHorizon,this.photonRing),this.applyQuality(),this.reset()}attachBody(t,i){if(this.assertNotDisposed(),t.trim().length===0||this.bodyOverlays.has(t))return;const s=new Ee({blending:F,color:16725273,depthWrite:!1,opacity:0,toneMapped:!0,transparent:!0}),o=new A(this.bodyOverlayGeometry,s);o.name=`black-hole-redshift-${t}`,o.renderOrder=16,o.scale.setScalar(1.035),o.visible=!1,o.layers.set(I),i.add(o),this.bodyOverlays.set(t,{overlay:o})}update(t){this.assertNotDisposed(),ri(t);const i=ai(t.lifecycleState),s=t.eventHorizonRadiusRenderUnits,o=Math.max(s,i?t.minimumVisualRadiusRenderUnits:0),n=o>s*(1+1e-9),r=t.spinVisualization,a=Math.abs(r),c=this.reducedMotion?0:t.scenarioTimeSeconds%1e4;this.root.position.fromArray(t.positionRenderUnits),this.root.visible=i,this.horizon.visible=i,this.overlayHorizon.visible=i,this.horizon.scale.setScalar(Math.max(o,1e-12)),this.overlayHorizon.scale.setScalar(Math.max(o,1e-12)),this.photonRing.visible=i&&this.quality!=="low",this.photonRing.scale.setScalar(Math.max(o,1e-12));const d=this.photonRingMaterial.uniforms;d.time.value=c,d.spin.value=r,d.opacity.value=mi(this.quality)*(this.reducedMotion?.85:1);const l=i&&t.accretionDiskEnabled;this.accretionDisk.visible=l,this.accretionDisk.scale.setScalar(Math.max(o,1e-12));const u=this.diskMaterial.uniforms;u.time.value=c,u.spin.value=r,u.opacity.value=je(this.quality),this.lensedArch.visible=l&&this.quality!=="low",this.lensedArch.scale.setScalar(Math.max(o,1e-12));const g=this.lensedArchMaterial.uniforms;g.time.value=c,g.spin.value=r,g.opacity.value=je(this.quality)*.72;const y=i&&t.accretionDiskEnabled&&a>.12&&this.quality!=="low";if(this.jetA.visible=y,this.jetB.visible=y,y){const m=o*(5.2+a*2.4),v=o*(.28+a*.14);this.jetA.scale.set(v,m,1),this.jetB.scale.set(v*.88,m*.9,1);const b=Math.cos(N),R=Math.sin(N);this.jetA.position.set(0,b*m*.5,R*m*.5),this.jetB.position.set(0,-b*m*.46,-R*m*.46);const T=(this.reducedMotion?.12:.18)*Math.max(a,.35),E=this.jetMaterialA.uniforms,S=this.jetMaterialB.uniforms;E.time.value=c,S.time.value=c,E.opacity.value=T,S.opacity.value=T*.75}const p=i?this.writeStreams(t,o):0;this.streams.points.geometry.setDrawRange(0,p),this.streams.points.visible=p>0,this.streams.points.material.uniforms.opacity.value=p>0?.92:0,this.updateBodyOverlays(i?t.bodies:[]);let h=0,f=0;for(const m of t.bodies)m.outcome==="captured"&&(h+=1),pe(m.outcome)&&(f+=1);this.diagnostics=Object.freeze({active:i,mode:i?t.mode:"none",lifecycleState:i?t.lifecycleState:"idle",stage:i?t.stage:"idle",runSignature:i?t.runSignature:"",eventHorizonRadiusRenderUnits:i?s:0,visualRadiusRenderUnits:i?o:0,presentationRadiusExaggerated:i&&n,accretionDiskVisible:l,streamPointCount:p,capturedBodyCount:i?h:0,disruptedBodyCount:i?f:0,baseBodyOverrideCount:i?t.bodies.length:0,finite:!0,lensing:this.lensingDiagnostics})}setLensingDiagnostics(t){this.assertNotDisposed(),this.lensingDiagnostics=t,this.diagnostics=Object.freeze({...this.diagnostics,lensing:t,finite:this.diagnostics.finite&&t.finite})}reset(){this.disposed||(this.root.visible=!1,this.horizon.visible=!1,this.overlayHorizon.visible=!1,this.photonRing.visible=!1,this.accretionDisk.visible=!1,this.lensedArch.visible=!1,this.jetA.visible=!1,this.jetB.visible=!1,this.streams.points.visible=!1,this.streams.points.geometry.setDrawRange(0,0),this.streams.points.material.uniforms.opacity.value=0,this.resetBodyOverlays(),this.lensingDiagnostics=Object.freeze({...q,quality:this.quality}),this.diagnostics=Object.freeze({...Be,lensing:this.lensingDiagnostics}))}setQuality(t){this.assertNotDisposed(),this.quality=t,this.applyQuality()}setReducedMotion(t){this.assertNotDisposed(),this.reducedMotion=t}getDiagnostics(){return this.diagnostics}getProtectiveExposureCeiling(){return this.diagnostics.active?this.diagnostics.accretionDiskVisible?.68:this.lensingDiagnostics.path==="schwarzschild"?.74:.82:null}dispose(){if(!this.disposed){this.reset(),this.disposed=!0,this.root.removeFromParent();for(const{overlay:t}of this.bodyOverlays.values())t.removeFromParent(),t.material.dispose();this.bodyOverlays.clear(),this.streams.points.geometry.dispose(),this.streams.points.material.dispose(),this.horizonGeometry.dispose(),this.horizonMaterial.dispose(),this.photonRingGeometry.dispose(),this.photonRingMaterial.dispose(),this.diskGeometry.dispose(),this.diskMaterial.dispose(),this.lensedArchGeometry.dispose(),this.lensedArchMaterial.dispose(),this.jetRibbonGeometry.dispose(),this.jetMaterialA.dispose(),this.jetMaterialB.dispose(),this.bodyOverlayGeometry.dispose(),this.root.clear()}}writeStreams(t,i){let s=0;for(const d of t.bodies)pe(d.outcome)&&(s+=1);if(s===0)return 0;const o=Math.max(4,Math.min(fi(this.quality,this.reducedMotion),Math.floor(L/s))),n=this.streams.position.array,r=this.streams.size.array,a=this.streams.heat.array;let c=0;for(const d of t.bodies){if(!pe(d.outcome))continue;const l=gi(d),u=Math.max(4,Math.floor(o*l)),g=d.positionRenderUnits[0]-t.positionRenderUnits[0],y=d.positionRenderUnits[1]-t.positionRenderUnits[1],p=d.positionRenderUnits[2]-t.positionRenderUnits[2],h=Math.max(Math.hypot(g,y,p),i*1.8),f=h>0?Math.min(1,ci/h):1,m=g*f,v=y*f,b=p*f,R=yi(`${t.runSignature}:${d.bodyId}`),T=Y(R,1)*Math.PI*2,E=Y(R,2)>.5?1:-1;for(let S=0;S<u&&c<L;S+=1){const w=u<=1?1:S/(u-1),k=1-w*w*(3-2*w),z=Math.max(i*(1.55+1.5*k),h*k*.12),$=(2.4+Y(R,3)*1.8)*l,se=this.reducedMotion?0:t.scenarioTimeSeconds%1e4*.38*E,oe=T+w*$*Math.PI*2*E+se,ne=Math.sin(w*Math.PI)*z,re=c*3;n[re]=m*k+Math.cos(oe)*ne*.16,n[re+1]=v*k+Math.sin(oe*.77)*ne*.08,n[re+2]=b*k+Math.sin(oe)*ne*.16,r[c]=1.2+(1-w)*2.8+Y(R,4+S)*1.4,a[c]=ge(.35+(1-w)*.65+l*.2),c+=1}}return this.streams.position.needsUpdate=!0,this.streams.size.needsUpdate=!0,this.streams.heat.needsUpdate=!0,c}updateBodyOverlays(t){this.activeOverlayBodyIds.clear();for(const i of t){this.activeOverlayBodyIds.add(i.bodyId);const s=this.bodyOverlays.get(i.bodyId);if(s===void 0)continue;const o=ge(Math.max(i.tidalStress*.55,i.streamProgress,i.captureProgress)),n=s.overlay;n.material.opacity=o*.54,n.material.color.setRGB(1.25,.08+(1-o)*.16,.025),n.scale.set(1.035+o*.08,1.035+o*.42,1.035+o*.08),n.visible=o>.001&&i.outcome!=="captured"}for(const[i,s]of this.bodyOverlays)this.activeOverlayBodyIds.has(i)||(s.overlay.visible=!1,s.overlay.material.opacity=0,s.overlay.scale.setScalar(1.035))}resetBodyOverlays(){for(const{overlay:t}of this.bodyOverlays.values())t.visible=!1,t.material.opacity=0,t.scale.setScalar(1.035)}applyQuality(){const t=this.quality==="low"?.7:this.quality==="medium"?.9:this.quality==="high"?1.1:1.35;this.streams.points.material.uniforms.sizeScale.value=t}assertNotDisposed(){if(this.disposed)throw new Error("Black-hole visual system is disposed.")}}function li(){const e=new ae(new Float32Array(L*3),3),t=new ae(new Float32Array(L),1),i=new ae(new Float32Array(L),1);e.setUsage(ce),t.setUsage(ce),i.setUsage(ce);const s=new at;s.setAttribute("position",e),s.setAttribute("aSize",t),s.setAttribute("aHeat",i),s.setDrawRange(0,0);const o=new V({blending:F,depthWrite:!1,toneMapped:!0,transparent:!0,uniforms:{opacity:new M(0),sizeScale:new M(1.1)},vertexShader:`
      attribute float aSize;
      attribute float aHeat;
      uniform float sizeScale;
      varying float vHeat;
      void main() {
        vHeat = aHeat;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * sizeScale * (180.0 / max(-mvPosition.z, 1.0)), 1.5, 28.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,fragmentShader:`
      uniform float opacity;
      varying float vHeat;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float dist = length(centered);
        float soft = smoothstep(0.5, 0.08, dist);
        vec3 cool = vec3(1.05, 0.28, 0.05);
        vec3 hot = vec3(2.6, 1.55, 0.55);
        vec3 color = mix(cool, hot, clamp(vHeat, 0.0, 1.0));
        gl_FragColor = vec4(color, soft * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `}),n=new ct(s,o);return n.name="black-hole-deterministic-accretion-streams",n.frustumCulled=!1,n.visible=!1,{points:n,position:e,size:t,heat:i}}function di(){return new V({blending:F,depthTest:!0,depthWrite:!1,side:ee,toneMapped:!0,transparent:!0,uniforms:{time:new M(0),spin:new M(0),opacity:new M(1)},vertexShader:`
      varying vec2 vLocal;
      void main() {
        // Torus local XY is the ring plane; radial distance from tube center
        // is encoded via normal-ish projection — use UV along tube.
        vLocal = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 vLocal;

      void main() {
        // Soft continuous tube — no discard gaps that read as a dashed circle.
        // Torus UV: x = around tube, y = around major ring.
        float across = abs(vLocal.x - 0.5) * 2.0;
        float core = exp(-across * across * 14.0);
        float halo = exp(-across * across * 4.0) * 0.35;
        float band = clamp(core + halo, 0.0, 1.0);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float azimuth = vLocal.y * 6.28318530718;
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.2, 0.8, approachingSide);
        float beaming = mix(0.85, 1.35, approachingSide);
        vec3 color = vec3(2.9, 2.15, 1.25) * beaming;
        gl_FragColor = vec4(color, band * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function ui(){return new V({blending:F,depthTest:!0,depthWrite:!1,side:ee,toneMapped:!0,transparent:!0,uniforms:{time:new M(0),spin:new M(0),opacity:new M(.78)},vertexShader:`
      varying vec2 diskPosition;
      varying float diskHeight;
      void main() {
        diskPosition = position.xy;
        float radius = max(length(position.xy), 0.0001);
        // Gentle thickness + far-side lift so the back of the disk arches over.
        float thickness = sin((radius - 1.85) / 2.75 * 3.14159) * 0.18;
        float farLift = max(-position.y, 0.0) * 0.42 * smoothstep(2.0, 4.2, radius);
        vec3 warped = position + vec3(0.0, 0.0, thickness + farLift);
        diskHeight = warped.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
      }
    `,fragmentShader:`
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 diskPosition;
      varying float diskHeight;

      void main() {
        float radius = max(length(diskPosition), 0.0001);
        // Smooth radial falloff only — no high-frequency sin bands / moiré.
        float radial = smoothstep(1.85, 2.15, radius) * (1.0 - smoothstep(3.9, 4.6, radius));
        float azimuth = atan(diskPosition.y, diskPosition.x);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float orbital = max(abs(signedSpin), 0.55);

        // Doppler: approaching half clearly brighter/whiter, receding dimmer/redder.
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.12, 0.88, approachingSide);
        float beaming = mix(0.22, 2.35, approachingSide);
        beaming = mix(1.0, beaming, orbital);

        float temperature = pow(clamp((4.6 - radius) / 2.6, 0.0, 1.0), 0.65);
        vec3 cool = vec3(0.42, 0.04, 0.012);
        vec3 warm = vec3(1.55, 0.32, 0.05);
        vec3 hot = vec3(3.5, 2.45, 1.55);
        vec3 approachingTint = mix(warm, hot, temperature);
        vec3 recedingTint = mix(cool, vec3(0.95, 0.12, 0.03), temperature * 0.55);
        vec3 color = mix(recedingTint, approachingTint, approachingSide);
        color *= beaming;

        // Very soft, low-frequency glow drift — not concentric stripes.
        float drift = 0.94 + 0.06 * sin(azimuth * 2.0 + time * 0.2 * direction);
        color *= drift;

        float heightFade = 1.0 - smoothstep(0.22, 0.55, abs(diskHeight));
        float innerRim = smoothstep(1.85, 2.05, radius) * (1.0 - smoothstep(2.05, 2.45, radius));
        color += vec3(2.6, 1.85, 1.1) * innerRim * mix(0.25, 1.2, approachingSide);
        gl_FragColor = vec4(color, radial * opacity * heightFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function hi(){return new V({blending:F,depthTest:!0,depthWrite:!1,side:ee,toneMapped:!0,transparent:!0,uniforms:{time:new M(0),spin:new M(0),opacity:new M(.55)},vertexShader:`
      varying vec2 diskPosition;
      void main() {
        diskPosition = position.xy;
        float radius = max(length(position.xy), 0.0001);
        float far = max(-position.y, 0.0);
        // Lift the far side clearly over the silhouette as a thin arch.
        float arch = far * far * 0.55 * smoothstep(2.0, 4.0, radius);
        vec3 warped = vec3(position.x * (1.0 + arch * 0.06), position.y, position.z + arch);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
      }
    `,fragmentShader:`
      uniform float time;
      uniform float spin;
      uniform float opacity;
      varying vec2 diskPosition;

      void main() {
        float radius = max(length(diskPosition), 0.0001);
        float radial = smoothstep(2.0, 2.35, radius) * (1.0 - smoothstep(3.6, 4.2, radius));
        float azimuth = atan(diskPosition.y, diskPosition.x);
        float signedSpin = clamp(spin, -1.0, 1.0);
        float direction = signedSpin < 0.0 ? -1.0 : 1.0;
        float farMask = smoothstep(0.05, 0.65, -diskPosition.y / max(radius, 0.001));
        float approachingSide = 0.5 + 0.5 * cos(azimuth) * direction;
        approachingSide = smoothstep(0.15, 0.85, approachingSide);
        float beaming = mix(0.35, 1.85, approachingSide);
        vec3 cool = vec3(0.9, 0.14, 0.04);
        vec3 hot = vec3(2.9, 2.0, 1.15);
        vec3 color = mix(cool, hot, approachingSide) * beaming;
        gl_FragColor = vec4(color, radial * farMask * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function pi(){return new rt(1,1,1,48)}function Ue(){return new V({blending:F,depthWrite:!1,side:ee,toneMapped:!0,transparent:!0,uniforms:{time:new M(0),opacity:new M(.15)},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float time;
      uniform float opacity;
      varying vec2 vUv;

      void main() {
        float across = abs(vUv.x - 0.5) * 2.0;
        float radial = exp(-across * across * 7.0);
        float along = vUv.y;
        // Soft fade at BOTH ends — no hard rectangular cutoff or spikes.
        float tip = smoothstep(0.0, 0.22, along);
        float tail = 1.0 - smoothstep(0.45, 1.0, along);
        float taper = tip * tail;
        vec3 color = mix(vec3(0.35, 0.55, 1.2), vec3(1.2, 1.35, 2.0), radial);
        float alpha = radial * taper * opacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function fi(e,t){return Math.max(8,Math.floor((e==="low"?28:e==="medium"?56:e==="high"?96:144)*(t?.5:1)))}function je(e){return e==="low"?.55:e==="medium"?.7:e==="high"?.82:.9}function mi(e){return e==="low"?0:e==="medium"?.85:e==="high"?1:1.05}function gi(e){return Math.max(.08,ge(Math.max({intact:0,"tidally-stressed":0,disrupted:.24,"accretion-stream":.52,captured:1,ejected:0}[e.outcome],e.streamProgress,e.captureProgress)))}function pe(e){return e==="disrupted"||e==="accretion-stream"||e==="captured"}function yi(e){let t=2166136261;for(let i=0;i<e.length;i+=1)t^=e.charCodeAt(i),t=Math.imul(t,16777619);return t>>>0}function Y(e,t){let i=e+Math.imul(t+1,2654435761)>>>0;return i^=i>>>16,i=Math.imul(i,2146121005),i^=i>>>15,i=Math.imul(i,2221713035),i^=i>>>16,(i>>>0)/4294967296}export{pt as A,Ri as B,Ce as C,q as E,Q as G,ye as S,Ti as a,I as b,wi as c,Ii as d,vi as e,bi as f,ut as g,gt as h,Oe as i,Ei as j,Si as k,ki as l,xi as m,Ai as v};
