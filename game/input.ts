"use client";

import { useEffect } from "react";

/**
 * One input surface, written by keyboard and touch alike so the player
 * controller never learns which device it's on. Mobile is the primary
 * platform here (PLAN §27), so touch isn't a later adapter — it writes the
 * same fields keyboard does.
 *
 * ponytail: module-level mutable state read inside useFrame, deliberately not
 * React state. Input changes every frame; routing it through setState would
 * re-render the tree 60x a second (PLAN §28).
 */
export const input = {
  /** Intent on the ground plane, -1..1. y is forward. */
  move: { x: 0, y: 0 },
  /** Camera-look delta accumulated since the last frame, in radians. */
  look: { x: 0, y: 0 },
  /** Edge-triggered; read it with consumeInteract(). */
  interactQueued: false,
};

/** True at most once per press, so holding the key doesn't retrigger. */
export function consumeInteract(): boolean {
  if (!input.interactQueued) return false;
  input.interactQueued = false;
  return true;
}

/** Read and clear the look delta. Called once per frame by the camera. */
export function consumeLook(): { x: number; y: number } {
  const { x, y } = input.look;
  input.look.x = 0;
  input.look.y = 0;
  return { x, y };
}

export function resetInput() {
  input.move.x = 0;
  input.move.y = 0;
  input.look.x = 0;
  input.look.y = 0;
  input.interactQueued = false;
}

const MOVE_KEYS: Record<string, [axis: "x" | "y", value: number]> = {
  KeyW: ["y", 1],
  ArrowUp: ["y", 1],
  KeyS: ["y", -1],
  ArrowDown: ["y", -1],
  KeyA: ["x", -1],
  ArrowLeft: ["x", -1],
  KeyD: ["x", 1],
  ArrowRight: ["x", 1],
};

const INTERACT_KEYS = new Set(["KeyE", "Space", "Enter"]);

/** Desktop input. Touch controls live in game/ui/TouchControls.tsx. */
export function useKeyboardInput(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const held = new Set<string>();

    const apply = () => {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const binding = MOVE_KEYS[code];
        if (!binding) continue;
        if (binding[0] === "x") x += binding[1];
        else y += binding[1];
      }
      // Diagonals must not be faster than cardinals.
      const length = Math.hypot(x, y);
      input.move.x = length > 1 ? x / length : x;
      input.move.y = length > 1 ? y / length : y;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (INTERACT_KEYS.has(e.code)) {
        input.interactQueued = true;
        // Space would otherwise scroll the page behind the canvas.
        if (e.code === "Space") e.preventDefault();
        return;
      }
      if (!MOVE_KEYS[e.code]) return;
      e.preventDefault();
      held.add(e.code);
      apply();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!held.delete(e.code)) return;
      apply();
    };

    // Alt-tabbing away mid-stride would otherwise leave the player walking.
    const onBlur = () => {
      held.clear();
      resetInput();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      onBlur();
    };
  }, [enabled]);
}
