import type {Object3D} from 'three';

// Verified figure roots. Each root includes its body, head, jewellery and carried accessories.
// Exclude before scene attachment so figures cannot appear in any color, shadow or reflection pass.
export const excludedPeople=new Set([
 'AE35_010_female_01',
 'AE35_010_people_female_02_pose_c',
 'AE35_010_people_female_03_pose_d',
 'AE35_010_people_male_03_pose_b',
]);
export function excludePeople(root:Object3D):string[]{
 const figures:Object3D[]=[];root.traverse(object=>{if(excludedPeople.has(object.name))figures.push(object);});
 for(const figure of figures)figure.removeFromParent();
 return figures.map(figure=>figure.name);
}
