"use client";

import { useActiveInteraction } from "../interaction/registry.ts";
import { TouchControls } from "./TouchControls.tsx";

const VERB_LABEL: Record<string, string> = {
  INTERACT: "Use",
  OPEN: "Open",
  CLOSE: "Close",
  READ: "Read",
  COLLECT: "Take",
  PLAY: "Play",
  ENTER: "Enter",
  EXAMINE: "Look at",
  SIT: "Sit on",
  LIE: "Lie on",
  RISE: "Get up",
  TURN_ON: "Turn on",
  TURN_OFF: "Turn off",
  STOKE: "Put a log on",
  SEARCH: "Look through",
  RETURN: "Put back",
};

/**
 * Overlays the world. Screen-space DOM rather than in-world text: it stays
 * legible at any distance and screen readers can reach it (PLAN §32).
 */
export function Hud({
  action,
  hint,
}: {
  /** Set by a mini-game to take over the action button. */
  action?: { label: string } | null;
  /** Replaces the desktop control hint while a mini-game is running. */
  hint?: string | null;
} = {}) {
  const active = useActiveInteraction();
  const verb = active ? (VERB_LABEL[active.verb] ?? "Use") : null;
  const buttonLabel = action?.label ?? verb;

  return (
    <div className="safe-area pointer-events-none">
      {/* Announced when a prompt appears, so it isn't purely visual. */}
      <div
        aria-live="polite"
        className="absolute inset-x-0 bottom-44 flex justify-center px-6 sm:bottom-24"
      >
        {!action && active && (
          <p
            className="rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm
                       text-white shadow-lg backdrop-blur-sm"
          >
            <span className="hidden sm:inline">
              Press <kbd className="rounded bg-white/20 px-1.5 py-0.5">E</kbd>{" "}
            </span>
            <span className="sm:hidden">Tap to </span>
            {[verb?.toLowerCase(), active.label].filter(Boolean).join(" ")}
          </p>
        )}
      </div>

      <div className="sm:hidden">
        <TouchControls prompt={buttonLabel} />
      </div>

      <p className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-xs text-white/50 sm:block">
        {hint ?? "WASD to walk · drag to look · E to interact"}
      </p>
    </div>
  );
}
