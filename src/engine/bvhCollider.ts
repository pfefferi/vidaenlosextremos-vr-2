import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

interface MeshBvhEntry {
  geometry: THREE.BufferGeometry;
  bvh: MeshBVH;
  worldMatrix: THREE.Matrix4;
  invMatrix: THREE.Matrix4;
  minScale: number;
}

export class BvhTerrainCollider {
  private readonly entries: MeshBvhEntry[] = [];

  // Pre-allocated scratch math objects (zero per-frame heap allocations)
  private readonly _localSphereBox = new THREE.Box3();
  private readonly _localCenter = new THREE.Vector3();
  private readonly _worldClosest = new THREE.Vector3();
  private readonly _worldTri = new THREE.Triangle();
  private readonly _pushDir = new THREE.Vector3();
  private readonly _colX = new THREE.Vector3();
  private readonly _colY = new THREE.Vector3();
  private readonly _colZ = new THREE.Vector3();

  constructor(root?: THREE.Object3D) {
    if (!root) return;

    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position');
      const index = geom.getIndex();
      const triCount = index
        ? Math.floor(index.count / 3)
        : posAttr
          ? Math.floor(posAttr.count / 3)
          : 0;

      if (!posAttr || triCount === 0) return;

      try {
        const bvh = new MeshBVH(geom);
        const worldMatrix = new THREE.Matrix4().copy(mesh.matrixWorld);
        const invMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();

        const e = worldMatrix.elements;
        this._colX.set(e[0], e[1], e[2]);
        this._colY.set(e[4], e[5], e[6]);
        this._colZ.set(e[8], e[9], e[10]);
        const minScale = Math.min(this._colX.length(), this._colY.length(), this._colZ.length());

        this.entries.push({
          geometry: geom,
          bvh,
          worldMatrix,
          invMatrix,
          minScale: minScale > 1e-6 ? minScale : 1,
        });
      } catch {
        // Safely skip geometries that cannot build a BVH
      }
    });
  }

  get meshCount(): number {
    return this.entries.length;
  }

  resolveSphereCollision(worldPos: THREE.Vector3, radius: number, floorY: number): THREE.Vector3 {
    const r = Math.max(radius, 0);
    const rSq = r * r;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const localRadius = r / entry.minScale + 0.05;

      this._localCenter.copy(worldPos).applyMatrix4(entry.invMatrix);
      this._localSphereBox.min.set(
        this._localCenter.x - localRadius,
        this._localCenter.y - localRadius,
        this._localCenter.z - localRadius
      );
      this._localSphereBox.max.set(
        this._localCenter.x + localRadius,
        this._localCenter.y + localRadius,
        this._localCenter.z + localRadius
      );

      entry.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(this._localSphereBox),
        intersectsTriangle: (tri) => {
          this._worldTri.a.copy(tri.a).applyMatrix4(entry.worldMatrix);
          this._worldTri.b.copy(tri.b).applyMatrix4(entry.worldMatrix);
          this._worldTri.c.copy(tri.c).applyMatrix4(entry.worldMatrix);

          this._worldTri.closestPointToPoint(worldPos, this._worldClosest);
          const distSq = worldPos.distanceToSquared(this._worldClosest);

          if (distSq < rSq) {
            if (distSq > 1e-12) {
              const dist = Math.sqrt(distSq);
              const penetration = r - dist;
              this._pushDir.subVectors(worldPos, this._worldClosest).divideScalar(dist);
              worldPos.addScaledVector(this._pushDir, penetration);
            } else {
              this._worldTri.getNormal(this._pushDir);
              if (this._pushDir.lengthSq() < 1e-12) {
                this._pushDir.set(0, 1, 0);
              }
              worldPos.addScaledVector(this._pushDir, r);
            }
          }
          return false;
        },
      });
    }

    const minY = floorY + r * 0.5;
    if (worldPos.y < minY) {
      worldPos.y = minY;
    }

    return worldPos;
  }

  dispose(): void {
    for (let i = 0; i < this.entries.length; i++) {
      const geom = this.entries[i].geometry as THREE.BufferGeometry & {
        disposeBoundsTree?: () => void;
        boundsTree?: unknown;
      };
      geom.disposeBoundsTree?.();
      if ('boundsTree' in geom) {
        geom.boundsTree = undefined;
      }
    }
    this.entries.length = 0;
  }
}
