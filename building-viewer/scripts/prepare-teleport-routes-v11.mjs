import fs from'node:fs';
const dir='../../evidence/teleport-v11',survey=JSON.parse(fs.readFileSync(dir+'/survey-landings.json'));const base=JSON.parse(fs.readFileSync(dir+'/configured-routes.json')).slice(0,8);
const skip=new Set(['treppe_bt1_2.002-0','BU_Treppe_Show_time-0','BU_Treppe_Show_time-1','Etagentreppen_262-0','Etagentreppen_7676-0','Etagentreppen_262.001-0','Etagentreppen_7676.001-0']);
// Interior U-stairs connect occupied storeys, not cramped half-flight turnarounds.
for (const owner of ['Etagentreppen_262','Etagentreppen_7676','Etagentreppen_34535','Etagentreppen__34']) {
  for (const record of survey.filter(r => [owner,owner+'.001',owner+'.002',owner+'.003'].includes(r.owner))) {
    if (!/to-first-floor|to-second-floor/.test(record.id) && !/\.002-0$/.test(record.id)) skip.add(record.id)
    if (['Etagentreppen_34535.002-0','Etagentreppen__34.002-0'].includes(record.id)) skip.add(record.id)
  }
}
for (const [lower,upper] of [['treppe_bt1_1.001','treppe_bt1_1.002'],['treppe_bt1_2.001','treppe_bt1_2.003'],['treppe_bt1_5.003','treppe_bt1_5.005'],['treppe_bt1_6.001','treppe_bt1_6.002']]) {
  const a=survey.find(r=>r.owner===lower),b=survey.find(r=>r.owner===upper)
  skip.add(a.id);skip.add(b.id)
  survey.push({id:lower+'-storey',owner:lower,sourceObjects:[lower,upper],ends:[a.ends[0],b.ends[1]]})
}
const candidates=base.map(r=>({id:r.id,label:r.label,owner:r.id,existing:true,ends:[r.bottom,r.top].map(point=>({candidates:[{point,radius:r.bottomRadius||r.radius||.6,layerId:r.layerId,distance:0}]}))}));
for(const r of survey){if(skip.has(r.id)||!r.ends?.every(e=>e.candidates.length))continue;const wide=r.owner==='TR_Stufen_001';candidates.push({...r,id:r.id.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),label:r.id.replace(/_/g,' '),ends:r.ends.map(e=>({candidates:e.candidates.map(p=>({...p,radius:Math.min(p.radius,wide?.6:.4)})).sort((a,b)=>(a.distance+(wide?5:1)*(.6-a.radius))-(b.distance+(wide?5:1)*(.6-b.radius)))}))})}
fs.writeFileSync(dir+'/route-candidates.json',JSON.stringify(candidates,null,2));console.log('Candidates',candidates.length);
