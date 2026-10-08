import { Bone, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import type { CharacterAnimState } from './CharacterVisual';
export type FootGroundQuery = (origin: Vector3, distance: number) => number | null;
export type FootFrame = {
    grounded: boolean;
    speed: number;
    visualFeetY: number;
    ground: FootGroundQuery;
};
type Leg = {
    side: 'Left' | 'Right';
    soleVertices: { mesh: SkinnedMesh; index: number }[];
    hip: Bone;
    knee: Bone;
    foot: Bone;
    toe: Bone;
    length1: number;
    length2: number;
    sole: Vector3;
    heel: Vector3;
    tip: Vector3;
    restFoot: Quaternion;
    restToe: Quaternion;
    anchor: Vector3 | null;
    anchorYaw: Quaternion;
    previousPhase: number;
    weight: number;
    error: number;
    support: number | null;
};
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Visual correction only. The controller, bind pose and source clips stay untouched. */
export class CharacterFootIK {
    enabled = true;
    private legs: Leg[] = [];
    private saved: {
        bone: Bone;
        rotation: Quaternion;
    }[] = [];
    private modelPosition = new Vector3();
    private applied = false;
    private strength = 0;
    private pelvis = 0;
    private soleLift = 0;
    private previousRoot = new Vector3(Infinity, Infinity, Infinity);
    private previousYaw = new Quaternion();
    private previousState: CharacterAnimState | null = null;
    constructor(private readonly root: Object3D, private readonly model: Object3D) {
        root.updateMatrixWorld(true);
        const rootRotation = root.getWorldQuaternion(new Quaternion()).invert();
        for (const side of ['Left', 'Right'] as const) {
            const hip = model.getObjectByName('mixamorig' + side + 'UpLeg') as Bone | undefined;
            const knee = model.getObjectByName('mixamorig' + side + 'Leg') as Bone | undefined;
            const foot = model.getObjectByName('mixamorig' + side + 'Foot') as Bone | undefined;
            const toe = model.getObjectByName('mixamorig' + side + 'ToeBase') as Bone | undefined;
            if (!hip?.isBone || !knee?.isBone || !foot?.isBone || !toe?.isBone || knee.parent !== hip || foot.parent !== knee || toe.parent !== foot)
                continue;
            const ankle = foot.getWorldPosition(new Vector3()), hp = hip.getWorldPosition(new Vector3()), kp = knee.getWorldPosition(new Vector3());
            const length1 = hp.distanceTo(kp), length2 = kp.distanceTo(ankle);
            // This reviewed rig is in metres after its existing 0.01 armature scale.
            if (length1 < .3 || length1 > .6 || length2 < .3 || length2 > .6)
                continue;
            const points: Vector3[] = [];
            const vertices: { mesh: SkinnedMesh; index: number }[] = [];
            model.traverse(o => {
                const mesh = o as SkinnedMesh;
                if (!mesh.isSkinnedMesh)
                    return;
                const a = mesh.geometry.attributes;
                if (!a.skinWeight || !a.skinIndex)
                    return;
                for (let i = 0; i < a.position!.count; i++) {
                    let weight = 0;
                    for (let j = 0; j < 4; j++) {
                        const bone = mesh.skeleton.bones[a.skinIndex.getComponent(i, j)];
                        if (bone === foot || bone === toe || bone?.parent === toe)
                            weight += a.skinWeight.getComponent(i, j);
                    }
                    if (weight > .5) {
                        points.push(root.worldToLocal(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)));
                        vertices.push({ mesh, index: i });
                    }
                }
            });
            if (!points.length)
                continue;
            const minY = Math.min(...points.map(p => p.y)), minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
            // Calibrated from the actual shoe vertices in the unanimated load pose.
            const local = (z: number) => foot.worldToLocal(root.localToWorld(new Vector3(root.worldToLocal(ankle.clone()).x, minY, z)));
            this.legs.push({ side, soleVertices: vertices.filter((_, i) => points[i]!.y < minY + .06), hip, knee, foot, toe, length1, length2, sole: local((minZ + maxZ) / 2), heel: local(minZ + .025), tip: local(maxZ - .025), restFoot: rootRotation.clone().multiply(foot.getWorldQuaternion(new Quaternion())), restToe: toe.quaternion.clone(), anchor: null, anchorYaw: new Quaternion(), previousPhase: 0, weight: 0, error: 0, support: null });
        }
        if (this.legs.length !== 2)
            this.legs = [];
    }
    /** Undo last frame before AnimationMixer evaluates, including unkeyed bones. */
    restore(): void {
        if (!this.applied)
            return;
        for (const s of this.saved)
            s.bone.quaternion.copy(s.rotation);
        this.model.position.copy(this.modelPosition);
        this.applied = false;
    }
    reset(): void {
        this.restore();
        this.strength = 0;
        this.pelvis = 0;
        this.previousRoot.set(Infinity, Infinity, Infinity);
        this.previousState = null;
        for (const leg of this.legs) {
            leg.anchor = null;
            leg.weight = 0;
            leg.support = null;
            leg.error = 0;
        }
    }
    /** Correct small pose-dependent sole penetration on level ground using the
     * actual skinned shoe vertices, not the ankle bone or the capsule origin. */
    fitFlatSoles(dt: number, frame: FootFrame): void {
        if (!this.enabled || !frame.grounded || !this.legs.length) { this.soleLift = 0; return; }
        this.root.updateMatrixWorld(true);
        let lift = 0;
        const point = new Vector3(), lowest = new Vector3();
        for (const leg of this.legs) {
            lowest.set(0, Infinity, 0);
            for (const { mesh, index } of leg.soleVertices) {
                mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
                if (point.y < lowest.y) lowest.copy(point);
            }
            if (!Number.isFinite(lowest.y)) continue;
            const height = frame.ground(new Vector3(lowest.x, this.root.position.y + .14, lowest.z), .3);
            // Do not turn a nearby riser into a body offset. Stairs use leg IK.
            if (height === null || Math.abs(height - this.root.position.y) > .035) continue;
            lift = Math.max(lift, height + .006 - lowest.y);
        }
        this.soleLift = Math.max(Math.min(.06, lift), this.soleLift * Math.exp(-18 * dt));
        if (this.soleLift <= .00001) return;
        if (!this.applied) {
            this.saved = [];
            this.modelPosition.copy(this.model.position);
            this.applied = true;
        }
        this.model.position.y += this.soleLift;
        this.root.updateMatrixWorld(true);
    }
    diagnostics() { return { soleLift: this.soleLift, enabled: this.enabled, calibrated: this.legs.length === 2, strength: this.strength, pelvis: this.pelvis, legs: this.legs.map(l => ({ side: l.side, weight: l.weight, locked: !!l.anchor, support: l.support, targetError: l.error })) }; }
    apply(dt: number, state: CharacterAnimState, phase: number, frame: FootFrame): void {
        if (!this.enabled || !frame.grounded || state === 'jumping' || !this.legs.length || frame.speed > .9) {
            this.reset();
            return;
        }
        const stair = state === 'stairsUp' || state === 'stairsDown';
        const idle = state === 'idle' && this.strength > .01;
        const yaw = this.root.getWorldQuaternion(new Quaternion());
        const moved = this.previousRoot.distanceTo(this.root.position) > .8;
        const turned = 1 - Math.abs(yaw.dot(this.previousYaw)) > .025;
        if (moved || turned || (this.previousState !== state && state !== 'idle')) {
            for (const leg of this.legs)
                leg.anchor = null;
            if (moved) {
                this.strength = 0;
                this.pelvis = 0;
            }
        }
        this.previousRoot.copy(this.root.position);
        this.previousYaw.copy(yaw);
        this.previousState = state;
        this.strength += (Number(stair || idle) - this.strength) * (1 - Math.exp(-16 * dt));
        if (this.strength < .001) {
            this.reset();
            return;
        }
        this.saved = this.legs.flatMap(l => [l.hip, l.knee, l.foot, l.toe]).map(bone => ({ bone, rotation: bone.quaternion.clone() }));
        this.modelPosition.copy(this.model.position);
        this.applied = true;
        // Smooth the visible body across discrete risers without moving its physics root.
        this.model.position.y += (frame.visualFeetY - this.root.position.y) * this.strength;
        this.root.updateMatrixWorld(true);
        const plans = this.legs.map(leg => {
            const p = (phase + (leg.side === 'Left' ? 0 : .5)) % 1, end = state === 'stairsDown' ? .6 : .56;
            const contact = idle ? 1 : smooth(0, .06, p) * (1 - smooth(end - .06, end, p));
            if (contact < .01 || p < leg.previousPhase || turned || (leg.anchor && 1 - Math.abs(yaw.dot(leg.anchorYaw)) > .025))
                leg.anchor = null;
            leg.previousPhase = p;
            const animated = leg.foot.getWorldPosition(new Vector3());
            const rotation = leg.foot.getWorldQuaternion(new Quaternion()).slerp(yaw.clone().multiply(leg.restFoot), contact * this.strength);
            const scale = leg.foot.getWorldScale(new Vector3());
            const offset = (point: Vector3) => point.clone().multiply(scale).applyQuaternion(rotation);
            const sole = animated.clone().add(offset(leg.sole));
            const readHeight = (point: Vector3) => frame.ground(new Vector3(point.x, this.root.position.y + .5, point.z), 1.12);
            if (!leg.anchor && contact > .05) {
                const heights = [leg.sole, leg.heel, leg.tip].map(point => readHeight(animated.clone().add(offset(point)))).filter((h): h is number => h !== null);
                if (heights.length) {
                    leg.anchor = new Vector3(sole.x, Math.max(...heights) + .006, sole.z);
                    leg.anchorYaw.copy(yaw);
                }
            }
            if (leg.anchor && (Math.hypot(sole.x - leg.anchor.x, sole.z - leg.anchor.z) > .48 || readHeight(leg.anchor) === null))
                leg.anchor = null;
            const goal = sole.clone();
            if (leg.anchor)
                goal.lerp(leg.anchor, contact);
            // During swing retain the authored lift, but raise a shoe that intersects a tread.
            const shift = goal.clone().sub(sole);
            let supported = 0;
            const heights = [leg.sole, leg.heel, leg.tip].map(point => { const pointWorld = animated.clone().add(offset(point)).add(shift); const height = readHeight(pointWorld); if (height !== null)
                supported++; return height === null ? 0 : height + .004 - pointWorld.y; });
            const clearance = Math.max(0, ...heights);
            goal.y += Math.min(.4, clearance);
            leg.weight = contact * this.strength;
            leg.support = leg.anchor?.y ?? null;
            const target = animated.clone().lerp(goal.sub(offset(leg.sole)), this.strength);
            return { leg, target, rotation, contact, supported };
        });
        if (plans.every(p => p.supported === 0)) {
            this.reset();
            return;
        }
        let drop = 0;
        for (const plan of plans) {
            const hip = plan.leg.hip.getWorldPosition(new Vector3());
            const reach = (plan.leg.length1 + plan.leg.length2) * .985;
            const horizontal = Math.hypot(hip.x - plan.target.x, hip.z - plan.target.z);
            const vertical = Math.sqrt(Math.max(0, reach * reach - horizontal * horizontal));
            if (plan.contact > .2)
                drop = Math.min(drop, plan.target.y + vertical - hip.y);
        }
        this.pelvis += (Math.max(-.28, drop) - this.pelvis) * (1 - Math.exp(-32 * dt));
        this.model.position.y += this.pelvis * this.strength;
        this.root.updateMatrixWorld(true);
        const forward = new Vector3(0, 0, 1).applyQuaternion(yaw);
        for (const { leg, target, rotation, contact, supported } of plans) {
            if (!supported)
                continue;
            solveLeg(leg.hip, leg.knee, leg.foot, target, forward);
            setWorldRotation(leg.foot, rotation);
            leg.toe.quaternion.slerp(leg.restToe, contact * this.strength);
            leg.foot.updateWorldMatrix(false, true);
            leg.error = leg.foot.getWorldPosition(new Vector3()).distanceTo(target);
        }
    }
}
function setWorldRotation(bone: Bone, rotation: Quaternion): void {
    const parent = bone.parent!.getWorldQuaternion(new Quaternion()).invert();
    bone.quaternion.copy(parent.multiply(rotation)).normalize();
    bone.updateWorldMatrix(false, true);
}
/** Analytic two-segment solve; rotations preserve original bone lengths/scales. */
export function solveLeg(hip: Bone, knee: Bone, foot: Bone, target: Vector3, forward: Vector3): void {
    hip.updateWorldMatrix(true, true);
    const h = hip.getWorldPosition(new Vector3()), k = knee.getWorldPosition(new Vector3()), f = foot.getWorldPosition(new Vector3());
    const a = h.distanceTo(k), b = k.distanceTo(f), axis = target.clone().sub(h);
    if (axis.lengthSq() < 1e-10 || a < 1e-6 || b < 1e-6)
        return;
    const distance = Math.max(Math.abs(a - b) + .001, Math.min(a + b - .001, axis.length()));
    axis.normalize();
    const bend = k.clone().sub(h).addScaledVector(axis, -k.clone().sub(h).dot(axis));
    if (bend.length() < .025 || bend.dot(forward) < 0)
        bend.copy(forward).addScaledVector(axis, -forward.dot(axis));
    if (bend.lengthSq() < 1e-8)
        bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
    bend.normalize();
    const along = (a * a - b * b + distance * distance) / (2 * distance), perpendicular = Math.sqrt(Math.max(0, a * a - along * along));
    const kneeTarget = h.clone().addScaledVector(axis, along).addScaledVector(bend, perpendicular);
    const end = h.clone().addScaledVector(axis, distance);
    const rotate = (bone: Bone, child: Bone, to: Vector3) => {
        const origin = bone.getWorldPosition(new Vector3()), from = child.getWorldPosition(new Vector3()).sub(origin).normalize(), direction = to.clone().sub(origin).normalize();
        const world = bone.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromUnitVectors(from, direction));
        setWorldRotation(bone, world);
    };
    rotate(hip, knee, kneeTarget);
    rotate(knee, foot, end);
}
