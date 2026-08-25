"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { clearCameraDistance, resolve, type Point } from "../collision.ts";
import { consumeInteract, consumeLook, input } from "../input.ts";
import { triggerActive, updateNearest } from "../interaction/registry.ts";
import { collidersFor, PLAYER_RADIUS, SPAWN, WORLD_BOUNDS } from "../world/layout.ts";
import { Avatar } from "./Avatar.tsx";
import { createMotion } from "./motion.ts";
import {
  cameraPosition,
  damp,
  headTurn,
  moveDirection,
  steer,
} from "./movement.ts";

const WALK_SPEED = 4.2;
const ACCELERATION = 12;
const TURN_LAMBDA = 14;
// Pulled in a little from a landscape framing: the portrait field of view is
// wide, which makes everything in it smaller.
const CAMERA_DISTANCE = 6;
const CAMERA_HEIGHT = 4.2;
const CAMERA_LAMBDA = 6;
/** Never let the camera end up inside her head. */
const MIN_CAMERA_DISTANCE = 1.9;
const LOOK_AT_HEIGHT = 1.1;
/** A long frame (tab switch, GC pause) must not teleport anyone through a wall. */
const MAX_DELTA = 1 / 20;

export function Player({
  doorOpen,
  paused = false,
}: {
  doorOpen: boolean;
  /**
   * A mini-game has the camera and the controls. She stands still *and* is
   * hidden: the camera frames the cabinet from the front, which is exactly
   * where she is standing, so leaving her visible put her back across the shot.
   */
  paused?: boolean;
}) {
  const group = useRef<Group>(null);
  const position = useRef<Point>({ ...SPAWN });
  const velocity = useRef({ x: 0, z: 0 });
  const yaw = useRef(0);
  const facing = useRef(Math.PI);
  // The ref object itself is handed to <Avatar>, which reads `.current` inside
  // its own frame loop. Passing `.current` during render would both trip the
  // rules of hooks and hand over a value that never updates.
  const motion = useRef(createMotion());

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_DELTA);
    const mesh = group.current;
    if (!mesh) return;

    mesh.visible = !paused;

    if (paused) {
      // Bleed off the walk so she is standing still when the game hands back,
      // and leave the camera and prompts to whatever took over.
      velocity.current.x = 0;
      velocity.current.z = 0;
      motion.current.gait = 0;
      motion.current.elapsed += delta;
      return;
    }

    // --- camera yaw -------------------------------------------------------
    yaw.current += consumeLook().x;

    // --- intent -> world-space velocity -----------------------------------
    const dir = moveDirection(input.move, yaw.current);
    const targetX = dir.x * WALK_SPEED;
    const targetZ = dir.z * WALK_SPEED;
    velocity.current.x = damp(velocity.current.x, targetX, ACCELERATION, delta);
    velocity.current.z = damp(velocity.current.z, targetZ, ACCELERATION, delta);

    // --- move, then push out of anything we ended up inside ----------------
    const colliders = collidersFor(doorOpen);
    const next = resolve(
      {
        x: position.current.x + velocity.current.x * delta,
        z: position.current.z + velocity.current.z * delta,
      },
      PLAYER_RADIUS,
      colliders,
      WORLD_BOUNDS,
    );
    position.current = next;
    mesh.position.set(next.x, 0, next.z);

    // --- face the direction of travel -------------------------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    facing.current = steer(facing.current, velocity.current, TURN_LAMBDA, delta);
    mesh.rotation.y = facing.current;

    // --- pose -------------------------------------------------------------
    const pose = motion.current;
    pose.gait = Math.min(speed / WALK_SPEED, 1);
    pose.stride += speed * delta * 2.6;
    pose.elapsed += delta;
    // She glances toward whatever the camera is looking at.
    pose.headYaw = damp(pose.headYaw, headTurn(yaw.current, facing.current), 9, delta);

    // --- camera follow ----------------------------------------------------
    // Pull the camera in if a wall would come between it and her — otherwise
    // stepping through the front door leaves the camera outside, framing the
    // wall it just walked past.
    const ideal = cameraPosition(next, yaw.current, CAMERA_DISTANCE, CAMERA_HEIGHT);
    const room = clearCameraDistance(
      next,
      { x: ideal.x, z: ideal.z },
      CAMERA_DISTANCE,
      colliders,
    );
    const distance = Math.max(MIN_CAMERA_DISTANCE, room);
    // Drop the camera as it comes in, or a close shot ends up looking
    // straight down at the top of her head.
    const t = distance / CAMERA_DISTANCE;
    const height = LOOK_AT_HEIGHT + (CAMERA_HEIGHT - LOOK_AT_HEIGHT) * t;
    const want = cameraPosition(next, yaw.current, distance, height);
    state.camera.position.x = damp(state.camera.position.x, want.x, CAMERA_LAMBDA, delta);
    state.camera.position.y = damp(state.camera.position.y, want.y, CAMERA_LAMBDA, delta);
    state.camera.position.z = damp(state.camera.position.z, want.z, CAMERA_LAMBDA, delta);
    state.camera.lookAt(next.x, LOOK_AT_HEIGHT, next.z);

    // --- interaction ------------------------------------------------------
    updateNearest(next);
    if (consumeInteract()) triggerActive();
  });

  return (
    <group ref={group} position={[SPAWN.x, 0, SPAWN.z]}>
      <Avatar motion={motion} />
    </group>
  );
}
