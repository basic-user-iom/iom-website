"""Render deterministic opposing-angle QA views for repeat-LOD GLB candidates.

Run with Blender, for example:

  blender --background --python scripts/blender-render-repeat-lod-qa.py -- \
    --input near=tmp/repeat-lod-ground-floor/Mesh.13786-near-source.glb \
    --input mid=tmp/repeat-lod-ground-floor/Mesh.13786-mid-conservative.glb \
    --input far=tmp/repeat-lod-ground-floor/Mesh.13786-far-conservative.glb \
    --output tmp/repeat-lod-ground-floor/visual-qa

The same source-derived camera framing is used for every candidate so the
resulting images can be compared directly.
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
from mathutils import Vector


VIEWS = {
    "front": Vector((0.0, -1.0, 0.18)),
    "back": Vector((0.0, 1.0, 0.18)),
    "left": Vector((-1.0, 0.0, 0.18)),
    "right": Vector((1.0, 0.0, 0.18)),
    "top": Vector((0.12, -0.08, 1.0)),
    "bottom": Vector((0.12, -0.08, -1.0)),
    "grazing": Vector((1.0, -1.0, 0.06)),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        action="append",
        required=True,
        help="Candidate in label=path form; the first candidate defines framing.",
    )
    parser.add_argument("--output", required=True)
    parser.add_argument("--resolution", type=int, default=720)
    args = parser.parse_args(argv)
    parsed_inputs = []
    for value in args.input:
        if "=" not in value:
            parser.error(f"--input must use label=path: {value}")
        label, raw_path = value.split("=", 1)
        path = Path(raw_path).resolve()
        if not label or not path.is_file():
            parser.error(f"Invalid input: {value}")
        parsed_inputs.append((label, path))
    args.inputs = parsed_inputs
    return args


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.materials,
        bpy.data.images,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def import_glb(path: Path) -> list[bpy.types.Object]:
    bpy.ops.import_scene.gltf(filepath=str(path), import_shading="NORMALS")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects imported from {path}")
    bpy.context.view_layer.update()
    return meshes


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def set_color_management() -> None:
    scene = bpy.context.scene
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0


def add_area_light(name: str, location: Vector, energy: float, size: float, center: Vector) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = max(size, 0.1)
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = (center - location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(obj)


def configure_scene(center: Vector, radius: float, resolution: int) -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 30
    set_color_management()

    world = bpy.data.worlds.new("LOD QA World") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.045, 0.055, 0.07, 1.0)
    background.inputs["Strength"].default_value = 0.45

    light_radius = max(radius, 0.5)
    add_area_light(
        "Key",
        center + Vector((1.7, -2.0, 2.6)).normalized() * light_radius * 3.5,
        1300.0,
        light_radius * 1.5,
        center,
    )
    add_area_light(
        "Fill",
        center + Vector((-2.1, -0.4, 1.1)).normalized() * light_radius * 3.2,
        650.0,
        light_radius * 2.0,
        center,
    )
    add_area_light(
        "Rim",
        center + Vector((0.3, 2.0, 1.8)).normalized() * light_radius * 3.0,
        900.0,
        light_radius * 1.2,
        center,
    )

    camera_data = bpy.data.cameras.new("LOD QA Camera")
    camera_data.lens = 58.0
    camera = bpy.data.objects.new("LOD QA Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def position_camera(camera: bpy.types.Object, center: Vector, radius: float, direction: Vector) -> float:
    unit = direction.normalized()
    fov = min(camera.data.angle_x, camera.data.angle_y)
    distance = max(radius / max(math.sin(fov * 0.5), 0.05) * 1.17, radius * 2.4, 0.5)
    camera.location = center + unit * distance
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.clip_start = max(distance / 10000.0, 0.001)
    camera.data.clip_end = max(distance + radius * 8.0, 100.0)
    return distance


def render_candidate(
    label: str,
    path: Path,
    output: Path,
    frame_min: Vector,
    frame_max: Vector,
    resolution: int,
) -> dict:
    clear_scene()
    meshes = import_glb(path)
    actual_min, actual_max = world_bounds(meshes)
    center = (frame_min + frame_max) * 0.5
    radius = max((frame_max - center).length, 0.05)
    camera = configure_scene(center, radius, resolution)
    render_paths = {}
    distances = {}
    for view_name, direction in VIEWS.items():
        distances[view_name] = position_camera(camera, center, radius, direction)
        target = output / f"{label}-{view_name}.png"
        bpy.context.scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        render_paths[view_name] = target.name
    return {
        "label": label,
        "input": str(path),
        "inputBytes": path.stat().st_size,
        "inputSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "actualBounds": {"min": list(actual_min), "max": list(actual_max)},
        "meshObjects": len(meshes),
        "renders": render_paths,
        "cameraDistance": distances,
    }


def main() -> None:
    args = parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)

    clear_scene()
    source_meshes = import_glb(args.inputs[0][1])
    frame_min, frame_max = world_bounds(source_meshes)

    results = []
    for label, path in args.inputs:
        results.append(
            render_candidate(label, path, output, frame_min, frame_max, args.resolution)
        )

    report = {
        "schema": "iom-repeat-lod-blender-visual-qa-v1",
        "renderer": bpy.app.version_string,
        "resolution": args.resolution,
        "frameBounds": {"min": list(frame_min), "max": list(frame_max)},
        "views": {name: list(direction) for name, direction in VIEWS.items()},
        "candidates": results,
        "status": "renders-generated-manual-approval-required",
    }
    (output / "render-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
