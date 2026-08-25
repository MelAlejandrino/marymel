"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";

import { PALETTE } from "../world/palette.ts";
import type { AvatarMotion } from "./motion.ts";
import { FACE, HAIR, RIG } from "./rig.ts";

/**
 * A stylized little character, posed procedurally.
 *
 * Proportions are deliberately chibi — a large head on a small body reads as
 * charming at a distance, where a realistic figure would just read as a smudge.
 * Every feature sits *on* the head rather than protruding from it; a dark blob
 * floating off the front of a blank sphere is what makes low-poly faces
 * unsettling. The numbers live in `rig.ts` and are checked in `rig.test.ts`.
 */

const A = PALETTE.avatar;
const R = RIG.headR;

function Limb({
  length,
  radius,
  color,
}: {
  length: number;
  radius: number;
  color: string;
}) {
  // Hung from the origin, so the parent group acts as the joint.
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, length - radius * 2, 3, 8]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Eye({ side }: { side: 1 | -1 }) {
  const { eye, catchlight, blush } = FACE;
  return (
    <group>
      <mesh position={[side * eye.x, eye.y, eye.z]}>
        <sphereGeometry args={[eye.r, 12, 10]} />
        <meshStandardMaterial color={A.eye} roughness={0.3} />
      </mesh>
      {/* Tiny, but a catchlight is what makes an eye look alive rather than
          painted on. Offset from the eye, so it rides on the eye's surface. */}
      <mesh
        position={[
          side * (eye.x + catchlight.dx),
          eye.y + catchlight.dy,
          eye.z + catchlight.dz,
        ]}
      >
        <sphereGeometry args={[catchlight.r, 8, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[side * blush.x, blush.y, blush.z]}>
        <sphereGeometry args={[blush.r, 10, 8]} />
        <meshStandardMaterial color={A.blush} roughness={0.9} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

export function Avatar({ motion }: { motion: RefObject<AvatarMotion> }) {
  const head = useRef<Group>(null);
  const body = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const ponytail = useRef<Group>(null);

  useFrame(() => {
    const { gait, stride, headYaw, elapsed } = motion.current;
    const swing = Math.sin(stride);

    // Arms and legs swing in opposition, the way people actually walk.
    if (legL.current) legL.current.rotation.x = swing * 0.72 * gait;
    if (legR.current) legR.current.rotation.x = -swing * 0.72 * gait;
    if (armL.current) armL.current.rotation.x = -swing * 0.55 * gait;
    if (armR.current) armR.current.rotation.x = swing * 0.55 * gait;

    if (body.current) {
      // Highest when the legs pass each other, lowest when they are spread —
      // which is where a pendulum leg lifts the foot anyway.
      body.current.position.y = Math.abs(Math.cos(stride)) * 0.035 * gait;
      body.current.rotation.x = gait * 0.07;
      // Idle breathing, so standing still is not perfectly frozen.
      body.current.scale.y = 1 + Math.sin(elapsed * 1.6) * 0.012 * (1 - gait);
    }

    if (head.current) {
      head.current.rotation.y = headYaw;
      // Counter the walk lean, so she does not stare at her own feet.
      head.current.rotation.x = -gait * 0.05 + Math.sin(stride * 2) * 0.02 * gait;
    }

    // The ponytail trails the head and bounces with each step.
    if (ponytail.current) {
      ponytail.current.rotation.x = 0.25 + Math.sin(stride * 2) * 0.16 * gait;
      ponytail.current.rotation.z = -headYaw * 0.5;
    }
  });

  return (
    <group ref={body}>
      {/* --- legs --- */}
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          ref={side === -1 ? legL : legR}
          position={[side * RIG.legX, RIG.hipY, 0]}
        >
          <Limb length={RIG.legLength} radius={RIG.legRadius} color={A.skin} />
          <mesh
            position={[0, -RIG.legLength - RIG.shoe.drop, RIG.shoe.forward]}
            castShadow
          >
            <boxGeometry args={[RIG.shoe.width, RIG.shoe.height, RIG.shoe.depth]} />
            <meshStandardMaterial color={A.shoe} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* --- dress --- */}
      <mesh position={[0, (RIG.dress.bottomY + RIG.dress.topY) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[
            RIG.dress.rTop,
            RIG.dress.rBottom,
            RIG.dress.topY - RIG.dress.bottomY,
            14,
            1,
            true,
          ]}
        />
        <meshStandardMaterial color={A.dress} roughness={0.8} flatShading />
      </mesh>
      {/* Caps the open-ended cylinder, so the skirt is not hollow from below. */}
      <mesh position={[0, RIG.dress.bottomY + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RIG.dress.rBottom, 14]} />
        <meshStandardMaterial color={A.apron} roughness={0.9} />
      </mesh>
      <mesh position={[0, RIG.dress.bottomY + 0.025, 0]} castShadow>
        <cylinderGeometry args={[RIG.dress.rBottom + 0.008, RIG.dress.rBottom + 0.008, 0.05, 14]} />
        <meshStandardMaterial color={A.dressTrim} roughness={0.85} flatShading />
      </mesh>
      {/* Collar, tying the dress into the neck. */}
      <mesh position={[0, RIG.dress.topY - 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.13, RIG.dress.rTop, 0.06, 12]} />
        <meshStandardMaterial color={A.dressTrim} roughness={0.85} />
      </mesh>

      {/* --- arms --- */}
      {([-1, 1] as const).map((side) => (
        <group
          key={side}
          ref={side === -1 ? armL : armR}
          position={[side * RIG.armX, RIG.shoulderY, 0]}
          // Angled out, so the forearm clears the flare of the skirt.
          rotation={[0, 0, side * RIG.armOut]}
        >
          <Limb length={RIG.armLength} radius={RIG.armRadius} color={A.skin} />
        </group>
      ))}

      {/* --- head --- */}
      <group ref={head} position={[0, RIG.headY, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[R, 24, 20]} />
          <meshStandardMaterial color={A.skin} roughness={0.88} />
        </mesh>

        {/*
          Hair in two shells rather than one: a crown that stops above the brow,
          and a back shell that wraps round behind. One sphere big enough to
          read as hair would swallow the face.
        */}
        <mesh castShadow>
          <sphereGeometry
            args={[R + HAIR.crown.lift, 24, 20, 0, Math.PI * 2, 0, HAIR.crown.thetaLength]}
          />
          <meshStandardMaterial color={A.hair} roughness={0.75} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry
            args={[
              R + HAIR.back.lift,
              24,
              20,
              HAIR.back.phiStart,
              HAIR.back.phiLength,
              0,
              HAIR.back.thetaLength,
            ]}
          />
          <meshStandardMaterial color={A.hair} roughness={0.75} />
        </mesh>

        {/* Locks framing the face. */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[side * HAIR.sideLock.x, HAIR.sideLock.y, HAIR.sideLock.z]}
            castShadow
          >
            <sphereGeometry args={[HAIR.sideLock.r, 12, 10]} />
            <meshStandardMaterial color={A.hairSheen} roughness={0.75} flatShading />
          </mesh>
        ))}

        <Eye side={-1} />
        <Eye side={1} />

        {/* A half-torus turned upside down: the curve opens upward, into a smile. */}
        <mesh position={[0, FACE.mouth.y, FACE.mouth.z]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[FACE.mouth.r, FACE.mouth.tube, 6, 14, Math.PI]} />
          <meshStandardMaterial color={A.eye} roughness={0.6} />
        </mesh>

        <group ref={ponytail} position={[0, HAIR.ponytail.y, HAIR.ponytail.z]}>
          <mesh position={[0, -0.02, -0.07]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={A.hair} roughness={0.75} flatShading />
          </mesh>
          <mesh position={[0, -0.2, -0.14]} rotation={[0.4, 0, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.24, 3, 10]} />
            <meshStandardMaterial color={A.hair} roughness={0.75} flatShading />
          </mesh>
          <mesh position={[0, -0.055, -0.105]} castShadow>
            <boxGeometry args={[0.14, 0.06, 0.14]} />
            <meshStandardMaterial color={A.ribbon} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
