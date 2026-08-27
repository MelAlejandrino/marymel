"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  DoubleSide,
  Path,
  Shape,
  type Mesh,
  type PointLight,
} from "three";

import { decayBlaze, fireIntensity, hearth } from "./hearth.ts";
import { PALETTE } from "./palette.ts";
import {
  BACK_WALL,
  DOOR,
  frontWallHoles,
  frontWallOutline,
  gableOutline,
  HOUSE,
  HOUSE_BACK_OUTER,
  HOUSE_CENTRE_Z,
  HOUSE_FRONT_INNER,
  HOUSE_INNER_DEPTH,
  OUTER_HALF_WIDTH,
  CHIMNEY,
  DOORSTEP,
  HEARTH,
  GABLE_WINDOW,
  LANTERNS,
  RIDGE_Y,
  ROOF_LENGTH,
  roofHeightAt,
  roofSlabs,
  SIDE_WALLS,
  WINDOW,
  WINDOW_BOX,
  WINDOWS,
} from "./layout.ts";

/** Walls are double-sided so the room still reads once the door swings open. */
function Wall({ x, z, hx, hz }: { x: number; z: number; hx: number; hz: number }) {
  return (
    <mesh position={[x, HOUSE.wallHeight / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[hx * 2, HOUSE.wallHeight, hz * 2]} />
      <meshStandardMaterial color={PALETTE.wall} roughness={0.92} side={DoubleSide} />
    </mesh>
  );
}

/**
 * Cottage window.
 *
 * The wall has an actual hole in it (see `FrontWall`), so this is only the
 * glass and the joinery around it — and the joinery is fitted to *both* faces.
 * That is the whole fix for "inside there is a curtain and then the wall":
 * there was never an opening, just a pane stuck on the outside.
 */
function Window({ x, y }: { x: number; y: number }) {
  const w = WINDOW.width;
  const h = WINDOW.height;
  const f = WINDOW.frame;
  const t = HOUSE.wallThickness;
  /** Larger z is outdoors; the room is at smaller z. */
  const outer = HOUSE.frontZ + t / 2;
  const inner = HOUSE.frontZ - t / 2;

  /** Frame bars around an opening, on whichever face. */
  const bars = (depth: number) =>
    [
      { p: [0, h / 2 + f / 2, 0], s: [w + f * 2, f, depth] },
      { p: [0, -h / 2 - f / 2, 0], s: [w + f * 2, f, depth] },
      { p: [-w / 2 - f / 2, 0, 0], s: [f, h + f * 2, depth] },
      { p: [w / 2 + f / 2, 0, 0], s: [f, h + f * 2, depth] },
    ] as const;

  return (
    <group position={[x, y, 0]}>
      {/*
        Glass, in the middle of the wall's thickness. Transparent rather than an
        opaque glowing slab: from the garden it catches the low sun, and from
        the armchair you can see the trees. Double-sided, or it vanishes from
        one side.
      */}
      <mesh position={[0, 0, HOUSE.frontZ]}>
        <boxGeometry args={[w, h, 0.03]} />
        <meshStandardMaterial
          color={PALETTE.paneLit}
          emissive={PALETTE.paneLit}
          emissiveIntensity={0.28}
          transparent
          opacity={0.32}
          roughness={0.12}
          metalness={0.1}
          side={DoubleSide}
        />
      </mesh>

      {/* Reveal: the four inside faces of the hole, so the opening has depth
          instead of showing a paper-thin edge. */}
      {[
        { p: [0, h / 2 + 0.01, HOUSE.frontZ], s: [w, 0.02, t] },
        { p: [0, -h / 2 - 0.01, HOUSE.frontZ], s: [w, 0.02, t] },
        { p: [-w / 2 - 0.01, 0, HOUSE.frontZ], s: [0.02, h, t] },
        { p: [w / 2 + 0.01, 0, HOUSE.frontZ], s: [0.02, h, t] },
      ].map((face, i) => (
        <mesh key={i} position={face.p as [number, number, number]}>
          <boxGeometry args={face.s as [number, number, number]} />
          <meshStandardMaterial color={PALETTE.wallShade} roughness={0.95} />
        </mesh>
      ))}

      {/* Joinery, outside and in. */}
      {([outer, inner] as const).map((z, face) => {
        const push = face === 0 ? 0.06 : -0.06;
        return (
          <group key={face} position={[0, 0, z + push]}>
            {bars(0.13).map((bar, i) => (
              <mesh key={i} position={bar.p as [number, number, number]} castShadow>
                <boxGeometry args={bar.s as [number, number, number]} />
                <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
              </mesh>
            ))}
            {/* Mullions: one upright, one transom. */}
            <mesh>
              <boxGeometry args={[0.055, h, 0.05]} />
              <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
            </mesh>
            <mesh>
              <boxGeometry args={[w, 0.055, 0.05]} />
              <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
            </mesh>
            {/* Sill. The outside one is deep enough to carry the flower box;
                the inside one is a shelf you could stand a candle on. */}
            <mesh
              position={[0, -h / 2 - WINDOW.sillDrop, face === 0 ? 0.04 : -0.04]}
              castShadow
            >
              <boxGeometry args={[w + 0.42, 0.1, face === 0 ? 0.3 : 0.22]} />
              <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Flower box on the outside sill. Three blossoms is enough to read as
          planted; a real bouquet's worth just costs draw calls nobody sees. */}
      <group
        position={[0, -h / 2 - WINDOW.sillDrop - WINDOW_BOX.height / 2, outer + 0.22]}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[WINDOW_BOX.width, WINDOW_BOX.height, WINDOW_BOX.depth]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.9} flatShading />
        </mesh>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * 0.46, WINDOW_BOX.height / 2 + 0.06, 0]}>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color={PALETTE.blossom[(i + 1) % PALETTE.blossom.length]}
              roughness={0.8}
              flatShading
            />
          </mesh>
        ))}
      </group>

      {/* Sat in the opening, so it warms the wall outside and the room inside
          from one light rather than two. */}
      <pointLight
        position={[0, 0, HOUSE.frontZ]}
        color={PALETTE.paneLit}
        intensity={3.4}
        distance={6}
      />
    </group>
  );
}

