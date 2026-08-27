"use client";

import { useEffect, useMemo } from "react";

import { buildTerrainGeometry } from "./terrainMesh.ts";

/**
 * The land the garden sits in: one mesh, one material, one draw call.
 *
 * The shape and the colour live in `terrain.ts`, the buffers in
 * `terrainMesh.ts`. All that is left here is mounting it.
 */
export function Terrain() {
  const geometry = useMemo(() => buildTerrainGeometry(), []);
  // Built by hand rather than declared, so it is disposed by hand (PLAN §28).
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    // Shadows land on it — the cottage across the lawn is the same surface as
    // the hills — but it casts none: the shadow map is fitted to the garden, and
    // widening it to cover the hills would cost every texel of its resolution
    // where it is actually seen. The hills are shaded by their own slope and by
    // `terrainEnclosure` instead.
    <mesh geometry={geometry} receiveShadow>
      {/*
        No map, no normal map, nothing to download: every variation in it is a
        vertex colour worked out once at load. `flatShading` is deliberately off,
        unlike the garden's foliage — faceting a hill shows the polar grid as a
        fan of triangles pointing straight at the player.
      */}
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
