"""Decode and pre-simplify NASA's Draco-compressed ISS GLB for the web generator.

Usage:
  blender --background --factory-startup --python prepare-iss-source-blender.py -- \
    --input nasa-iss-igoal-original.glb --output nasa-iss-igoal-decoded.glb --ratio 0.20
"""

import argparse
import json
import os
import sys

import bpy


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ratio", type=float, default=0.20)
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    result = parser.parse_args(values)
    if not 0.05 <= result.ratio <= 1.0:
        parser.error("--ratio must be between 0.05 and 1.0")
    return result


def triangle_count(mesh):
    return sum(max(0, len(polygon.vertices) - 2) for polygon in mesh.polygons)


args = arguments()
source = os.path.abspath(args.input)
output = os.path.abspath(args.output)
os.makedirs(os.path.dirname(output), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)

mesh_objects = [item for item in bpy.context.scene.objects if item.type == "MESH"]
if not mesh_objects:
    raise RuntimeError("NASA ISS source did not import any mesh objects")

triangles_before = sum(triangle_count(item.data) for item in mesh_objects)
for item in mesh_objects:
    bpy.context.view_layer.objects.active = item
    item.select_set(True)
    modifier = item.modifiers.new(name="IOM ISS web fidelity", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = args.ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    item.select_set(False)

triangles_after = sum(triangle_count(item.data) for item in mesh_objects)
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_draco_mesh_compression_enable=False,
    export_yup=True,
    export_materials="EXPORT",
)

print(json.dumps({
    "source": source,
    "output": output,
    "meshObjects": len(mesh_objects),
    "trianglesBefore": triangles_before,
    "trianglesAfter": triangles_after,
    "ratio": args.ratio,
}, indent=2))
