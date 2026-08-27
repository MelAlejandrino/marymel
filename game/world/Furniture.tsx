"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { DoubleSide } from "three";

import { useInteractable } from "../interaction/registry.ts";
import {
  isSeatedAt,
  seatedOwner,
  sitAt,
  standUp,
  subscribeToSeating,
} from "../player/seat.ts";
import { stokeFire } from "./hearth.ts";
import { PALETTE } from "./palette.ts";
import {
  actionRange,
  FURNITURE,
  SEAT_FRONT,
  SEAT_SURFACE,
  RUGS,
  SCONCES,
  seatAnchor,
  type Furniture,
} from "./furniture.ts";
import {
  HOUSE,
  HOUSE_BACK_INNER,
  HOUSE_CENTRE_Z,
  HOUSE_FRONT_INNER,
  WINDOW,
  WINDOWS,
} from "./layout.ts";

/**
 * Everything carried into the cottage.
 *
 * Each piece is modelled in its own axes — origin on the floor at its centre,
 * facing +z — and `furniture.ts` says where it stands and which way it is
 * turned. That is the same split the rest of the world uses: the numbers live
 * in one file, the meshes read them, and `furniture.test.ts` checks nothing
 * ends up inside a wall or on top of anything else.
 *
 * ponytail: only the big pieces cast shadows. The shadow map covers the whole
 * garden and is redrawn every frame, so it does not get the camera culling
 * that spares the interior while she is outside — and nobody has ever looked
 * for the shadow of a paperback. Put `castShadow` back on a piece if its
 * shadow turns out to matter.
 *
 * ponytail: plain boxes and spheres, no loader, no glTF. At this art style a
 * sofa is a box with three cushions on it, and a real asset pipeline would buy
 * nothing but a download. If a piece ever needs to be genuinely detailed, it
 * can be a model without the other twelve becoming models too.
 */

const H = PALETTE.home;

/** Four legs under a top, at the corners of a footprint. */
function Legs({
  hx,
  hz,
  height,
  radius = 0.05,
  color = H.walnut,
}: {
  hx: number;
  hz: number;
  height: number;
  radius?: number;
  color?: string;
}) {
  return (
    <>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * hx, height / 2, sz * hz]}>
            <cylinderGeometry args={[radius, radius * 0.85, height, 6]} />
            <meshStandardMaterial color={color} roughness={0.85} flatShading />
          </mesh>
        )),
      )}
    </>
  );
}

function Sofa() {
  // Every height is measured off the cushion she actually sits on, and every
  // depth off the front edge her knees have to clear, so the model and the seat
  // anchor cannot drift apart.
  const S = SEAT_SURFACE.sofa;
  const D = SEAT_FRONT.sofa * 2;

  return (
    <group>
      <mesh position={[0, (0.16 + S - 0.06) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, S - 0.22, D]} />
        <meshStandardMaterial color={H.fabricShade} roughness={0.95} />
      </mesh>
      {/* Back, leaned a little so it does not read as a crate. */}
      <mesh position={[0, S + 0.21, -0.4]} rotation={[0.09, 0, 0]} castShadow>
        <boxGeometry args={[2.2, 0.62, 0.22]} />
        <meshStandardMaterial color={H.fabric} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.0, S - 0.02, 0]} castShadow>
          <boxGeometry args={[0.22, 0.44, D]} />
          <meshStandardMaterial color={H.fabric} roughness={0.95} />
        </mesh>
      ))}
      {/* Seat cushions, their tops flush with the seat height. */}
      {[-0.65, 0, 0.65].map((x) => (
        <mesh key={x} position={[x, S - 0.08, 0.06]}>
          <boxGeometry args={[0.62, 0.16, D - 0.18]} />
          <meshStandardMaterial color={H.fabric} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* Throw cushions, in the dress pinks and golds, so the room ties to her. */}
      {[-0.72, 0.72].map((x, i) => (
        <mesh
          key={x}
          position={[x, S + 0.14, -0.24]}
          rotation={[0.4, 0, i === 0 ? 0.2 : -0.2]}
        >
          <boxGeometry args={[0.36, 0.36, 0.14]} />
          <meshStandardMaterial color={H.cushion[i]} roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* A blanket thrown over one arm. */}
      <mesh position={[0.95, S + 0.19, 0.12]} rotation={[0, 0, 0.06]}>
        <boxGeometry args={[0.42, 0.1, 0.66]} />
        <meshStandardMaterial color={H.cushion[2]} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.06, S - 0.08, 0.12]}>
        <boxGeometry args={[0.16, 0.44, 0.6]} />
        <meshStandardMaterial color={H.cushion[2]} roughness={0.95} flatShading />
      </mesh>
      <Legs hx={0.95} hz={0.36} height={0.16} />
    </group>
  );
}

