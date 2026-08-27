"use client";

import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { ACESFilmicToneMapping, PCFShadowMap } from "three";

import { discoverSpot, playArcade } from "@/lib/world/actions";
import type { PlayerSpot } from "@/lib/world/query";

import { useKeyboardInput } from "./input.ts";
import { ClawGame, type ClawOutcome } from "./minigames/claw/ClawGame.tsx";
import type { ClawPhase } from "./minigames/claw/mechanics.ts";
import { AdaptiveFov } from "./player/AdaptiveFov.tsx";
import { Player } from "./player/Player.tsx";
import { Hud } from "./ui/Hud.tsx";
import { LoadingScreen } from "./ui/LoadingScreen.tsx";
import { MemoryViewer, type Reveal } from "./ui/MemoryViewer.tsx";
import { OpeningCapsule } from "./ui/OpeningCapsule.tsx";
import { useLookDrag } from "./ui/useLookDrag.ts";
import { Door } from "./world/Door.tsx";
import { Environment } from "./world/Environment.tsx";
import { Furnishings } from "./world/Furniture.tsx";
import { HOUSE } from "./world/layout.ts";
import { PALETTE } from "./world/palette.ts";
import { Spots } from "./world/spots/index.tsx";

/** How long the capsule stays shut before the note opens. */
const OPENING_MS = 1150;