/**
 * The front wall, extruded from its elevation with the doorway and both
 * windows cut out of it as holes.
 */
function FrontWall() {
  const shape = useMemo(() => {
    const outline = frontWallOutline();
    const s = new Shape();
    s.moveTo(outline[0][0], outline[0][1]);
    for (const [x, y] of outline.slice(1)) s.lineTo(x, y);
    s.closePath();

    s.holes = frontWallHoles().map((hole) => {
      const path = new Path();
      path.moveTo(hole[0][0], hole[0][1]);
      for (const [x, y] of hole.slice(1)) path.lineTo(x, y);
      path.closePath();
      return path;
    });
    return s;
  }, []);

  return (
    <mesh
      // ExtrudeGeometry runs along +z from the shape's plane, so start at the
      // wall's inner face and it finishes flush with the outer one.
      position={[0, 0, HOUSE.frontZ - HOUSE.wallThickness / 2]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry
        args={[shape, { depth: HOUSE.wallThickness, bevelEnabled: false }]}
      />
      <meshStandardMaterial color={PALETTE.wall} roughness={0.92} side={DoubleSide} />
    </mesh>
  );
}

/**
 * The gable end, extruded from the roofline outline so it closes the triangle
 * under the slabs exactly.
 */
function Gable({ z }: { z: number }) {
  const shape = useMemo(() => {
    const points = gableOutline();
    const s = new Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) s.lineTo(x, y);
    s.closePath();
    return s;
  }, []);

  return (
    <mesh position={[0, HOUSE.wallHeight, z]} castShadow receiveShadow>
      {/* ExtrudeGeometry runs along +z, so `z` is the far face. */}
      <extrudeGeometry args={[shape, { depth: HOUSE.wallThickness, bevelEnabled: false }]} />
      <meshStandardMaterial color={PALETTE.wallShade} roughness={0.92} side={DoubleSide} />
    </mesh>
  );
}

/**
 * The fire in the hearth.
 *
 * It flickers on its own and flares when a log goes on, which is what makes
 * "put a log on the fire" an action rather than a line of text. The blaze lives
 * in `hearth.ts` because the log basket is furniture and the fire is part of
 * the building — a shared number is the whole mechanism between them.
 */
