"""
Headless Blender cleanup for IOM building GLBs.

Does not overwrite the source. Conservative: apply transforms, drop
degenerate faces, fix inverted (negative-scale) normals, recalc outside
normals. Does not merge-by-distance or delete unnamed interiors.

Usage:
  blender --background --python blender-clean-model.py -- ^
    --input "D:\\IOM\\ICM\\2026-glb\\ICM_ext.glb" ^
    --output "F:\\iom_website\\building-viewer\\tmp\\icm-ext-cleaned.glb"
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


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--report", default="")
    p.add_argument("--min-area", type=float, default=1e-12)
    p.add_argument("--apply-transforms", action="store_true")
    return p.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    prefs = bpy.context.preferences
    try:
        prefs.edit.undo_steps = 0
    except Exception:
        pass
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def import_gltf(path: str):
    bpy.ops.import_scene.gltf(filepath=path)


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def object_bounds():
    inf = 1e30
    mn = [inf, inf, inf]
    mx = [-inf, -inf, -inf]
    count = 0
    for obj in mesh_objects():
        for corner in obj.bound_box:
            w = obj.matrix_world @ __import__("mathutils").Vector(corner)
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
            count += 1
    if count == 0:
        return None
    size = [mx[i] - mn[i] for i in range(3)]
    return {"min": mn, "max": mx, "size": size}


def count_tris(obj) -> int:
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def uv_stats(obj):
    mesh = obj.data
    out_of_range = 0
    missing = 0
    if not mesh.uv_layers:
        if mesh.materials:
            missing = 1
        return missing, out_of_range
    uv = mesh.uv_layers.active
    if uv is None:
        return missing, out_of_range
    for loop in uv.uv:
        u, v = loop.vector.x, loop.vector.y
        if u < -0.001 or u > 1.001 or v < -0.001 or v > 1.001:
            out_of_range = 1
            break
    return missing, out_of_range


def apply_transforms(report: dict):
    from mathutils import Matrix

    negative = 0
    for obj in list(mesh_objects()):
        det = obj.matrix_world.determinant()
        if det < 0:
            negative += 1
            obj["iom_negative_scale"] = 1
        try:
            mw = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = mw
            mesh = obj.data
            if mesh.users > 1:
                obj.data = mesh.copy()
            obj.data.transform(mw)
            obj.matrix_world = Matrix.Identity(4)
        except Exception as err:
            report.setdefault("apply_errors", []).append(f"{obj.name}: {err}")
    report["negative_scale_objects"] = negative


def clean_mesh(obj, min_area: float) -> dict:
    mesh = obj.data
    before = count_tris(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()

    degenerate = [f for f in bm.faces if f.calc_area() < min_area]
    removed_area = len(degenerate)
    if degenerate:
        bmesh.ops.delete(bm, geom=degenerate, context="FACES")

    try:
        bmesh.ops.dissolve_degenerate(bm, dist=1e-7)
    except Exception:
        pass

    loose_verts = [v for v in bm.verts if not v.link_faces]
    removed_loose = len(loose_verts)
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context="VERTS")

    if obj.get("iom_negative_scale"):
        bmesh.ops.reverse_faces(bm, faces=bm.faces, flip_multires=False)

    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.validate(clean_customdata=False)
    after = count_tris(obj)
    return {
        "name": obj.name,
        "tris_before": before,
        "tris_after": after,
        "zero_area_faces": removed_area,
        "loose_verts": removed_loose,
    }


def export_glb(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=path,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_apply=True,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
        return
    except TypeError:
        pass
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")


def main():
    args = parse_args()
    src = Path(args.input)
    dst = Path(args.output)
    if not src.exists():
        raise SystemExit(f"Missing input: {src}")

    report = {
        "input": str(src),
        "output": str(dst),
        "blender": bpy.app.version_string,
        "ok": False,
    }
    reset_scene()
    print(f"[iom-clean] import {src}", flush=True)
    import_gltf(str(src))

    meshes = mesh_objects()
    report["mesh_objects"] = len(meshes)
    report["bounds_before"] = object_bounds()
    report["tris_before"] = sum(count_tris(o) for o in meshes)

    uv_missing = 0
    uv_oor = 0
    for obj in meshes:
        m, o = uv_stats(obj)
        uv_missing += m
        uv_oor += o
    report["uv_missing_before"] = uv_missing
    report["uv_out_of_range_before"] = uv_oor

    if args.apply_transforms:
        print("[iom-clean] apply transforms", flush=True)
        apply_transforms(report)
    else:
        report["negative_scale_objects"] = sum(
            1 for o in meshes if o.matrix_world.determinant() < 0
        )
        print("[iom-clean] skip apply transforms (use --apply-transforms)", flush=True)

    print("[iom-clean] clean meshes", flush=True)
    per = []
    zero_area = 0
    loose = 0
    for obj in mesh_objects():
        row = clean_mesh(obj, args.min_area)
        per.append(row)
        zero_area += row["zero_area_faces"]
        loose += row["loose_verts"]
        if row["zero_area_faces"] or row["loose_verts"]:
            print(
                f"  {row['name']}: {row['tris_before']} -> {row['tris_after']} tris "
                f"(zero-area {row['zero_area_faces']}, loose {row['loose_verts']})",
                flush=True,
            )

    report["zero_area_faces_removed"] = zero_area
    report["loose_verts_removed"] = loose
    report["tris_after"] = sum(count_tris(o) for o in mesh_objects())
    report["bounds_after"] = object_bounds()
    report["meshes_touched"] = sum(1 for r in per if r["zero_area_faces"] or r["loose_verts"])
    report["per_mesh"] = [r for r in per if r["zero_area_faces"] or r["loose_verts"]][:80]

    print(f"[iom-clean] export {dst}", flush=True)
    export_glb(str(dst))
    report["output_bytes"] = dst.stat().st_size if dst.exists() else 0
    report["ok"] = dst.exists() and dst.stat().st_size > 0

    report_path = Path(args.report) if args.report else dst.with_suffix(".json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in report if k != "per_mesh"}, indent=2), flush=True)
    print(f"[iom-clean] report {report_path}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
