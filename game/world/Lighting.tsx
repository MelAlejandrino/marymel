"use client";

import { PALETTE } from "./palette.ts";
import { WORLD_BOUNDS } from "./layout.ts";

/**
 * Late golden hour: a low, warm key light throwing long shadows, with cool
 * sky bounce filling the shade. The warm/cool split is what stops a low-poly
 * scene reading as flat plastic.
 */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={[PALETTE.skyHorizon, PALETTE.grassDark, 1.1]} />
      <ambientLight intensity={0.25} color={PALETTE.skyTop} />

      <directionalLight
        // Low and off to one side, so the cottage gets a lit face and a shaded
        // one instead of being evenly washed out.
        position={[22, 18, 14]}
        intensity={2.4}
        color="#ffdcb0"
        castShadow
        // ponytail: the garden more than doubled, so the same map covers more
        // ground per texel. 4096 if the shadow edges ever read as jagged.
        shadow-mapSize={[2048, 2048]}
        // Fit the shadow frustum to the fenced garden: any larger and the
        // texels get too coarse to hold an edge.
        shadow-camera-left={-WORLD_BOUNDS - 4}
        shadow-camera-right={WORLD_BOUNDS + 4}
        shadow-camera-top={WORLD_BOUNDS + 4}
        shadow-camera-bottom={-WORLD_BOUNDS - 4}
        shadow-camera-near={1}
        shadow-camera-far={90}
        // Pulls the shadow off the surface casting it, killing the stripes
        // that otherwise crawl across large flat ground planes.
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />

      {/* Cool rim from the opposite side, separating the roof from the sky. */}
      <directionalLight position={[-10, 6, -12]} intensity={0.55} color="#9fb6d8" />
    </>
  );
}
