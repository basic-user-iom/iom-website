import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuide} from '../src/guide.mjs';

function fixture() {
 const doc={activeElement:null};
 class Node extends EventTarget {
  hidden=false; attrs={}; parent=null;
  setAttribute(k,v){this.attrs[k]=v;}
  focus(){doc.activeElement=this;}
  contains(n){return n===this||n?.parent===this;}
  click(){this.dispatchEvent(new Event('click'));}
 }
 const ids=['guide','guide-button','guide-title','settings','settings-button','close-guide','guide-done','view','walk'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Node()]));
 nodes['guide-title'].parent=nodes.guide;nodes['guide-done'].parent=nodes.guide;
 doc.getElementById=id=>nodes[id];doc.querySelectorAll=()=>[nodes.view,nodes.walk];doc.defaultView=new EventTarget();
 let openings=0;const guide=createGuide({document:doc,onOpen:()=>openings++});
 const key=(key,code,target)=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,code});if(target)Object.defineProperty(e,'target',{value:target});doc.defaultView.dispatchEvent(e);return e;};
 return {doc,nodes,guide,key,get openings(){return openings;}};
}

test('startup help does not steal focus; dismissal restores focus and Info reopens it',()=>{
 const f=fixture();assert.equal(f.nodes.guide.hidden,false);assert.equal(f.doc.activeElement,null);
 f.nodes['guide-done'].click();assert.equal(f.nodes.guide.hidden,true);assert.equal(f.doc.activeElement,f.nodes['guide-button']);
 assert.equal(f.nodes['guide-button'].attrs['aria-expanded'],'false');
 f.nodes['guide-button'].click();assert.equal(f.nodes.guide.hidden,false);assert.equal(f.doc.activeElement,f.nodes['guide-title']);assert.equal(f.openings,1);
 assert.equal(f.nodes.settings.hidden,true);assert.equal(f.nodes['settings-button'].attrs['aria-expanded'],'false');
});

test('Escape closes help before a later walk key handler and remains available after closing',()=>{
 const f=fixture();let walkingKeys=0;f.doc.defaultView.addEventListener('keydown',()=>walkingKeys++);
 assert.equal(f.key('Escape','Escape').defaultPrevented,true);assert.equal(walkingKeys,0);assert.equal(f.nodes.guide.hidden,true);
 f.key('Escape','Escape');assert.equal(walkingKeys,1);
});

test('reading help with arrows does not move the camera or suppress native scrolling',()=>{
 const f=fixture();let moving=0;f.doc.defaultView.addEventListener('keydown',()=>moving++);
 assert.equal(f.key('ArrowDown','ArrowDown',f.nodes['guide-title']).defaultPrevented,false);assert.equal(moving,0);
 f.key('ArrowDown','ArrowDown',f.nodes.view);assert.equal(moving,1);
});

test('scene actions dismiss help without stealing focus; disposal removes listeners',()=>{
 const f=fixture();f.doc.activeElement=f.nodes.view;f.nodes.view.click();assert.equal(f.nodes.guide.hidden,true);assert.equal(f.doc.activeElement,f.nodes.view);
 f.guide.open();f.nodes.walk.focus();f.nodes.walk.click();assert.equal(f.nodes.guide.hidden,true);
 f.guide.open();f.nodes['settings-button'].focus();f.nodes['settings-button'].click();assert.equal(f.nodes.guide.hidden,true);
 f.guide.dispose();f.nodes['guide-button'].click();assert.equal(f.nodes.guide.hidden,true);
});
