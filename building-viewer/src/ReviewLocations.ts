import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import type { ViewerEngine } from './ViewerEngine'
/** Review annotations only: they never enter the building or collision graph. */
export function mountReviewLocations(engine: ViewerEngine, host: HTMLElement): void {
  const overlay = new Group(); overlay.name = 'Review_CAD_annotations_v4'; engine.scene.add(overlay)
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Review location')
  const note = document.createElement('div'); note.className = 'bv-review-note'
  const locations = [
    { name:'Select location', p:null, note:'' },
    { name:'Teleport: foyer escalators', p:[-78.4,0,-29.05], camera:[-84,4,-29.05], note:'In Walk mode, each side escalator has its own UP circle and a DOWN circle on the upper floor.' },
    { name:'Teleport: foyer south A', p:[-72.21,0,-57.33], camera:[-75,3,-62], note:'In Walk mode, step into UP or DOWN. Release the movement key after arrival; leave and re-enter the circle to return.' },
    { name:'Teleport: foyer south B', p:[-64.43,0,-43.88], camera:[-61,3,-38], note:'Both wooden stair branches now have a return teleport at the upper landing.' },
    { name:'Teleport: E276 floors 1 / 2', p:[-49.5,5.969988823,55.65], camera:[-50.9,7.57,55.65], note:'UP / DOWN links the existing floors. From the stair entrance, go around the end of the side wall to reach the lower circle. The physical stair connection remains obstructed.' },
    { name:'Teleport: E277 floors 1 / 2', p:[-60.68,5.969988823,55.65], camera:[-59.28,7.57,55.65], note:'Return teleport on the real upper floor at 10.397 m. The lower circle is behind the side wall; approach around its end.' },
    { name:'Exterior approach: west', p:[-162.5,.5,44.9], camera:[-180,12,62], note:'Ground approach, two flights and upper landing. Original terrain belongs to the ICM Exterior layer.' },
    { name:'Exterior approach: east', p:[-26.85,.5,44.9], camera:[-8,12,62], note:'Check the approach to the first step and the return from the landing to the ground.' },
    { name:'Restored stairs: west', p:[-159,3,35], camera:[-180,16,53], note:'Position recovered from the original ICM_pack.blend; 18 parts restored across the model.' },
    { name:'Restored stairs: east', p:[-30,3,33], camera:[-4,17,48], note:'Original positions of exterior stairs and landings.' },
    { name:'Restored ICM pillar', p:[-121.38,4,-99.69], camera:[-105,13,-119], note:'The ICM pillar is back at its original Blender position.' },
    { name:'Former grouped position', p:[0,0,6], camera:[26,19,30], note:'The stairs and ICM pillar should no longer be grouped here.' },
    { name:'Stairs TR004', p:[-35.96,8.3,36], note:'Slow: 0.35 m/s. The exit joins a landing near Y=10.0 to a floor near Y=10.4; the intended architecture needs confirmation.' },
    { name:'Stairs TR005', p:[-74.16,8.3,36], note:'Check ascent and descent. Passing the test does not confirm the intended exit landing height.' },
    { name:'Seats: close view', p:[-34,1,-70], camera:[-32,3,-65], note:'Automatic LOD keeps the original at close range. LOD1 is for distant views.' },
    { name:'Seats: distant view', p:[-33,2,-70], camera:[-5,38,-30], exploded:true, note:'Exploded floors expose the hall for comparing LOD0 and LOD1 silhouettes.' },
    { name:'CAD: E262', p:[-37.22,4.69208,-11.30414], box:true, note:'bt2_technik_boden_1OG: 1.208 m clearance above the step. The box shows the 1.70 m character height; the structure has not been cut.' },
    { name:'CAD: E7676', p:[-72.89,4.69208,-11.30414], box:true, note:'bt2_technik_boden_1OG: 1.205 m clearance. The intended CAD opening or route needs confirmation.' },
    { name:'CAD: E276', p:[-52.33419,8.33873,54.46991], box:true, note:'zusatz_fb_bt2_og2: 0.631 m clearance; the 0.096 m gap is narrower than the 0.28 m character capsule.' },
    { name:'CAD: E277', p:[-57.84443,8.33873,54.46991], box:true, note:'Same obstruction as E276. Do not remove the slab without CAD confirmation.' },
    { name:'CAD: open face 2188', p:[-24.45494,.86070,-60.77209], note:'RG_Teil_01, face 2188: a matching bottom face has not been confirmed. This is an annotation, not a new support.' },
  ]
  locations.forEach((loc,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=loc.name;select.append(option)})
  select.onchange=()=>{
    const loc=locations[Number(select.value)]!;note.textContent=loc.note
    for(const child of [...overlay.children]){overlay.remove(child);const m=child as Mesh;m.geometry.dispose();(m.material as MeshBasicMaterial).dispose()}
    if(!loc.p)return
    engine.exitWalk();engine.modelAnim.stop();if(loc.exploded)engine.modelAnim.seekNormalized(1)
    const p=new Vector3(...loc.p);const position=loc.camera?new Vector3(...loc.camera):p.clone().add(new Vector3(3,2.5,4))
    engine.orbit.setEnabled(true);engine.camera.position.copy(position);engine.orbit.controls.target.copy(p);engine.camera.lookAt(p);engine.orbit.controls.update()
    if(loc.box){const marker=new Mesh(new BoxGeometry(.28,1.7,.28),new MeshBasicMaterial({color:0xff982e,wireframe:true,depthTest:false}));marker.position.copy(p).add(new Vector3(0,.85,0));overlay.add(marker)}
    else if(loc.name.startsWith('CAD:')){const marker=new Mesh(new SphereGeometry(.06),new MeshBasicMaterial({color:0xff982e,depthTest:false}));marker.position.copy(p);overlay.add(marker)}
  }
  const label = document.createElement('label')
  label.className = 'bv-review-field'
  label.append('Location:', select)
  host.append(label, note)
}
