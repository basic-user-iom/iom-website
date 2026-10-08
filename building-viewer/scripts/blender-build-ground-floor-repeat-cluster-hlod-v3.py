"""Build a disabled low-cost Web HLOD for the repeated chair/table row.

The output is an offline candidate only.  It never edits the production GLBs
or manifests.  A separate Node audit pins the resulting geometry into the
existing parity/floor-aware v2 packages and keeps activation fail-closed until
the seven-view render gate is approved.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import traceback
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


EXPECTED_SOURCE_TRIANGLES = 61_269
EXPECTED_SOURCE_BYTES = 1_744_016
EXPECTED_SOURCE_SHA256 = "5e825834692b57e85dc09f7cb48d956815c3c6a7cee1ab8c35e9c3b92a345efe"
EXPECTED_MATERIALS = [
    "vray Stuhl_Plastik",
    "vray Stuhl_Plakete",
    "vray Stuhl_Metall",
    "vray Stuhl_Bezug",
]
VIEW_DIRECTIONS = [
    Vector((1.0, 0.0, 0.0)),
    Vector((0.0, 1.0, 0.0)),
    Vector((0.0, 0.0, 1.0)),
    Vector((1.0, 1.0, 0.0)).normalized(),
    Vector((1.0, -1.0, 0.0)).normalized(),
    Vector((1.0, 0.0, 1.0)).normalized(),
    Vector((0.0, 1.0, 1.0)).normalized(),
]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--ratio", type=float, default=0.03)
    parser.add_argument("--max-triangles", type=int, default=2_000)
    parser.add_argument("--weld-distance", type=float, default=1e-6)
    parser.add_argument("--silhouette-lock", action="store_true")
    parser.add_argument("--lock-boundaries", action="store_true")
    parser.add_argument("--vertex-group-factor", type=float, default=1.0)
    args = parser.parse_args(argv)
    if not 0.02 <= args.ratio <= 0.5:
        parser.error("--ratio must be between 0.02 and 0.5")
    if not 1_000 <= args.max_triangles <= 20_000:
        parser.error("--max-triangles must be between 1,000 and 20,000")
    if not 0.0 <= args.vertex_group_factor <= 1.0:
        parser.error("--vertex-group-factor must be between 0 and 1")
    if not 0.0 <= args.weld_distance <= 1e-3:
        parser.error("--weld-distance must be between 0 and 0.001 source units")
    return args


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.undo_steps = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def count_triangles(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def triangle_counts_by_material(obj: bpy.types.Object) -> list[int]:
    result = [0 for _ in obj.data.materials]
    obj.data.calc_loop_triangles()
    for triangle in obj.data.loop_triangles:
        if 0 <= triangle.material_index < len(result):
            result[triangle.material_index] += 1
    return result


def object_bounds(obj: bpy.types.Object) -> dict[str, list[float]]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
    }


def find_target() -> bpy.types.Object:
    candidates = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.name.startswith("Stuhl_Tisch_Rechts_Reihe_")
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one chair/table mesh, found {len(candidates)}")
    target = candidates[0]
    material_names = [material.name if material else None for material in target.data.materials]
    if material_names != EXPECTED_MATERIALS:
        raise RuntimeError(f"Material order changed: {material_names}")
    triangles = count_triangles(target)
    if triangles != EXPECTED_SOURCE_TRIANGLES:
        raise RuntimeError(
            f"Source triangle pin changed: {triangles} != {EXPECTED_SOURCE_TRIANGLES}"
        )
    return target


def silhouette_vertices(
    obj: bpy.types.Object, include_boundaries: bool
) -> set[int]:
    """Return vertices on a silhouette in any pinned opposing direction."""
    mesh = obj.data
    mesh.update()
    edge_faces: dict[tuple[int, int], list[int]] = {}
    for polygon in mesh.polygons:
        vertices = list(polygon.vertices)
        for index, left in enumerate(vertices):
            right = vertices[(index + 1) % len(vertices)]
            key = (left, right) if left < right else (right, left)
            edge_faces.setdefault(key, []).append(polygon.index)

    locked: set[int] = set()
    for edge, face_indices in edge_faces.items():
        if len(face_indices) == 1:
            if include_boundaries:
                locked.update(edge)
            continue
        normals = [mesh.polygons[index].normal for index in face_indices]
        is_silhouette = False
        for direction in VIEW_DIRECTIONS:
            signs = [normal.dot(direction) for normal in normals]
            if min(signs) <= 0.0 <= max(signs):
                is_silhouette = True
                break
        if is_silhouette:
            locked.update(edge)
    return locked


def remove_degenerate_and_recalculate(obj: bpy.types.Object) -> dict[str, int]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    before = len(bm.faces)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-8, edges=list(bm.edges))
    zero_area = [face for face in bm.faces if face.calc_area() < 1e-10]
    if zero_area:
        bmesh.ops.delete(bm, geom=zero_area, context="FACES")
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bmesh.ops.triangulate(
            bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY"
        )
    loose = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    after = len(bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate(clean_customdata=False)
    obj.data.update()
    return {
        "facesBeforeCleanup": before,
        "facesAfterCleanup": after,
        "zeroAreaFacesRemoved": len(zero_area),
        "looseVerticesRemoved": len(loose),
    }


def weld_coincident_vertices(obj: bpy.types.Object, distance: float) -> dict[str, int | float]:
    """Reconnect exact export seams before simplification without moving geometry."""
    before = len(obj.data.vertices)
    if distance <= 0:
        return {"distance": distance, "verticesBefore": before, "verticesAfter": before}
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=distance)
    after = len(bm.verts)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate(clean_customdata=False)
    obj.data.update()
    return {"distance": distance, "verticesBefore": before, "verticesAfter": after}


def export_glb(target: bpy.types.Object, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    kwargs = dict(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=True,
        export_apply=True,
        export_yup=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(
            filepath=str(output), export_format="GLB", use_selection=True
        )


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    if not source.is_file():
        raise RuntimeError(f"Missing source GLB: {source}")
    if source.stat().st_size != EXPECTED_SOURCE_BYTES:
        raise RuntimeError(
            f"Source byte pin changed: {source.stat().st_size} != {EXPECTED_SOURCE_BYTES}"
        )
    source_sha256 = sha256_file(source)
    if source_sha256 != EXPECTED_SOURCE_SHA256:
        raise RuntimeError(
            f"Source SHA-256 pin changed: {source_sha256} != {EXPECTED_SOURCE_SHA256}"
        )

    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source), import_shading="NORMALS")
    target = find_target()
    for obj in list(bpy.context.scene.objects):
        if obj != target:
            bpy.data.objects.remove(obj, do_unlink=True)
    if target.data.users > 1:
        target.data = target.data.copy()

    before_bounds = object_bounds(target)
    before_by_material = triangle_counts_by_material(target)
    weld = weld_coincident_vertices(target, args.weld_distance)
    locked = (
        silhouette_vertices(target, args.lock_boundaries)
        if args.silhouette_lock
        else set()
    )
    vertex_group = None
    if locked:
        vertex_group = target.vertex_groups.new(name="IOM_PINNED_SILHOUETTE")
        vertex_group.add(sorted(locked), 1.0, "REPLACE")

    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    modifier = target.modifiers.new("IOM_Web_Cluster_HLOD_V3", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = args.ratio
    modifier.use_collapse_triangulate = True
    if vertex_group is not None:
        modifier.vertex_group = vertex_group.name
        modifier.invert_vertex_group = True
        modifier.vertex_group_factor = args.vertex_group_factor
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    cleanup = remove_degenerate_and_recalculate(target)

    after_triangles = count_triangles(target)
    after_by_material = triangle_counts_by_material(target)
    if after_triangles > args.max_triangles:
        raise RuntimeError(
            f"Candidate exceeds triangle ceiling: {after_triangles} > {args.max_triangles}"
        )
    if len(after_by_material) != 4 or any(value <= 0 for value in after_by_material):
        raise RuntimeError(f"A material role lost all geometry: {after_by_material}")

    after_bounds = object_bounds(target)
    export_glb(target, output)
    report = {
        "schema": "IOM_BLENDER_GROUND_REPEAT_CLUSTER_HLOD_V3",
        "version": 3,
        "blender": bpy.app.version_string,
        "algorithm": "web-row-welded-collapse-decimation-with-optional-seven-direction-silhouette-lock",
        "input": {
            "name": source.name,
            "bytes": source.stat().st_size,
            "sha256": source_sha256,
        },
        "output": {
            "name": output.name,
            "bytes": output.stat().st_size,
            "sha256": sha256_file(output),
        },
        "ratio": args.ratio,
        "maxTriangles": args.max_triangles,
        "weld": weld,
        "silhouetteLock": args.silhouette_lock,
        "lockBoundaries": args.lock_boundaries,
        "vertexGroupFactor": args.vertex_group_factor,
        "lockedVertexCount": len(locked),
        "trianglesBefore": EXPECTED_SOURCE_TRIANGLES,
        "trianglesAfter": after_triangles,
        "trianglesByMaterialBefore": before_by_material,
        "trianglesByMaterialAfter": after_by_material,
        "materialNames": EXPECTED_MATERIALS,
        "boundsBefore": before_bounds,
        "boundsAfter": after_bounds,
        "cleanup": cleanup,
        "containsAnimations": False,
        "containsCameras": False,
        "containsLights": False,
        "ready": False,
        "activationApproved": False,
        "runtimeIntegrated": False,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
