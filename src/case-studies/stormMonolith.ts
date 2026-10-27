import data from '../data/stormPublication.json'
const c = data.locales.en
export const STORM_MONOLITH_STUDY = {
  slug: data.slug, eyebrow:c.eyebrow, title:c.title, lead:c.lead, impact:c.impact,
  primaryCta:{label:c.open, href:data.live, external:true},
  secondaryCta:{label:c.read, href:'/blog/'+data.article},
  stages:c.stages.map((stage,i)=>({
    id:["brief","clouds","materials","delivery"][i]!, index:String(i+1).padStart(2,'0'),
    framework:(['challenge','solution','solution','deliverables'] as const)[i]!,
    title:stage.title, summary:stage.summary, detail:stage.detail,
    media:{type:'image' as const, src:i===2?'/assets/blog/storm-monolith-studio/detail.webp':data.image, alt:stage.alt},
  })), deliverables:c.deliverables,
}
