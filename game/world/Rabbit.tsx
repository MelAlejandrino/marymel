"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { Group } from "three";

import { useInteractable, type Interactable } from "../interaction/registry.ts";
import { damp, wrapAngle } from "../player/movement.ts";
import {
  petOwner,
  petting,
  startPet,
  strokeWeight,
  subscribeToPetting,
} from "../player/petting.ts";
import { PET_TURN, RABBIT, rabbitHomes, rabbitPose } from "./critters.ts";
import { PALETTE } from "./palette.ts";
import { hashRandom, type Placement } from "./scatter.ts";

/**
 * The rabbits.
 *
 * Built the same way the avatar is: a pile of flat-shaded blobs whose
 * proportions live in a rig (`critters.ts`) and whose pose is set procedurally
 * every frame. What makes it read as a rabbit is not polygon count — it is the
 * big rear, the dipped back, the long flat ears, the hind feet, and the fact
 * that it is never still: it hops, it stops to graze, its nose never stops
 * twitching, and its ears flick at nothing.
 *
 * ponytail: ~27 meshes each, five of them. The rest of the garden is instanced
 * for exactly this reason, but these are individually posed, so instancing
 * would mean writing matrices per bone per frame. If the draw calls ever
 * matter, the static parts (feet, whiskers, tail) are the ones to merge.
 */

const C = PALETTE.rabbit;
/** How close she must be for the prompt. Generous: it is a moving target. */
const PET_RANGE = 2.1;

/**
 * One prompt per rabbit, owned out here rather than by the component.
 *
 * A hopping rabbit has to carry its prompt with it, so the object the registry
 * holds is the object the frame loop writes to — and React will not let a
 * render read a ref or mutate state, which is what any in-component version of
 * this comes down to. Module state for the same reason `input.ts` is module
 * state: it changes every frame and no render depends on it.
 */
const PROMPTS = new Map<string, Interactable>();

function promptFor(id: string, home: Placement): Interactable {
  let prompt = PROMPTS.get(id);
  if (!prompt) {
    prompt = {
      id,
      // Overwritten every frame with where the rabbit actually is.
      x: home.x,
      z: home.z,
      range: PET_RANGE,
      verb: "PET",
      label: "the rabbit",
      enabled: true,
      // Reads its own live position, so she reaches for the rabbit rather than
      // for wherever it was when the page loaded.
      onInteract: () => startPet(id, prompt!.x, prompt!.z),
    };
    PROMPTS.set(id, prompt);
  }
  return prompt;
}

/** Move a rabbit's prompt to where the rabbit now is. */
function movePrompt(id: string, x: number, z: number, enabled: boolean) {
  const prompt = PROMPTS.get(id);
  if (!prompt) return;
  prompt.x = x;
  prompt.z = z;
  prompt.enabled = enabled;
}

function usePetOwner(): string | null {
  return useSyncExternalStore(subscribeToPetting, petOwner, () => null);
}

/**
 * One ear, hung from its base so the group *is* the joint — the ear can then
 * be tipped back, splayed and flicked without any of its own geometry moving.
 */
