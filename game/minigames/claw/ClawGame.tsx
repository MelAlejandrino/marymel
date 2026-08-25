"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import { consumeInteract, input } from "../../input.ts";
import { damp } from "../../player/movement.ts";
import { ClawMachine } from "./ClawMachine.tsx";
import {
  capsuleLayout,
  createClaw,
  isFinished,
  stepClaw,
  type ClawPhase,
  type ClawState,
} from "./mechanics.ts";

/**
 * Drives one round of the claw machine.
 *
 * While this is mounted the player controller is paused, so the camera and the
 * movement input belong to the claw. Winning is settled here and then reported
 * to the server, which decides *which* prize and refuses a duplicate — so the
 * worst a tampered client can do is claim a prize it was going to be given
 * anyway. That is the right trade for a private gift: the alternative is
 * server-rolled odds, which makes the claw theatre.
 */

/**
 * Where the camera sits while playing: in front of the cabinet and a little
 * above the glass, looking down into the play area rather than at it edge-on —
 * depth is what makes aiming readable.
 */
const CAMERA_BACK = 1.62;
const CAMERA_HEIGHT = 1.72;
const LOOK_HEIGHT = 1.0;

export type ClawOutcome = "won" | "missed";

export function ClawGame({
  x,
  z,
  rotation,
  capsuleCount,
  freePlay = false,
  frozen = false,
  onRound,
  onPhase,
}: {
  x: number;
  z: number;
  rotation: number;
  /** How many capsules to put in the machine. */
  capsuleCount: number;
  /**
   * She has won everything in here, so the machine refills itself and keeps
   * being playable. Nothing new gets recorded.
   */
  freePlay?: boolean;
  /** A reveal is up: hold the machine still so the stick does not drive it. */
  frozen?: boolean;
  onRound: (outcome: ClawOutcome) => void;
  /** So the HUD can stop offering "Drop" while the claw is already busy. */
  onPhase?: (phase: ClawPhase) => void;
}) {
  const claw = useRef<ClawState>(createClaw());
  const settled = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshotted at mount and then owned here. Recomputing from the prop would
  // fight with `taken` and remove two capsules per win; and shrinking the array
  // would shift the indices `grabbed` points at.
  const [capsules, setCapsules] = useState(() => capsuleLayout(capsuleCount));

  // The machine faces +z in its own space, so "in front" is that direction
  // turned by the spot's rotation.
  const front = { x: Math.sin(rotation), z: Math.cos(rotation) };

  // Stepping out mid-round must not leave a timer to fire into nothing.
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  useFrame((state, delta) => {
    // Still consumed while frozen, so a press behind the reveal is swallowed
    // rather than queued up to fire the moment it closes.
    const drop = consumeInteract();
    if (!frozen) {
      const before = claw.current.phase;
      claw.current = stepClaw(
        claw.current,
        { move: { x: input.move.x, y: input.move.y }, drop },
        delta,
        capsules,
      );
      if (claw.current.phase !== before) onPhase?.(claw.current.phase);
    }

    if (isFinished(claw.current) && !settled.current) {
      settled.current = true;
      const outcome: ClawOutcome = claw.current.grabbed === null ? "missed" : "won";
      if (outcome === "won") {
        // Mark the capsule she actually grabbed, so that one is the one that
        // disappears rather than whichever happened to be last in the list.
        const index = claw.current.grabbed!;
        setCapsules((prev) => {
          const next = prev.map((c, i) => (i === index ? { ...c, taken: true } : c));
          // In free play the machine tops itself back up once it is cleared,
          // so it never becomes an ornament she cannot use.
          return freePlay && next.every((c) => c.taken)
            ? next.map((c) => ({ ...c, taken: false }))
            : next;
        });
      }
      onRound(outcome);
      // Back to aiming shortly, so a miss costs a moment rather than a reload.
      resetTimer.current = setTimeout(
        () => {
          claw.current = createClaw();
          settled.current = false;
          onPhase?.("aiming");
        },
        outcome === "won" ? 900 : 550,
      );
    }

    // Frame the cabinet. The player controller is paused, so nothing fights
    // over the camera.
    const camX = x + front.x * CAMERA_BACK;
    const camZ = z + front.z * CAMERA_BACK;
    state.camera.position.x = damp(state.camera.position.x, camX, 5, delta);
    state.camera.position.y = damp(state.camera.position.y, CAMERA_HEIGHT, 5, delta);
    state.camera.position.z = damp(state.camera.position.z, camZ, 5, delta);
    state.camera.lookAt(x, LOOK_HEIGHT, z);
  });

  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <ClawMachine claw={claw} capsules={capsules} playing />
    </group>
  );
}
