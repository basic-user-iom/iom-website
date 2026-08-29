"""Build a topology-safe planar proxy for the disabled unowned shell v2.

Only limited dissolve of coplanar faces is allowed. Material, seam and sharp
boundaries are preserved; faces are then triangulated and normals recalculated.
No ratio-based/global decimation is used.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import traceback
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


PLANAR_PROXY_SOURCE_PATHS = {
    "scene/0/0",
    "scene/0/2",
    "scene/0/5",
    "scene/0/7",
    "scene/0/10",
    "scene/0/16",
    "scene/0/18",
    "scene/0/41",
    "scene/0/89",
    "scene/0/90",
    "scene/0/91",
    "scene/0/92",
    "scene/0/93",
    "scene/0/125",
    "scene/0/162",
    "scene/0/184",
    "scene/0/249",
    "scene/0/257",
    "scene/0/281",
    "scene/0/318",
    "scene/0/327",
    "scene/0/331",
    "scene/0/341",
    "scene/0/351",
    "scene/0/366",
    "scene/0/367",
    "scene/0/370",
    "scene/0/372",
    "scene/0/394",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--angle-degrees", type=float, default=1.0)
    parser.add_argument("--min-area", type=float, default=1e-10)
    args = parser.parse_args(argv)
    if not 0.05 <= args.angle_degrees <= 30.0:
        parser.error("--angle-degrees must be between 0.05 and 30.0")
    return args


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.undo_steps = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def count_triangles(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def source_path(obj: bpy.types.Object) -> str | None:
    value = obj.get("iomProxySourcePath")
    if isinstance(value, str) and value:
        return value
    prefix = "IOM_PROXY_SOURCE__"
    name = obj.name.split(".")[0]
    if name.startswith(prefix):
        raw = name[len(prefix) :]
        return raw.replace("__", "/")
    return None


def bounds() -> dict:
    objects = mesh_objects()
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    if not points:
        raise RuntimeError("No proxy mesh bounds")
    minimum = [min(point[axis] for point in points) for axis in range(3)]
    maximum = [max(point[axis] for point in points) for axis in range(3)]
    return {"min": minimum, "max": maximum}


def simplify_object(obj: bpy.types.Object, angle: float, min_area: float) -> dict:
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    mesh = obj.data
    before = count_triangles(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    zero_area = [face for face in bm.faces if face.calc_area() < min_area]
    if zero_area:
        bmesh.ops.delete(bm, geom=zero_area, context="FACES")
    bmesh.ops.dissolve_degenerate(bm, dist=1e-8, edges=list(bm.edges))
    path = source_path(obj)
    planar_proxy = path in PLANAR_PROXY_SOURCE_PATHS
    if bm.faces and planar_proxy:
        bmesh.ops.dissolve_limit(
            bm,
            angle_limit=angle,
            use_dissolve_boundaries=True,
            verts=list(bm.verts),
            edges=list(bm.edges),
            delimit={"MATERIAL", "SEAM", "SHARP"},
        )
    if bm.faces:
        bm.faces.ensure_lookup_table()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
        bm.faces.ensure_lookup_table()
    post_triangulation_degenerate = [
        face for face in bm.faces if face.calc_area() < min_area
    ]
    if post_triangulation_degenerate:
        bmesh.ops.delete(bm, geom=post_triangulation_degenerate, context="FACES")
    if bm.faces:
        bm.faces.ensure_lookup_table()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    loose = [vert for vert in bm.verts if not vert.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(clean_customdata=False)
    mesh.update()
    after = count_triangles(obj)
    return {
        "object": obj.name,
        "sourcePath": path,
        "mode": "planar-feature-preserving-proxy" if planar_proxy else "lossless-retained-source",
        "trianglesBefore": before,
        "trianglesAfter": after,
        "removedTriangles": before - after,
        "zeroAreaFacesRemoved": len(zero_area),
        "postTriangulationZeroAreaFacesRemoved": len(post_triangulation_degenerate),
        "looseVerticesRemoved": len(loose),
    }


def configure_materials() -> None:
    for material in bpy.data.materials:
        material.use_backface_culling = False
        if not material.use_nodes:
            material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
        if principled:
            principled.inputs["Base Color"].default_value = (0.58, 0.65, 0.74, 1.0)
            principled.inputs["Metallic"].default_value = 0.0
            principled.inputs["Roughness"].default_value = 0.88
            principled.inputs["Alpha"].default_value = 1.0


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(path),
        export_format="GLB",
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=True,
        export_apply=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_extras=True)


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    if not source.is_file():
        raise RuntimeError(f"Missing proxy input: {source}")
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(source), import_shading="NORMALS")
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    objects = mesh_objects()
    if not objects:
        raise RuntimeError("Proxy input imported no mesh objects")
    missing_paths = [obj.name for obj in objects if not source_path(obj)]
    if missing_paths:
        raise RuntimeError(f"Proxy input lost source-path extras: {missing_paths[:10]}")
    before_bounds = bounds()
    before_triangles = sum(count_triangles(obj) for obj in objects)
    angle = math.radians(args.angle_degrees)
    rows = [simplify_object(obj, angle, args.min_area) for obj in objects]
    configure_materials()
    after_triangles = sum(count_triangles(obj) for obj in mesh_objects())
    input_source_paths = sorted(set(row["sourcePath"] for row in rows))
    nonempty_objects = [obj for obj in mesh_objects() if count_triangles(obj) > 0]
    represented_source_paths = sorted(set(source_path(obj) for obj in nonempty_objects))
    zero_area_after = 0
    for obj in mesh_objects():
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        zero_area_after += sum(1 for face in bm.faces if face.calc_area() < args.min_area)
        bm.free()
    for obj in list(mesh_objects()):
        if count_triangles(obj) == 0:
            bpy.data.objects.remove(obj, do_unlink=True)
    after_bounds = bounds()
    export_glb(output)
    report = {
        "schema": "IOM_BLENDER_UNOWNED_STRUCTURAL_PROXY_V2",
        "version": 2,
        "blender": bpy.app.version_string,
        "input": str(source),
        "output": str(output),
        "algorithm": "hybrid-lossless-v1-plus-limited-dissolve-coplanar-v2",
        "angleDegrees": args.angle_degrees,
        "globalRatioDecimationUsed": False,
        "planarProxySourcePaths": sorted(PLANAR_PROXY_SOURCE_PATHS),
        "meshObjects": len(objects),
        "inputSourcePathCount": len(input_source_paths),
        "inputSourcePaths": input_source_paths,
        "representedSourcePathCount": len(represented_source_paths),
        "representedSourcePaths": represented_source_paths,
        "trianglesBefore": before_triangles,
        "trianglesAfter": after_triangles,
        "trianglesRemoved": before_triangles - after_triangles,
        "boundsBefore": before_bounds,
        "boundsAfter": after_bounds,
        "zeroAreaFacesAfter": zero_area_after,
        "normalsRecalculated": True,
        "materialsOpposingSideVisible": True,
        "outputBytes": output.stat().st_size,
        "perObject": rows,
        "ready": False,
        "activationApproved": False,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "perObject"}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