function Fire() {
  const embers = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);

  useFrame((state, delta) => {
    hearth.blaze = decayBlaze(hearth.blaze, delta);
    const t = state.clock.elapsedTime;

    if (light.current) light.current.intensity = fireIntensity(hearth.blaze, t);
    if (embers.current) {
      // The embers swell with the blaze and breathe with the flicker.
      const swell = 1 + hearth.blaze * 0.5 + Math.sin(t * 6.1) * 0.05;
      embers.current.scale.setScalar(swell);
    }
  });

  return (
    <group position={[-0.55, 0.3, 0]}>
      <mesh ref={embers}>
        <icosahedronGeometry args={[0.36, 0]} />
        <meshStandardMaterial
          color="#ff9a4a"
          emissive="#ff7a2a"
          emissiveIntensity={2.4}
          flatShading
        />
      </mesh>
      {/* Logs in the grate, so the fire is burning something. */}
      {[-0.1, 0.12].map((z, i) => (
        <mesh
          key={z}
          position={[0.06, -0.24, z]}
          rotation={[Math.PI / 2, 0, i ? 0.4 : -0.3]}
        >
          <cylinderGeometry args={[0.07, 0.065, 0.5, 7]} />
          <meshStandardMaterial color="#4a3128" roughness={1} flatShading />
        </mesh>
      ))}
      <pointLight ref={light} position={[-0.35, 0.3, 0]} color="#ff9a52" distance={13} />
    </group>
  );
}

