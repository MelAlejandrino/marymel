"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { LatheGeometry, Vector2, type Group } from "three";

import { PALETTE } from "../world/palette.ts";
import type { AvatarMotion } from "./motion.ts";
import {
  blend,
  blinkScale,
  crouchDrop,
  dressRadiusAt,
  ease,
  FACE,
  HAIR,
  onSkin,
  POSTURE,
  RIG,
  skirtProfile,
} from "./rig.ts";

/**
 * A stylized little character, posed procedurally.
 *
 * Proportions are deliberately chibi — a large head on a small body reads as
 * charming at a distance, where a realistic figure would just read as a smudge.
 * Every feature sits *on* the head rather than protruding from it; a dark blob
 * floating off the front of a blank sphere is what makes low-poly faces
 * unsettling. The numbers live in `rig.ts` and are checked in `rig.test.ts`.
 *
 * Nothing here is drawn from a box or shaded flat. Every part is a capsule, a
 * sphere, a torus or a lathed profile, smooth-shaded, and every joint has a
 * ball or a cuff sitting over it — a figure assembled from primitives gives
 * itself away at the seams long before it does at the silhouette.
 */

const A = PALETTE.avatar;
const R = RIG.headR;

/**
 * Segment counts, in one place.
 *
 * Spent where it shows. The head and the skirt own the silhouette from every
 * angle, so they get real subdivision; a five-millimetre catchlight does not.
 * The whole character is still a couple of thousand triangles.
 */
const SEG = {
  head: [40, 28] as const,
  hair: [36, 26] as const,
  /** Limbs are seen from a distance and mostly side-on. */
  limb: [6, 16] as const,
  blob: [16, 12] as const,
  tiny: [10, 8] as const,
  /** The skirt is a full revolve — a facet here shows up on her outline. */
  revolve: 36,
} as const;

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
      <capsuleGeometry args={[radius, length - radius * 2, ...SEG.limb]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

/**
 * An arc of a circle, apex up.
 *
 * The brow and the lash are the two places where a flat bar most obviously
 * reads as a bar: they sit on the roundest part of her, right beside the eye,
 * and the camera looks straight at them. A torus segment bent to the same span
 * curves with the face instead of hovering across it.
 */
function Arc({
  radius,
  tube,
  arc,
  color,
  roughness = 0.7,
}: {
  radius: number;
  tube: number;
  arc: number;
  color: string;
  roughness?: number;
}) {
  // three sweeps a torus from +X; turning it by half of what is left over puts
  // the middle of the arc at the top, which is where an eyebrow's apex goes.
  return (
    <mesh rotation={[0, 0, (Math.PI - arc) / 2]}>
      <torusGeometry args={[radius, tube, 8, 20, arc]} />
      <meshStandardMaterial color={color} roughness={roughness} />
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
        {/* A shade taller than wide, and flattened front to back, so it beds
            into the face rather than bulging out of it. */}
        <mesh scale={[0.94, 1.06, 0.86]}>
          <sphereGeometry args={[eye.r, 20, 16]} />
          <meshStandardMaterial color={A.eye} roughness={0.18} />
        </mesh>
        {/* Tiny, but a catchlight is what makes an eye look alive rather than
            painted on. Offset from the eye, so it rides on the eye's surface. */}
        <mesh position={[side * catchlight.dx, catchlight.dy, catchlight.dz]}>
          <sphereGeometry args={[catchlight.r, 12, 10]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
        </mesh>
        {/* Lash arc riding the upper rim of the eye, tilted up at the outer
            corner. It sits inside the blinking group, so it comes down with
            the lid. */}
        <group position={[0, lash.dy, lash.dz]} rotation={[0, 0, -side * lash.tilt]}>
          <Arc
            radius={lash.r}
            tube={lash.tube}
            arc={lash.arc}
            color={A.eye}
            roughness={0.45}
          />
        </group>
      </group>
      {/* Blush: pressed flat into the cheek, so it reads as colour in the skin
          rather than as a bead stuck onto it. */}
      <mesh position={[side * blush.x, blush.y, blush.z]} scale={[1.15, 0.85, 0.5]}>
        <sphereGeometry args={[blush.r, ...SEG.blob]} />
        <meshStandardMaterial color={A.blush} roughness={0.95} transparent opacity={0.62} />
      </mesh>
    </group>
  );
}

/** Brow above each eye: arched, and angled up and out so she reads as cheerful. */
function Brow({ side }: { side: 1 | -1 }) {
  const { brow } = FACE;
  // The chord has to span `w`, so the radius follows from the angle it bends
  // through. The ring's centre sits a radius below, which puts the apex of the
  // arc — not its middle — at the brow line the rig asks for.
  const radius = brow.w / (2 * Math.sin(brow.arc / 2));
  return (
    // The outer group lays the arc's plane onto the curve of the forehead; the
    // inner one lifts the temple end. Two groups, because a single Euler would
    // apply the tilt about the wrong axis.
    <group
      position={onSkin({ x: side * brow.x, y: brow.y, z: brow.z }, 0.006)}
      rotation={[-Math.atan2(brow.y, brow.z), 0, 0]}
    >
      <group position={[0, -radius, 0]} rotation={[0, 0, -side * brow.tilt]}>
        <Arc radius={radius} tube={brow.h / 2} arc={brow.arc} color={A.hair} />
      </group>
    </group>
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
            position={[Math.cos(a) * flower.r * 0.86, Math.sin(a) * flower.r * 0.86, 0]}
            // Drawn out along its own radius, so each one reads as a petal
            // pointing outward rather than as a bead on a ring.
            rotation={[0, 0, a - Math.PI / 2]}
            scale={[0.7, 1.15, 0.42]}
          >
            <sphereGeometry args={[flower.r * 0.66, 12, 10]} />
            <meshStandardMaterial color={A.flower} roughness={0.65} />
          </mesh>
        );
      })}
      <mesh scale={[1, 1, 0.6]}>
        <sphereGeometry args={[flower.r * 0.42, 12, 10]} />
        <meshStandardMaterial
          color={A.flowerCore}
          emissive={A.flowerCore}
          emissiveIntensity={0.25}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/**
 * One shoe: a capsule laid on its side and widened, with a strap over the toe.
 *
 * The caps become the heel and the toe, which is exactly where the roundness
 * belongs — a shoe is all curve at both ends, and a hard corner there was the
 * most obviously blocky thing on her.
 */
