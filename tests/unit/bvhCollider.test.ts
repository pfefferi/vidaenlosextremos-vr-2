import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BvhTerrainCollider } from '@/engine/bvhCollider';

describe('BvhTerrainCollider', () => {
  it('pushes an intersecting sphere out of box geometry and respects floorY', () => {
    const geom = new THREE.BoxGeometry(4, 4, 4);
    const mat = new THREE.MeshStandardMaterial();
    const boxMesh = new THREE.Mesh(geom, mat);
    boxMesh.position.set(0, 0, -5);
    boxMesh.updateMatrixWorld(true);

    const collider = new BvhTerrainCollider(boxMesh);
    expect(collider.meshCount).toBe(1);

    // Approaching the front face (z = -3.0) from outside at z = -2.7 with radius 0.5
    const pos = new THREE.Vector3(0, 0, -2.7);
    collider.resolveSphereCollision(pos, 0.5, -10);
    expect(pos.z).toBeGreaterThanOrEqual(-2.5 - 1e-3);

    // Far away position is unaffected above floorY
    const farPos = new THREE.Vector3(20, 5, 20);
    collider.resolveSphereCollision(farPos, 0.5, -10);
    expect(farPos.x).toBe(20);
    expect(farPos.y).toBe(5);
    expect(farPos.z).toBe(20);

    // Below floorY gets clamped to floorY + radius * 0.5
    const lowPos = new THREE.Vector3(10, -12, 10);
    collider.resolveSphereCollision(lowPos, 0.8, -5);
    expect(lowPos.y).toBeCloseTo(-5 + 0.4, 6);

    collider.dispose();
    expect(collider.meshCount).toBe(0);
    geom.dispose();
    mat.dispose();
  });

  it('handles scaled mesh transforms and empty/missing roots safely', () => {
    const emptyCollider = new BvhTerrainCollider();
    expect(emptyCollider.meshCount).toBe(0);
    const p = new THREE.Vector3(0, -10, 0);
    emptyCollider.resolveSphereCollision(p, 1.0, -4);
    expect(p.y).toBeCloseTo(-3.5, 6);

    const emptyMesh = new THREE.Mesh(new THREE.BufferGeometry());
    const zeroTriCollider = new BvhTerrainCollider(emptyMesh);
    expect(zeroTriCollider.meshCount).toBe(0);

    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(2, 2, 2);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
    group.add(mesh);
    group.scale.setScalar(2); // scaled to 4x4x4 -> front face at z = +2.0
    group.position.set(0, 0, 0);

    const scaledCollider = new BvhTerrainCollider(group);
    expect(scaledCollider.meshCount).toBe(1);
    const hit = new THREE.Vector3(0, 0, 2.2);
    scaledCollider.resolveSphereCollision(hit, 0.5, -10);
    expect(hit.z).toBeGreaterThanOrEqual(2.5 - 1e-3);

    scaledCollider.dispose();
    geom.dispose();
  });
});
