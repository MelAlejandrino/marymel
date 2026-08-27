"use client";

import { useFrame, type RootState } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import {
  clearCameraDistance,
  resolve,
  type Box,
  type Point,
} from "../collision.ts";
import { consumeInteract, consumeLook, input } from "../input.ts";
import { triggerActive, updateNearest } from "../interaction/registry.ts";
import { collidersFor, PLAYER_RADIUS, SPAWN, WORLD_BOUNDS } from "../world/layout.ts";
import { Avatar } from "./Avatar.tsx";
import { createMotion, type AvatarMotion } from "./motion.ts";
import {
  crouchWeight,
  endPet,
  PET,
  PET_SECONDS,
  petting,
  strokeOffset,
} from "./petting.ts";
import { patLook } from "./rig.ts";
import {
  POSE_SECONDS,
  poseHeight,
  seating,
  standUp,
  type Seat,
} from "./seat.ts";
import {
  cameraPosition,
  damp,
  headTurn,
  moveDirection,
  steer,
  wrapAngle,
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

/**
 * Ease the avatar into or out of a posture.
 *
 * `posture` flips the instant she sits; the blend is what turns that flip into
 * a movement. The joint angles themselves live in `rig.ts` — this only decides
 * how far through them she is.
 */
function settlePose(motion: AvatarMotion, delta: number, seat: Seat | null) {
  motion.elapsed += delta;
  const step = delta / POSE_SECONDS;

  if (seat) {
    motion.posture = seat.posture;
    motion.gait = 0;
    motion.poseBlend = Math.min(1, motion.poseBlend + step);
    // Level her head off, or she keeps staring wherever the camera happened to
    // be pointing when she sat down.
    motion.headYaw = damp(motion.headYaw, 0, 6, delta);
    return;
  }

  // Standing back up: run the blend out *before* dropping the posture, so the
  // legs straighten rather than snapping.
  motion.poseBlend = Math.max(0, motion.poseBlend - step);
  if (motion.poseBlend === 0) motion.posture = "stand";
}

/**
 * Frame her from behind at the current yaw, pulling in if a wall would come
 * between the camera and her. Shared by walking and sitting: the camera should
 * not behave differently just because she stopped moving.
 */
function followCamera(
  state: RootState,
  at: Point,
  yaw: number,
  delta: number,
  colliders: Box[],
) {
  const ideal = cameraPosition(at, yaw, CAMERA_DISTANCE, CAMERA_HEIGHT);
  const room = clearCameraDistance(
    at,
    { x: ideal.x, z: ideal.z },
    CAMERA_DISTANCE,
    colliders,
  );
  const distance = Math.max(MIN_CAMERA_DISTANCE, room);
  // Drop the camera as it comes in, or a close shot ends up looking straight
  // down at the top of her head.
  const t = distance / CAMERA_DISTANCE;
  const height = LOOK_AT_HEIGHT + (CAMERA_HEIGHT - LOOK_AT_HEIGHT) * t;
  const want = cameraPosition(at, yaw, distance, height);

  state.camera.position.x = damp(state.camera.position.x, want.x, CAMERA_LAMBDA, delta);
  state.camera.position.y = damp(state.camera.position.y, want.y, CAMERA_LAMBDA, delta);
  state.camera.position.z = damp(state.camera.position.z, want.z, CAMERA_LAMBDA, delta);
  state.camera.lookAt(at.x, LOOK_AT_HEIGHT, at.z);
}

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
  /**
   * Where she was standing when she sat down. Getting up puts her back on her
   * feet somewhere already known to be clear, rather than dropping her into the
   * middle of the sofa she was sitting on.
   */
  const stoodAt = useRef<Point | null>(null);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_DELTA);
    const mesh = group.current;
    if (!mesh) return;

    mesh.visible = !paused;
    const colliders = collidersFor(doorOpen);

    if (paused) {
      // A mini-game taking the controls while she is sitting would leave her
      // stuck in a chair it has no prompt to get out of.
      if (seating.current) standUp();
      if (petting.current) endPet();
      velocity.current.x = 0;
      velocity.current.z = 0;
      motion.current.gait = 0;
      settlePose(motion.current, delta, null);
      return;
    }

    // --- camera yaw -------------------------------------------------------
    // Looking around still works while she is sitting. Walking does not.
    yaw.current += consumeLook().x;

    // --- sitting or lying down --------------------------------------------
    const seat = seating.current;
    if (seat) {
      // Remember the standing spot on the way in, once.
      if (!stoodAt.current) stoodAt.current = { ...position.current };

      velocity.current.x = 0;
      velocity.current.z = 0;
      settlePose(motion.current, delta, seat);

      mesh.position.set(seat.x, poseHeight(seat), seat.z);
      // Lying down is the same pose tipped onto its back: her origin is at her
      // feet, so -90° about x lays her out with her head toward the headboard.
      mesh.rotation.set(seat.posture === "lie" ? -Math.PI / 2 : 0, seat.facing, 0);
      facing.current = seat.facing;

      followCamera(state, { x: seat.x, z: seat.z }, yaw.current, delta, colliders);
      updateNearest({ x: seat.x, z: seat.z });
      if (consumeInteract()) triggerActive();
      return;
    }

    // --- back on her feet -------------------------------------------------
    if (stoodAt.current) {
      position.current = stoodAt.current;
      stoodAt.current = null;
      mesh.rotation.set(0, facing.current, 0);
    }
    settlePose(motion.current, delta, null);

    // --- petting an animal -------------------------------------------------
    /*
      She stays where she is and crouches; the animal comes to her hand. The
      timing of both halves lives in `petting.ts`, and the store is what the
      animal reads to know where her hand will be.
    */
    const pet = petting.current;
    if (pet) {
      pet.elapsed += delta;
      pet.playerX = position.current.x;
      pet.playerZ = position.current.z;
      pet.playerFacing = facing.current;
      // Walking off calls it off — but through the stand-up, so she is never
      // left snapping out of a crouch.
      if (input.move.x !== 0 || input.move.y !== 0) {
        pet.elapsed = Math.max(pet.elapsed, PET_SECONDS - PET.release);
      }
      if (pet.elapsed >= PET_SECONDS) endPet();
    }
    // Zero once the gesture is over, whichever way it ended.
    motion.current.pat = crouchWeight(pet ? pet.elapsed : PET_SECONDS);
    motion.current.patStroke = pet ? strokeOffset(pet.elapsed) : 0;

    // --- intent -> world-space velocity -----------------------------------
    const dir = pet ? { x: 0, z: 0 } : moveDirection(input.move, yaw.current);
    const targetX = dir.x * WALK_SPEED;
    const targetZ = dir.z * WALK_SPEED;
    velocity.current.x = damp(velocity.current.x, targetX, ACCELERATION, delta);
    velocity.current.z = damp(velocity.current.z, targetZ, ACCELERATION, delta);

    // --- move, then push out of anything we ended up inside ----------------
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

    // --- face the direction of travel, or the animal ----------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    if (pet) {
      // Turn to where it was standing when she reached out, not to where it
      // has hopped since: it is coming to a spot in front of her, so aiming at
      // its live position would have the two of them circling each other.
      const want = Math.atan2(pet.x - next.x, pet.z - next.z);
      facing.current = damp(
        facing.current,
        facing.current + wrapAngle(want - facing.current),
        8,
        delta,
      );
    } else {
      facing.current = steer(facing.current, velocity.current, TURN_LAMBDA, delta);
    }
    mesh.rotation.y = facing.current;

    // --- pose -------------------------------------------------------------
    const pose = motion.current;
    pose.gait = Math.min(speed / WALK_SPEED, 1);
    pose.stride += speed * delta * 2.6;
    // She glances toward whatever the camera is looking at — except while she
    // is petting something, which is beside her, so she turns to look at it.
    pose.headYaw = damp(
      pose.headYaw,
      pet ? patLook() : headTurn(yaw.current, facing.current),
      9,
      delta,
    );

    // --- camera follow ----------------------------------------------------
    followCamera(state, next, yaw.current, delta, colliders);

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