function Shoe({ y }: { y: number }) {
  const { width, height, depth, forward } = RIG.shoe;
  const r = height / 2;
  return (
    <group position={[0, y, forward]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[width / height, 1, 1]} castShadow>
        <capsuleGeometry args={[r, depth - height, 6, 20]} />
        <meshStandardMaterial color={A.shoe} roughness={0.55} />
      </mesh>
      {/* Strap across the instep. Two centimetres of colour, and the shoe
          stops being a brown lump. */}
      <mesh position={[0, 0, depth * 0.2]} scale={[(width / height) * 0.97, 0.8, 1]}>
        <torusGeometry args={[r, 0.011, 8, 24]} />
        <meshStandardMaterial color={A.ribbon} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** A ribbon tail hanging off the bow, flattened and curling away. */
function BowTail({ side, length }: { side: 1 | -1; length: number }) {
  return (
    <mesh
      position={[side * 0.016, -length / 2, 0]}
      rotation={[0, 0, side * 0.24]}
      scale={[1.5, 1, 0.5]}
    >
      <capsuleGeometry args={[0.014, length, 4, 12]} />
      <meshStandardMaterial color={A.sash} roughness={0.7} />
    </mesh>
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

  // Lathed once: the profile is pure geometry off `rig.ts`, so it never
  // changes. ponytail: no disposal — there is one avatar and she outlives the
  // scene.
  const skirtGeometry = useMemo(
    () => new LatheGeometry(skirtProfile().map(([r, y]) => new Vector2(r, y)), SEG.revolve),
    [],
  );

  useFrame(() => {
    const { gait, stride, headYaw, elapsed, posture, poseBlend, pat, patStroke } =
      motion.current;
    const swing = Math.sin(stride);
    // `t` is how far she is out of standing. At 0 everything below reduces to
    // the walk cycle exactly as it was, so the posed case cannot regress it.
    // Eased, so sitting down settles into the pose instead of arriving at it
    // and stopping dead; `ease` is exact at both ends, so the poses themselves
    // are untouched.
    const t = posture === "stand" ? 0 : ease(poseBlend);
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
      // Cloth lags the hips it hangs from. A quarter-cycle behind the sway, and
      // the skirt swings with her rather than being bolted to her waist.
      skirt.current.rotation.z = blend(
        Math.sin(stride - Math.PI / 2) * 0.055 * walk,
        0,
        t,
      );
    }

    /*
      --- crouching to pet something ---

      A layer on top of everything above, not another posture: she is on her
      feet, so the walk cycle still owns her the instant the crouch runs out.
      Everything here reads the joints that were just set and blends them the
      rest of the way down, which means `pat === 0` leaves the pose untouched.
    */
    if (pat > 0) {
      const P = POSTURE.pat;
      const bend = (joint: typeof legL, to: number) => {
        if (joint.current) joint.current.rotation.x = blend(joint.current.rotation.x, to, pat);
      };
      bend(legL, P.thigh);
      bend(legR, P.thigh);
      bend(kneeLj, P.shin);
      bend(kneeRj, P.shin);

      if (body.current) {
        // Her hips have to come down with her folded legs, or she crouches
        // with her feet in the air.
        body.current.position.y = blend(body.current.position.y, -crouchDrop(), pat);
        body.current.rotation.x = blend(body.current.rotation.x, P.lean, pat);
        body.current.rotation.z = blend(body.current.rotation.z, 0, pat);
      }
      // Right hand does the stroking; the left rests on her knee.
      if (armR.current) {
        armR.current.rotation.x = blend(
          armR.current.rotation.x,
          P.arm + patStroke * P.stroke,
          pat,
        );
        armR.current.rotation.z = blend(armR.current.rotation.z, P.armOut, pat);
      }
      if (armL.current) {
        armL.current.rotation.x = blend(armL.current.rotation.x, P.restArm, pat);
        armL.current.rotation.z = blend(armL.current.rotation.z, -P.restArmOut, pat);
      }
      if (head.current) {
        // Looking down at it, and a little nod on each stroke.
        head.current.rotation.x = blend(
          head.current.rotation.x,
          P.headPitch + patStroke * 0.05,
          pat,
        );
      }
      if (skirt.current) {
        skirt.current.rotation.x = blend(skirt.current.rotation.x, P.skirtTilt, pat);
        skirt.current.scale.y = blend(skirt.current.scale.y, P.skirtTakeUp, pat);
        skirt.current.rotation.z = blend(skirt.current.rotation.z, 0, pat);
      }
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
      // Leaning forward, it falls over her shoulder rather than sticking out
      // behind her at the same angle it does when she is upright.
      if (pat > 0) {
        ponytail.current.rotation.x = blend(ponytail.current.rotation.x, -0.35, pat);
      }
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
              {/* A ball in the joint itself, so a bent knee has no daylight in
                  it — two capsules pivoting against each other always do. */}
              <mesh castShadow>
                <sphereGeometry args={[RIG.knee.r, ...SEG.blob]} />
                <meshStandardMaterial color={A.skin} roughness={0.8} />
              </mesh>
              <Limb length={shin} radius={RIG.legRadius * 0.92} color={A.skin} />
              <Shoe y={-shin - RIG.shoe.drop} />
            </group>
          </group>
        );
      })}

      {/* --- dress ---
          The skirt hangs from the waist as one group, so it can be tilted and
          taken up when she sits without the hem, the trim and the underskirt
          drifting apart from each other. Every child's y is measured down from
          the waist, which is the group's origin and the pivot.

          The body of it is revolved from `skirtProfile()` — the same curve the
          sash below reads — so the flare is a real curve rather than a cone
          with its corners showing. */}
      <group ref={skirt} position={[0, RIG.dress.topY, 0]}>
        <mesh geometry={skirtGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={A.dress} roughness={0.72} />
        </mesh>
        {/* Caps the open-ended lathe, so the skirt is not hollow from below. */}
        <mesh
          position={[0, RIG.dress.bottomY - RIG.dress.topY + 0.002, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[RIG.dress.rBottom, SEG.revolve]} />
          <meshStandardMaterial color={A.apron} roughness={0.9} />
        </mesh>
        {/* Rolled hem in trim colour — a torus rather than a ring of cylinder,
            so the bottom edge of the dress is round instead of cut. */}
        <mesh
          position={[0, RIG.dress.bottomY - RIG.dress.topY + RIG.dress.hem.tube * 0.5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[RIG.dress.rBottom, RIG.dress.hem.tube, 10, SEG.revolve]} />
          <meshStandardMaterial color={A.dressTrim} roughness={0.8} />
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
              RIG.dress.rBottom - 0.012,
              RIG.dress.rBottom + RIG.petticoat.flare,
              RIG.petticoat.height,
              SEG.revolve,
              1,
              true,
            ]}
          />
          <meshStandardMaterial color={A.apron} roughness={0.85} />
        </mesh>
        {/* ...rolled off at its own hem too. */}
        <mesh
          position={[0, RIG.dress.bottomY - RIG.dress.topY - RIG.petticoat.drop, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry
            args={[RIG.dress.rBottom + RIG.petticoat.flare, 0.011, 8, SEG.revolve]}
          />
          <meshStandardMaterial color={A.apron} roughness={0.9} />
        </mesh>
      </group>
      {/* Sash at the waist, with the bow tied at the back. It stays on the
          torso: a waistband does not swing with the skirt. Its radii come from
          `dressRadiusAt`, so it lies flat against the curve of the bodice
          rather than standing off the pinch of the waist. */}
      <mesh position={[0, RIG.sash.y, 0]} castShadow>
        <cylinderGeometry
          args={[
            dressRadiusAt(RIG.sash.y + RIG.sash.height / 2) + 0.012,
            dressRadiusAt(RIG.sash.y - RIG.sash.height / 2) + 0.012,
            RIG.sash.height,
            SEG.revolve,
          ]}
        />
        <meshStandardMaterial color={A.sash} roughness={0.75} />
      </mesh>
      <group position={[0, RIG.sash.y, -dressRadiusAt(RIG.sash.y) - 0.03]}>
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[side * RIG.sash.bow.r, 0, 0]}
            // Splayed away from the knot and flattened, so the loops read as
            // ribbon rather than as two beads.
            rotation={[0, 0, side * 0.3]}
            scale={[1, 0.72, 0.5]}
            castShadow
          >
            <sphereGeometry args={[RIG.sash.bow.r, ...SEG.blob]} />
            <meshStandardMaterial color={A.sash} roughness={0.75} />
          </mesh>
        ))}
        {/* Knot, covering where the two loops meet. */}
        <mesh scale={[1, 0.9, 0.7]} castShadow>
          <sphereGeometry args={[0.027, ...SEG.tiny]} />
          <meshStandardMaterial color={A.sash} roughness={0.75} />
        </mesh>
        <BowTail side={-1} length={RIG.sash.bow.tail} />
        <BowTail side={1} length={RIG.sash.bow.tail * 0.82} />
      </group>
      {/* Neck. Meant to stay hidden inside the collar — it is here so that
          turning or tilting her head does not open a gap straight through her. */}
      <mesh position={[0, RIG.neck.y, 0]}>
        <cylinderGeometry
          args={[RIG.neck.rTop, RIG.neck.rBottom, RIG.neck.height, 20, 1, true]}
        />
        <meshStandardMaterial color={A.skinShade} roughness={0.85} />
      </mesh>
      {/* Collar, tying the dress into the neck, rolled off along its top edge. */}
      <mesh position={[0, RIG.dress.topY - 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.13, RIG.dress.rTop, 0.06, SEG.revolve]} />
        <meshStandardMaterial color={A.dressTrim} roughness={0.8} />
      </mesh>
      <mesh position={[0, RIG.dress.topY + 0.008, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.128, 0.014, 8, SEG.revolve]} />
        <meshStandardMaterial color={A.dressTrim} roughness={0.8} />
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
            <sphereGeometry args={[RIG.sleeve.r, 20, 16]} />
            <meshStandardMaterial color={A.dressLight} roughness={0.75} />
          </mesh>
          {/* Cuff where the sleeve ends, so the arm leaves the sleeve rather
              than passing through the side of it. */}
          <mesh position={[0, -0.108, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RIG.armRadius + 0.004, 0.01, 8, 18]} />
            <meshStandardMaterial color={A.dressTrim} roughness={0.8} />
          </mesh>
          {/* Hand: a mitten, not a ball — narrowed across the palm, drawn out
              along the fingers, with a thumb at the inside edge. */}
          <group position={[0, -RIG.armLength, 0]}>
            <mesh scale={[0.84, 1.14, 0.96]} castShadow>
              <sphereGeometry args={[RIG.hand.r, ...SEG.blob]} />
              <meshStandardMaterial color={A.skin} roughness={0.8} />
            </mesh>
            <mesh
              position={[-side * RIG.hand.r * 0.58, 0.014, RIG.hand.r * 0.3]}
              rotation={[0, 0, side * 0.5]}
              scale={[0.8, 1.25, 0.8]}
            >
              <sphereGeometry args={[RIG.hand.r * 0.42, ...SEG.tiny]} />
              <meshStandardMaterial color={A.skin} roughness={0.8} />
            </mesh>
          </group>
        </group>
      ))}

      {/* --- head --- */}
      <group ref={head} position={[0, RIG.headY, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[R, ...SEG.head]} />
          <meshStandardMaterial color={A.skin} roughness={0.78} />
        </mesh>

        {/*
          Hair in two shells rather than one: a crown that stops above the brow,
          and a back shell that wraps round behind. One sphere big enough to
          read as hair would swallow the face.
        */}
        <mesh castShadow>
          <sphereGeometry
            args={[
              R + HAIR.crown.lift,
              ...SEG.hair,
              0,
              Math.PI * 2,
              0,
              HAIR.crown.thetaLength,
            ]}
          />
          <meshStandardMaterial color={A.hair} roughness={0.6} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry
            args={[
              R + HAIR.back.lift,
              ...SEG.hair,
              HAIR.back.phiStart,
              HAIR.back.phiLength,
              0,
              HAIR.back.thetaLength,
            ]}
          />
          <meshStandardMaterial color={A.hair} roughness={0.6} />
        </mesh>

        <Eye side={-1} />
        <Eye side={1} />
        <Brow side={-1} />
        <Brow side={1} />
        <HairFlower />

        <mesh position={[0, FACE.nose.y, FACE.nose.z]} scale={[1, 0.86, 0.72]}>
          <sphereGeometry args={[FACE.nose.r, 14, 12]} />
          <meshStandardMaterial color={A.skinShade} roughness={0.88} />
        </mesh>

        {/* A half-torus turned upside down: the curve opens upward, into a
            smile. Flattened front to back, so it follows the cheek. */}
        <mesh
          position={[0, FACE.mouth.y, FACE.mouth.z]}
          rotation={[0, 0, Math.PI]}
          scale={[1, 1, 0.7]}
        >
          <torusGeometry args={[FACE.mouth.r, FACE.mouth.tube, 10, 28, Math.PI]} />
          <meshStandardMaterial color={A.eye} roughness={0.45} />
        </mesh>

        <group ref={ponytail} position={[0, HAIR.ponytail.y, HAIR.ponytail.z]}>
          <mesh position={[0, -0.02, -0.07]} scale={[1, 0.94, 1.06]} castShadow>
            <sphereGeometry args={[0.11, 20, 16]} />
            <meshStandardMaterial color={A.hair} roughness={0.6} />
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
              <capsuleGeometry args={[seg.r, seg.len, 6, 18]} />
              <meshStandardMaterial color={i === 0 ? A.hair : A.hairSheen} roughness={0.6} />
            </mesh>
          ))}
          {/* The tie: a ring round the tail, not a cube through it. Turned to
              sit square across the fall of the hair. */}
          <mesh
            position={[0, -0.055, -0.105]}
            rotation={[Math.PI / 2 + 0.34, 0, 0]}
            castShadow
          >
            <torusGeometry args={[0.076, 0.023, 10, 24]} />
            <meshStandardMaterial color={A.ribbon} roughness={0.65} />
          </mesh>
          {/* Bow loops on the tie. */}
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[side * 0.105, -0.04, -0.095]}
              rotation={[0, 0, side * 0.35]}
              scale={[1, 0.7, 0.5]}
              castShadow
            >
              <sphereGeometry args={[0.058, ...SEG.blob]} />
              <meshStandardMaterial color={A.ribbon} roughness={0.65} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
