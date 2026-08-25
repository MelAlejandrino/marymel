"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, type Mesh, type MeshStandardMaterial } from "three";

import { PALETTE } from "../../world/palette.ts";
import {
  CASE,
  CHUTE,
  CHUTE_VOID,
  GLASS_TOP,
  HOLE,
  HUB,
  PLAY,
  PRONG,
  RAIL_Y,
  SKIN,
} from "./geometry.ts";
import { wouldGrab, type Capsule, type ClawState } from "./mechanics.ts";

/**
 * The cabinet. Authored facing +z, with the play area centred on the machine's
 * own origin so `mechanics.ts` coordinates map straight onto it — heights
 * included, which is why the capsule can be dropped down the chute and land in
 * the right place.
 *
 * The whole pose is read from a ref every frame rather than passed as props:
 * it changes continuously, and re-rendering the tree for it would be absurd.
 */

const CASE_W = CASE.width;
const CASE_D = CASE.depth;

const SCREEN = "#8fd6ff";
const CAPSULE_COLOURS = PALETTE.blossom;

const capsuleColour = (i: number) => CAPSULE_COLOURS[i % CAPSULE_COLOURS.length];

/**
 * One finger: a tapered bone from the hinge, a knuckle, then a toe curling
 * inward. Cylinders rather than boxes, and tapered rather than uniform — that
 * is the difference between a claw and a machine part.
 *
 * A `Group` wraps it so the parent can drive `rotation.x`; the parent negates
 * the splay, because a positive rotation about X swings a hanging finger inward.
 */
function Finger() {
  const { upper, toe } = PRONG;
  return (
    <>
      <mesh position={[0, -upper.length / 2, 0]} castShadow>
        <cylinderGeometry args={[upper.rTop, upper.rBottom, upper.length, 8]} />
        <meshStandardMaterial color="#d7dee7" metalness={0.8} roughness={0.26} />
      </mesh>

      {/* Knuckle, so the bend has a joint rather than a crease. */}
      <mesh position={[0, -upper.length, 0]} castShadow>
        <sphereGeometry args={[upper.rBottom * 1.25, 10, 8]} />
        <meshStandardMaterial color="#aeb8c4" metalness={0.85} roughness={0.22} />
      </mesh>

      <group position={[0, -upper.length, 0]} rotation={[toe.curl, 0, 0]}>
        <mesh position={[0, -toe.length / 2, 0]} castShadow>
          <cylinderGeometry args={[toe.rTop, toe.rBottom, toe.length, 8]} />
          <meshStandardMaterial color="#c6cfda" metalness={0.8} roughness={0.26} />
        </mesh>
        {/* Rounded tip: a flat-ended cylinder reads as cut-off pipe. */}
        <mesh position={[0, -toe.length, 0]} castShadow>
          <sphereGeometry args={[toe.rBottom, 8, 6]} />
          <meshStandardMaterial color="#9aa5b2" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </>
  );
}