function Armchair() {
  const S = SEAT_SURFACE.armchair;
  const D = SEAT_FRONT.armchair * 2;

  return (
    <group>
      <mesh position={[0, (0.14 + S - 0.06) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.84, S - 0.2, D]} />
        <meshStandardMaterial color={H.fabricShade} roughness={0.95} />
      </mesh>
      <mesh position={[0, S + 0.26, -0.34]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.84, 0.7, 0.2]} />
        <meshStandardMaterial color={H.cushion[0]} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.36, S + 0.02, 0.04]} castShadow>
          <boxGeometry args={[0.16, 0.4, D - 0.06]} />
          <meshStandardMaterial color={H.cushion[0]} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, S - 0.08, 0.06]}>
        <boxGeometry args={[0.6, 0.16, D - 0.16]} />
        <meshStandardMaterial color={H.fabric} roughness={0.95} flatShading />
      </mesh>
      <Legs hx={0.32} hz={0.32} height={0.14} />
    </group>
  );
}

function CoffeeTable() {
  return (
    <group>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.07, 0.7]} />
        <meshStandardMaterial color={H.oak} roughness={0.8} flatShading />
      </mesh>
      {/* Lower shelf, with a stack of books on it. */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.86, 0.05, 0.56]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.85} flatShading />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.24, 0.24 + i * 0.055, 0]} rotation={[0, i * 0.14, 0]}>
          <boxGeometry args={[0.34, 0.05, 0.26]} />
          <meshStandardMaterial color={H.books[i]} roughness={0.85} />
        </mesh>
      ))}
      {/* Two mugs, because someone was sitting here. */}
      {[0.16, 0.34].map((x, i) => (
        <group key={x} position={[x, 0.53, i === 0 ? -0.1 : 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.048, 0.11, 10]} />
            <meshStandardMaterial color={H.linen} roughness={0.6} />
          </mesh>
          <mesh position={[0.062, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.032, 0.011, 6, 10]} />
            <meshStandardMaterial color={H.linen} roughness={0.6} />
          </mesh>
        </group>
      ))}
      <Legs hx={0.42} hz={0.28} height={0.44} radius={0.045} />
    </group>
  );
}

