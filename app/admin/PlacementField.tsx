"use client";

import { useId, useRef, useState } from "react";

import { insideBox, resolve } from "@/game/collision";
import { footprint, FURNITURE } from "@/game/world/furniture";
import {
  BACK_WALL,
  collidersFor,
  DOOR,
  FENCE,
  FRONT_SEGMENTS,
  HEARTH_COLLIDER,
  HOUSE,
  HOUSE_BACK_OUTER,
  HOUSE_FRONT_OUTER,
  OUTER_HALF_WIDTH,
  PATH_STONES,
  PLAYER_RADIUS,
  SIDE_WALLS,
  TREES,
  WORLD_BOUNDS,
} from "@/game/world/layout";
import { spotRange } from "@/game/world/spots/meta";

/**
 * Place a spot by dragging it on a map of the world, instead of typing
 * coordinates.
 *
 * The map is drawn from `game/world/layout.ts` — the same constants the game
 * renders and collides against — so it cannot drift out of step with the actual
 * garden. It is deliberately top-down and to scale: world x runs left to right,
 * world z runs top to bottom, which matches how the world looks from above
 * with the cottage at the back.
 *
 * The numbers still exist, in hidden inputs, so every server action keeps
 * working exactly as before and this stays a presentation change.
 */

const R = WORLD_BOUNDS;
/** A little breathing room so the fence is not flush against the edge. */
const PAD = 1.6;

/** Facing, as eight directions. `atan2(dx, dz)` matches the game's convention. */
const COMPASS: { dx: number; dz: number; arrow: string; name: string }[] = [
  { dx: -1, dz: -1, arrow: "↖", name: "back-left" },
  { dx: 0, dz: -1, arrow: "↑", name: "away from you" },
  { dx: 1, dz: -1, arrow: "↗", name: "back-right" },
  { dx: -1, dz: 0, arrow: "←", name: "left" },
  { dx: 0, dz: 0, arrow: "", name: "" },
  { dx: 1, dz: 0, arrow: "→", name: "right" },
  { dx: -1, dz: 1, arrow: "↙", name: "front-left" },
  { dx: 0, dz: 1, arrow: "↓", name: "toward you" },
  { dx: 1, dz: 1, arrow: "↘", name: "front-right" },
];

const angleFor = (dx: number, dz: number) => Math.atan2(dx, dz);

/** Which compass point a rotation is closest to, so the right one lights up. */
function nearestCompass(rotation: number): number {
  let best = 7;
  let bestGap = Infinity;
  COMPASS.forEach((c, i) => {
    if (!c.arrow) return;
    const gap = Math.abs(
      Math.atan2(
        Math.sin(angleFor(c.dx, c.dz) - rotation),
        Math.cos(angleFor(c.dx, c.dz) - rotation),
      ),
    );
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

/**
 * Whether this is a sensible place for it. Two conditions, and both matter:
 *
 * 1. The spot must not be *inside* a wall or a tree trunk. It would be buried.
 * 2. Somewhere within reach must be standable, so she can get to it.
 *
 * The second alone is not enough: a spot buried in a wall still has open ground
 * on the far side, so it passes the reach test while being invisible. A frame
 * flush *against* a wall sits at the wall's face rather than in it, so it
 * satisfies both.
 */
function isReachable(x: number, z: number, kind: string): boolean {
  const colliders = collidersFor(true);

  if (colliders.some((box) => insideBox({ x, z }, box))) return false;

  const reach = spotRange(kind) - 0.35;
  if (reach <= 0) return true;

  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: x + Math.cos(a) * reach, z: z + Math.sin(a) * reach };
  }).some((p) => {
    const settled = resolve(p, PLAYER_RADIUS, colliders, WORLD_BOUNDS);
    return Math.abs(settled.x - p.x) < 1e-6 && Math.abs(settled.z - p.z) < 1e-6;
  });
}

/** What each piece is called, for the label on the map. */
const FURNITURE_LABEL: Record<string, string> = {
  sofa: "sofa",
  armchair: "chair",
  coffeeTable: "table",
  bookshelf: "shelves",
  bed: "bed",
  roundTable: "table",
  chair: "chair",
  console: "console",
  plant: "plant",
  logBasket: "logs",
};

const Wall = ({ x, z, hx, hz }: { x: number; z: number; hx: number; hz: number }) => (
  <rect
    x={x - hx}
    y={z - hz}
    width={hx * 2}
    height={hz * 2}
    fill="#efe4d4"
    opacity={0.9}
  />
);

