"use client";

import { useMemo } from "react";
import { BackSide, Color } from "three";

import { PALETTE } from "./palette.ts";
import { WORLD_BOUNDS } from "./layout.ts";

/**
 * A gradient dome rather than a flat background colour. A single flat colour
 * is what makes a stylized scene look unfinished — a warm horizon under a
 * cooler zenith gives the world depth and sets the golden-hour mood for free.
 */
const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  varying vec3 vWorldPosition;

  void main() {
    // Normalising by the dome radius keeps the gradient anchored to the
    // horizon regardless of where the camera is standing.
    float h = normalize(vWorldPosition).y;
    // smoothstep rather than a linear mix: the band near the horizon should
    // be wide and soft, not a hard line.
    float t = smoothstep(-0.05, 0.55, h);
    gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
  }
`;

export function Sky() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color(PALETTE.skyTop) },
      horizonColor: { value: new Color(PALETTE.skyHorizon) },
    }),
    [],
  );

  return (
    <mesh>
      <sphereGeometry args={[WORLD_BOUNDS * 3.4, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={BackSide}
        depthWrite={false}
        // The dome must not be dimmed by the scene fog, or the horizon and the
        // fog colour fight each other.
        fog={false}
      />
    </mesh>
  );
}