export function World({
  spots,
  isAdmin,
  signedIn,
  logout,
}: {
  spots: PlayerSpot[];
  isAdmin: boolean;
  /** Anonymous visitors have nothing to sign out of. */
  signedIn: boolean;
  logout: () => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  /**
   * The id of the cabinet she is at — not the spot object. Holding the object
   * froze it at the moment she walked up, so a win never reached the machine
   * and the prize stayed sitting in it.
   */
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  const [clawPhase, setClawPhase] = useState<ClawPhase>("aiming");
  const [opening, setOpening] = useState(false);
  /**
   * Prizes shown during this visit to a cabinet. In free play everything is
   * already owned, so without this the server can hand back the same one twice
   * running and the machine looks broken.
   */
  const shown = useRef<string[]>([]);

  const playing = playingId
    ? (spots.find((spot) => spot.id === playingId) ?? null)
    : null;

  /** She has won everything in this cabinet: it becomes a toy rather than a prize box. */
  const freePlay =
    !!playing &&
    (playing.prizes?.total ?? 0) > 0 &&
    (playing.prizes?.won ?? 0) >= (playing.prizes?.total ?? 0);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useKeyboardInput();
  useLookDrag(container);

  const handleInteract = useCallback(
    (spot: PlayerSpot) => {
      if (spot.kind === "ARCADE") {
        // Only a cabinet with nothing in it at all is unplayable. Once she has
        // won everything it refills for free play — see `capsuleCount` below.
        if ((spot.prizes?.total ?? 0) === 0) {
          setReveal({
            title: "Nothing in here yet",
            message: "This machine has not been filled yet. Come back to it.",
            mediaUrl: null,
            mediaAlt: null,
            type: "MESSAGE",
            wonLabel: "Empty",
          });
          return;
        }
        // Hand the camera and the controls to the cabinet.
        setClawPhase("aiming");
        shown.current = [];
        setPlayingId(spot.id);
        return;
      }

      // Everything else already carries its memory, so the reveal is instant.
      // Recording the find happens behind it rather than making her wait.
      if (spot.memory) setReveal(spot.memory);
      if (!spot.discovered) {
        void discoverSpot(spot.id).then(() => startTransition(() => router.refresh()));
      }
    },
    [router],
  );

  const handleRound = useCallback(
    (outcome: ClawOutcome) => {
      if (outcome === "missed") {
        setMiss(true);
        setTimeout(() => setMiss(false), 1400);
        return;
      }

      // The claw decided *that* she won; the server decides *what*, and refuses
      // to hand over the same prize twice.
      setOpening(true);
      const settled = Date.now();

      void playArcade(playingId!, shown.current).then((result) => {
        if (result.outcome === "empty") {
          setOpening(false);
          return;
        }

        shown.current = [...shown.current, result.prize.id];

        // Hold the capsule shut for the rest of the beat, however fast the
        // server answered, so the reveal never snaps in.
        const remaining = Math.max(0, OPENING_MS - (Date.now() - settled));
        setTimeout(() => {
          setOpening(false);
          setReveal({
            ...result.prize,
            wonLabel:
              result.outcome === "replay" ? "One you already have" : "You won it!",
          });
          if (result.outcome === "won") startTransition(() => router.refresh());
        }, remaining);
      });
    },
    [playingId, router],
  );

  return (
    <div
      ref={container}
      className="absolute inset-0 touch-none overflow-hidden bg-[#14101a] select-none"
    >
      <Canvas
        // Set the shadow type outright rather than via R3F's `shadows`
        // shorthand: its default is PCFSoftShadowMap, which three 0.185
        // deprecated and warns about on every render.
        shadows={{ enabled: true, type: PCFShadowMap }}
        // Cap the pixel ratio: a 3x phone screen triples the fragment cost for
        // a difference nobody sees at this art style (PLAN §28).
        dpr={[1, 2]}
        // fov is a starting value; AdaptiveFov sets it from the aspect.
        camera={{ fov: 60, near: 0.1, far: 320, position: [0, 4.4, 21] }}
        gl={{
          // Filmic tone mapping keeps the warm key light from blowing out the
          // cream walls, which is most of why the scene reads as lit rather
          // than coloured in.
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onCreated={() => setReady(true)}
      >
        {/* Fog tuned to start past the cottage, so the garden stays crisp and
            only the far treeline softens into the horizon. */}
        <fog attach="fog" args={[PALETTE.fog, 48, 140]} />

        <AdaptiveFov horizontal={60} />

        <Environment />
        <Door
          open={doorOpen}
          label="the door"
          // ponytail: Phase 2 just opens it. Phase 3 replaces this one callback
          // with the anniversary question and only opens on a correct answer
          // (PLAN §5) — the door itself needs no changes.
          onInteract={() => setDoorOpen((open) => !open)}
        />
        <Spots spots={spots} onInteract={handleInteract} playingId={playing?.id} />
        {/*
          The furniture is content, not scenery: she sits on it, opens it and
          switches it on. It owns its own state and talks to the player through
          `player/seat.ts`, so nothing has to be threaded down from here.
        */}
        <Furnishings />
        <Player doorOpen={doorOpen} paused={playing !== null} />

        {playing && (
          <ClawGame
            x={playing.x}
            z={playing.z}
            rotation={playing.rotation}
            capsuleCount={
              // Refilled once she has won everything, so free play has
              // something in the machine to grab.
              freePlay
                ? (playing.prizes?.total ?? 0)
                : (playing.prizes?.total ?? 0) - (playing.prizes?.won ?? 0)
            }
            freePlay={freePlay}
            frozen={reveal !== null || opening}
            onRound={handleRound}
            onPhase={setClawPhase}
          />
        )}

        {/* Warm spill through the open doorway. The room lights itself now —
            the fire and the lamps live with the furniture. */}
        <pointLight
          position={[0, 1.4, HOUSE.frontZ + 1.2]}
          color="#ffd39a"
          intensity={doorOpen ? 9 : 0}
          distance={6}
        />
      </Canvas>

      <OpeningCapsule show={opening} />

      <Hud
        // Only offer the drop while she is actually in control of the claw.
        action={playing ? { label: clawPhase === "aiming" ? "Drop" : "…" } : null}
        hint={
          playing
            ? clawPhase === "aiming"
              ? "Move to aim · E or Space to drop"
              : "…"
            : null
        }
      />

      {playing && (
        <div className="safe-area pointer-events-none z-30">
          <button
            type="button"
            onClick={() => setPlayingId(null)}
            className="pointer-events-auto absolute top-4 left-4 rounded-full border
                       border-white/25 bg-black/45 px-4 py-2 text-sm text-white
                       backdrop-blur-sm transition hover:bg-black/65"
          >
            Step back
          </button>
          {miss && (
            <p
              aria-live="polite"
              className="absolute inset-x-0 top-1/2 text-center text-lg text-white/85 drop-shadow"
            >
              So close…
            </p>
          )}
        </div>
      )}

      <MemoryViewer reveal={reveal} onClose={() => setReveal(null)} />

      {/*
        The only chrome left in the world, and an anonymous visitor sees none of
        it — she never signed in, so there is nothing to sign out of.
      */}
      {!playing && (signedIn || isAdmin) && (
        <div className="safe-area pointer-events-none z-20">
          <div className="pointer-events-auto absolute top-4 left-4 flex items-center gap-4">
            {signedIn && (
              <form action={logout}>
                <button className="text-xs tracking-wide text-white/35 underline underline-offset-4 transition hover:text-white/75">
                  Leave
                </button>
              </form>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs tracking-wide text-white/35 underline underline-offset-4 transition hover:text-white/75"
              >
                Admin
              </Link>
            )}
          </div>
        </div>
      )}
      <LoadingScreen done={ready} />
    </div>
  );
}