export function PlacementField({
  kind,
  x: initialX,
  z: initialZ,
  rotation: initialRotation = 0,
  others = [],
}: {
  kind: string;
  x: number;
  z: number;
  rotation?: number;
  /** The other things already out there, for context. */
  others?: { x: number; z: number; title: string; kind: string }[];
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState({ x: initialX, z: initialZ });
  const [rotation, setRotation] = useState(initialRotation);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();

  const reachable = isReachable(pos.x, pos.z, kind);
  const facing = nearestCompass(rotation);

  /** Screen point to world point, clamped inside the fence. */
  function toWorld(event: React.PointerEvent) {
    const el = svg.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const span = (R + PAD) * 2;
    const wx = ((event.clientX - box.left) / box.width) * span - (R + PAD);
    const wz = ((event.clientY - box.top) / box.height) * span - (R + PAD);
    const limit = R - 0.6;
    return {
      x: Math.round(Math.min(limit, Math.max(-limit, wx)) * 10) / 10,
      z: Math.round(Math.min(limit, Math.max(-limit, wz)) * 10) / 10,
    };
  }

  const place = (event: React.PointerEvent) => {
    const world = toWorld(event);
    if (world) setPos(world);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The values the server actions read. Hidden, so nobody types them. */}
      <input type="hidden" name="x" value={pos.x} />
      <input type="hidden" name="z" value={pos.z} />
      <input type="hidden" name="rotation" value={rotation} />

      <p className="text-[0.7rem] font-medium tracking-wide uppercase opacity-50">
        Where it goes
      </p>

      <svg
        ref={svg}
        viewBox={`${-(R + PAD)} ${-(R + PAD)} ${(R + PAD) * 2} ${(R + PAD) * 2}`}
        role="application"
        aria-labelledby={titleId}
        className="w-full touch-none rounded-xl border border-white/12 bg-[#7d9b58]/25"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          place(e);
        }}
        onPointerMove={(e) => {
          if (dragging) place(e);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <title id={titleId}>
          Map of the garden. Drag to choose where this goes.
        </title>

        {/* --- ground and fence --------------------------------------------- */}
        <rect x={-R} y={-R} width={R * 2} height={R * 2} fill="#7d9b58" opacity={0.5} />
        <rect
          x={-R}
          y={-R}
          width={R * 2}
          height={R * 2}
          fill="none"
          stroke="#e0d3bd"
          strokeWidth={0.35}
        />
        {/* The gateway: the gap she comes in through. */}
        <line
          x1={-FENCE.gateHalfWidth}
          y1={R}
          x2={FENCE.gateHalfWidth}
          y2={R}
          stroke="#7d9b58"
          strokeWidth={0.6}
        />

        {/* --- the path ----------------------------------------------------- */}
        <rect
          x={-0.95}
          y={HOUSE_FRONT_OUTER}
          width={1.9}
          height={R - HOUSE_FRONT_OUTER}
          fill="#6b5540"
          opacity={0.35}
        />
        {PATH_STONES.map((stone, i) => (
          <circle key={i} cx={stone.x} cy={stone.z} r={0.55} fill="#bdb2a4" opacity={0.8} />
        ))}

        {/* --- the cottage -------------------------------------------------- */}
        <rect
          x={-OUTER_HALF_WIDTH}
          y={HOUSE_BACK_OUTER}
          width={OUTER_HALF_WIDTH * 2}
          height={HOUSE_FRONT_OUTER - HOUSE_BACK_OUTER}
          fill="#4a3b32"
          opacity={0.28}
        />
        {FRONT_SEGMENTS.map((w, i) => (
          <Wall key={`f${i}`} {...w} />
        ))}
        {SIDE_WALLS.map((w, i) => (
          <Wall key={`s${i}`} {...w} />
        ))}
        <Wall {...BACK_WALL} />
        {/* The doorway, drawn as a gap in the front wall. */}
        <rect
          x={-DOOR.halfWidth}
          y={HOUSE.frontZ - 0.3}
          width={DOOR.halfWidth * 2}
          height={0.6}
          fill="#c98b6b"
        />

        {/*
          --- the furniture ------------------------------------------------
          Drawn from the same `FURNITURE` list the game builds its meshes and
          its colliders from, so what you see here is exactly what she will
          walk into. `isReachable` already refused to place a spot inside a
          sofa; the only thing missing was being able to see the sofa.
        */}
        {FURNITURE.map((item, i) => {
          const box = footprint(item);
          const label = FURNITURE_LABEL[item.kind] ?? item.kind;
          return (
            <g key={`fur${i}`}>
              <rect
                x={box.x - box.hx}
                y={box.z - box.hz}
                width={box.hx * 2}
                height={box.hz * 2}
                rx={0.18}
                fill="#8a6a52"
                fillOpacity={0.55}
                stroke="#c39a6b"
                strokeWidth={0.09}
              />
              {/* Only label what there is room to label, or the room turns
                  into a wall of overlapping text. */}
              {box.hx > 0.5 && box.hz > 0.5 && (
                <text
                  x={box.x}
                  y={box.z + 0.28}
                  textAnchor="middle"
                  fill="#f2e4d0"
                  fillOpacity={0.75}
                  style={{ fontSize: 0.75, pointerEvents: "none" }}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
        {/* The hearth: solid, and the one thing in the room that is on fire. */}
        <rect
          x={HEARTH_COLLIDER.x - HEARTH_COLLIDER.hx}
          y={HEARTH_COLLIDER.z - HEARTH_COLLIDER.hz}
          width={HEARTH_COLLIDER.hx * 2}
          height={HEARTH_COLLIDER.hz * 2}
          rx={0.12}
          fill="#a8564a"
          fillOpacity={0.7}
          stroke="#ff9a4a"
          strokeWidth={0.1}
        />

        {/* --- trees -------------------------------------------------------- */}
        {TREES.map((t, i) => (
          <circle key={i} cx={t.x} cy={t.z} r={1.1 * t.scale} fill="#5f8049" opacity={0.75} />
        ))}

        {/* --- what is already out there ------------------------------------ */}
        {others.map((o, i) => (
          <g key={i} opacity={0.75}>
            <circle cx={o.x} cy={o.z} r={0.55} fill="#1b1420" opacity={0.4} />
            <circle cx={o.x} cy={o.z} r={0.4} fill="#ffd9a0" />
          </g>
        ))}

        {/* --- the one being placed ----------------------------------------- */}
        <g>
          {/* How close she has to get. */}
          <circle
            cx={pos.x}
            cy={pos.z}
            r={spotRange(kind)}
            fill={reachable ? "#f2a2ae" : "#ff6b6b"}
            opacity={0.16}
          />
          {/* Which way it faces. */}
          <line
            x1={pos.x}
            y1={pos.z}
            x2={pos.x + Math.sin(rotation) * 1.5}
            y2={pos.z + Math.cos(rotation) * 1.5}
            stroke="#fff"
            strokeWidth={0.28}
            strokeLinecap="round"
            opacity={0.85}
          />
          <circle cx={pos.x} cy={pos.z} r={0.85} fill="#1b1420" opacity={0.45} />
          <circle
            cx={pos.x}
            cy={pos.z}
            r={0.62}
            fill={reachable ? "#f2a2ae" : "#ff6b6b"}
            stroke="#fff"
            strokeWidth={0.18}
          />
        </g>
      </svg>

      {!reachable && (
        <p className="text-xs leading-relaxed text-amber-200">
          She would not be able to reach this — it is inside a wall, or walled in.
          Drag it somewhere she can stand next to.
        </p>
      )}

      {/* --- facing ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-medium tracking-wide uppercase opacity-50">
            Which way it faces
          </span>
          <div className="grid w-[7.5rem] grid-cols-3 gap-1">
            {COMPASS.map((c, i) =>
              c.arrow ? (
                <button
                  key={c.name}
                  type="button"
                  aria-label={`Facing ${c.name}`}
                  aria-pressed={facing === i}
                  onClick={() => setRotation(angleFor(c.dx, c.dz))}
                  className={`grid aspect-square place-items-center rounded-md border text-sm transition ${
                    facing === i
                      ? "border-rose-400/70 bg-rose-400/25 text-white"
                      : "border-white/12 bg-white/5 opacity-60 hover:opacity-100"
                  }`}
                >
                  {c.arrow}
                </button>
              ) : (
                <span key="middle" className="grid aspect-square place-items-center text-[0.6rem] opacity-30">
                  ✳
                </span>
              ),
            )}
          </div>
        </div>

        <p className="max-w-56 flex-1 text-xs leading-relaxed opacity-45">
          Drag the pin to move it. The soft ring is how close she has to get. The
          line shows which way it faces — matters for a photo frame against a
          wall, less so for a keepsake on the ground. Brown blocks are furniture
          and the red one is the hearth: the pin turns red over anything solid.
        </p>
      </div>
    </div>
  );
}
