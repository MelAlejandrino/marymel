"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { useInteractable } from "../interaction/registry.ts";
import { damp } from "../player/movement.ts";
import { DOOR, HOUSE } from "./layout.ts";
import { PALETTE } from "./palette.ts";

/**
 * The first interactable. It knows how to swing and how to register itself,
 * and nothing else — what *happens* when you knock is the caller's business,
 * which is what lets Phase 3 hang the anniversary question off it without
 * touching this file.
 */

const JAMB = 0.09;
const LEAF_WIDTH = DOOR.halfWidth * 2 - 0.04;
/** Positive Y rotation swings the leaf toward -z, i.e. into the house, so it
 *  never clips the doorstep outside. */
const OPEN_ANGLE = Math.PI * 0.62;

function Panel({ y, height }: { y: number; height: number }) {
  return (
    <mesh position={[0, y, 0.045]}>
      <boxGeometry args={[LEAF_WIDTH - 0.34, height, 0.03]} />
      <meshStandardMaterial color={PALETTE.doorPanel} roughness={0.7} />
    </mesh>
  );
}

export function Door({
  open,
  label,
  onInteract,
}: {
  open: boolean;
  label: string;
  onInteract: () => void;
}) {
  const hinge = useRef<Group>(null);

  useInteractable({
    id: "front-door",
    x: DOOR.x,
    // Stand in front of the door, not inside the wall.
    z: DOOR.z + 0.9,
    range: DOOR.range,
    // The prompt has to follow the door's state, or it still reads "open the
    // door" while you are standing in the open doorway.
    verb: open ? "CLOSE" : "OPEN",
    label,
    enabled: true,
    onInteract,
  });

  useFrame((_, delta) => {
    if (!hinge.current) return;
    const target = open ? OPEN_ANGLE : 0;
    hinge.current.rotation.y = damp(hinge.current.rotation.y, target, 5, delta);
  });

  return (
    <group position={[DOOR.x, 0, DOOR.z]}>
      {/*
        Jambs and a head, NOT a slab across the opening. The frame sits just
        outside the doorway and overlaps the wall either side, so swinging the
        leaf away actually reveals the room behind it.
      */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (DOOR.halfWidth + JAMB / 2), DOOR.height / 2, 0]}
          castShadow
        >
          <boxGeometry args={[JAMB, DOOR.height + JAMB, HOUSE.wallThickness + 0.16]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, DOOR.height + JAMB / 2, 0]} castShadow>
        <boxGeometry
          args={[
            DOOR.halfWidth * 2 + JAMB * 2,
            JAMB,
            HOUSE.wallThickness + 0.16,
          ]}
        />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
      </mesh>

      {/* Hinged on the left edge, so it swings rather than scaling open. */}
      <group ref={hinge} position={[-DOOR.halfWidth, 0, 0]}>
        <group position={[LEAF_WIDTH / 2 + 0.02, 0, 0]}>
          <mesh position={[0, DOOR.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[LEAF_WIDTH, DOOR.height, 0.1]} />
            <meshStandardMaterial color={PALETTE.door} roughness={0.65} />
          </mesh>

          <Panel y={DOOR.height * 0.72} height={DOOR.height * 0.3} />
          <Panel y={DOOR.height * 0.33} height={DOOR.height * 0.34} />

          <mesh position={[LEAF_WIDTH / 2 - 0.19, DOOR.height * 0.47, 0.085]} castShadow>
            <sphereGeometry args={[0.072, 14, 12]} />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.75} roughness={0.28} />
          </mesh>

          {/* A little heart, because this is her door. */}
          <mesh position={[0, DOOR.height * 0.55, 0.062]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.13, 0.13, 0.02]} />
            <meshStandardMaterial
              color={PALETTE.blossom[0]}
              emissive={PALETTE.blossom[0]}
              emissiveIntensity={0.35}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.046, DOOR.height * 0.55 + 0.046, 0.062]}
              // Lay the disc flat against the door instead of standing it up.
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.046, 0.046, 0.02, 12]} />
              <meshStandardMaterial
                color={PALETTE.blossom[0]}
                emissive={PALETTE.blossom[0]}
                emissiveIntensity={0.35}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