function Bookshelf() {
  const shelves = [0.45, 0.87, 1.29, 1.71];

  return (
    <group>
      {/* Carcass: two sides, a back and a top. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.05, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 2.1, 0.56]} />
          <meshStandardMaterial color={H.walnut} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, -0.26]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.1, 0.05]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.06, 0]} castShadow>
        <boxGeometry args={[2.32, 0.1, 0.64]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} flatShading />
      </mesh>

      {shelves.map((y, row) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 0.05, 0.54]} />
            <meshStandardMaterial color={H.oak} roughness={0.85} />
          </mesh>
          {/* Books, leaning a little where the row runs out. */}
          {Array.from({ length: 7 }, (_, i) => {
            const lean = row === 1 && i === 6 ? 0.32 : 0;
            const height = 0.24 + ((i + row) % 3) * 0.05;
            return (
              <mesh
                key={i}
                position={[-0.86 + i * 0.2, y + 0.03 + height / 2, 0]}
                rotation={[0, 0, lean]}
              >
                <boxGeometry args={[0.11, height, 0.32]} />
                <meshStandardMaterial
                  color={H.books[(i + row * 2) % H.books.length]}
                  roughness={0.9}
                  flatShading
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* A jar and a small plant on the top, so the shelf does not end flat. */}
      <mesh position={[-0.6, 2.24, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.26, 10]} />
        <meshStandardMaterial
          color={H.cushion[1]}
          roughness={0.35}
          transparent
          opacity={0.75}
        />
      </mesh>
      <group position={[0.62, 2.11, 0]}>
        <mesh>
          <cylinderGeometry args={[0.13, 0.1, 0.18, 8]} />
          <meshStandardMaterial color={H.pot} roughness={0.9} flatShading />
        </mesh>
        {[
          [0, 0.2, 0],
          [0.11, 0.15, 0.06],
          [-0.09, 0.16, -0.05],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <icosahedronGeometry args={[0.12 - i * 0.02, 0]} />
            <meshStandardMaterial color={H.foliage} roughness={0.9} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Bed() {
  return (
    <group>
      {/* Headboard at -z, against the back wall. */}
      <mesh position={[0, 0.78, -1.06]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.12, 0.12]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.84, 1.4, -1.06]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={H.metal} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.42, 0.98]} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.1]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} />
      </mesh>
      {/* Mattress and duvet. */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.26, 2.1] } />
        <meshStandardMaterial color={H.linen} roughness={0.95} />
      </mesh>
      {/* Duvet, its top at the surface she lies on. */}
      <mesh position={[0, SEAT_SURFACE.bed - 0.07, 0.24]} castShadow>
        <boxGeometry args={[1.76, 0.14, 1.6]} />
        <meshStandardMaterial color={H.duvet} roughness={0.95} flatShading />
      </mesh>
      {/* Folded throw across the foot. */}
      <mesh position={[0, 0.74, 0.78]}>
        <boxGeometry args={[1.76, 0.1, 0.5]} />
        <meshStandardMaterial color={H.cushion[0]} roughness={0.95} flatShading />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.72, -0.76]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.72, 0.16, 0.42]} />
          <meshStandardMaterial color={H.linen} roughness={0.95} flatShading />
        </mesh>
      ))}
      <Legs hx={0.8} hz={0.98} height={0.36} />
    </group>
  );
}

function RoundTable() {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.72, 0.07, 20]} />
        <meshStandardMaterial color={H.oak} roughness={0.8} flatShading />
      </mesh>
      {/* Pedestal rather than four legs, so the chairs can tuck under. */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.68, 8]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.08, 10]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} flatShading />
      </mesh>

      {/* A vase of the same blossoms that grow outside. */}
      <group position={[0, 0.76, 0]}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.11, 0.22, 10]} />
          <meshStandardMaterial color={H.linen} roughness={0.5} />
        </mesh>
        {[
          [0, 0.3, 0],
          [0.1, 0.25, 0.05],
          [-0.08, 0.27, -0.06],
          [0.04, 0.22, -0.09],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <icosahedronGeometry args={[0.075, 0]} />
            <meshStandardMaterial
              color={PALETTE.blossom[i % PALETTE.blossom.length]}
              roughness={0.8}
              flatShading
            />
          </mesh>
        ))}
      </group>

      {/* Two places laid, because the room is for two people. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.42, 0.76, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.02, 14]} />
            <meshStandardMaterial color={H.linen} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Chair({ tint = 0 }: { tint?: number }) {
  const S = SEAT_SURFACE.chair;
  const D = SEAT_FRONT.chair * 2;

  return (
    <group>
      <mesh position={[0, S - 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.07, D]} />
        <meshStandardMaterial color={H.oak} roughness={0.85} flatShading />
      </mesh>
      {/* Back at -z, so a chair at rotation 0 faces the room. */}
      <mesh position={[0, S + 0.28, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.62, 0.06]} />
        <meshStandardMaterial color={H.oak} roughness={0.85} />
      </mesh>
      <mesh position={[0, S + 0.12, -0.19]}>
        <boxGeometry args={[0.42, 0.1, 0.04]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.85} />
      </mesh>
      {/* A cushion tied on, its top flush with the seat height. */}
      <mesh position={[0, S - 0.035, 0.01]}>
        <boxGeometry args={[0.42, 0.07, D - 0.08]} />
        <meshStandardMaterial
          color={H.cushion[tint % H.cushion.length]}
          roughness={0.92}
          flatShading
        />
      </mesh>
      <Legs hx={0.2} hz={0.2} height={S - 0.12} radius={0.035} color={H.oakDark} />
    </group>
  );
}

