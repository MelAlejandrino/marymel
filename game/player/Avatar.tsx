"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";

import { PALETTE } from "../world/palette.ts";
import type { AvatarMotion } from "./motion.ts";
import {
  blend,
  blinkScale,
  dressRadiusAt,
  FACE,
  HAIR,
  POSTURE,
  RIG,
} from "./rig.ts";

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
  const { eye, catchlight, lash, blush } = FACE;
  const lid = useRef<Group>(null);

  // Both eyes read the same clock, so they blink together with no shared
  // state between them.
  useFrame((state) => {
    if (lid.current) lid.current.scale.y = blinkScale(state.clock.elapsedTime);
  });

  return (
    <group>
      <group ref={lid} position={[side * eye.x, eye.y, eye.z]}>
        <mesh>
          <sphereGeometry args={[eye.r, 12, 10]} />
          <meshStandardMaterial color={A.eye} roughness={0.3} />
        </mesh>
        {/* Tiny, but a catchlight is what makes an eye look alive rather than
            painted on. Offset from the eye, so it rides on the eye's surface. */}
        <mesh
          position={[side * catchlight.dx, catchlight.dy, catchlight.dz]}
        >
          <sphereGeometry args={[catchlight.r, 8, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
        </mesh>
        {/* Lash along the upper lid, tilted up at the outer corner. It sits
            inside the blinking group, so it comes down with the lid. */}
        <mesh
          position={[side * lash.dx, lash.dy, lash.dz]}
          rotation={[0, 0, -side * lash.tilt]}
        >
          <boxGeometry args={[lash.w, lash.h, lash.d]} />
          <meshStandardMaterial color={A.eye} roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[side * blush.x, blush.y, blush.z]}>
        <sphereGeometry args={[blush.r, 10, 8]} />
        <meshStandardMaterial color={A.blush} roughness={0.9} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** Brow above each eye, angled up and out so she reads as cheerful. */
function Brow({ side }: { side: 1 | -1 }) {
  const { brow } = FACE;
  return (
    <mesh
      position={[side * brow.x, brow.y, brow.z]}
      rotation={[0, 0, -side * brow.tilt]}
    >
      <boxGeometry args={[brow.w, brow.h, brow.d]} />
      <meshStandardMaterial color={A.hair} roughness={0.7} />
    </mesh>
  );
}

/** A ring of petals round a bright centre, pinned over one ear. */
function HairFlower() {
  const { flower } = HAIR;
  return (
    <group position={[flower.x, flower.y, flower.z]} rotation={[0, 0, 0.4]}>
      {Array.from({ length: flower.petals }, (_, i) => {
        const a = (i / flower.petals) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * flower.r * 0.9, Math.sin(a) * flower.r * 0.9, 0]}
            scale={[1, 1, 0.5]}
          >
            <sphereGeometry args={[flower.r * 0.62, 8, 6]} />
            <meshStandardMaterial color={A.flower} roughness={0.7} flatShading />
          </mesh>
        );
      })}
      <mesh scale={[1, 1, 0.6]}>
        <sphereGeometry args={[flower.r * 0.42, 8, 6]} />
        <meshStandardMaterial
          color={A.flowerCore}
          emissive={A.flowerCore}
          emissiveIntensity={0.25}
          roughness={0.6}
        />
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
  const kneeLj = useRef<Group>(null);
  const kneeRj = useRef<Group>(null);
  const ponytail = useRef<Group>(null);
  const skirt = useRef<Group>(null);

  useFrame(() => {
    const { gait, stride, headYaw, elapsed, posture, poseBlend } = motion.current;
    const swing = Math.sin(stride);
    // `t` is how far she is out of standing. At 0 everything below reduces to
    // the walk cycle exactly as it was, so the posed case cannot regress it.
    const t = posture === "stand" ? 0 : poseBlend;
    const pose = posture === "lie" ? POSTURE.lie : POSTURE.sit;
    // Sitting still means standing still, however she got here.
    const walk = gait * (1 - t);

    // Arms and legs swing in opposition, the way people actually walk.
    // A bent knee also drives the shin, so the legs read as legs and not as
    // planks pivoting at the hip.
    const swingL = swing * 0.72 * walk;
    if (legL.current) legL.current.rotation.x = blend(swingL, pose.thigh, t);
    if (legR.current) legR.current.rotation.x = blend(-swingL, pose.thigh, t);
    // The trailing leg bends; the leading one straightens.
    const kneeL = Math.max(0, -swing) * 0.55 * walk;
    const kneeR = Math.max(0, swing) * 0.55 * walk;
    if (kneeLj.current) kneeLj.current.rotation.x = blend(kneeL, pose.shin, t);
    if (kneeRj.current) kneeRj.current.rotation.x = blend(kneeR, pose.shin, t);

    const armSwing = swing * 0.55 * walk;
    if (armL.current) {
      armL.current.rotation.x = blend(-armSwing, pose.arm, t);
      armL.current.rotation.z = blend(-RIG.armOut, -pose.armOut, t);
    }
    if (armR.current) {
      armR.current.rotation.x = blend(armSwing, pose.arm, t);
      armR.current.rotation.z = blend(RIG.armOut, pose.armOut, t);
    }

    if (body.current) {
      // Highest when the legs pass each other, lowest when they are spread —
      // which is where a pendulum leg lifts the foot anyway.
      body.current.position.y = Math.abs(Math.cos(stride)) * 0.035 * walk;
      body.current.rotation.x = blend(walk * 0.07, pose.lean, t);
      // Idle breathing, so sitting and standing are never perfectly frozen.
      const still = 1 - walk;
      body.current.scale.y = 1 + Math.sin(elapsed * 1.6) * 0.012 * still;
      // A little hip sway on the walk, and a slow drift when standing.
      body.current.rotation.z = blend(
        Math.sin(stride) * 0.035 * walk + Math.sin(elapsed * 0.9) * 0.012 * still,
        0,
        t,
      );
    }

    if (head.current) {
      head.current.rotation.y = headYaw;
      // Counter the walk lean, so she does not stare at her own feet.
      head.current.rotation.x = blend(
        -walk * 0.05 + Math.sin(stride * 2) * 0.02 * walk,
        // Lying down, the head tips back onto the pillow rather than forward.
        posture === "lie" ? 0.12 : -0.05,
        t,
      );
      // Idle head tilt, so being still still reads as breathing.
      head.current.rotation.z = Math.sin(elapsed * 0.7) * 0.05 * (1 - walk);
    }

    // The skirt gets out of the way of a seated pose. Without this she folds
    // her legs up entirely inside a rigid cone and sitting looks like standing
    // still with the feet hidden.
    if (skirt.current) {
      skirt.current.rotation.x = blend(0, pose.skirtTilt, t);
      skirt.current.scale.y = blend(1, pose.skirtTakeUp, t);
    }

    // The ponytail trails the head and bounces with each step.
    if (ponytail.current) {
      ponytail.current.rotation.x = blend(
        0.2 + Math.sin(stride * 2) * 0.2 * walk + Math.sin(elapsed * 1.3) * 0.03 * (1 - walk),
        // Lying on her back, it falls flat instead of sticking out.
        posture === "lie" ? -0.5 : 0.3,
        t,
      );
      ponytail.current.rotation.z = -headYaw * 0.5;
    }
  });

  return (
    <group ref={body}>
      {/* --- legs, hip -> knee -> foot --- */}
      {([-1, 1] as const).map((side) => {
        const shin = RIG.legLength - RIG.kneeAt;
        return (
          <group
            key={side}
            ref={side === -1 ? legL : legR}
            position={[side * RIG.legX, RIG.hipY, 0]}
          >
            <Limb length={RIG.kneeAt} radius={RIG.legRadius} color={A.skin} />
            {/* The knee group is the joint: everything below hangs off it, so
                bending it carries the shoe with it. */}
            <group ref={side === -1 ? kneeLj : kneeRj} position={[0, -RIG.kneeAt, 0]}>
              <Limb length={shin} radius={RIG.legRadius * 0.92} color={A.skin} />
              <mesh position={[0, -shin - RIG.shoe.drop, RIG.shoe.forward]} castShadow>
                <boxGeometry args={[RIG.shoe.width, RIG.shoe.height, RIG.shoe.depth]} />
                <meshStandardMaterial color={A.shoe} roughness={0.8} />
              </mesh>
              {/* Ribbon across the toe. Two centimetres of colour, and the shoe
                  stops being a brown box. */}
              <mesh
                position={[
                  0,
                  -shin - RIG.shoe.drop + RIG.shoe.height / 2,
                  RIG.shoe.forward + RIG.shoe.depth * 0.22,
                ]}
              >
                <boxGeometry args={[RIG.shoe.width + 0.012, 0.035, 0.05]} />
                <meshStandardMaterial color={A.ribbon} roughness={0.7} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* --- dress ---
          The skirt hangs from the waist as one group, so it can be tilted and
          taken up when she sits without the hem, the trim and the underskirt
          drifting apart from each other. Every child's y is measured down from
          the waist, which is the group's origin and the pivot. */}
      <group ref={skirt} position={[0, RIG.dress.topY, 0]}>
        <mesh
          position={[0, (RIG.dress.bottomY - RIG.dress.topY) / 2, 0]}
          castShadow
          receiveShadow
        >
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
        <mesh
          position={[0, RIG.dress.bottomY - RIG.dress.topY + 0.002, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[RIG.dress.rBottom, 14]} />
          <meshStandardMaterial color={A.apron} roughness={0.9} />
        </mesh>
        <mesh position={[0, RIG.dress.bottomY - RIG.dress.topY + 0.025, 0]} castShadow>
          <cylinderGeometry
            args={[RIG.dress.rBottom + 0.008, RIG.dress.rBottom + 0.008, 0.05, 14]}
          />
          <meshStandardMaterial color={A.dressTrim} roughness={0.85} flatShading />
        </mesh>
        {/* Underskirt showing below the hem — one ring of lighter colour, and
            the skirt reads as layered rather than as a cone. */}
        <mesh
          position={[
            0,
            RIG.dress.bottomY -
              RIG.dress.topY -
              RIG.petticoat.drop +
              RIG.petticoat.height / 2,
            0,
          ]}
          castShadow
        >
          <cylinderGeometry
            args={[
              RIG.dress.rBottom - 0.01,
              RIG.dress.rBottom + RIG.petticoat.flare,
              RIG.petticoat.height,
              14,
            ]}
          />
          <meshStandardMaterial color={A.apron} roughness={0.85} flatShading />
        </mesh>
      </group>
      {/* Sash at the waist, with the bow tied at the back. It stays on the
          torso: a waistband does not swing with the skirt. */}
      <mesh position={[0, RIG.sash.y, 0]} castShadow>
        <cylinderGeometry
          args={[
            dressRadiusAt(RIG.sash.y + RIG.sash.height / 2) + 0.012,
            dressRadiusAt(RIG.sash.y - RIG.sash.height / 2) + 0.012,
            RIG.sash.height,
            14,
          ]}
        />
        <meshStandardMaterial color={A.sash} roughness={0.8} />
      </mesh>
      <group position={[0, RIG.sash.y, -dressRadiusAt(RIG.sash.y) - 0.03]}>
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * RIG.sash.bow.r, 0, 0]} scale={[1, 0.8, 0.6]} castShadow>
            <sphereGeometry args={[RIG.sash.bow.r, 8, 6]} />
            <meshStandardMaterial color={A.sash} roughness={0.8} flatShading />
          </mesh>
        ))}
        <mesh position={[0, -RIG.sash.bow.tail / 2, 0]}>
          <boxGeometry args={[0.05, RIG.sash.bow.tail, 0.03]} />
          <meshStandardMaterial color={A.sash} roughness={0.8} />
        </mesh>
      </group>
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
          // Angled out, so the forearm clears the flare of the skirt. Set in
          // the frame loop, because sitting brings the hands into her lap.
          rotation={[0, 0, side * RIG.armOut]}
        >
          <Limb length={RIG.armLength} radius={RIG.armRadius} color={A.skin} />
          {/* Puff sleeve capping the shoulder, hiding the joint. */}
          <mesh position={[0, -0.02, 0]} scale={[1, RIG.sleeve.squash, 1]} castShadow>
            <sphereGeometry args={[RIG.sleeve.r, 12, 10]} />
            <meshStandardMaterial color={A.dressLight} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, -RIG.armLength, 0]} castShadow>
            <sphereGeometry args={[RIG.hand.r, 10, 8]} />
            <meshStandardMaterial color={A.skin} roughness={0.85} />
          </mesh>
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
        <Brow side={-1} />
        <Brow side={1} />
        <HairFlower />

        <mesh position={[0, FACE.nose.y, FACE.nose.z]}>
          <sphereGeometry args={[FACE.nose.r, 8, 6]} />
          <meshStandardMaterial color={A.skinShade} roughness={0.9} />
        </mesh>

        {/* A half-torus turned upside down: the curve opens upward, into a smile. */}
        <mesh position={[0, FACE.mouth.y, FACE.mouth.z]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[FACE.mouth.r, FACE.mouth.tube, 6, 14, Math.PI]} />
          <meshStandardMaterial color={A.eye} roughness={0.6} />
        </mesh>

        <group ref={ponytail} position={[0, HAIR.ponytail.y, HAIR.ponytail.z]}>
          <mesh position={[0, -0.02, -0.07]} castShadow>
            <sphereGeometry args={[0.11, 12, 10]} />
            <meshStandardMaterial color={A.hair} roughness={0.75} flatShading />
          </mesh>
          {/*
            Three tapering segments rather than one capsule, each leaning a
            little further back: a single capsule reads as a handle, a taper
            reads as hair falling.
          */}
          {[
            { y: -0.19, z: -0.13, r: 0.082, len: 0.2, tilt: 0.34 },
            { y: -0.36, z: -0.2, r: 0.066, len: 0.17, tilt: 0.5 },
            { y: -0.5, z: -0.27, r: 0.044, len: 0.13, tilt: 0.66 },
          ].map((seg, i) => (
            <mesh
              key={i}
              position={[0, seg.y, seg.z]}
              rotation={[seg.tilt, 0, 0]}
              castShadow
            >
              <capsuleGeometry args={[seg.r, seg.len, 3, 10]} />
              <meshStandardMaterial
                color={i === 0 ? A.hair : A.hairSheen}
                roughness={0.75}
                flatShading
              />
            </mesh>
          ))}
          <mesh position={[0, -0.055, -0.105]} castShadow>
            <boxGeometry args={[0.15, 0.07, 0.15]} />
            <meshStandardMaterial color={A.ribbon} roughness={0.7} />
          </mesh>
          {/* Bow loops on the tie. */}
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[side * 0.1, -0.045, -0.1]}
              scale={[1, 0.75, 0.55]}
              castShadow
            >
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color={A.ribbon} roughness={0.7} flatShading />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