function Ear({ side, fur, group }: { side: 1 | -1; fur: string; group: React.RefObject<Group | null> }) {
  const { ear } = RABBIT;
  const innerLength = ear.length - ear.inner.r * 2 - 0.05;

  return (
    <group
      ref={group}
      position={[side * ear.x, ear.y, ear.z]}
      rotation={[ear.tilt, 0, side * ear.spread]}
    >
      {/* Squashed front-to-back: a round ear reads as an antenna. */}
      <mesh position={[0, ear.length / 2, 0]} scale={[1, 1, ear.flatten]} castShadow>
        <capsuleGeometry args={[ear.r, ear.length - ear.r * 2, 4, 10]} />
        <meshStandardMaterial color={fur} roughness={0.88} flatShading />
      </mesh>
      {/* The pink inside, sitting on the front face rather than inside it. */}
      <mesh
        position={[0, ear.length / 2 + ear.inner.drop, ear.inner.z]}
        scale={[1, 1, ear.flatten * 0.55]}
      >
        <capsuleGeometry args={[ear.inner.r, innerLength, 3, 8]} />
        <meshStandardMaterial color={C.inner} roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

/** Three whiskers, splayed out and forward from the muzzle. */
function Whiskers({ side }: { side: 1 | -1 }) {
  const { whisker } = RABBIT;

  return (
    <group position={[side * 0.028, whisker.y, whisker.z]}>
      {whisker.rows.map((tilt) => (
        <group
          key={tilt}
          // A cylinder's axis is Y, so -pi/2 about z lays it along +x; the
          // tilt fans them within that plane and the y rotation sweeps the
          // whole fan forward.
          rotation={[0, -side * 0.5, -side * (Math.PI / 2 - tilt)]}
        >
          <mesh position={[0, whisker.length / 2, 0]}>
            <cylinderGeometry args={[whisker.r, whisker.r * 0.6, whisker.length, 3]} />
            <meshStandardMaterial color={C.whisker} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** An eye, set high and wide the way a prey animal's are. */
function Eye({ side }: { side: 1 | -1 }) {
  const { eye, catchlight } = RABBIT;

  return (
    <group position={[side * eye.x, eye.y, eye.z]}>
      <mesh>
        <sphereGeometry args={[eye.r, 12, 10]} />
        <meshStandardMaterial color={C.eye} roughness={0.25} />
      </mesh>
      {/* The same trick as her eyes: a speck of white is the whole difference
          between an eye and a painted dot. */}
      <mesh position={[side * catchlight.dx, catchlight.dy, catchlight.dz]}>
        <sphereGeometry args={[catchlight.r, 6, 5]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

/** Hearts, while she is stroking it. They rise and shrink away. */
function Hearts({ id }: { id: string }) {
  const group = useRef<Group>(null);

  useFrame(() => {
    const hearts = group.current;
    if (!hearts) return;
    const pet = petting.current;
    const weight = pet && pet.ownerId === id ? strokeWeight(pet.elapsed) : 0;
    hearts.visible = weight > 0.05;
    if (!hearts.visible || !pet) return;

    hearts.children.forEach((heart, i) => {
      // Each heart runs its own cycle, offset so they do not rise in lockstep.
      const cycle = (pet.elapsed * 0.85 + i * 0.37) % 1;
      heart.position.y = 0.42 + cycle * 0.42;
      heart.position.x = Math.sin(cycle * 4 + i) * 0.06;
      // Pop in, drift up, shrink out — cheaper than fading, and reads warmer.
      const size = Math.sin(cycle * Math.PI) * weight;
      heart.scale.setScalar(size);
      heart.rotation.z = Math.sin(cycle * 3 + i) * 0.3;
    });
  });

  return (
    <group ref={group} visible={false}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.45, 0.08]} scale={0}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.07, 0.07, 0.012]} />
            <meshStandardMaterial
              color={PALETTE.blossom[0]}
              emissive={PALETTE.blossom[0]}
              emissiveIntensity={0.5}
            />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 0.025, 0.025, 0]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshStandardMaterial
                color={PALETTE.blossom[0]}
                emissive={PALETTE.blossom[0]}
                emissiveIntensity={0.5}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Rabbit({ index, home }: { index: number; home: Placement }) {
  const id = `rabbit-${index}`;
  const scale = home.scale;
  /** This rabbit's offset into every cycle, so five of them never sync up. */
  const phase = useMemo(() => hashRandom(index * 13 + 7), [index]);
  const fur = C.fur[Math.floor(hashRandom(index * 7 + 5) * C.fur.length)];

  const outer = useRef<Group>(null);
  const chassis = useRef<Group>(null);
  const head = useRef<Group>(null);
  const muzzle = useRef<Group>(null);
  const earL = useRef<Group>(null);
  const earR = useRef<Group>(null);

  /** Yaw is smoothed rather than set, so nothing snaps when it stops hopping
   *  round its loop and turns to face her. */
  const yaw = useRef(-home.rotation);
  /** Where it was standing when she reached out. */
  const anchor = useRef<{ x: number; z: number } | null>(null);
  /** After a pet it is wherever she left it, while its loop has moved on. This
   *  is the difference, decayed away — so it hops back rather than teleports. */
  const slip = useRef<{ x: number; z: number } | null>(null);
  const at = useRef({ x: home.x, z: home.z });

  const petted = usePetOwner() === id;

  useInteractable(promptFor(id, home));

  useFrame(({ clock }, delta) => {
    const body = outer.current;
    if (!body) return;
    const time = clock.elapsedTime;

    const pet = petting.current;
    const mine = pet && pet.ownerId === id ? pet : null;

    // Remember where it was standing the moment she reached out, so it comes
    // over from there instead of from wherever its loop has moved on to.
    if (mine && !anchor.current) anchor.current = { ...at.current };
    if (!mine && anchor.current) {
      anchor.current = null;
      const loose = rabbitPose({ home, scale, phase, seconds: time, pet: null, anchor: null });
      slip.current = { x: at.current.x - loose.x, z: at.current.z - loose.z };
    }

    const pose = rabbitPose({
      home,
      scale,
      phase,
      seconds: time,
      pet: mine,
      anchor: anchor.current,
    });

    let { x, z } = pose;
    // Hop back to the loop rather than snapping onto it.
    if (slip.current) {
      slip.current.x = damp(slip.current.x, 0, 3.4, delta);
      slip.current.z = damp(slip.current.z, 0, 3.4, delta);
      x += slip.current.x;
      z += slip.current.z;
      if (Math.hypot(slip.current.x, slip.current.z) < 0.02) slip.current = null;
    }

    at.current.x = x;
    at.current.z = z;
    body.position.set(x, pose.lift, z);

    // Heading is smoothed rather than set, so nothing snaps when it stops
    // hopping round its loop and turns to face her.
    yaw.current = damp(
      yaw.current,
      yaw.current + wrapAngle(pose.yaw - yaw.current),
      9,
      delta,
    );
    body.rotation.y = yaw.current;

    // The prompt follows the rabbit, and nothing is pettable while a pet is
    // already running.
    movePrompt(id, x, z, !pet);

    // --- squash and stretch ----------------------------------------------
    if (chassis.current) {
      chassis.current.rotation.x = pose.pitch;
      // Stretched in the air, squashed on the grass, and squashed a little
      // further under each stroke.
      const stretch =
        1 +
        pose.air * 0.16 -
        (1 - pose.air) * 0.05 -
        Math.max(0, pose.stroke) * 0.05 * pose.petted;
      chassis.current.scale.set(1 + (1 - stretch) * 0.6, stretch, 1 + (1 - stretch) * 0.6);
    }

    // --- head, ears, nose --------------------------------------------------
    if (head.current) {
      head.current.rotation.x =
        pose.graze * RABBIT.graze - pose.petted * 0.3 + pose.air * 0.08;
      // Looking around while it hops. While she pets it, it stands side-on
      // and tips its head her way — a glance, not the full turn, because a
      // neck that comes round 80 degrees looks broken.
      head.current.rotation.y =
        Math.sin(time * 0.45 + phase * 6) * 0.3 * (1 - pose.graze) * (1 - pose.petted) -
        PET_TURN * 0.35 * pose.petted;
      head.current.rotation.z = Math.sin(time * 0.8 + phase * 4) * 0.06;
    }

    for (const [side, ear] of [
      [-1, earL.current],
      [1, earR.current],
    ] as const) {
      if (!ear) continue;
      // A sharp, rare spike: ears flick at nothing, which is most of what
      // makes an animal look alive when it is standing still.
      const flick = Math.max(0, Math.sin(time * 1.9 + phase * 9 + side)) ** 14;
      ear.rotation.x =
        RABBIT.ear.tilt -
        pose.air * 0.5 +
        pose.graze * 0.5 +
        RABBIT.earsBack * pose.petted * (1 - flick);
      ear.rotation.z =
        side * (RABBIT.ear.spread * (1 - pose.petted * 0.7) + flick * 0.5);
    }

    if (muzzle.current) {
      // Nose twitch, in bursts. Fast and tiny, never off for long.
      const burst =
        0.35 +
        0.65 *
          Math.max(
            pose.graze,
            pose.petted,
            Math.max(0, Math.sin(time * 0.7 + phase * 5)),
          );
      const twitch = (Math.sin(time * 13 + phase * 9) * 0.5 + 0.5) * burst;
      muzzle.current.scale.set(1, 1 + twitch * 0.1, 1 - twitch * 0.06);
      muzzle.current.position.z = RABBIT.muzzle.z + twitch * 0.004;
    }
  });

  const { haunch, chest, belly, hindFoot, frontPaw, tail, hip, nose, cheek } = RABBIT;

  return (
    <group ref={outer} position={[home.x, 0, home.z]}>
      <group scale={scale}>
        {/* Everything hangs off the hip, so tipping to graze or to reach up at
            her hand pivots where a rabbit actually pivots. */}
        <group ref={chassis} position={[0, hip.y, hip.z]}>
          <group position={[0, -hip.y, -hip.z]}>
            {/* --- body: big rear, dipped back, raised chest --- */}
            <mesh position={[0, haunch.y, haunch.z]} scale={[1, 0.96, 1.06]} castShadow>
              <icosahedronGeometry args={[haunch.r, 1]} />
              <meshStandardMaterial color={fur} roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0, chest.y, chest.z]} scale={[0.94, 0.92, 1]} castShadow>
              <icosahedronGeometry args={[chest.r, 1]} />
              <meshStandardMaterial color={fur} roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0, belly.y, belly.z]} scale={[0.92, 0.8, 1.15]}>
              <icosahedronGeometry args={[belly.r, 1]} />
              <meshStandardMaterial color={C.belly} roughness={0.95} flatShading />
            </mesh>

            {/* --- hind feet: long, flat, pointing forward --- */}
            {([-1, 1] as const).map((side) => (
              <mesh
                key={side}
                position={[side * hindFoot.x, hindFoot.y, hindFoot.z]}
                rotation={[0, side * 0.06, 0]}
                castShadow
              >
                <boxGeometry args={[hindFoot.w, hindFoot.h, hindFoot.l]} />
                <meshStandardMaterial color={fur} roughness={0.9} flatShading />
              </mesh>
            ))}

            {/* --- front paws, tucked under the chest --- */}
            {([-1, 1] as const).map((side) => (
              <mesh
                key={side}
                position={[side * frontPaw.x, frontPaw.y, frontPaw.z]}
                scale={[1, 0.85, 1.25]}
              >
                <icosahedronGeometry args={[frontPaw.r, 1]} />
                <meshStandardMaterial color={C.belly} roughness={0.92} flatShading />
              </mesh>
            ))}

            {/* --- tail: one white puff --- */}
            <mesh position={[0, tail.y, tail.z]} castShadow>
              <icosahedronGeometry args={[tail.r, 1]} />
              <meshStandardMaterial color={C.belly} roughness={0.95} flatShading />
            </mesh>

            {/* --- head --- */}
            <group ref={head} position={[0, RABBIT.head.y, RABBIT.head.z]}>
              <mesh scale={[1, 1.02, 1.05]} castShadow>
                <icosahedronGeometry args={[RABBIT.head.r, 2]} />
                <meshStandardMaterial color={fur} roughness={0.9} flatShading />
              </mesh>

              {/* Cheeks. A rabbit's face is wide at the jaw and narrow at the
                  nose; without these the head is just a ball. */}
              {([-1, 1] as const).map((side) => (
                <mesh
                  key={side}
                  position={[side * cheek.x, cheek.y, cheek.z]}
                  scale={[1, 0.9, 1.1]}
                >
                  <icosahedronGeometry args={[cheek.r, 1]} />
                  <meshStandardMaterial color={fur} roughness={0.92} flatShading />
                </mesh>
              ))}

              {/* Muzzle group: the twitch lives here, so the nose and whiskers
                  move together the way they do on a real rabbit. */}
              <group ref={muzzle} position={[0, RABBIT.muzzle.y, RABBIT.muzzle.z]}>
                <mesh scale={[1, 0.88, 1.1]}>
                  <icosahedronGeometry args={[RABBIT.muzzle.r, 1]} />
                  <meshStandardMaterial color={C.belly} roughness={0.92} flatShading />
                </mesh>
              </group>
              <mesh position={[0, nose.y, nose.z]} scale={[1.3, 1, 0.9]}>
                <icosahedronGeometry args={[nose.r, 1]} />
                <meshStandardMaterial color={C.nose} roughness={0.7} flatShading />
              </mesh>

              <Eye side={-1} />
              <Eye side={1} />
              <Whiskers side={-1} />
              <Whiskers side={1} />
              <Ear side={-1} fur={fur} group={earL} />
              <Ear side={1} fur={fur} group={earR} />
            </group>
          </group>
        </group>
      </group>

      {/* Mounted outside the scaled body so the hearts are the same size above
          every rabbit. Rendered only while she is actually petting this one. */}
      {petted && <Hearts id={id} />}
    </group>
  );
}

export function Rabbits({ count = 5 }: { count?: number } = {}) {
  const homes = useMemo(() => rabbitHomes(count), [count]);

  return (
    <group>
      {homes.map((home, i) => (
        <Rabbit key={i} index={i} home={home} />
      ))}
    </group>
  );
}
