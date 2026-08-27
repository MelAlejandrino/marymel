"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";

import {
  FENCE,
  HOUSE_FRONT_OUTER,
  PATH_STONES,
  TREES,
  WORLD_BOUNDS,
} from "./layout.ts";
import { PALETTE } from "./palette.ts";
import { hashRandom, scatter, type Placement } from "./scatter.ts";

/**
 * Everything outside the cottage. The small stuff — flowers, grass, fence
 * pickets — is instanced: a lush garden is hundreds of objects, and on a phone
 * that has to stay a handful of draw calls (PLAN §28).
 */

function useInstances(
  count: number,
  build: (i: number) => { matrix: Matrix4; color?: Color },
) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const { matrix, color } = build(i);
      mesh.setMatrixAt(i, matrix);
      if (color) mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, build]);

  return ref;
}

function matrixFor(p: Placement, y: number, scaleY = p.scale) {
  const m = new Matrix4();
  m.compose(
    new Vector3(p.x, y, p.z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.rotation),
    new Vector3(p.scale, scaleY, p.scale),
  );
  return m;
}

function Flowers() {
  const placements = useMemo(
    () => scatter(230, 11, { minScale: 0.7, maxScale: 1.25 }),
    [],
  );
  const build = useMemo(
    () => (i: number) => ({
      matrix: matrixFor(placements[i], 0.18),
      color: new Color(
        PALETTE.blossom[Math.floor(hashRandom(i * 5 + 3) * PALETTE.blossom.length)],
      ),
    }),
    [placements],
  );
  const ref = useInstances(placements.length, build);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placements.length]} castShadow>
      <icosahedronGeometry args={[0.17, 0]} />
      <meshStandardMaterial roughness={0.75} flatShading />
    </instancedMesh>
  );
}

function GrassTufts() {
  const placements = useMemo(
    () => scatter(560, 29, { minScale: 0.55, maxScale: 1.15, pathHalfWidth: 1.2 }),
    [],
  );
  const build = useMemo(
    () => (i: number) => ({
      matrix: matrixFor(placements[i], 0.16, placements[i].scale * 1.6),
      color: new Color(i % 3 === 0 ? PALETTE.grassDark : PALETTE.grass),
    }),
    [placements],
  );
  const ref = useInstances(placements.length, build);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placements.length]}>
      <coneGeometry args={[0.13, 0.42, 4]} />
      <meshStandardMaterial roughness={0.95} flatShading />
    </instancedMesh>
  );
}

function Bushes() {
  const placements = useMemo(
    () => scatter(46, 53, { minScale: 0.75, maxScale: 1.5 }),
    [],
  );
  const build = useMemo(
    () => (i: number) => ({
      matrix: matrixFor(placements[i], 0.34),
      color: new Color(
        PALETTE.leaves[Math.floor(hashRandom(i * 9 + 1) * PALETTE.leaves.length)],
      ),
    }),
    [placements],
  );
  const ref = useInstances(placements.length, build);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, placements.length]}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial roughness={0.9} flatShading />
    </instancedMesh>
  );
}

function Tree({ x, z, scale, tint }: (typeof TREES)[number]) {
  const leaf = (offset: number) =>
    PALETTE.leaves[(tint + offset) % PALETTE.leaves.length];

  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 2, 6]} />
        <meshStandardMaterial color={PALETTE.trunk} roughness={0.95} flatShading />
      </mesh>
      {/* Three overlapping blobs read as a canopy far more cheaply than a
          detailed one, and flat shading gives it facets to catch the light. */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial color={leaf(0)} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.62, 2.05, 0.3]} castShadow>
        <icosahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial color={leaf(1)} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.5, 2.25, -0.35]} castShadow>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial color={leaf(2)} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** Picket positions around the perimeter, leaving a gap for the path. */
