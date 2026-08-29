"""
Golden-slice DCC rebuild: clip to crop, drop stacked CAD, thicken open
shells, repair UV0, UV1 lightmap unwrap, Cycles GI bake, glTF export.

Usage:
  blender --background --python blender-golden-slice.py -- ^
    --input slice.glb --output baked.glb --lightmap lightmap.png ^
    --min -35,-1,84 --max -8,12,132 --samples 96
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import traceback
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector


SKIP_SOLIDIFY = re.compile(
    r"chair|stuhl|sitz|wardrobe|schrank|bank|bench|leuchte|leuchte|light|lampe|"
    r"blind|jalousie|lamelle|container|speaker|box|kiste|tisch|table",
    re.I,
)


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--lightmap", required=True)
    p.add_argument("--report", default="")
    p.add_argument("--size", type=int, default=2048)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--min-area", type=float, default=1e-12)
    p.add_argument("--min", default="")
    p.add_argument("--max", default="")
    p.add_argument("--solidify", type=float, default=0.05)
    p.add_argument("--remodel", action="store_true", help="Replace CAD shells with solid architectural boxes")
    p.add_argument("--remodel-room", action="store_true", help="Replace CAD with a closed interior room")
    return p.parse_args(argv)


def parse_vec3(raw: str):
    if not raw:
        return None
    parts = [float(x.strip()) for x in raw.split(",")]
    if len(parts) != 3:
        raise SystemExit(f"Expected x,y,z got {raw}")
    return parts


def gltf_aabb_to_blender(bmin, bmax):
    """Extract AABBs are glTF Y-up; Blender import is Z-up (x, y, z) → (x, -z, y)."""
    return [bmin[0], -bmax[2], bmin[1]], [bmax[0], -bmin[2], bmax[1]]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def count_tris(obj) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def world_aabb(obj):
    """AABB from actual verts. obj.bound_box stays stale after face clipping."""
    mw = obj.matrix_world
    xs, ys, zs = [], [], []
    for v in obj.data.vertices:
        w = mw @ v.co
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)
    if not xs:
        return Vector((0.0, 0.0, 0.0)), Vector((0.0, 0.0, 0.0))
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def verts_in_box(obj, bmin, bmax, margin=0.5):
    mw = obj.matrix_world
    pts = []
    for v in obj.data.vertices:
        w = mw @ v.co
        if (
            bmin[0] - margin <= w.x <= bmax[0] + margin
            and bmin[1] - margin <= w.y <= bmax[1] + margin
            and bmin[2] - margin <= w.z <= bmax[2] + margin
        ):
            pts.append(w)
    return pts


def aabb_from_points(pts, fallback_min, fallback_max):
    if not pts:
        if fallback_min is None:
            return None, None
        return Vector(fallback_min), Vector(fallback_max)
    return (
        Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
        Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))),
    )


def aabb_iou(a_min, a_max, b_min, b_max) -> float:
    ix = max(0.0, min(a_max.x, b_max.x) - max(a_min.x, b_min.x))
    iy = max(0.0, min(a_max.y, b_max.y) - max(a_min.y, b_min.y))
    iz = max(0.0, min(a_max.z, b_max.z) - max(a_min.z, b_min.z))
    inter = ix * iy * iz
    if inter <= 0:
        return 0.0
    va = max(1e-9, (a_max.x - a_min.x) * (a_max.y - a_min.y) * (a_max.z - a_min.z))
    vb = max(1e-9, (b_max.x - b_min.x) * (b_max.y - b_min.y) * (b_max.z - b_min.z))
    return inter / (va + vb - inter)


def has_image_texture(obj) -> bool:
    mats = list(obj.data.materials) if obj.data.materials else []
    for mat in mats:
        if not mat or not mat.node_tree:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and getattr(node, "image", None):
                return True
    return False


def apply_transforms():
    for obj in list(mesh_objects()):
        try:
            mw = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = mw
            mesh = obj.data
            if mesh.users > 1:
                obj.data = mesh.copy()
            obj.data.transform(mw)
            obj.matrix_world = Matrix.Identity(4)
        except Exception:
            pass


def clean_mesh(obj, min_area: float) -> None:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    degenerate = [f for f in bm.faces if f.calc_area() < min_area]
    if degenerate:
        bmesh.ops.delete(bm, geom=degenerate, context="FACES")
    try:
        bmesh.ops.dissolve_degenerate(bm, dist=1e-7)
    except Exception:
        pass
    try:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    except Exception:
        pass
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    mesh.validate(clean_customdata=False)


def clip_to_box(obj, bmin, bmax, margin=0.75) -> int:
    """Drop faces whose centroid sits outside the crop. Returns remaining faces."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    dead = []
    for face in bm.faces:
        c = obj.matrix_world @ face.calc_center_median()
        if (
            c.x < bmin[0] - margin
            or c.x > bmax[0] + margin
            or c.y < bmin[1] - margin
            or c.y > bmax[1] + margin
            or c.z < bmin[2] - margin
            or c.z > bmax[2] + margin
        ):
            dead.append(face)
    if dead:
        bmesh.ops.delete(bm, geom=dead, context="FACES")
    kept = len(bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return kept


def drop_empty_and_duplicates(report: dict) -> None:
    dropped = []
    for obj in list(mesh_objects()):
        if count_tris(obj) < 2 or len(obj.data.polygons) < 1:
            dropped.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    kept = mesh_objects()
    boxes = [(obj, *world_aabb(obj), count_tris(obj), has_image_texture(obj)) for obj in kept]
    remove = set()
    for i, (a, amin, amax, atris, amap) in enumerate(boxes):
        if a.name in remove:
            continue
        for b, bmin, bmax, btris, bmap in boxes[i + 1 :]:
            if b.name in remove:
                continue
            if aabb_iou(amin, amax, bmin, bmax) < 0.82:
                continue
            # Same stacked CAD: keep textured, else more triangles.
            drop_b = False
            if amap != bmap:
                drop_b = bmap is False
            elif atris != btris:
                drop_b = btris < atris
            else:
                drop_b = True
            if drop_b:
                remove.add(b.name)
            else:
                remove.add(a.name)
                break
    for obj in list(mesh_objects()):
        if obj.name in remove:
            dropped.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    # Green-roof volume vs grass slab occupying the same XZ.
    names = {o.name: o for o in mesh_objects()}
    if "Dach gruen" in names and "Grndach_001" in names:
        dropped.append("Grndach_001")
        bpy.data.objects.remove(names["Grndach_001"], do_unlink=True)
    # Campus roof/façade remnants that only graze this bay.
    for leftover in ("Dach_002", "Fassade_001"):
        if leftover in names:
            dropped.append(leftover)
            bpy.data.objects.remove(names[leftover], do_unlink=True)
    report["dropped"] = dropped


def first_material(obj):
    mats = list(obj.data.materials) if obj.data and obj.data.materials else []
    for mat in mats:
        if mat:
            return mat
    return None


def ensure_mat(name, color, roughness=0.55, metallic=0.0, transmission=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = alpha >= 0.99 and transmission <= 0.0
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if metallic and "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if transmission:
            if "Transmission Weight" in bsdf.inputs:
                bsdf.inputs["Transmission Weight"].default_value = transmission
            elif "Transmission" in bsdf.inputs:
                bsdf.inputs["Transmission"].default_value = transmission
            if "IOR" in bsdf.inputs:
                bsdf.inputs["IOR"].default_value = 1.45
        if alpha < 1.0 and "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
            try:
                mat.blend_method = "BLEND"
            except Exception:
                pass
    return mat


def add_solid_box(name, mn: Vector, mx: Vector, mat) -> object:
    size = mx - mn
    # Degenerate protection
    size.x = max(size.x, 0.05)
    size.y = max(size.y, 0.05)
    size.z = max(size.z, 0.05)
    loc = (mn + mx) * 0.5
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=bm.verts, vec=size)
    bmesh.ops.translate(bm, verts=bm.verts, vec=loc)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    if mat:
        obj.data.materials.append(mat)
    return obj


def boolean_cut(target, cutter) -> int:
    """Difference via evaluated mesh — modifier_apply is unreliable in background."""
    mats = [m for m in target.data.materials]
    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = target.modifiers.new("IOMCut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    try:
        mod.solver = "EXACT"
    except Exception:
        pass
    mod.object = cutter
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    eval_obj = target.evaluated_get(dg)
    new_mesh = bpy.data.meshes.new_from_object(eval_obj)
    old = target.data
    target.modifiers.clear()
    target.data = new_mesh
    for mat in mats:
        if mat and mat.name not in [m.name for m in target.data.materials if m]:
            target.data.materials.append(mat)
    bpy.data.meshes.remove(old)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return count_tris(target)


def join_objects(name, objs):
    objs = [o for o in objs if o is not None]
    if not objs:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def wall_slab(axis, outer, inward, u0, u1, z0, z1, depth_out, depth_in):
    """Box on a vertical wall. inward +1 means +axis into the building."""
    a0 = outer - inward * depth_out
    a1 = outer + inward * depth_in
    lo, hi = (a0, a1) if a0 <= a1 else (a1, a0)
    if axis == "Y":
        return Vector((u0, lo, z0)), Vector((u1, hi, z1))
    return Vector((lo, u0, z0)), Vector((hi, u1, z1))


def ribbon_glaze_bands(z_floor_top, z_roof_bot, rows=3):
    plinth, parapet, spandrel = 0.74, 0.54, 0.40
    remain = (z_roof_bot - z_floor_top) - plinth - parapet - spandrel * (rows - 1)
    glaze = max(1.6, remain / rows)
    bands = []
    z = z_floor_top + plinth
    for i in range(rows):
        bands.append((z, z + glaze))
        z += glaze + (spandrel if i < rows - 1 else 0)
    return bands, spandrel


def add_curtain_wall(
    wall,
    axis,
    outer,
    inward,
    u0,
    u1,
    z_floor_top,
    z_roof_bot,
    wall_t,
    concrete,
    mullion_mat,
    glass,
    built,
):
    """Ribbon glazing + aluminum grid on one exterior face. Returns extra objects."""
    extra = []
    bands, spandrel_h = ribbon_glaze_bands(z_floor_top, z_roof_bot)
    margin = 0.55
    opening_u0, opening_u1 = u0 + margin, u1 - margin
    pitch = 1.85
    mull_w, mull_out, mull_in = 0.09, 0.05, 0.11
    span = opening_u1 - opening_u0
    cols = max(4, int(round(span / pitch)))
    # Punch one ribbon per storey.
    for i, (z0, z1) in enumerate(bands):
        mn, mx = wall_slab(axis, outer, inward, opening_u0, opening_u1, z0, z1, 0.28, wall_t + 0.28)
        cutter = add_solid_box(f"{wall.name}_Cut{i}", mn, mx, concrete)
        boolean_cut(wall, cutter)
        g_mn, g_mx = wall_slab(axis, outer, inward, opening_u0 + 0.03, opening_u1 - 0.03, z0 + 0.03, z1 - 0.03, -0.02, 0.06)
        extra.append(add_solid_box(f"{wall.name}_Glass{i}", g_mn, g_mx, glass))
        # Spandrel under the next ribbon (skip after last).
        if i < len(bands) - 1:
            s0, s1 = z1, z1 + spandrel_h
            s_mn, s_mx = wall_slab(axis, outer, inward, u0, u1, s0, s1, 0.06, 0.04)
            extra.append(add_solid_box(f"{wall.name}_Spandrel{i}", s_mn, s_mx, concrete))
        # Horizontal transoms at head and sill.
        for zt0, zt1 in ((z0 - 0.04, z0 + 0.05), (z1 - 0.05, z1 + 0.04)):
            t_mn, t_mx = wall_slab(axis, outer, inward, opening_u0, opening_u1, zt0, zt1, mull_out, mull_in)
            extra.append(add_solid_box(f"{wall.name}_Transom_{i}_{zt0:.2f}", t_mn, t_mx, mullion_mat))
        # Vertical mullions.
        for c in range(cols + 1):
            uc = opening_u0 + span * (c / cols)
            m_mn, m_mx = wall_slab(
                axis,
                outer,
                inward,
                uc - mull_w * 0.5,
                uc + mull_w * 0.5,
                z0,
                z1,
                mull_out,
                mull_in,
            )
            extra.append(add_solid_box(f"{wall.name}_Mullion_{i}_{c}", m_mn, m_mx, mullion_mat))
    built.extend(extra)
    return extra


def remodel_as_architecture(report: dict, crop_min, crop_max, wall_t=0.30) -> None:
    """Replace remaining CAD with a closed, thick bay: floor, 4 walls, roof, grass."""
    by_name = {o.name: o for o in mesh_objects()}
    fassade = by_name.get("Fassade")
    dach = by_name.get("Dach gruen")
    floor_src = by_name.get("c5_fb_neu001")
    rasen = by_name.get("rasen_01_001")
    frame = by_name.get("Block_rahmen_s__001")
    if not fassade:
        raise SystemExit("Remodel needs Fassade after clip")
    if not crop_min or not crop_max:
        raise SystemExit("Remodel needs a crop AABB")

    wall_mat = ensure_mat("IOMWall", (0.62, 0.60, 0.56), 0.72)
    floor_mat = ensure_mat("IOMFloor", (0.42, 0.40, 0.36), 0.78)
    grass_mat = first_material(dach) or first_material(rasen) or ensure_mat("IOMGrass", (0.22, 0.34, 0.18), 0.82)
    frame_mat = ensure_mat("IOMMullion", (0.14, 0.15, 0.16), 0.32, metallic=0.82)
    glass = ensure_mat("IOMGlass", (0.55, 0.66, 0.72), 0.04, transmission=0.92, alpha=0.22)

    # The golden-ext crop IS the bay. Do not size from CAD bound_box.
    fmin = Vector(crop_min)
    fmax = Vector(crop_max)
    report["remodel_envelope"] = {
        "min": [fmin.x, fmin.y, fmin.z],
        "max": [fmax.x, fmax.y, fmax.z],
    }
    # Room height from façade; floor slightly below, roof at top.
    x0, y0 = fmin.x, fmin.y
    x1, y1 = fmax.x, fmax.y
    z0 = fmin.z
    z1 = fmax.z
    if dach:
        dpts = verts_in_box(dach, crop_min, crop_max)
        if dpts:
            z1 = max(z1, max(p.z for p in dpts))

    floor_h = 0.22
    roof_h = 0.28
    z_floor_top = z0 + floor_h
    z_roof_bot = z1 - roof_h

    built = []
    built.append(
        add_solid_box(
            "IOM_Floor",
            Vector((x0, y0, z0)),
            Vector((x1, y1, z_floor_top)),
            floor_mat,
        )
    )
    built.append(
        add_solid_box(
            "IOM_Roof",
            Vector((x0, y0, z_roof_bot)),
            Vector((x1, y1, z1)),
            grass_mat if dach else wall_mat,
        )
    )
    # Four walls sit on the floor, under the roof, thickness inward.
    walls = [
        ("IOM_Wall_Y0", Vector((x0, y0, z_floor_top)), Vector((x1, y0 + wall_t, z_roof_bot))),
        ("IOM_Wall_Y1", Vector((x0, y1 - wall_t, z_floor_top)), Vector((x1, y1, z_roof_bot))),
        ("IOM_Wall_X0", Vector((x0, y0 + wall_t, z_floor_top)), Vector((x0 + wall_t, y1 - wall_t, z_roof_bot))),
        ("IOM_Wall_X1", Vector((x1 - wall_t, y0 + wall_t, z_floor_top)), Vector((x1, y1 - wall_t, z_roof_bot))),
    ]
    for name, mn, mx in walls:
        built.append(add_solid_box(name, mn, mx, wall_mat))

    if rasen:
        rmin, rmax = aabb_from_points(verts_in_box(rasen, crop_min, crop_max), None, None)
        if rmin and (rmax.x - rmin.x) > 0.4 and (rmax.y - rmin.y) > 0.4:
            built.append(
                add_solid_box(
                    "IOM_Grass",
                    Vector((rmin.x, rmin.y, z_floor_top)),
                    Vector((rmax.x, rmax.y, z_floor_top + 0.12)),
                    grass_mat,
                )
            )

    # Skylight: cut a hole in the roof and put a thin frame + glass.
    roof = next(o for o in built if o.name == "IOM_Roof")
    tmin = tmax = None
    if frame:
        tmin, tmax = aabb_from_points(verts_in_box(frame, crop_min, crop_max), None, None)
    if not tmin or (tmax.x - tmin.x) < 1.0 or (tmax.y - tmin.y) < 1.0:
        cx, cy = (x0 + x1) * 0.5, (y0 + y1) * 0.5
        tmin = Vector((cx - 3.0, cy - 2.2, z_roof_bot))
        tmax = Vector((cx + 3.0, cy + 2.2, z1))
    pad = 0.08
    cutter = add_solid_box(
        "IOM_SkylightCut",
        Vector((tmin.x + pad, tmin.y + pad, z_roof_bot - 0.2)),
        Vector((tmax.x - pad, tmax.y - pad, z1 + 0.2)),
        wall_mat,
    )
    report["roof_tris_after_cut"] = boolean_cut(roof, cutter)
    built.append(
        add_solid_box(
            "IOM_SkylightGlass",
            Vector((tmin.x + pad, tmin.y + pad, z_roof_bot + 0.06)),
            Vector((tmax.x - pad, tmax.y - pad, z_roof_bot + 0.10)),
            glass,
        )
    )
    ft = 0.12
    built.append(add_solid_box("IOM_SkyFrameA", Vector((tmin.x, tmin.y, z_roof_bot)), Vector((tmax.x, tmin.y + ft, z1)), frame_mat))
    built.append(add_solid_box("IOM_SkyFrameB", Vector((tmin.x, tmax.y - ft, z_roof_bot)), Vector((tmax.x, tmax.y, z1)), frame_mat))
    built.append(add_solid_box("IOM_SkyFrameC", Vector((tmin.x, tmin.y + ft, z_roof_bot)), Vector((tmin.x + ft, tmax.y - ft, z1)), frame_mat))
    built.append(add_solid_box("IOM_SkyFrameD", Vector((tmax.x - ft, tmin.y + ft, z_roof_bot)), Vector((tmax.x, tmax.y - ft, z1)), frame_mat))

    wall_y0 = next(o for o in built if o.name == "IOM_Wall_Y0")
    wall_x1 = next(o for o in built if o.name == "IOM_Wall_X1")
    # Camera-facing faces: glTF +Z (Blender −Y) and glTF +X edge.
    extras = []
    extras += add_curtain_wall(
        wall_y0, "Y", y0, +1, x0, x1, z_floor_top, z_roof_bot, wall_t, wall_mat, frame_mat, glass, built,
    )
    extras += add_curtain_wall(
        wall_x1, "X", x1, -1, y0 + wall_t, y1 - wall_t, z_floor_top, z_roof_bot, wall_t, wall_mat, frame_mat, glass, built,
    )
    glass_objs = [o for o in extras if "Glass" in o.name] + [o for o in built if "SkylightGlass" in o.name]
    mull_objs = [o for o in extras if "Mullion" in o.name or "Transom" in o.name] + [
        o for o in built if o.name.startswith("IOM_SkyFrame")
    ]
    span_objs = [o for o in extras if "Spandrel" in o.name]
    join_objects("IOM_Glazing", glass_objs)
    join_objects("IOM_Mullions", mull_objs)
    if span_objs:
        join_objects("IOM_Spandrel", span_objs)
    report["curtain"] = {
        "ribbons": 3,
        "glass_joined": "IOM_Glazing",
        "mullions_joined": "IOM_Mullions",
        "y0_tris": count_tris(wall_y0),
        "x1_tris": count_tris(wall_x1),
    }

    cad_names = [o.name for o in mesh_objects() if not o.name.startswith("IOM_")]
    for obj in list(mesh_objects()):
        if not obj.name.startswith("IOM_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    report["remodeled"] = [o.name for o in mesh_objects()]
    report["removed_cad"] = cad_names
    print(f"[golden] remodeled {report['remodeled']}", flush=True)


def ensure_emit(name, color=(1.0, 0.95, 0.88), strength=12.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    for node in list(tree.nodes):
        tree.nodes.remove(node)
    emit = tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (color[0], color[1], color[2], 1.0)
    emit.inputs["Strength"].default_value = strength
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def horizontal_obb(pts):
    """PCA in Blender XY (floor plane). Returns origin, u, v, hu, hv."""
    if len(pts) < 8:
        return None
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    xx = xz = zz = 0.0
    for p in pts:
        dx = p.x - cx
        dy = p.y - cy
        xx += dx * dx
        xz += dx * dy
        zz += dy * dy
    n = float(len(pts))
    xx /= n
    xz /= n
    zz /= n
    tr = xx + zz
    det = xx * zz - xz * xz
    disc = math.sqrt(max(0.0, tr * tr * 0.25 - det))
    l1 = tr * 0.5 + disc
    ux, uy = xz, l1 - xx
    ulen = math.hypot(ux, uy) or 1.0
    ux, uy = ux / ulen, uy / ulen
    u = Vector((ux, uy, 0.0))
    v = Vector((-uy, ux, 0.0))
    min_u = min_v = 1e9
    max_u = max_v = -1e9
    for p in pts:
        du = (p.x - cx) * u.x + (p.y - cy) * u.y
        dv = (p.x - cx) * v.x + (p.y - cy) * v.y
        min_u = min(min_u, du)
        max_u = max(max_u, du)
        min_v = min(min_v, dv)
        max_v = max(max_v, dv)
    origin = Vector((cx, cy, 0.0)) + u * ((min_u + max_u) * 0.5) + v * ((min_v + max_v) * 0.5)
    hu = (max_u - min_u) * 0.5
    hv = (max_v - min_v) * 0.5
    return origin, u, v, hu, hv


def cloakroom_frame(crop_min, crop_max):
    """
    Real garderobe is ~30° off world axes. Align the remodel to the ceiling
    slab, with local +Y toward the hall (smaller Blender Y / glTF +Z).
    """
    ceil_pts = []
    for obj in mesh_objects():
        if "garderobe" not in (obj.name or "").lower() or "decke" not in (obj.name or "").lower():
            continue
        mw = obj.matrix_world
        for vert in obj.data.vertices:
            ceil_pts.append(mw @ vert.co)
    obb = horizontal_obb(ceil_pts)
    if not obb:
        origin = Vector(
            (
                (crop_min[0] + crop_max[0]) * 0.5,
                (crop_min[1] + crop_max[1]) * 0.5,
                0.0,
            )
        )
        return origin, Vector((1, 0, 0)), Vector((0, 1, 0)), (crop_max[0] - crop_min[0]) * 0.5, (crop_max[1] - crop_min[1]) * 0.5
    origin, u, v, hu, hv = obb
    # Hall is the crop face with smaller Y (gltf_aabb_to_blender maps glTF +Z that way).
    hall_dir = Vector((0.0, -1.0, 0.0))
    if v.dot(hall_dir) < 0:
        v = -v
    # Right-handed: local X × Y = +Z.
    u = Vector((v.y, -v.x, 0.0))
    return origin, u.normalized(), v.normalized(), hu, hv


def add_parented_box(name, mn: Vector, mx: Vector, mat, parent) -> object:
    obj = add_solid_box(name, mn, mx, mat)
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.matrix_basis.identity()
    return obj


def bake_parented_meshes(parent):
    bpy.context.view_layer.update()
    children = [o for o in mesh_objects() if o.parent == parent]
    for obj in children:
        mw = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = mw
        mesh = obj.data
        if mesh.users > 1:
            obj.data = mesh.copy()
        obj.data.transform(mw)
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()
    bpy.data.objects.remove(parent, do_unlink=True)


def remodel_as_room(report: dict, crop_min, crop_max, wall_t=0.22) -> None:
    """Closed foyer cloakroom aligned to the 30° CAD bay, not the world AABB."""
    if not crop_min or not crop_max:
        raise SystemExit("Room remodel needs a crop AABB")
    origin, u_axis, v_axis, hu, hv = cloakroom_frame(crop_min, crop_max)
    z0 = float(crop_min[2])
    z1 = float(crop_max[2])
    report["remodel_envelope"] = {
        "min": [crop_min[0], crop_min[1], crop_min[2]],
        "max": [crop_max[0], crop_max[1], crop_max[2]],
    }
    report["room_obb"] = {
        "origin": [origin.x, origin.y, origin.z],
        "u": [u_axis.x, u_axis.y, u_axis.z],
        "v": [v_axis.x, v_axis.y, v_axis.z],
        "hu": hu,
        "hv": hv,
        "yaw_deg": math.degrees(math.atan2(v_axis.y, v_axis.x)),
    }
    print(f"[golden] room OBB hu={hu:.2f} hv={hv:.2f} yaw={report['room_obb']['yaw_deg']:.1f}", flush=True)

    plaster = ensure_mat("IOMPlaster", (0.78, 0.76, 0.72), 0.68)
    floor_mat = ensure_mat("IOMIntFloor", (0.36, 0.33, 0.30), 0.62)
    ceil_mat = ensure_mat("IOMCeiling", (0.86, 0.85, 0.82), 0.58)
    wood = ensure_mat("IOMWood", (0.38, 0.26, 0.16), 0.48)
    metal = ensure_mat("IOMMullion", (0.16, 0.16, 0.17), 0.38, metallic=0.55)
    emit = ensure_emit("IOMDownlight", (1.0, 0.96, 0.90), 18.0)

    floor_h, ceil_h = 0.14, 0.18
    z_floor_top = z0 + floor_h
    z_ceil_bot = z1 - ceil_h
    # Inset so walls sit on the ceiling slab, not in the hall AABB corners.
    x0, x1 = -hu + 0.08, hu - 0.08
    y0, y1 = -hv + 0.06, hv - 0.55

    frame = bpy.data.objects.new("IOM_RoomFrame", None)
    bpy.context.scene.collection.objects.link(frame)
    rot = Matrix((
        (u_axis.x, v_axis.x, 0.0, origin.x),
        (u_axis.y, v_axis.y, 0.0, origin.y),
        (0.0, 0.0, 1.0, 0.0),
        (0.0, 0.0, 0.0, 1.0),
    ))
    frame.matrix_world = rot

    built = []
    built.append(add_parented_box("IOM_Floor", Vector((x0, y0, z0)), Vector((x1, y1, z_floor_top)), floor_mat, frame))
    built.append(add_parented_box("IOM_Ceiling", Vector((x0, y0, z_ceil_bot)), Vector((x1, y1, z1)), ceil_mat, frame))
    walls = [
        ("IOM_Wall_Y0", Vector((x0, y0, z_floor_top)), Vector((x1, y0 + wall_t, z_ceil_bot))),
        ("IOM_Wall_X0", Vector((x0, y0 + wall_t, z_floor_top)), Vector((x0 + wall_t, y1, z_ceil_bot))),
        ("IOM_Wall_X1", Vector((x1 - wall_t, y0 + wall_t, z_floor_top)), Vector((x1, y1, z_ceil_bot))),
    ]
    for name, mn, mx in walls:
        built.append(add_parented_box(name, mn, mx, plaster, frame))

    # No hall-side plaster wall — that slab was sitting in the foyer at 30°.
    # CAD keeps the opening into the cloakroom.

    built.append(
        add_parented_box(
            "IOM_Counter",
            Vector((x1 - wall_t - 0.62, y0 + wall_t + 0.9, z_floor_top)),
            Vector((x1 - wall_t - 0.02, y1 - wall_t - 0.9, z_floor_top + 1.02)),
            wood,
            frame,
        )
    )
    built.append(
        add_parented_box(
            "IOM_CounterTop",
            Vector((x1 - wall_t - 0.70, y0 + wall_t + 0.86, z_floor_top + 1.02)),
            Vector((x1 - wall_t + 0.02, y1 - wall_t - 0.86, z_floor_top + 1.08)),
            wood,
            frame,
        )
    )

    w_y0 = y0 + wall_t
    built.append(
        add_parented_box(
            "IOM_Wardrobe",
            Vector((x0 + wall_t + 0.3, w_y0, z_floor_top)),
            Vector((x1 - wall_t - 0.85, w_y0 + 0.56, z_floor_top + 2.12)),
            wood,
            frame,
        )
    )
    fins = []
    span = (x1 - wall_t - 0.85) - (x0 + wall_t + 0.3)
    cols = max(6, int(span / 0.62))
    for i in range(cols + 1):
        uu = (x0 + wall_t + 0.3) + span * (i / cols)
        fins.append(
            add_parented_box(
                f"IOM_WardrobeFin_{i}",
                Vector((uu - 0.018, w_y0, z_floor_top + 0.04)),
                Vector((uu + 0.018, w_y0 + 0.56, z_floor_top + 2.08)),
                metal,
                frame,
            )
        )

    lights = []
    for ix in range(3):
        for iy in range(3):
            lx = x0 + (x1 - x0) * (0.22 + 0.28 * ix)
            ly = y0 + (y1 - y0) * (0.22 + 0.28 * iy)
            lights.append(
                add_parented_box(
                    f"IOM_Light_{ix}_{iy}",
                    Vector((lx - 0.18, ly - 0.18, z_ceil_bot - 0.04)),
                    Vector((lx + 0.18, ly + 0.18, z_ceil_bot + 0.01)),
                    emit,
                    frame,
                )
            )

    cad_names = [o.name for o in mesh_objects() if not o.name.startswith("IOM_")]
    for obj in list(mesh_objects()):
        if not obj.name.startswith("IOM_") and obj != frame:
            bpy.data.objects.remove(obj, do_unlink=True)

    bake_parented_meshes(frame)
    join_objects("IOM_WardrobeFins", [o for o in mesh_objects() if o.name.startswith("IOM_WardrobeFin_")])
    join_objects("IOM_Lights", [o for o in mesh_objects() if o.name.startswith("IOM_Light_")])

    report["remodeled"] = [o.name for o in mesh_objects()]
    report["removed_cad"] = cad_names
    print(f"[golden] room remodeled {report['remodeled']}", flush=True)


def mesh_min_dim(obj) -> float:
    mn, mx = world_aabb(obj)
    return min(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)


def is_open_shell(obj) -> bool:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.edges.ensure_lookup_table()
    boundary = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    faces = len(bm.faces)
    bm.free()
    return boundary > 0 and faces > 0


def solidify_thin_open(thickness: float, report: dict) -> None:
    done = []
    skipped = []
    for obj in list(mesh_objects()):
        if SKIP_SOLIDIFY.search(obj.name or ""):
            skipped.append(obj.name)
            continue
        if count_tris(obj) > 2500:
            skipped.append(obj.name)
            continue
        if not is_open_shell(obj):
            continue
        try:
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            mod = obj.modifiers.new("IOMSolidify", "SOLIDIFY")
            mod.thickness = thickness
            mod.offset = 0.0
            try:
                mod.use_even_offset = True
            except Exception:
                pass
            bpy.ops.object.modifier_apply(modifier=mod.name)
            done.append(obj.name)
        except Exception as err:
            skipped.append(f"{obj.name}:{err}")
            try:
                if "IOMSolidify" in obj.modifiers:
                    obj.modifiers.remove(obj.modifiers["IOMSolidify"])
            except Exception:
                pass
    report["solidified"] = done
    report["solidify_skipped"] = skipped


def uv_span(obj, layer_name: str) -> float:
    mesh = obj.data
    uv = mesh.uv_layers.get(layer_name)
    if not uv or not uv.data:
        return 0.0
    us = [loop.uv.x for loop in uv.data]
    vs = [loop.uv.y for loop in uv.data]
    if not us:
        return 0.0
    return max(max(us) - min(us), max(vs) - min(vs))


def repair_uv0():
    for obj in mesh_objects():
        mesh = obj.data
        if not mesh.uv_layers:
            mesh.uv_layers.new(name="UVMap")
        if mesh.uv_layers[0].name != "UVMap":
            mesh.uv_layers[0].name = "UVMap"
        span = uv_span(obj, "UVMap")
        needs = span > 10 or span < 0.04 or obj.name.startswith("IOM_")
        if not needs:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        mesh.uv_layers["UVMap"].active = True
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.uv.cube_project(cube_size=4.0, correct_aspect=True, scale_to_bounds=False)
        except Exception:
            try:
                bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.02)
            except Exception:
                pass
        bpy.ops.object.mode_set(mode="OBJECT")


def ensure_uv_layers():
    for obj in mesh_objects():
        mesh = obj.data
        if not mesh.uv_layers:
            mesh.uv_layers.new(name="UVMap")
        if mesh.uv_layers[0].name != "UVMap":
            mesh.uv_layers[0].name = "UVMap"
        if "Light" in obj.name or "Glass" in obj.name or "Glazing" in obj.name:
            continue
        for uv in list(mesh.uv_layers):
            if uv.name not in ("UVMap", "UVLightmap"):
                mesh.uv_layers.remove(uv)
        if "UVLightmap" not in mesh.uv_layers:
            mesh.uv_layers.new(name="UVLightmap")
        mesh.uv_layers["UVLightmap"].active = True
        try:
            mesh.uv_layers["UVMap"].active_render = True
        except Exception:
            pass


def lightmap_unwrap():
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [o for o in mesh_objects() if "Glass" not in o.name and "Glazing" not in o.name and "Light" not in o.name]
    for obj in meshes:
        obj.select_set(True)
    if not meshes:
        return
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.lightmap_pack(
            PREF_CONTEXT="ALL_FACES",
            PREF_PACK_IN_ONE=True,
            PREF_IMG_PX_SIZE=2048,
            PREF_MARGIN_DIV=16,
        )
    except Exception:
        bpy.ops.uv.smart_project(angle_limit=66.0, island_margin=0.04)
    try:
        bpy.ops.uv.pack_islands(margin=0.01)
    except Exception:
        pass
    bpy.ops.object.mode_set(mode="OBJECT")


def enable_cycles(scene, samples: int):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for compute in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = compute
                prefs.get_devices()
                devices = getattr(prefs, "devices", [])
                if not devices:
                    continue
                for d in devices:
                    d.use = True
                scene.cycles.device = "GPU"
                print(f"[golden] Cycles device GPU ({compute})", flush=True)
                return
            except Exception:
                continue
    except Exception:
        pass
    print("[golden] Cycles device CPU", flush=True)


def setup_interior_world(scene, envelope):
    world = bpy.data.worlds.new("IOMInteriorWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.42, 0.40, 0.38, 1.0)
        bg.inputs[1].default_value = 0.18
    # Weak sun through the door opening.
    sun = bpy.data.lights.new("IOMSunSpill", "SUN")
    sun.energy = 1.6
    sun.angle = 0.012
    sun_obj = bpy.data.objects.new("IOMSunSpill", sun)
    sun_obj.rotation_euler = (1.05, 0.05, 0.4)
    scene.collection.objects.link(sun_obj)
    mn, mx = envelope["min"], envelope["max"]
    z = mx[2] - 0.35
    idx = 0
    for ix in range(3):
        for iy in range(3):
            lamp = bpy.data.lights.new(f"IOMArea{idx}", "AREA")
            lamp.energy = 180
            lamp.size = 1.4
            lamp.color = (1.0, 0.96, 0.90)
            obj = bpy.data.objects.new(f"IOMArea{idx}", lamp)
            obj.location = (
                mn[0] + (mx[0] - mn[0]) * (0.22 + 0.28 * ix),
                mn[1] + (mx[1] - mn[1]) * (0.22 + 0.28 * iy),
                z,
            )
            obj.rotation_euler = (3.14159, 0.0, 0.0)
            scene.collection.objects.link(obj)
            idx += 1


def setup_world_and_sun(scene):
    world = bpy.data.worlds.new("IOMWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.55, 0.62, 0.72, 1.0)
        bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("IOMSun", "SUN")
    sun.energy = 4.5
    sun.angle = 0.009
    sun_obj = bpy.data.objects.new("IOMSun", sun)
    sun_obj.rotation_euler = (0.85, 0.15, 0.7)
    scene.collection.objects.link(sun_obj)


def setup_bake_image(size: int):
    img = bpy.data.images.new("IOMLightmap", width=size, height=size, alpha=False, float_buffer=True)
    for cs in ("Linear Rec.709", "Non-Color", "Linear"):
        try:
            img.colorspace_settings.name = cs
            break
        except Exception:
            continue
    for mat in bpy.data.materials:
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.select = True
        nodes.active = tex
        mat.use_backface_culling = False
    return img


def bake(scene, samples: int):
    enable_cycles(scene, samples)
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 16
    try:
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass
    meshes = [o for o in mesh_objects() if "Glass" not in o.name and "Glazing" not in o.name and "Light" not in o.name]
    if not meshes:
        raise SystemExit("No meshes left to bake")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects():
        skip = "Glass" in obj.name or "Glazing" in obj.name or "Light" in obj.name
        obj.select_set(not skip)
        obj.hide_set(False)
        obj.hide_render = False
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.context.view_layer.update()
    # Re-assert bake target on every material (UV edits can clear the active node).
    img = bpy.data.images.get("IOMLightmap")
    if img:
        for mat in bpy.data.materials:
            if not mat.node_tree:
                continue
            for node in mat.node_tree.nodes:
                if getattr(node, "image", None) is img:
                    node.select = True
                    mat.node_tree.nodes.active = node
    view = bpy.context.view_layer
    with bpy.context.temp_override(
        selected_objects=meshes,
        object=meshes[0],
        active_object=meshes[0],
        view_layer=view,
        scene=scene,
    ):
        bpy.ops.object.bake(type="DIFFUSE")


def strip_bake_nodes(img):
    for mat in bpy.data.materials:
        tree = getattr(mat, "node_tree", None)
        if not tree:
            continue
        for node in list(tree.nodes):
            if getattr(node, "image", None) is img:
                tree.nodes.remove(node)


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
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB")


def main():
    args = parse_args()
    src = Path(args.input)
    dst = Path(args.output)
    lightmap = Path(args.lightmap)
    if not src.exists():
        raise SystemExit(f"Missing input: {src}")
    bmin = parse_vec3(args.min)
    bmax = parse_vec3(args.max)
    if bmin and bmax:
        bmin, bmax = gltf_aabb_to_blender(bmin, bmax)
        print(f"[golden] blender crop {bmin} .. {bmax}", flush=True)

    report = {
        "input": str(src),
        "output": str(dst),
        "lightmap": str(lightmap),
        "blender": bpy.app.version_string,
        "ok": False,
        "clip": {"min": bmin, "max": bmax} if bmin and bmax else None,
    }
    reset_scene()
    print(f"[golden] import {src}", flush=True)
    bpy.ops.import_scene.gltf(filepath=str(src))
    report["mesh_objects_before"] = len(mesh_objects())
    report["tris_before"] = sum(count_tris(o) for o in mesh_objects())
    if bmin and bmax:
        print("[golden] clip to crop AABB", flush=True)
        clip_kept = {}
        for obj in list(mesh_objects()):
            clip_kept[obj.name] = clip_to_box(obj, bmin, bmax)
        report["clip_faces"] = clip_kept
        print(f"[golden] clip faces {clip_kept}", flush=True)
        if sum(clip_kept.values()) == 0:
            raise SystemExit("Clip removed every face — crop space is probably wrong")
    apply_transforms()
    drop_empty_and_duplicates(report)
    for obj in mesh_objects():
        clean_mesh(obj, args.min_area)
    if args.remodel:
        print("[golden] remodel CAD → solid architecture", flush=True)
        remodel_as_architecture(report, bmin, bmax)
    elif args.remodel_room:
        print("[golden] remodel CAD → interior room", flush=True)
        remodel_as_room(report, bmin, bmax)
    elif args.solidify > 0:
        print(f"[golden] solidify thin open shells {args.solidify}m", flush=True)
        solidify_thin_open(args.solidify, report)
        for obj in mesh_objects():
            clean_mesh(obj, args.min_area)
    print("[golden] repair UV0", flush=True)
    repair_uv0()
    ensure_uv_layers()
    lightmap_unwrap()
    if args.remodel_room:
        setup_interior_world(bpy.context.scene, report["remodel_envelope"])
    else:
        setup_world_and_sun(bpy.context.scene)
    img = setup_bake_image(args.size)
    print(f"[golden] Cycles bake {args.size}px / {args.samples} samples", flush=True)
    bake(bpy.context.scene, args.samples)
    lightmap.parent.mkdir(parents=True, exist_ok=True)
    img.filepath_raw = str(lightmap)
    img.file_format = "PNG"
    img.save()
    strip_bake_nodes(img)
    print(f"[golden] export {dst}", flush=True)
    export_glb(str(dst))
    report["mesh_objects"] = len(mesh_objects())
    report["kept_names"] = [o.name for o in mesh_objects()]
    report["tris_after"] = sum(count_tris(o) for o in mesh_objects())
    report["lightmap_bytes"] = lightmap.stat().st_size if lightmap.exists() else 0
    report["output_bytes"] = dst.stat().st_size if dst.exists() else 0
    report["ok"] = dst.exists() and lightmap.exists()
    report_path = Path(args.report) if args.report else dst.with_suffix(".json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
