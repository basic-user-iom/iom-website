import { Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry, type Material, type Texture } from 'three';
import type { PhysicalPosition } from '../RenderContext';
import { mapCameraRelativePosition } from '../CameraRelativeTransform';
import { VOYAGER_MODEL_ASSET } from './SpaceObjectAssetCatalog';

type ModelState = 'idle' | 'loading' | 'ready' | 'fallback';
const DISH_NORMAL = new Vector3(0, 1, 0);
const EARTHWARD = new Vector3();

/** One downloaded asset, two independently positioned spacecraft instances. */
export class VoyagerModelVisual {
  public readonly root = new Group();
  public state: ModelState = 'idle';
  public meshCount = 0;
  private readonly anchors = new Map<string, Group>();
  private loading: Promise<void> | null = null;
  private disposed = false;

  public constructor() {
    this.root.name = 'voyager-nasa-models';
    for (const id of VOYAGER_MODEL_ASSET.objectIds) {
      const anchor = new Group();
      anchor.name = id + '-nasa-model';
      anchor.visible = false;
      this.anchors.set(id, anchor);
      this.root.add(anchor);
    }
  }

  public request(): Promise<void> {
    if (this.loading !== null) return this.loading;
    this.state = 'loading';
    this.loading = this.load();
    return this.loading;
  }

  public hide(): void {
    for (const anchor of this.anchors.values()) anchor.visible = false;
  }

  public focusDirection(id: string): Vector3 {
    return new Vector3(-0.7, 0.7, 0.55).normalize()
      .applyQuaternion(this.anchors.get(id)!.quaternion);
  }

  public focusUp(id: string): Vector3 {
    return DISH_NORMAL.clone().applyQuaternion(this.anchors.get(id)!.quaternion);
  }

  public update(id: string, position: Vector3, earthM: PhysicalPosition | undefined,
    spacecraftM: PhysicalPosition, metersToRenderUnits: number, visible: boolean): boolean {
    const anchor = this.anchors.get(id);
    if (anchor === undefined) return false;
    anchor.visible = visible && this.state === 'ready';
    anchor.position.copy(position);
    anchor.scale.setScalar(metersToRenderUnits);
    // Illustrative attitude: the high-gain dish points Earthward. Roll is not
    // measured telemetry, and the UI explicitly identifies this approximation.
    if (earthM !== undefined) {
      mapCameraRelativePosition(EARTHWARD, earthM, spacecraftM, 1).normalize();
      if (EARTHWARD.lengthSq() > 0) anchor.quaternion.setFromUnitVectors(DISH_NORMAL, EARTHWARD);
    }
    anchor.updateMatrixWorld(true);
    return anchor.visible;
  }

  private async load(): Promise<void> {
    try {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const { scene } = await loader.loadAsync(VOYAGER_MODEL_ASSET.file);
      if (this.disposed) { disposeModel(scene); return; }
      scene.name = 'voyager-nasa-carbajal-content';
      scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        this.meshCount += 1;
        object.frustumCulled = false;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          // A neutral inspection fill makes authored textures readable far from
          // the Sun without adding a scene-wide light or altering other bodies.
          material.onBeforeCompile = shader => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
              'outgoingLight += diffuseColor.rgb * (0.18 + 0.75 * max(dot(normal, normalize(vec3(-0.4, 0.7, 1.0))), 0.0));\n#include <opaque_fragment>');
          };
          material.customProgramCacheKey = () => 'voyager-inspection-fill-v1';
        }
      });
      for (const anchor of this.anchors.values()) anchor.add(scene.clone(true));
      this.state = 'ready';
    } catch (error) {
      this.state = 'fallback';
      console.warn('NASA Voyager model unavailable; retaining spacecraft locator.', error);
    }
  }

  public dispose(): void {
    this.disposed = true;
    disposeModel(this.root);
    this.root.removeFromParent();
    this.root.clear();
  }
}

function disposeModel(root: Group): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
      }
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}