function Console({ off }: { off: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.07, 0.5]} />
        <meshStandardMaterial color={H.oak} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 0.6, -0.02]} castShadow>
        <boxGeometry args={[1.5, 0.34, 0.42]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.85} />
      </mesh>
      {/* Two drawers with brass knobs. */}
      {[-0.38, 0.38].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.6, 0.21]}>
            <boxGeometry args={[0.66, 0.28, 0.02]} />
            <meshStandardMaterial color={H.oak} roughness={0.8} />
          </mesh>
          <mesh position={[x, 0.6, 0.25]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      ))}
      <Legs hx={0.76} hz={0.19} height={0.6} radius={0.045} />

      {/* A dish for keys, and a lamp that is actually on. */}
      <mesh position={[-0.52, 0.87, 0]}>
        <cylinderGeometry args={[0.14, 0.11, 0.05, 12]} />
        <meshStandardMaterial color={H.cushion[2]} roughness={0.5} />
      </mesh>
      <group position={[0.5, 0.85, 0]}>
        <mesh>
          <cylinderGeometry args={[0.11, 0.14, 0.05, 12]} />
          <meshStandardMaterial color={H.metal} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.34, 6]} />
          <meshStandardMaterial color={H.metal} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.13, 0.19, 0.24, 12, 1, true]} />
          <meshStandardMaterial
            color={off ? H.fabricShade : PALETTE.lampLit}
            emissive={PALETTE.lampLit}
            emissiveIntensity={off ? 0 : 0.9}
            roughness={0.6}
            side={DoubleSide}
          />
        </mesh>
        {/* The one lamp that earns a real light, because switching it is the
            whole point of it being there. */}
        <pointLight
          position={[0, 0.4, 0]}
          color={PALETTE.lampLit}
          intensity={off ? 0 : 9}
          distance={7}
        />
      </group>
    </group>
  );
}