function fencePickets() {
  const out: { x: number; z: number; rotY: number }[] = [];
  const R = WORLD_BOUNDS;
  const count = Math.floor((R * 2) / FENCE.postSpacing);

  for (let i = 0; i <= count; i++) {
    const t = -R + i * FENCE.postSpacing;
    // The front run steps around the gateway.
    if (Math.abs(t) > FENCE.gateHalfWidth) out.push({ x: t, z: R, rotY: 0 });
    out.push({ x: t, z: -R, rotY: 0 });
    out.push({ x: -R, z: t, rotY: Math.PI / 2 });
    out.push({ x: R, z: t, rotY: Math.PI / 2 });
  }
  return out;
}

function Fence() {
  const pickets = useMemo(() => fencePickets(), []);
  const build = useMemo(
    () => (i: number) => {
      const p = pickets[i];
      const m = new Matrix4();
      m.compose(
        new Vector3(p.x, FENCE.height / 2, p.z),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.rotY),
        // Vary the height a little, so the run does not read as machine-cut.
        new Vector3(1, 0.94 + hashRandom(i) * 0.12, 1),
      );
      return { matrix: m };
    },
    [pickets],
  );
  const ref = useInstances(pickets.length, build);

  const R = WORLD_BOUNDS;
  const railHeights = [0.38, 0.78];
  const frontRunLength = R - FENCE.gateHalfWidth;
  const frontRunCentre = FENCE.gateHalfWidth + frontRunLength / 2;

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, pickets.length]} castShadow>
        <boxGeometry args={[0.12, FENCE.height, 0.07]} />
        <meshStandardMaterial color={PALETTE.fence} roughness={0.9} />
      </instancedMesh>

      {railHeights.map((y) => (
        <group key={y}>
          {[-1, 1].map((side) => (
            <mesh key={`x${side}`} position={[side * R, y, 0]} castShadow>
              <boxGeometry args={[0.06, 0.09, R * 2]} />
              <meshStandardMaterial color={PALETTE.fence} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, y, -R]} castShadow>
            <boxGeometry args={[R * 2, 0.09, 0.06]} />
            <meshStandardMaterial color={PALETTE.fence} roughness={0.9} />
          </mesh>
          {/* Front rails stop either side of the gateway. */}
          {[-1, 1].map((side) => (
            <mesh key={`gate${side}`} position={[side * frontRunCentre, y, R]} castShadow>
              <boxGeometry args={[frontRunLength, 0.09, 0.06]} />
              <meshStandardMaterial color={PALETTE.fence} roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Taller gate posts, marking the way in. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * FENCE.gateHalfWidth, 0.72, R]} castShadow>
          <boxGeometry args={[0.2, 1.44, 0.2]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Path() {
  const soilLength = WORLD_BOUNDS - HOUSE_FRONT_OUTER;

  return (
    <group>
      {/* Worn earth first, stones laid on top of it. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, (HOUSE_FRONT_OUTER + WORLD_BOUNDS) / 2]}
        receiveShadow
      >
        <planeGeometry args={[1.9, soilLength]} />
        <meshStandardMaterial color={PALETTE.soil} roughness={1} transparent opacity={0.5} />
      </mesh>

      {PATH_STONES.map((stone, i) => (
        <mesh
          key={i}
          // Sunk almost flush, so they read as stones set into the path rather
          // than dropped on top of it.
          position={[stone.x, 0.018, stone.z]}
          // Only spun about the vertical. A cylinder's axis is already Y, so a
          // short one is a disc lying flat; the -PI/2 that a *plane* needs to
          // lie down stands a cylinder up on its edge like a wheel.
          rotation={[0, stone.rotation, 0]}
          receiveShadow
        >
          <cylinderGeometry args={[0.62 * stone.scale, 0.58 * stone.scale, 0.05, 7]} />
          <meshStandardMaterial color={PALETTE.stone} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function Garden() {
  return (
    <group>
      {/* Ground reaches well past the fence, so the horizon fades into fog
          instead of ending at a visible edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_BOUNDS * 4, WORLD_BOUNDS * 4]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>

      <Path />
      <Fence />
      <GrassTufts />
      <Bushes />
      <Flowers />
      {TREES.map((tree, i) => (
        <Tree key={i} {...tree} />
      ))}
    </group>
  );
}
