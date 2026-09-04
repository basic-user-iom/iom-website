"""Fail-closed Blender repair for audited closed ICM architectural meshes.

Each target is bound to its exact source object name and source
vertex/triangle fingerprint. A candidate is certified only after the repaired
Blender mesh and the exported/re-imported GLB representation both audit as
closed, manifold, consistently wound, and free of loose edges.

Usage:
  blender --background --factory-startup \
    --python scripts/blender-repair-architectural-surfaces.py -- \
    --input tmp/icm-anim-2025-cleaned.glb \
    --output tmp/blender-surface-cleanup/icm-anim-repaired.glb \
    --report tmp/blender-surface-cleanup/blender-report.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
import traceback
from pathlib import Path

import bpy
import bmesh


CERTIFIED_FLAG = "iomSurfaceTopologyRepaired"
CERTIFIED_VERSION_KEY = "iomSurfaceTopologyRepair"
CERTIFIED_VERSION = "weld-seams-recalculate-normals-v1"

# Exact identities and fingerprints from tmp/icm-anim-2025-cleaned.glb.
# Keep both fassade003.001 and fassade_003.001: their former canonical names
# collide, but they are independently audited and intentionally repaired.
TARGET_SPECS = (
    {"name": "BT1_Kabinen_wnde24", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT1_Kabinen_wnde31", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT1_Kabinen_wnde34", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT1_Kabinen_wnde43", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT1_Kabinen_wnde50", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT1_Kabinen_wnde57", "vertices": 2046, "triangles": 2816, "accepted": True},
    {"name": "BT3_innenwaende.002", "vertices": 129, "triangles": 67, "accepted": False},
    {"name": "BT3_innenwaende.006", "vertices": 212, "triangles": 112, "accepted": False},
    {"name": "Buhne_aufbau_decke", "vertices": 184, "triangles": 172, "accepted": True},
    {"name": "EG_decke_bergang_aussen", "vertices": 48, "triangles": 28, "accepted": True},
    {"name": "Foyer_Dach_aussen_002", "vertices": 48, "triangles": 36, "accepted": True},
    {"name": "Foyer_Dach_aussen_1", "vertices": 96, "triangles": 52, "accepted": True},
    {"name": "S11_trennwand", "vertices": 1226, "triangles": 612, "accepted": True},
    {"name": "S12_trennwand", "vertices": 1226, "triangles": 612, "accepted": True},
    {"name": "S21_trennwand", "vertices": 1226, "triangles": 612, "accepted": True},
    {"name": "S22_trennwand", "vertices": 1226, "triangles": 612, "accepted": True},
    {"name": "Wand_40.005", "vertices": 166, "triangles": 92, "accepted": True},
    {"name": "Wand_bt1_001.002", "vertices": 462, "triangles": 244, "accepted": True},
    {"name": "fassade003.001", "vertices": 24, "triangles": 12, "accepted": True},
    {"name": "fassade005.002", "vertices": 24, "triangles": 12, "accepted": True},
    {"name": "fassade008.002", "vertices": 24, "triangles": 12, "accepted": True},
    {"name": "fassade_001.001", "vertices": 24, "triangles": 12, "accepted": True},
    {"name": "fassade_001.003", "vertices": 24, "triangles": 12, "accepted": True},
    {"name": "fassade_003.001", "vertices": 90, "triangles": 44, "accepted": True},
    {"name": "fassade_buero_1", "vertices": 83, "triangles": 58, "accepted": True},
    {"name": "fassade_buero_1.001", "vertices": 86, "triangles": 64, "accepted": True},
    {"name": "fassade_buero_2", "vertices": 370, "triangles": 396, "accepted": True},
    {"name": "fassade_buero_2.001", "vertices": 373, "triangles": 396, "accepted": True},
    {"name": "og_waendeInnen_01", "vertices": 2062, "triangles": 1428, "accepted": True},
    {"name": "saal1_waende.004", "vertices": 144, "triangles": 92, "accepted": True},
)

EXPECTED_ANIMATED_OBJECTS = {
    "Ground Floor._anim1",
    "1st Floor._anim1",
    "2st Floor._anim1",
    "Mezzanine._anim1",
    "Ceiling._anim1",
}
EXPECTED_ANIMATION_DURATION_SECONDS = 2.708333
EXPECTED_TARGET_COUNT = 30
EXPECTED_ACCEPTED_COUNT = 28
EXPECTED_REJECTED_COUNT = 2
EXPECTED_SOURCE_INVENTORY = {
    "objects": 8140,
    "meshObjects": 7889,
    "meshes": 4274,
    "materials": 424,
    "images": 153,
    "triangles": 13638673,
    "actions": ["Animation"],
}
# glTF may split a logical vertex at an attribute or material seam. Rejoin only
# byte-equivalent/round-off-equivalent positions for the exported logical-mesh
# audit; never reuse the much larger repair tolerance here.
EXPORT_LOGICAL_WELD_DISTANCE = 1e-7
SIGNATURE_KEYS = (
    "objects",
    "meshObjects",
    "meshes",
    "materials",
    "images",
    "actions",
    "animatedObjects",
    "triangles",
    "hierarchySha256",
    "objectInventorySha256",
    "meshInventorySha256",
    "materialInventorySha256",
    "imageInventorySha256",
    "animationDetails",
)


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1 :] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--merge-ratio", type=float, default=1e-6)
    parser.add_argument("--min-merge-distance", type=float, default=1e-7)
    parser.add_argument("--max-merge-distance", type=float, default=1e-4)
    parser.add_argument(
        "--target",
        action="append",
        default=[],
        help="Exact object name from the built-in audited target list",
    )
    return parser.parse_args(argv)


def require_operator_finished(label: str, result):
    if "FINISHED" not in set(result or ()):
        raise RuntimeError(f"Blender operator {label} did not finish: {result!r}")


def reset_scene():
    require_operator_finished(
        "read_factory_settings",
        bpy.ops.wm.read_factory_settings(use_empty=True),
    )
    try:
        bpy.context.preferences.edit.undo_steps = 0
    except Exception:
        pass
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def import_glb(path: Path):
    require_operator_finished(
        f"import_scene.gltf({path})",
        bpy.ops.import_scene.gltf(filepath=str(path)),
    )


def count_triangles(mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def mesh_diagonal(mesh) -> float:
    if not mesh.vertices:
        return 0.0
    minimum = [math.inf, math.inf, math.inf]
    maximum = [-math.inf, -math.inf, -math.inf]
    for vertex in mesh.vertices:
        for axis in range(3):
            value = vertex.co[axis]
            minimum[axis] = min(minimum[axis], value)
            maximum[axis] = max(maximum[axis], value)
    return math.sqrt(
        sum((maximum[axis] - minimum[axis]) ** 2 for axis in range(3))
    )


def bmesh_topology(bm) -> dict:
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.verts.index_update()
    boundary = 0
    non_manifold = 0
    winding_conflicts = 0
    loose_edges = 0
    for edge in bm.edges:
        linked = list(edge.link_faces)
        if len(linked) == 0:
            loose_edges += 1
        elif len(linked) == 1:
            boundary += 1
        elif len(linked) > 2:
            non_manifold += 1
        else:
            directions = []
            for face in linked:
                for loop in face.loops:
                    if loop.edge == edge:
                        directions.append(
                            (loop.vert.index, loop.link_loop_next.vert.index)
                        )
                        break
            if len(directions) == 2 and directions[0] == directions[1]:
                winding_conflicts += 1
    return {
        "vertices": len(bm.verts),
        "edges": len(bm.edges),
        "faces": len(bm.faces),
        "boundaryEdges": boundary,
        "nonManifoldEdges": non_manifold,
        "windingConflictEdges": winding_conflicts,
        "looseEdges": loose_edges,
    }


def topology_clean(topology: dict) -> bool:
    return bool(
        topology["faces"] > 0
        and topology["boundaryEdges"] == 0
        and topology["nonManifoldEdges"] == 0
        and topology["windingConflictEdges"] == 0
        and topology["looseEdges"] == 0
    )


def audit_mesh(mesh, weld_distance: float = 0.0) -> dict:
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        if weld_distance > 0 and bm.verts:
            bmesh.ops.remove_doubles(
                bm, verts=list(bm.verts), dist=weld_distance
            )
        return bmesh_topology(bm)
    finally:
        bm.free()


def repair_mesh(mesh, merge_distance: float) -> dict:
    triangles_before = count_triangles(mesh)
    original_vertices = len(mesh.vertices)
    original_faces = len(mesh.polygons)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    before = bmesh_topology(bm)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=merge_distance)
    zero_area = [face for face in bm.faces if face.calc_area() <= 1e-12]
    if zero_area:
        bmesh.ops.delete(bm, geom=zero_area, context="FACES")
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    after_bmesh = bmesh_topology(bm)
    if topology_clean(after_bmesh):
        bm.to_mesh(mesh)
        mesh.update()
    bm.free()

    after_validate = None
    validate_changed = False
    if topology_clean(after_bmesh):
        validate_changed = bool(mesh.validate(clean_customdata=False))
        mesh.update()
        after_validate = audit_mesh(mesh)
    accepted = bool(after_validate and topology_clean(after_validate))
    result = {
        "accepted": accepted,
        "mergeDistance": merge_distance,
        "verticesBefore": original_vertices,
        "facesBefore": original_faces,
        "trianglesBefore": triangles_before,
        "weldedVertices": original_vertices - after_bmesh["vertices"],
        "zeroAreaFacesRemoved": len(zero_area),
        "meshValidateChanged": validate_changed,
        "topologyBefore": before,
        "topologyAfterBMesh": after_bmesh,
        "topologyAfterValidate": after_validate,
    }
    if accepted:
        result.update(
            {
                "verticesAfter": len(mesh.vertices),
                "facesAfter": len(mesh.polygons),
                "trianglesAfter": count_triangles(mesh),
            }
        )
    return result


def sha256_rows(rows) -> str:
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def action_fcurves(action) -> list:
    """Return legacy and layered-action FCurves without creating channel bags."""
    curves = []
    seen = set()

    def append_curve(curve):
        pointer = curve.as_pointer()
        if pointer not in seen:
            seen.add(pointer)
            curves.append(curve)

    for curve in list(getattr(action, "fcurves", []) or []):
        append_curve(curve)

    slots = list(getattr(action, "slots", []) or [])
    for layer in list(getattr(action, "layers", []) or []):
        for strip in list(getattr(layer, "strips", []) or []):
            channelbags = getattr(strip, "channelbags", None)
            if channelbags is not None:
                for channelbag in list(channelbags or []):
                    for curve in list(getattr(channelbag, "fcurves", []) or []):
                        append_curve(curve)
                continue
            channelbag_for_slot = getattr(strip, "channelbag", None)
            if not callable(channelbag_for_slot):
                continue
            for slot in slots:
                try:
                    channelbag = channelbag_for_slot(slot, ensure=False)
                except TypeError:
                    channelbag = channelbag_for_slot(slot)
                if channelbag is None:
                    continue
                for curve in list(getattr(channelbag, "fcurves", []) or []):
                    append_curve(curve)
    return curves


def animation_details() -> list:
    fps = bpy.context.scene.render.fps / max(
        1e-9, bpy.context.scene.render.fps_base
    )
    details = []
    for action in bpy.data.actions:
        start, end = action.frame_range
        curves = action_fcurves(action)
        non_constant = 0
        for curve in curves:
            values = [point.co[1] for point in curve.keyframe_points]
            if values and any(abs(value - values[0]) > 1e-8 for value in values[1:]):
                non_constant += 1
        details.append(
            {
                "name": action.name,
                "frameStart": float(start),
                "frameEnd": float(end),
                "durationSeconds": float(end - start) / fps,
                "curves": len(curves),
                "nonConstantCurves": non_constant,
            }
        )
    return sorted(details, key=lambda row: row["name"])


def scene_signature() -> dict:
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    animated_objects = []
    for obj in objects:
        animation_data = getattr(obj, "animation_data", None)
        action = getattr(animation_data, "action", None) if animation_data else None
        if action:
            animated_objects.append({"object": obj.name, "action": action.name})
    hierarchy = sorted(
        (obj.name, obj.type, obj.parent.name if obj.parent else None) for obj in objects
    )
    object_inventory = sorted(
        (
            obj.name,
            obj.type,
            getattr(getattr(obj, "data", None), "name", None),
        )
        for obj in objects
    )
    return {
        "objects": len(objects),
        "meshObjects": len(meshes),
        "meshes": len(bpy.data.meshes),
        "materials": len(bpy.data.materials),
        "images": len(bpy.data.images),
        "actions": sorted(action.name for action in bpy.data.actions),
        "animatedObjects": sorted(animated_objects, key=lambda row: row["object"]),
        "triangles": sum(count_triangles(obj.data) for obj in meshes),
        "hierarchySha256": sha256_rows(hierarchy),
        "objectInventorySha256": sha256_rows(object_inventory),
        "meshInventorySha256": sha256_rows(sorted(mesh.name for mesh in bpy.data.meshes)),
        "materialInventorySha256": sha256_rows(
            sorted(material.name for material in bpy.data.materials)
        ),
        # Blender's glTF round-trip may rename image datablocks while retaining
        # the exact texture inventory. Dimensions/channels/source/format are
        # stable release invariants; object/material names remain exact above.
        "imageInventorySha256": sha256_rows(
            sorted(
                (
                    int(image.size[0]),
                    int(image.size[1]),
                    int(image.channels),
                    image.source,
                    image.file_format,
                )
                for image in bpy.data.images
            )
        ),
        "animationDetails": animation_details(),
    }


def compare_signatures(label: str, expected: dict, actual: dict) -> list:
    failures = []
    for key in SIGNATURE_KEYS:
        if expected.get(key) != actual.get(key):
            failures.append(
                f"{label} inventory mismatch for {key}: "
                f"{expected.get(key)!r} != {actual.get(key)!r}"
            )
    return failures


def validate_source_inventory(signature: dict) -> list:
    failures = []
    for key, expected in EXPECTED_SOURCE_INVENTORY.items():
        actual = signature.get(key)
        if actual != expected:
            failures.append(
                f"Source baseline mismatch for {key}: {actual!r} != {expected!r}"
            )
    return failures


def validate_expected_animation(label: str, signature: dict) -> list:
    failures = []
    owner_actions = {
        row["object"]: row["action"] for row in signature["animatedObjects"]
    }
    expected_owner_actions = {
        owner: "Animation" for owner in EXPECTED_ANIMATED_OBJECTS
    }
    if owner_actions != expected_owner_actions:
        failures.append(
            f"{label} animated owner/action mapping mismatch: {owner_actions!r}"
        )
    details = [
        row for row in signature["animationDetails"] if row["name"] == "Animation"
    ]
    if len(details) != 1:
        failures.append(f"{label} expected exactly one Animation action")
    elif (
        abs(
            details[0]["durationSeconds"]
            - EXPECTED_ANIMATION_DURATION_SECONDS
        )
        > 0.001
    ):
        failures.append(
            f"{label} Animation duration is {details[0]['durationSeconds']} seconds"
        )
    elif details[0]["curves"] <= 0 or details[0]["nonConstantCurves"] <= 0:
        failures.append(
            f"{label} Animation has no preserved non-constant FCurve channels: "
            f"{details[0]!r}"
        )
    return failures


def clear_certificate(obj):
    for key in (CERTIFIED_FLAG, CERTIFIED_VERSION_KEY):
        if key in obj:
            del obj[key]


def exact_certificate(obj) -> bool:
    return bool(
        obj is not None
        and obj.get(CERTIFIED_FLAG) is True
        and obj.get(CERTIFIED_VERSION_KEY) == CERTIFIED_VERSION
    )


def has_any_certificate(obj) -> bool:
    return bool(
        obj is not None
        and (CERTIFIED_FLAG in obj or CERTIFIED_VERSION_KEY in obj)
    )


def export_glb(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    require_operator_finished(
        f"export_scene.gltf({path})",
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLB",
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            export_materials="EXPORT",
            export_animations=True,
            export_cameras=False,
            export_lights=False,
            export_extras=True,
            export_apply=False,
        ),
    )


def make_staged_output_path(output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(
        prefix=f".{output.stem}-validation-",
        suffix=".glb",
        dir=str(output.parent),
    )
    os.close(descriptor)
    staged = Path(name)
    staged.unlink()
    return staged


def write_report(path: Path, report: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")


def main():
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    staged_output = None
    output_published = False
    report = {
        "schema": "iom-blender-architectural-surface-repair-v2",
        "ok": False,
        "blender": bpy.app.version_string,
        "input": str(source),
        "output": str(output),
        "failures": [],
    }
    try:
        if not source.exists():
            raise RuntimeError(f"Missing input: {source}")
        if source == output:
            raise RuntimeError("Input and output must differ")
        if report_path in (source, output):
            raise RuntimeError("Report, input, and output paths must all differ")
        report["outputExistedBeforeRun"] = output.exists()
        specs_by_name = {spec["name"]: spec for spec in TARGET_SPECS}
        if len(specs_by_name) != len(TARGET_SPECS):
            raise RuntimeError("Duplicate exact object name in TARGET_SPECS")
        if len(TARGET_SPECS) != EXPECTED_TARGET_COUNT:
            raise RuntimeError(
                f"TARGET_SPECS contains {len(TARGET_SPECS)} entries; "
                f"expected {EXPECTED_TARGET_COUNT}"
            )
        configured_accepted = sum(
            1 for spec in TARGET_SPECS if spec["accepted"]
        )
        configured_rejected = len(TARGET_SPECS) - configured_accepted
        if (
            configured_accepted != EXPECTED_ACCEPTED_COUNT
            or configured_rejected != EXPECTED_REJECTED_COUNT
        ):
            raise RuntimeError(
                "TARGET_SPECS disposition count mismatch: "
                f"accepted={configured_accepted}, rejected={configured_rejected}"
            )
        if args.target:
            requested = set(args.target)
            unknown = sorted(requested - set(specs_by_name))
            if unknown:
                raise RuntimeError(
                    f"Unknown exact audited target(s): {', '.join(unknown)}"
                )
            if len(requested) != len(args.target):
                raise RuntimeError("Duplicate --target values are not allowed")
            missing = sorted(set(specs_by_name) - requested)
            if missing:
                raise RuntimeError(
                    "Partial --target runs cannot produce a certified output; "
                    "missing exact targets: " + ", ".join(missing)
                )
        specs = list(TARGET_SPECS)
        target_names = {spec["name"] for spec in specs}
        report["targets"] = specs

        reset_scene()
        print(f"[iom-surface-repair] import {source}", flush=True)
        import_glb(source)
        before_signature = scene_signature()
        report["before"] = before_signature
        report["failures"].extend(validate_source_inventory(before_signature))
        report["failures"].extend(
            validate_expected_animation("source", before_signature)
        )

        all_objects = list(bpy.context.scene.objects)
        matches_by_name = {
            name: [obj for obj in all_objects if obj.name == name]
            for name in target_names
        }
        match_counts = {
            name: len(matches) for name, matches in matches_by_name.items()
        }
        report["expectedMatchCounts"] = {
            name: 1 for name in sorted(target_names)
        }
        report["actualMatchCounts"] = dict(sorted(match_counts.items()))
        for name, count in match_counts.items():
            if count != 1:
                report["failures"].append(
                    f"Exact target {name!r} matched {count} objects; expected 1"
                )
        if report["failures"]:
            raise RuntimeError("Source identity or animation preflight failed")

        matched = [matches_by_name[spec["name"]][0] for spec in specs]
        fingerprints = []
        for spec, obj in zip(specs, matched):
            if obj.type != "MESH" or getattr(obj, "data", None) is None:
                fingerprints.append(
                    {"name": obj.name, "type": obj.type, "vertices": None, "triangles": None}
                )
                report["failures"].append(
                    f"Exact target {obj.name!r} is {obj.type}, expected MESH"
                )
                continue
            actual = {
                "name": obj.name,
                "type": obj.type,
                "vertices": len(obj.data.vertices),
                "triangles": count_triangles(obj.data),
            }
            fingerprints.append(actual)
            if (
                actual["vertices"] != spec["vertices"]
                or actual["triangles"] != spec["triangles"]
            ):
                report["failures"].append(
                    f"Fingerprint mismatch for {obj.name}: {actual} != "
                    f"vertices={spec['vertices']}, triangles={spec['triangles']}"
                )
        report["sourceFingerprints"] = fingerprints
        if report["failures"]:
            raise RuntimeError("Source target fingerprint preflight failed")

        stale_non_targets = sorted(
            obj.name
            for obj in all_objects
            if obj.name not in target_names and has_any_certificate(obj)
        )
        if stale_non_targets:
            report["failures"].append(
                "Unexpected surface-repair certificate(s) on non-targets: "
                + ", ".join(stale_non_targets)
            )
            raise RuntimeError("Unexpected non-target certificates")
        stale_target_certificates = sorted(
            obj.name for obj in matched if has_any_certificate(obj)
        )
        for obj in matched:
            clear_certificate(obj)
        uncleared_target_certificates = sorted(
            obj.name for obj in matched if has_any_certificate(obj)
        )
        report["staleTargetCertificatesRemoved"] = stale_target_certificates
        if uncleared_target_certificates:
            report["failures"].append(
                "Could not clear stale target certificate(s): "
                + ", ".join(uncleared_target_certificates)
            )
            raise RuntimeError("Stale target certificate removal failed")

        users_by_mesh = {}
        for obj in mesh_objects():
            users_by_mesh.setdefault(obj.data, []).append(obj)
        isolated = 0
        for data, users in list(users_by_mesh.items()):
            selected = [obj for obj in users if obj.name in target_names]
            if selected and len(selected) != len(users):
                repaired_copy = data.copy()
                repaired_copy.name = f"{data.name}__IOM_SURFACE_REPAIR"
                for obj in selected:
                    obj.data = repaired_copy
                isolated += 1

        rows = []
        accepted_objects = []
        rejected_objects = []
        processed_meshes = set()
        for obj in matched:
            mesh = obj.data
            if mesh in processed_meshes:
                continue
            processed_meshes.add(mesh)
            owners = sorted(
                candidate.name for candidate in matched if candidate.data == mesh
            )
            source_mesh_name = mesh.name
            backup = mesh.copy()
            diagonal = mesh_diagonal(mesh)
            merge_distance = min(
                args.max_merge_distance,
                max(args.min_merge_distance, diagonal * args.merge_ratio),
            )
            result = repair_mesh(mesh, merge_distance)
            result.update({"mesh": mesh.name, "objects": owners, "diagonal": diagonal})
            if result["accepted"]:
                for owner_name in owners:
                    owner = bpy.data.objects.get(owner_name)
                    owner[CERTIFIED_FLAG] = True
                    owner[CERTIFIED_VERSION_KEY] = CERTIFIED_VERSION
                accepted_objects.extend(owners)
                bpy.data.meshes.remove(backup)
            else:
                for owner_name in owners:
                    owner = bpy.data.objects.get(owner_name)
                    owner.data = backup
                    clear_certificate(owner)
                rejected_objects.extend(owners)
                if mesh.users == 0:
                    bpy.data.meshes.remove(mesh)
                backup.name = source_mesh_name
            rows.append(result)
            status = "PASS" if result["accepted"] else "REJECT"
            topology = result["topologyAfterValidate"] or result["topologyAfterBMesh"]
            print(
                f"  [{status}] {', '.join(owners)}: "
                f"b={topology['boundaryEdges']} nm={topology['nonManifoldEdges']} "
                f"w={topology['windingConflictEdges']} loose={topology['looseEdges']}",
                flush=True,
            )

        expected_accepted = sorted(
            spec["name"] for spec in specs if spec["accepted"]
        )
        expected_rejected = sorted(
            spec["name"] for spec in specs if not spec["accepted"]
        )
        if (
            len(expected_accepted) != EXPECTED_ACCEPTED_COUNT
            or len(expected_rejected) != EXPECTED_REJECTED_COUNT
        ):
            report["failures"].append(
                "Expected repair disposition inventory changed unexpectedly"
            )
        if sorted(accepted_objects) != expected_accepted:
            report["failures"].append(
                f"Accepted object inventory mismatch: {sorted(accepted_objects)} "
                f"!= {expected_accepted}"
            )
        if sorted(rejected_objects) != expected_rejected:
            report["failures"].append(
                f"Rejected object inventory mismatch: {sorted(rejected_objects)} "
                f"!= {expected_rejected}"
            )
        certified_before_export = sorted(
            obj.name for obj in bpy.context.scene.objects if exact_certificate(obj)
        )
        invalid_certificate_objects = sorted(
            obj.name
            for obj in bpy.context.scene.objects
            if has_any_certificate(obj) and not exact_certificate(obj)
        )
        if certified_before_export != expected_accepted:
            report["failures"].append(
                "Pre-export certificate inventory does not equal accepted targets"
            )
        if invalid_certificate_objects:
            report["failures"].append(
                f"Invalid pre-export certificates: {invalid_certificate_objects}"
            )
        for name in expected_rejected:
            restored = bpy.data.objects.get(name)
            if has_any_certificate(restored):
                report["failures"].append(
                    f"Rejected target {name} retained a certificate"
                )
            spec = specs_by_name[name]
            if restored is None or restored.type != "MESH":
                report["failures"].append(
                    f"Rejected target {name} was not restored as one mesh object"
                )
                continue
            restored_fingerprint = {
                "vertices": len(restored.data.vertices),
                "triangles": count_triangles(restored.data),
            }
            expected_fingerprint = {
                "vertices": spec["vertices"],
                "triangles": spec["triangles"],
            }
            if restored_fingerprint != expected_fingerprint:
                report["failures"].append(
                    f"Rejected target {name} was not restored unchanged: "
                    f"{restored_fingerprint} != {expected_fingerprint}"
                )

        after_signature = scene_signature()
        report["failures"].extend(
            compare_signatures("post-repair", before_signature, after_signature)
        )
        report["failures"].extend(
            validate_expected_animation("post-repair", after_signature)
        )
        report.update(
            {
                "matchedObjects": sorted(obj.name for obj in matched),
                "acceptedObjects": sorted(accepted_objects),
                "rejectedObjects": sorted(rejected_objects),
                "isolatedSharedMeshes": isolated,
                "certificateObjectsBeforeExport": certified_before_export,
                "after": after_signature,
                "repairs": rows,
            }
        )
        if report["failures"]:
            raise RuntimeError("Post-repair fail-closed gate failed")

        staged_output = make_staged_output_path(output)
        print(
            f"[iom-surface-repair] validation export {staged_output}",
            flush=True,
        )
        export_glb(staged_output)
        if not staged_output.exists() or staged_output.stat().st_size <= 0:
            report["failures"].append("GLB export did not produce a non-empty file")
            raise RuntimeError("GLB export failed")
        report["outputBytes"] = staged_output.stat().st_size

        reset_scene()
        print(f"[iom-surface-repair] re-import {staged_output}", flush=True)
        import_glb(staged_output)
        exported_signature = scene_signature()
        report["exported"] = exported_signature
        report["failures"].extend(
            compare_signatures("exported GLB", before_signature, exported_signature)
        )
        report["failures"].extend(
            validate_expected_animation("exported GLB", exported_signature)
        )

        exported_matches = {
            name: [obj for obj in bpy.context.scene.objects if obj.name == name]
            for name in target_names
        }
        for name, objects in exported_matches.items():
            if len(objects) != 1:
                report["failures"].append(
                    f"Exported exact target {name!r} matched {len(objects)} objects"
                )
            elif objects[0].type != "MESH":
                report["failures"].append(
                    f"Exported exact target {name!r} is {objects[0].type}, expected MESH"
                )
        exported_certificates = sorted(
            obj.name for obj in bpy.context.scene.objects if exact_certificate(obj)
        )
        exported_invalid_certificates = sorted(
            obj.name
            for obj in bpy.context.scene.objects
            if has_any_certificate(obj) and not exact_certificate(obj)
        )
        if exported_certificates != expected_accepted:
            report["failures"].append(
                f"Exported certificate inventory {exported_certificates} "
                f"!= accepted inventory {expected_accepted}"
            )
        if len(exported_certificates) != len(expected_accepted):
            report["failures"].append(
                "Exported certificate count does not equal accepted count"
            )
        if exported_invalid_certificates:
            report["failures"].append(
                f"Invalid exported certificates: {exported_invalid_certificates}"
            )

        exported_audits = []
        for name in expected_accepted:
            objects = exported_matches.get(name, [])
            if len(objects) != 1 or objects[0].type != "MESH":
                continue
            raw_topology = audit_mesh(objects[0].data)
            logical_topology = audit_mesh(
                objects[0].data, EXPORT_LOGICAL_WELD_DISTANCE
            )
            exported_audits.append(
                {
                    "object": name,
                    "rawTopology": raw_topology,
                    "logicalTopology": logical_topology,
                    "logicalWeldDistance": EXPORT_LOGICAL_WELD_DISTANCE,
                }
            )
            if not topology_clean(logical_topology):
                report["failures"].append(
                    f"Exported repaired logical topology failed for {name}: "
                    f"{logical_topology} (raw={raw_topology})"
                )
        for name in expected_rejected:
            objects = exported_matches.get(name, [])
            if len(objects) == 1 and has_any_certificate(objects[0]):
                report["failures"].append(
                    f"Exported rejected target {name} has a certificate"
                )
        report["exportedCertificateObjects"] = exported_certificates
        report["exportedTopologyAudits"] = exported_audits
        report["safety"] = {
            "inputOverwritten": False,
            "exactObjectIdentities": True,
            "sourceFingerprintsVerified": True,
            "staleTargetCertificatesCleared": True,
            "meshValidateReaudited": True,
            "exportReimportAudited": True,
            "rejectedRepairsRestored": True,
            "outputPublishedOnlyAfterValidation": True,
        }
        if report["failures"]:
            report["ok"] = False
            write_report(report_path, report)
            raise RuntimeError(
                f"Fail-closed validation reported {len(report['failures'])} failure(s)"
            )
        # Only the byte-for-byte file that passed the re-import topology,
        # inventory, animation, hierarchy, and certificate gates may replace
        # the requested output. A failed run leaves any prior known-good output
        # untouched and removes its private validation export in the handler.
        os.replace(staged_output, output)
        staged_output = None
        output_published = True
        report["outputPublished"] = True
        report["ok"] = True
        write_report(report_path, report)
        print(
            json.dumps(
                {
                    "ok": True,
                    "accepted": len(accepted_objects),
                    "rejected": len(rejected_objects),
                    "certificates": len(exported_certificates),
                    "outputBytes": report["outputBytes"],
                },
                indent=2,
            ),
            flush=True,
        )
        print(f"[iom-surface-repair] report {report_path}", flush=True)
    except Exception as error:
        if staged_output is not None and staged_output.exists():
            try:
                staged_output.unlink()
            except OSError as cleanup_error:
                report["failures"].append(
                    f"Could not remove failed validation export {staged_output}: "
                    f"{cleanup_error}"
                )
        if (
            str(error) not in report["failures"]
            and not str(error).startswith("Fail-closed validation reported")
        ):
            report["failures"].append(str(error))
        report["outputPublished"] = output_published
        report["ok"] = False
        write_report(report_path, report)
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
