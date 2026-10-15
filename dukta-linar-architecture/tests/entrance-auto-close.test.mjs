import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const e={};new Function('exports',ts.transpileModule(readFileSync('src/EntranceAutoClose.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(e);
test('completed view suppresses proximity until actual movement, without disabling threshold safety',()=>{
 const door={amount:0,set(n){this.amount=n;}},a=new e.EntranceAutoClose(door),p=x=>({x,y:1.9,z:-33.41});
 a.update(p(28),.1,false,false,false);a.suspendProximityUntilMovement(p(25.9953));
 for(let i=0;i<100;i++)a.update(p(25.9953),.1);
 assert.equal(door.amount,0);assert.equal(a.inspect().waitingForMovement,true);assert.equal(a.running,false);
 a.update(p(25.9),.1);for(let i=0;i<20;i++)a.update(p(25.9),.1);
 assert.equal(a.inspect().waitingForMovement,false);assert.equal(a.inspect().proximityEnabled,true);assert.equal(door.amount,1);
 door.amount=0;a.reset();a.suspendProximityUntilMovement(p(25.4));for(let i=0;i<20;i++)a.update(p(25.4),.1);assert.equal(door.amount,1,'Threshold safety remains active while holding a final view');
 a.reset();assert.equal(a.inspect().waitingForMovement,false,'Explicit reset/stop clears the hold');
});
test('interior tour proximity stays disabled through pause, then manual approach works again',()=>{
 const door={amount:0,set(n){this.amount=n;}},a=new e.EntranceAutoClose(door),p=x=>({x,y:1.9914,z:-33.41});
 for(const x of [30,29,28,27,26.5,25.9953])a.update(p(x),.1,false,false,false);
 for(let i=0;i<80;i++)a.update(p(25.9953),.1,false,i<40,false);
 assert.equal(door.amount,0,'Closed door stays closed at the real wall-detail preset');assert.equal(a.inspect().proximityEnabled,false);
 a.update(p(28),.1);a.update(p(27.5),.1);for(let i=0;i<20;i++)a.update(p(27.5),.1);
 assert.equal(door.amount,1);assert.equal(a.inspect().proximityEnabled,true);
});
test('tour policy retains threshold delay and protects an occupied swept doorway',()=>{
 const door={amount:1,set(n){this.amount=n;}},a=new e.EntranceAutoClose(door),p=x=>({x,y:1.9,z:-32.7}),tick=(x,n)=>{for(let i=0;i<n;i++)a.update(p(x),.1,false,false,false);};
 a.update(p(25),.1,true,false,false);tick(25.5,1);assert.equal(a.inspect().remainingSeconds,5);tick(26,70);assert.equal(door.amount,1);assert.equal(a.inspect().remainingSeconds,0);tick(27,20);assert.equal(door.amount,0);
 tick(26.5,25);assert.equal(door.amount,0,'Interior approach cannot reopen the closed leaf');
 tick(25.4,20);assert.equal(door.amount,1,'Actual threshold still opens for safety, even with tour proximity disabled');
});
test('door delay starts at the actual threshold, blocks closing around the camera, and reopens on exit',()=>{const door={amount:0,set(n){this.amount=n;}},a=new e.EntranceAutoClose(door),p=x=>({x,y:1.9,z:-32.7}),step=(x,seconds)=>{for(let i=0;i<seconds*100;i++)a.update(p(x),.01);};
 a.update(p(22),.01);a.update(p(23),.01);step(23,3);assert.equal(door.amount,1);assert.equal(a.inspect().remainingSeconds,null);a.update(p(24),.01);a.update(p(25),.01);a.update(p(25.5),.01);assert.equal(a.inspect().remainingSeconds,5);step(25.5,7);assert.equal(door.amount,1);assert.equal(a.inspect().remainingSeconds,0);assert.equal(a.running,false,'Stationary camera in doorway does not force idle rendering');a.update(p(26.5),.01);a.update(p(27.5),.01);step(27.5,2);assert.equal(door.amount,0);a.update(p(27),.01);step(27,2);assert.equal(door.amount,1);
});
test('five seconds are counted only after crossing; pause freezes countdown and tour opening remains authoritative',()=>{const door={amount:1,set(n){this.amount=n;}},a=new e.EntranceAutoClose(door),p=x=>({x,y:1.9,z:-32.7});a.update(p(25),.01,true);a.update(p(25.5),.01);for(const x of [26,26.5,27,27.5])a.update(p(x),.01);for(let i=0;i<400;i++)a.update(p(28),.01);assert.equal(door.amount,1);const remaining=a.inspect().remainingSeconds;for(let i=0;i<1000;i++)a.update(p(28),.01,false,true);assert.equal(a.inspect().remainingSeconds,remaining);for(let i=0;i<300;i++)a.update(p(28),.01);assert.equal(door.amount,0);a.reset();a.update(p(40),.1);a.update(p(20),.1);assert.equal(a.inspect().remainingSeconds,null,'Teleports do not count as walking across the door');});