function Plant() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.21, 0.44, 10]} />
        <meshStandardMaterial color={H.pot} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.31, 0.29, 0.09, 10]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.95} flatShading />
      </mesh>
      {/* Leaves on stems, rather than one green ball. */}
      {[
        { p: [0, 0.92, 0], r: 0.3 },
        { p: [0.24, 0.74, 0.1], r: 0.23 },
        { p: [-0.2, 0.8, -0.12], r: 0.25 },
        { p: [0.08, 1.16, -0.06], r: 0.19 },
      ].map((leaf, i) => (
        <mesh key={i} position={leaf.p as [number, number, number]} castShadow>
          <icosahedronGeometry args={[leaf.r, 0]} />
          <meshStandardMaterial
            color={i % 2 ? H.foliage : PALETTE.leaves[1]}
            roughness={0.9}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

function LogBasket() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.48, 10, 1, true]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.95} flatShading side={DoubleSide} />
      </mesh>
      {[
        { p: [0, 0.5, 0.06], r: 0 },
        { p: [-0.1, 0.52, -0.08], r: 0.5 },
        { p: [0.12, 0.58, -0.02], r: -0.4 },
      ].map((log, i) => (
        <mesh
          key={i}
          position={log.p as [number, number, number]}
          rotation={[Math.PI / 2, 0, log.r]}
        >
          <cylinderGeometry args={[0.075, 0.07, 0.44, 7]} />
          <meshStandardMaterial color={PALETTE.trunk} roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Piece({ item, active }: { item: Furniture; active: boolean }) {
  switch (item.kind) {
    case "sofa":
      return <Sofa />;
    case "armchair":
      return <Armchair />;
    case "coffeeTable":
      return <CoffeeTable />;
    case "bookshelf":
      return <Bookshelf />;
    case "bed":
      return <Bed />;
    case "roundTable":
      return <RoundTable />;
    case "chair":
      return <Chair tint={item.tint} />;
    case "console":
      return <Console off={active} />;
    case "plant":
      return <Plant />;
    case "logBasket":
      return <LogBasket />;
  }
}

/** Nothing is ever seated on the server. */
const noOwner = () => null;

/**
 * A piece of furniture, standing where it stands and offering whatever it is
 * she can do with it.
 *
 * It registers with the same interaction registry the door, the letters and the
 * claw machine use, so the prompt, the range check and the nearest-thing-wins
 * rule all come for free — nothing here knows what a prompt is.
 */
function Standing({
  item,
  index,
  active,
  onToggle,
}: {
  item: Furniture;
  index: number;
  active: boolean;
  onToggle: (index: number) => void;
}) {
  const id = `furniture:${index}`;
  const { action } = item;
  // Subscribed rather than read: she sits down from inside a frame loop, and
  // this prompt has to change from "sit on the sofa" to "get up" when she does.
  const seated = useSyncExternalStore(subscribeToSeating, seatedOwner, noOwner) === id;

  /**
   * What the prompt offers right now. A seat that she is already in offers the
   * way out of it, or sitting down would be a one-way trip.
   */
  const prompt = (() => {
    if (!action) return null;
    if (action.kind === "seat") {
      return seated
        ? { verb: "RISE" as const, label: "" }
        : { verb: action.verb, label: action.label };
    }
    if (action.kind === "toggle") return active ? action.active : action.idle;
    return { verb: action.verb, label: action.label };
  })();

  const act = useCallback(() => {
    if (!action) return;
    switch (action.kind) {
      case "seat": {
        if (isSeatedAt(id)) {
          standUp();
          return;
        }
        const anchor = seatAnchor(item);
        if (!anchor) return;
        sitAt({
          ...anchor,
          posture: action.verb === "LIE" ? "lie" : "sit",
          ownerId: id,
        });
        return;
      }
      case "toggle":
        onToggle(index);
        return;
      case "stoke":
        stokeFire();
        return;
    }
  }, [action, id, index, item, onToggle]);

  useInteractable(
    prompt
      ? {
          // Stable because FURNITURE is a static, hand-written list.
          id,
          x: item.x,
          z: item.z,
          range: actionRange(item),
          verb: prompt.verb,
          label: prompt.label,
          enabled: true,
          onInteract: act,
        }
      : null,
  );

  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rotation, 0]}>
      <Piece item={item} active={active} />
    </group>
  );
}

/**
 * Wall sconce. Emissive only, with no light of its own: the hearth and the
 * windows already light this room, and every extra point light is paid for by
 * every fragment on screen.
 */
function Sconce({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 1.9, z]} rotation={[0, x > 0 ? Math.PI : 0, 0]}>
      <mesh>
        <boxGeometry args={[0.08, 0.3, 0.12]} />
        <meshStandardMaterial color={H.metal} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.14, 0.1, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color={H.metal} roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.27, 0.22, 0]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshStandardMaterial
          color={PALETTE.lampLit}
          emissive={PALETTE.lampLit}
          emissiveIntensity={1.6}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** Bunting strung along the back wall. */
