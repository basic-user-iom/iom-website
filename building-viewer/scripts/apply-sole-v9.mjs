import fs from 'node:fs';function edit(file,fn){const s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(file,fn(s))}function replace(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b)}
edit('src/controls/CharacterFootIK.ts',s=>{
s=replace(s,"    side: 'Left' | 'Right';","    side: 'Left' | 'Right';\n    soleVertices: { mesh: SkinnedMesh; index: number }[];");
s=replace(s,'    private pelvis = 0;','    private pelvis = 0;\n    private soleLift = 0;');
s=replace(s,'            const points: Vector3[] = [];','            const points: Vector3[] = [];\n            const vertices: { mesh: SkinnedMesh; index: number }[] = [];');
s=replace(s,`                    if (weight > .5)
                        points.push(root.worldToLocal(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)));`,`                    if (weight > .5) {
                        points.push(root.worldToLocal(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)));
                        vertices.push({ mesh, index: i });
                    }`);
s=replace(s,'this.legs.push({ side, hip,','this.legs.push({ side, soleVertices: vertices.filter((_, i) => points[i]!.y < minY + .06), hip,');
s=replace(s,'    diagnostics() { return { enabled:',`    /** Correct small pose-dependent sole penetration on level ground using the
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
    diagnostics() { return { soleLift: this.soleLift, enabled:`);
return s});
edit('src/controls/CharacterVisual.ts',s=>replace(s,'    } else this.footIK?.reset()\n  }','    } else this.footIK?.reset()\n    if (frame && !stair && !this.firstPerson) this.footIK?.fitFlatSoles(dt, frame)\n  }'));
// Cover both draw packing paths: same material must not merge different shadow contracts.
edit('scripts/test-visual-correctness.mjs',s=>replace(s,"  console.log('Visual correctness regression checks passed')",`  for (const kind of ['batch', 'instance']) {
    const root = new Group(), material = new MeshStandardMaterial({ name: 'Shared floor wood' })
    const sharedGeometry = new BoxGeometry(4, 1, 4)
    for (let flags = 0; flags < 4; flags++) for (let i = 0; i < 4; i++) {
      const geometry = kind === 'instance' ? sharedGeometry : new BoxGeometry(4 + i * .03, 1, 4)
      const mesh = new Mesh(geometry, material)
      mesh.position.set(i * 6, 0, flags * 6)
      mesh.castShadow = Boolean(flags & 1)
      mesh.receiveShadow = Boolean(flags & 2)
      root.add(mesh)
    }
    applyProceduralInstancing(root, { minInstances: kind === 'instance' ? 3 : 99, minBatchSize: 4 })
    const packs = root.children.filter(mesh => kind === 'instance' ? mesh.isInstancedMesh : mesh.isBatchedMesh)
    assert.equal(packs.length, 4, kind + ': preserve all four shadow contracts')
    assert.equal(new Set(packs.map(mesh => Number(mesh.castShadow) + 2 * Number(mesh.receiveShadow))).size, 4)
  }
  console.log('Visual correctness regression checks passed')`));
console.log('Added pose clearance and shadow regression');
