import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoothNavigation, advanceWalk, WALK_SPEED } from '../src/walk-navigation.mjs';
const point = (x,z) => [x,1.7,z];
const bounds = { minX:-4, maxX:7, minZ:-4.5, maxZ:4.5 };
const walls = [
  {id:'back',min:[-2.5,0,-2.55],max:[-2.45,3.5,2.55]},
  {id:'left',min:[-2.5,0,-2.55],max:[2.55,3.5,-2.5]},
  {id:'right',min:[-2.5,0,2.5],max:[2.55,3.5,2.55]},
];
const booth = () => createBoothNavigation({bounds,boxes:walls});
test('visitor uses actual three-sided booth with open +X entrance',()=>{
  const nav=booth(); assert.equal(nav.state.obstacleCount,3);
  assert.equal(nav.segmentClear(point(5,0),point(0,0)),true);
  assert.equal(nav.contains(point(-2.3,0)),false); assert.equal(nav.contains(point(-2.21,0)),true);
  assert.equal(nav.contains(point(0,2.3)),false); assert.equal(nav.contains(point(0,2.26)),true);
});
test('whole segment is swept: valid endpoints cannot tunnel through a thin wall',()=>{
  const nav=booth();assert(nav.contains(point(0,-3)));assert(nav.contains(point(0,0)));
  assert.equal(nav.segmentClear(point(0,-3),point(0,0)),false);
  assert.equal(nav.segmentClear(point(0,0),point(-3,0)),false);
});
test('circular clearance allows a corner diagonal while rejecting too-close sweep',()=>{
  const nav=createBoothNavigation({bounds,boxes:[{id:'plinth',min:[0,0,0],max:[1,1,1]}]});
  assert(nav.contains(point(-.18,-.18))); // distance .254m from corner, not an inflated square
  assert(!nav.contains(point(-.16,-.16)));
  assert.equal(nav.segmentClear(point(-1,.2),point(.2,-1)),true);
  assert.equal(nav.segmentClear(point(-.2,.3),point(.3,-.2)),false);
  assert.equal(nav.segmentClear(point(-.7,0),point(0,-.7)),true);
});
test('floor bounds maintain body radius and reject non-finite input',()=>{
  const nav=booth();assert(nav.contains(point(6.76,0)));assert(!nav.contains(point(6.761,0)));
  assert(!nav.contains([NaN,1.7,0]));assert(!nav.segmentClear(point(0,0),[0,1.7,Infinity]));
  assert.throws(()=>createBoothNavigation({bounds:{minX:0,maxX:.1,minZ:0,maxZ:2}}));
  assert.throws(()=>createBoothNavigation({bounds,boxes:[{min:[1,0,0],max:[0,1,1]}]}));
});
test('overhead fixtures and floor slab do not block visitor, furniture does',()=>{
  const nav=createBoothNavigation({bounds,boxes:[{min:[-1,2.5,-1],max:[1,3,1]},
    {min:[-4,-.1,-4.5],max:[7,0,4.5]},{min:[2,0,0],max:[3,1,1]}]});
  assert.equal(nav.state.obstacleCount,1);assert(nav.contains(point(0,0)));assert(!nav.contains(point(2.5,.5)));
});
test('unsafe spawn fails rather than teleporting across a wall; safe spawn keeps gaze delta',()=>{
  const nav=booth();assert.equal(nav.visitorPose({position:point(-2.47,0),target:point(0,0)}),null);
  const p=nav.visitorPose({position:[0,1,0],target:[-2,1.2,0],fov:55});
  assert.deepEqual(p.position,[0,1.7,0]);assert.equal(p.target[1],1.9);assert.equal(p.fov,55);
});
test('a ten-second stalled frame advances at most 100ms, never teleports',()=>{
  const nav=booth(), motion={position:point(1,0),yaw:Math.PI/2};
  const result=advanceWalk(motion,{forward:1},10,nav,{reducedMotion:true});
  assert.equal(result.dt,.1);assert(Math.abs(motion.position[0]-1-WALK_SPEED*.1)<1e-9);
});
test('diagonal movement has the same speed as straight movement',()=>{
  const nav=booth(), a={position:point(0,0),yaw:0},b={position:point(0,0),yaw:0};
  advanceWalk(a,{forward:1},.1,nav,{reducedMotion:true});advanceWalk(b,{forward:1,right:1},.1,nav,{reducedMotion:true});
  assert(Math.abs(a.distance-b.distance)<1e-9);
});
test('oblique motion slides along wall without crossing; corner remains safe',()=>{
  const nav=booth(), m={position:point(-2.1,0),yaw:-Math.PI/4};
  for(let i=0;i<50;i++){advanceWalk(m,{forward:1},.1,nav);assert(nav.contains(m.position));}
  assert(m.position[0]>=-2.21-1e-8);assert(m.position[2]>.5);assert(m.position[2]<=2.26+1e-8);
});
test('release damps to exact idle and does not request an endless render loop',()=>{
  const nav=booth(),m={position:point(0,0),yaw:0};advanceWalk(m,{forward:1},.1,nav);
  let result;for(let i=0;i<100;i++)result=advanceWalk(m,{},.016,nav);
  assert.equal(m.speed,0);assert.equal(result.needsFrame,false);assert(nav.contains(m.position));
});
test('reduced-motion preference removes drift on release, not manual control',()=>{
  const nav=booth(),m={position:point(0,0),yaw:0};advanceWalk(m,{forward:1},.1,nav,{reducedMotion:true});
  const previous=[...m.position];const r=advanceWalk(m,{},.016,nav,{reducedMotion:true});
  assert.deepEqual(m.position,previous);assert.equal(r.needsFrame,false);
});