function Bunting() {
  const span = 9;
  const count = 13;

  return (
    <group position={[0, 2.6, HOUSE_BACK_INNER + 0.06]}>
      <mesh>
        <boxGeometry args={[span, 0.02, 0.02]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.9} />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1) - 0.5;
        return (
          <mesh
            key={i}
            // Sag, so the line hangs instead of being nailed flat.
            position={[t * span, -0.14 - Math.cos(t * Math.PI) * 0.1, 0]}
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[0.11, 0.24, 3]} />
            <meshStandardMaterial
              color={PALETTE.blossom[i % PALETTE.blossom.length]}
              roughness={0.85}
              flatShading
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** A clock on the back wall — the one thing in the room that is not decoration. */
function WallClock() {
  return (
    <group position={[0, 2.1, HOUSE_BACK_INNER + 0.08]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 20]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 20]} />
        <meshStandardMaterial color={H.linen} roughness={0.6} />
      </mesh>
      {/* Stopped at ten past ten, the hour every clock in every advert shows,
          because it is the one that looks like a smile. */}
      {[
        { r: 0.14, a: 1.05, w: 0.02 },
        { r: 0.19, a: -1.05, w: 0.015 },
      ].map((hand, i) => (
        <mesh
          key={i}
          position={[Math.sin(hand.a) * hand.r, Math.cos(hand.a) * hand.r, 0.07]}
          rotation={[0, 0, -hand.a]}
        >
          <boxGeometry args={[hand.w, hand.r * 2, 0.012]} />
          <meshStandardMaterial color={PALETTE.avatar.eye} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Curtains, drawn back either side of each front window. */
function Curtains({ x }: { x: number }) {
  const z = HOUSE_FRONT_INNER - 0.06;
  const y = WINDOWS[0].y;

  return (
    <group position={[x, y, z]}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (WINDOW.width / 2 + 0.18), 0.1, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.13, 0.17, WINDOW.height + 0.5, 8]} />
          <meshStandardMaterial color={H.cushion[0]} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* Rail */}
      <mesh
        position={[0, WINDOW.height / 2 + 0.28, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.028, 0.028, WINDOW.width + 0.8, 8]} />
        <meshStandardMaterial color={H.walnut} roughness={0.85} />
      </mesh>
      {/* Pelmet, hiding the top of the rail. */}
      <mesh position={[0, WINDOW.height / 2 + 0.4, 0.02]}>
        <boxGeometry args={[WINDOW.width + 0.9, 0.18, 0.1]} />
        <meshStandardMaterial color={H.cushion[0]} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Furnishings() {
  /**
   * Which toggles are flipped, by index. One object rather than state per
   * piece: the pieces are a static list, and a lid does not need its own hook.
   */
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const onToggle = useCallback(
    (index: number) =>
      setToggled((prev) => ({ ...prev, [index]: !prev[index] })),
    [],
  );

  return (
    <group>
      {FURNITURE.map((item, i) => (
        <Standing
          key={i}
          item={item}
          index={i}
          active={!!toggled[i]}
          onToggle={onToggle}
        />
      ))}

      {RUGS.map((rug) => (
        <group key={`${rug.x},${rug.z}`} position={[rug.x, 0, rug.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
            <circleGeometry args={[rug.radius, 24]} />
            <meshStandardMaterial color={H.rug} roughness={0.98} />
          </mesh>
          {/* A border ring, so a rug is not one flat disc of colour. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, 0]} receiveShadow>
            <ringGeometry args={[rug.radius * 0.78, rug.radius * 0.86, 24]} />
            <meshStandardMaterial color={H.rugTrim} roughness={0.98} />
          </mesh>
        </group>
      ))}

      {SCONCES.map((sconce) => (
        <Sconce key={`${sconce.x},${sconce.z}`} {...sconce} />
      ))}

      {WINDOWS.map((win) => (
        <Curtains key={win.x} x={win.x} />
      ))}

      <Bunting />
      <WallClock />

      {/* One soft fill for the middle of the room. The hearth is off to one
          side, so without this the far corner reads as a cave. */}
      <pointLight
        position={[-2, 2.4, HOUSE_CENTRE_Z]}
        color={PALETTE.lampLit}
        intensity={14}
        distance={13}
      />
      {/* Skirting, tying the walls to the floor all the way round. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (HOUSE.halfWidth - HOUSE.wallThickness / 2 - 0.04), 0.11, HOUSE_CENTRE_Z]}
        >
          <boxGeometry args={[0.08, 0.22, HOUSE_FRONT_INNER - HOUSE_BACK_INNER]} />
          <meshStandardMaterial color={H.oakDark} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 0.11, HOUSE_BACK_INNER + 0.04]}>
        <boxGeometry args={[HOUSE.halfWidth * 2 - HOUSE.wallThickness, 0.22, 0.08]} />
        <meshStandardMaterial color={H.oakDark} roughness={0.9} />
      </mesh>
    </group>
  );
}