export function House() {
  const slabs = roofSlabs();
  const chimneyBase = roofHeightAt(CHIMNEY.x) - CHIMNEY.sink;

  return (
    <group>
      <FrontWall />
      {SIDE_WALLS.map((wall, i) => (
        <Wall key={`side-${i}`} {...wall} />
      ))}
      <Wall {...BACK_WALL} />

      {/* Interior floor, so an open door shows a room and not the void. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, HOUSE_CENTRE_Z]}
        receiveShadow
      >
        <planeGeometry args={[HOUSE.halfWidth * 2 - HOUSE.wallThickness, HOUSE_INNER_DEPTH]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.85} />
      </mesh>

      {WINDOWS.map((win) => (
        <Window key={win.x} {...win} />
      ))}

      {/* The hearth, set into the right-hand wall under the chimney — which
          until now vented nothing. */}
      <group position={[HEARTH.x, 0, HEARTH.z]}>
        <mesh position={[-HEARTH.depth / 2, HEARTH.height / 2 + 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[HEARTH.depth, HEARTH.height + 0.5, HEARTH.width + 0.7]} />
          <meshStandardMaterial color={PALETTE.stone} roughness={0.98} flatShading />
        </mesh>
        {/* Firebox: a dark recess cut back into the stone. */}
        <mesh position={[-HEARTH.depth / 2 + 0.06, HEARTH.height / 2, 0]}>
          <boxGeometry args={[HEARTH.depth, HEARTH.height, HEARTH.width]} />
          <meshStandardMaterial color="#2b1c18" roughness={1} />
        </mesh>
        <Fire />
        {/* Flue, carrying the hearth up to where the chimney breaks the roof.
            Without it the stack starts in mid-air above the fireplace. */}
        <mesh
          position={[
            CHIMNEY.x - HEARTH.x,
            (HEARTH.height + 0.4 + chimneyBase) / 2,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[CHIMNEY.width, chimneyBase - HEARTH.height - 0.4, CHIMNEY.width]}
          />
          <meshStandardMaterial color={PALETTE.wallShade} roughness={0.95} />
        </mesh>

        {/* Mantel */}
        <mesh position={[-HEARTH.depth / 2 - 0.06, HEARTH.height + 0.32, 0]} castShadow>
          <boxGeometry args={[HEARTH.depth + 0.24, 0.16, HEARTH.width + 1]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.85} />
        </mesh>
      </group>

      {/* Decorative beam across the head of the door. */}
      <mesh position={[0, DOOR.height + 0.18, HOUSE.frontZ]} castShadow>
        <boxGeometry args={[2.7, 0.2, HOUSE.wallThickness + 0.24]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.85} />
      </mesh>

      {/* Lanterns either side of the door, pooling warm light on the step. */}
      {LANTERNS.map((x) => (
        <group key={x} position={[x, 0, HOUSE.frontZ + 0.42]}>
          <mesh position={[0, 1.62, 0]} castShadow>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={PALETTE.timber} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.28, 0]} castShadow>
            <boxGeometry args={[0.26, 0.3, 0.26]} />
            <meshStandardMaterial
              color={PALETTE.lampLit}
              emissive={PALETTE.lampLit}
              emissiveIntensity={1.8}
            />
          </mesh>
          <mesh position={[0, 1.47, 0]} castShadow>
            <coneGeometry args={[0.24, 0.16, 4]} />
            <meshStandardMaterial color={PALETTE.roofRidge} roughness={0.85} flatShading />
          </mesh>
          <pointLight
            position={[0, 1.28, 0.1]}
            color={PALETTE.lampLit}
            intensity={5}
            distance={6}
          />
        </group>
      ))}

      {/* Doorstep */}
      <mesh position={[0, DOORSTEP.height / 2, DOORSTEP.z]} castShadow receiveShadow>
        <boxGeometry args={[DOORSTEP.halfWidth * 2, DOORSTEP.height, DOORSTEP.depth]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.95} />
      </mesh>

      {slabs.map((slab, i) => (
        <mesh
          key={i}
          position={slab.position}
          rotation={[0, 0, slab.rotationZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={slab.size} />
          <meshStandardMaterial color={PALETTE.roof} roughness={0.85} />
        </mesh>
      ))}

      {/* Ridge cap, hiding the seam where the two slabs meet. */}
      <mesh position={[0, RIDGE_Y + 0.04, HOUSE_CENTRE_Z]} castShadow>
        <boxGeometry args={[0.42, 0.22, ROOF_LENGTH]} />
        <meshStandardMaterial color={PALETTE.roofRidge} roughness={0.8} />
      </mesh>

      <Gable z={HOUSE_FRONT_INNER} />
      <Gable z={HOUSE_BACK_OUTER} />

      {/* A little round window in the front gable. */}
      <group position={[0, GABLE_WINDOW.y, HOUSE.frontZ + HOUSE.wallThickness / 2]}>
        {/* A cylinder's axis is Y by default, which would stand the pane
            edge-on to the wall. Tip it to face out of the gable. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[GABLE_WINDOW.radius, GABLE_WINDOW.radius, 0.08, 16]} />
          <meshStandardMaterial
            color={PALETTE.paneLit}
            emissive={PALETTE.paneLit}
            emissiveIntensity={0.7}
          />
        </mesh>
        <mesh>
          <torusGeometry args={[GABLE_WINDOW.radius + 0.02, GABLE_WINDOW.rim, 8, 20]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
        </mesh>
      </group>

      <group position={[CHIMNEY.x, 0, CHIMNEY.z]}>
        <mesh position={[0, (chimneyBase + CHIMNEY.top) / 2, 0]} castShadow>
          <boxGeometry args={[CHIMNEY.width, CHIMNEY.top - chimneyBase, CHIMNEY.width]} />
          <meshStandardMaterial color={PALETTE.wallShade} roughness={0.95} />
        </mesh>
        <mesh position={[0, CHIMNEY.top + 0.08, 0]} castShadow>
          <boxGeometry args={[CHIMNEY.width + 0.18, 0.16, CHIMNEY.width + 0.18]} />
          <meshStandardMaterial color={PALETTE.roofRidge} roughness={0.9} />
        </mesh>
      </group>

      {/* Corner timbers, breaking up the flat cream walls. */}
      {[-1, 1].map((side) =>
        [HOUSE.frontZ, HOUSE.backZ].map((z) => (
          <mesh
            key={`${side}-${z}`}
            position={[side * OUTER_HALF_WIDTH, HOUSE.wallHeight / 2, z]}
            castShadow
          >
            <boxGeometry args={[0.16, HOUSE.wallHeight, 0.16]} />
            <meshStandardMaterial color={PALETTE.timber} roughness={0.85} />
          </mesh>
        )),
      )}
    </group>
  );
}