export function ClawMachine({
  claw,
  capsules,
  playing,
}: {
  /** Live claw state, read per frame. */
  claw: { current: ClawState };
  capsules: Capsule[];
  playing: boolean;
}) {
  const head = useRef<Group>(null);
  const prongs = useRef<(Group | null)[]>([]);
  const cable = useRef<Mesh>(null);
  const prize = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const shells = useRef<(Mesh | null)[]>([]);

  // Reused every frame so the loop allocates nothing.
  const scratch = useMemo(() => new Color(), []);
  const hot = useMemo(() => new Color("#7ef0b0"), []);
  const cold = useMemo(() => new Color("#ffffff"), []);

  // Nothing left to win. A lit, humming cabinet with no prizes in it is the
  // most confusing object it is possible to put in the world.
  const empty = capsules.length === 0 || capsules.every((c) => c.taken);

  useFrame(() => {
    const s = claw.current;

    // --- the claw head, hanging and swinging ------------------------------
    if (head.current) {
      head.current.position.set(s.hangX, s.clawY, s.hangZ);
      // Tilt is the gap between where the gantry is and where the claw got to.
      // This is the swing, and it is most of why the machine feels physical.
      head.current.rotation.z = (s.x - s.hangX) * -1.5;
      head.current.rotation.x = (s.z - s.hangZ) * 1.5;
    }

    // --- fingers open and shut --------------------------------------------
    // Spread wide at rest, converging underneath when gripping. Negated: a
    // positive rotation about X swings a hanging finger *inward*.
    const splay = PRONG.splayOpen - s.grip * (PRONG.splayOpen - PRONG.splayShut);
    for (const finger of prongs.current) {
      if (finger) finger.rotation.x = -splay;
    }

    // --- the cable actually spans the gap --------------------------------
    if (cable.current) {
      const length = Math.max(0.01, RAIL_Y - s.clawY);
      cable.current.scale.y = length;
      cable.current.position.set(s.hangX, s.clawY + length / 2, s.hangZ);
    }

    // --- the prize: carried, then falling, then resting ------------------
    // One mesh for all three, positioned from state. Swapping between a
    // "floor" copy and a "held" copy is what used to read as a teleport.
    if (prize.current) {
      if (s.prize) {
        prize.current.visible = true;
        prize.current.position.set(s.prize.x, s.prize.y, s.prize.z);
        if (s.grabbed !== null) {
          const material = prize.current.material as MeshStandardMaterial;
          material.color.set(scratch.set(capsuleColour(s.grabbed)));
        }
      } else {
        prize.current.visible = false;
      }
    }

    // --- the aim ring ----------------------------------------------------
    // Where a drop would land, and whether it would catch anything. Without it
    // aiming is guesswork, which is most of what "feels off" about a claw.
    if (ring.current) {
      const aiming = playing && s.phase === "aiming";
      ring.current.visible = aiming;
      if (aiming) {
        ring.current.position.set(s.hangX, PLAY.floorY + 0.006, s.hangZ);
        const material = ring.current.material as MeshStandardMaterial;
        const live = wouldGrab(capsules, { x: s.hangX, z: s.hangZ });
        material.color.copy(live ? hot : cold);
        material.emissive.copy(live ? hot : cold);
        material.opacity = live ? 0.85 : 0.4;
      }
    }

    // --- capsules on the floor -------------------------------------------
    for (let i = 0; i < shells.current.length; i++) {
      const shell = shells.current[i];
      if (!shell) continue;
      // Hidden once won, and hidden the moment the claw lifts it — from then on
      // the single `prize` mesh is the one you can see.
      shell.visible = !capsules[i]?.taken && s.grabbed !== i;
    }
  });

  return (
    <group>
      {/*
        --- base cabinet ---------------------------------------------------
        Built from blocks around the chute shaft rather than as one solid box.
        As a solid box, a capsule falling to the chute landed *inside* it and
        simply vanished — there was nowhere for it to go.
      */}
      {(() => {
        const outerX = CASE.width / 2 + SKIN;
        const outerZ = CASE.depth / 2 + SKIN;
        const v = CHUTE_VOID;
        return (
          <>
            {/* Everything to the right of the shaft. */}
            <mesh
              position={[(v.maxX + outerX) / 2, PLAY.floorY / 2, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[outerX - v.maxX, PLAY.floorY, outerZ * 2]} />
              <meshStandardMaterial color="#42314a" roughness={0.7} />
            </mesh>
            {/* Behind the shaft, on the left. */}
            <mesh
              position={[(v.minX + v.maxX) / 2, PLAY.floorY / 2, (-outerZ + v.minZ) / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[v.maxX - v.minX, PLAY.floorY, v.minZ + outerZ]} />
              <meshStandardMaterial color="#42314a" roughness={0.7} />
            </mesh>
            {/* The tray the prize lands on, and the cabinet below it. */}
            <mesh
              position={[
                (v.minX + v.maxX) / 2,
                v.trayTopY / 2,
                (v.minZ + v.maxZ) / 2,
              ]}
              receiveShadow
            >
              <boxGeometry args={[v.maxX - v.minX, v.trayTopY, v.maxZ - v.minZ]} />
              <meshStandardMaterial color="#2a1f31" roughness={0.9} />
            </mesh>
            {/* Left skin, closing the side of the shaft. */}
            <mesh
              position={[v.minX, (v.trayTopY + PLAY.floorY) / 2, (v.minZ + v.maxZ) / 2]}
            >
              <boxGeometry args={[0.02, PLAY.floorY - v.trayTopY, v.maxZ - v.minZ]} />
              <meshStandardMaterial color="#3a2b43" roughness={0.8} />
            </mesh>
            {/* Front of the shaft: glass, so the landing is something to watch. */}
            <mesh
              position={[
                (v.minX + v.maxX) / 2,
                (v.trayTopY + PLAY.floorY) / 2,
                v.maxZ,
              ]}
            >
              <boxGeometry args={[v.maxX - v.minX, PLAY.floorY - v.trayTopY, 0.02]} />
              <meshStandardMaterial
                color="#a8dcf0"
                transparent
                opacity={0.18}
                roughness={0.08}
                metalness={0.1}
              />
            </mesh>
            {/* Lights the shaft, so the fall is visible rather than a dark gap. */}
            <pointLight
              position={[CHUTE.x, PLAY.chuteFloorY + 0.16, CHUTE.z]}
              color={PALETTE.lampLit}
              intensity={empty ? 1 : 4}
              distance={1.4}
            />
          </>
        );
      })()}

      {/* --- play floor, with a hole in the corner -------------------------- */}
      {/* Two slabs rather than one, so the capsule has somewhere to fall. */}
      <mesh
        position={[(HOLE.maxX + CASE_W / 2) / 2, PLAY.floorY - 0.02, 0]}
        receiveShadow
      >
        <boxGeometry args={[CASE_W / 2 - HOLE.maxX, 0.04, CASE_D]} />
        <meshStandardMaterial color="#2c2033" roughness={0.9} />
      </mesh>
      <mesh
        position={[
          (HOLE.minX + HOLE.maxX) / 2,
          PLAY.floorY - 0.02,
          (-CASE_D / 2 + HOLE.minZ) / 2,
        ]}
        receiveShadow
      >
        <boxGeometry args={[HOLE.maxX - HOLE.minX, 0.04, HOLE.minZ + CASE_D / 2]} />
        <meshStandardMaterial color="#2c2033" roughness={0.9} />
      </mesh>

      {/*
        A rim on the two open edges of the hole — it sits in a corner, so only
        the +x and -z sides need one. This used to be a slab across the whole
        opening, which covered the hole instead of framing it.
      */}
      <mesh
        position={[HOLE.maxX, PLAY.floorY + 0.005, (HOLE.minZ + HOLE.maxZ) / 2]}
        castShadow
      >
        <boxGeometry args={[0.05, 0.05, HOLE.maxZ - HOLE.minZ]} />
        <meshStandardMaterial
          color={PALETTE.lampLit}
          emissive={PALETTE.lampLit}
          emissiveIntensity={empty ? 0.15 : 0.9}
        />
      </mesh>
      <mesh
        position={[(HOLE.minX + HOLE.maxX) / 2, PLAY.floorY + 0.005, HOLE.minZ]}
        castShadow
      >
        <boxGeometry args={[HOLE.maxX - HOLE.minX, 0.05, 0.05]} />
        <meshStandardMaterial
          color={PALETTE.lampLit}
          emissive={PALETTE.lampLit}
          emissiveIntensity={empty ? 0.15 : 0.9}
        />
      </mesh>

      {/* --- glass --------------------------------------------------------- */}
      <mesh position={[0, (PLAY.floorY + GLASS_TOP) / 2, 0]}>
        <boxGeometry args={[CASE_W, GLASS_TOP - PLAY.floorY, CASE_D]} />
        <meshStandardMaterial
          color="#bfe4f5"
          transparent
          opacity={0.12}
          roughness={0.06}
          metalness={0.1}
        />
      </mesh>
      {([-1, 1] as const).map((sx) =>
        ([-1, 1] as const).map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[
              (sx * CASE_W) / 2,
              (PLAY.floorY + GLASS_TOP) / 2,
              (sz * CASE_D) / 2,
            ]}
            castShadow
          >
            <boxGeometry args={[0.045, GLASS_TOP - PLAY.floorY, 0.045]} />
            <meshStandardMaterial color="#5c4468" metalness={0.3} roughness={0.5} />
          </mesh>
        )),
      )}

      {/* --- marquee and rail ---------------------------------------------- */}
      <mesh position={[0, GLASS_TOP + 0.14, 0]} castShadow>
        <boxGeometry args={[CASE_W + 0.12, 0.26, CASE_D + 0.06]} />
        <meshStandardMaterial
          color={PALETTE.blossom[1]}
          emissive={PALETTE.blossom[0]}
          emissiveIntensity={empty ? 0.12 : playing ? 1.6 : 0.8}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, RAIL_Y, 0]}>
        <boxGeometry args={[CASE_W - 0.06, 0.03, 0.05]} />
        <meshStandardMaterial color="#6d5379" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* --- the cable ----------------------------------------------------- */}
      {/* Unit height, scaled each frame, so it stretches instead of floating. */}
      <mesh ref={cable}>
        <cylinderGeometry args={[0.005, 0.005, 1, 6]} />
        <meshStandardMaterial color="#9a86a5" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* --- the claw ------------------------------------------------------ */}
      <group ref={head}>
        <mesh castShadow>
          <cylinderGeometry args={[HUB.radiusTop, HUB.radiusBottom, HUB.height, 14]} />
          <meshStandardMaterial color="#e4eaf1" metalness={0.82} roughness={0.22} />
        </mesh>
        <mesh position={[0, HUB.height / 2, 0]} castShadow>
          <sphereGeometry args={[HUB.radiusTop, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#eef3f8" metalness={0.82} roughness={0.2} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <group
              ref={(g) => {
                prongs.current[i] = g;
              }}
              position={[0, PRONG.hinge.y, PRONG.hinge.z]}
            >
              <Finger />
            </group>
          </group>
        ))}
      </group>

      {/* --- the prize: carried, falling, then resting in the chute -------- */}
      <mesh ref={prize} visible={false} castShadow>
        <sphereGeometry args={[PLAY.capsuleR, 16, 14]} />
        <meshStandardMaterial color={capsuleColour(0)} roughness={0.28} metalness={0.18} />
      </mesh>

      {/* --- the aim ring -------------------------------------------------- */}
      <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        {/* A torus already lies in XY facing +Z, so -PI/2 about X lays it flat. */}
        <torusGeometry args={[0.085, 0.008, 8, 28]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.6}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* --- capsules still in the machine --------------------------------- */}
      {capsules.map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            shells.current[i] = m;
          }}
          position={[c.x, PLAY.floorY + PLAY.capsuleR, c.z]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[PLAY.capsuleR, 16, 14]} />
          <meshStandardMaterial
            color={capsuleColour(i)}
            roughness={0.28}
            metalness={0.18}
          />
        </mesh>
      ))}

      <pointLight
        position={[0, PLAY.parkY, 0.2]}
        color={SCREEN}
        intensity={empty ? 0.6 : playing ? 6 : 2.5}
        distance={2.8}
      />
    </group>
  );
}
