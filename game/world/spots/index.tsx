"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { BufferGeometry, Mesh, MeshStandardMaterial } from "three";

import { useInteractable } from "../../interaction/registry.ts";
import type { PlayerSpot } from "@/lib/world/query";
import { PALETTE } from "../palette.ts";
import { ClawMachine } from "../../minigames/claw/ClawMachine.tsx";
import { capsuleLayout, createClaw } from "../../minigames/claw/mechanics.ts";
import { ArcadeCabinet, Keepsake, LetterNote, PhotoFrame } from "./kinds.tsx";
import { SPOT_KINDS } from "./meta.ts";

/** The claw machine standing idle in the world, claw parked at the top. */
function IdleClawMachine({ count }: { count: number }) {
  const claw = useRef(createClaw());
  const capsules = useMemo(() => capsuleLayout(count), [count]);
  return <ClawMachine claw={claw} capsules={capsules} playing={false} />;
}

/**
 * How many capsules a cabinet shows standing in the world. Once she has won
 * everything it refills for free play, so only a cabinet with nothing in it at
 * all looks empty.
 */
function capsulesInCabinet(spot: PlayerSpot): number {
  const total = spot.prizes?.total ?? 0;
  const left = total - (spot.prizes?.won ?? 0);
  return left > 0 ? left : total;
}

/**
 * The registry that makes the world extensible: a spot's `kind` picks its
 * visual and its verb, so adding a new kind of thing to find means one entry in
 * `meta.ts` plus one branch below — no migration, and nothing else has to know.
 */
const KINDS = SPOT_KINDS;

/**
 * A soft glow over anything she has not found yet. This is what makes a world
 * with no map or quest log still explorable — you can see from a distance that
 * there is something over there.
 */
function Undiscovered() {
  const halo = useRef<Mesh<BufferGeometry, MeshStandardMaterial>>(null);

  useFrame((state) => {
    if (!halo.current) return;
    const pulse = 0.55 + Math.sin(state.clock.elapsedTime * 1.9) * 0.25;
    halo.current.material.opacity = pulse * 0.5;
    halo.current.scale.setScalar(1 + pulse * 0.12);
  });

  return (
    <mesh ref={halo} position={[0, 1.5, 0]}>
      <sphereGeometry args={[0.16, 12, 10]} />
      <meshStandardMaterial
        color={PALETTE.lampLit}
        emissive={PALETTE.lampLit}
        emissiveIntensity={2}
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </mesh>
  );
}

function SpotVisual({ spot }: { spot: PlayerSpot }) {
  switch (spot.kind) {
    case "ARCADE": {
      const count = capsulesInCabinet(spot);
      // `config.game` picks the mini-game, so a new cabinet is one branch here
      // plus one component — no migration, nothing else needs to know.
      if (spot.config?.game === "claw") return <IdleClawMachine count={count} />;
      return <ArcadeCabinet lit={count > 0} />;
    }
    case "FRAME":
      return <PhotoFrame tint={Number(spot.config?.tint ?? 0)} />;
    case "LETTER":
      return <LetterNote />;
    case "KEEPSAKE":
      return <Keepsake found={spot.discovered} />;
  }
}

function Spot({
  spot,
  onInteract,
}: {
  spot: PlayerSpot;
  onInteract: (spot: PlayerSpot) => void;
}) {
  const kind = KINDS[spot.kind];
  // A cabinet with nothing in it at all cannot offer a game. One she has
  // emptied by winning still can — it refills for free play.
  const unfilled = spot.kind === "ARCADE" && (spot.prizes?.total ?? 0) === 0;

  useInteractable({
    id: spot.id,
    x: spot.x,
    z: spot.z,
    range: kind.range,
    verb: unfilled ? "EXAMINE" : kind.verb,
    // ponytail: a letter's title is the surprise — the prompt just says "read".
    label: spot.kind === "LETTER" ? "" : spot.title,
    enabled: true,
    onInteract: () => onInteract(spot),
  });

  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.rotation, 0]}>
      <SpotVisual spot={spot} />
      {!spot.discovered && <Undiscovered />}
    </group>
  );
}

export function Spots({
  spots,
  onInteract,
  playingId,
}: {
  spots: PlayerSpot[];
  onInteract: (spot: PlayerSpot) => void;
  /** The spot a mini-game has taken over; it draws its own machine. */
  playingId?: string | null;
}) {
  return (
    <>
      {spots
        .filter((spot) => spot.id !== playingId)
        .map((spot) => (
          <Spot key={spot.id} spot={spot} onInteract={onInteract} />
        ))}
    </>
  );
}
