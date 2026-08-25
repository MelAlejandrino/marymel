"use client";

import { useMemo } from "react";
import { DoubleSide, Shape } from "three";

import { PALETTE } from "./palette.ts";
import {
  BACK_WALL,
  DOOR,
  FRONT_SEGMENTS,
  gableOutline,
  HOUSE,
  HOUSE_BACK_OUTER,
  HOUSE_CENTRE_Z,
  HOUSE_FRONT_INNER,
  HOUSE_INNER_DEPTH,
  OUTER_HALF_WIDTH,
  CHIMNEY,
  DOORSTEP,
  GABLE_WINDOW,
  LANTERNS,
  RIDGE_Y,
  ROOF_LENGTH,
  roofHeightAt,
  roofSlabs,
  SIDE_WALLS,
  WINDOW,
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

/** Cottage window: recess, glowing pane, frame and mullions. */
function Window({ x, y }: { x: number; y: number }) {
  const w = WINDOW.width;
  const h = WINDOW.height;
  const f = WINDOW.frame;
  const z = HOUSE.frontZ + HOUSE.wallThickness / 2;

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[w, h, 0.06]} />
        <meshStandardMaterial
          color={PALETTE.paneLit}
          emissive={PALETTE.paneLit}
          emissiveIntensity={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* Frame: four bars around the pane rather than a slab behind it. */}
      {[
        { p: [0, h / 2 + f / 2, 0.04], s: [w + f * 2, f, 0.14] },
        { p: [0, -h / 2 - f / 2, 0.04], s: [w + f * 2, f, 0.14] },
        { p: [-w / 2 - f / 2, 0, 0.04], s: [f, h + f * 2, 0.14] },
        { p: [w / 2 + f / 2, 0, 0.04], s: [f, h + f * 2, 0.14] },
      ].map((bar, i) => (
        <mesh key={i} position={bar.p as [number, number, number]} castShadow>
          <boxGeometry args={bar.s as [number, number, number]} />
          <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
        </mesh>
      ))}

      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.06, h, 0.06]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[w, 0.06, 0.06]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
      </mesh>

      {/* Sill */}
      <mesh position={[0, -h / 2 - WINDOW.sillDrop, 0.08]} castShadow>
        <boxGeometry args={[w + 0.42, 0.1, 0.26]} />
        <meshStandardMaterial color={PALETTE.timber} roughness={0.8} />
      </mesh>

      {/* Light spilling out onto the wall below. */}
      <pointLight position={[0, 0, 0.5]} color={PALETTE.paneLit} intensity={2.2} distance={4} />
    </group>
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

export function House() {
  const slabs = roofSlabs();
  const chimneyBase = roofHeightAt(CHIMNEY.x) - CHIMNEY.sink;

  return (
    <group>
      {FRONT_SEGMENTS.map((wall, i) => (
        <Wall key={`front-${i}`} {...wall} />
      ))}
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

      {/*
        Wall above the doorway. The front segments stop either side of the
        opening, so without this the gap runs the full wall height and you can
        see daylight over the door.
      */}
      <mesh
        position={[0, (DOOR.height + HOUSE.wallHeight) / 2, HOUSE.frontZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            DOOR.halfWidth * 2,
            HOUSE.wallHeight - DOOR.height,
            HOUSE.wallThickness,
          ]}
        />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.92} side={DoubleSide} />
      </mesh>

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
