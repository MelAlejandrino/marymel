"use client";

import { useRef, useState } from "react";

import { input } from "../input.ts";

const RADIUS = 52;

/**
 * Virtual joystick and interact button (PLAN §27). This is the primary input
 * on a phone, not a fallback — it writes the same `input` fields the keyboard
 * does, so the controller is unaware of either.
 */
export function TouchControls({ prompt }: { prompt: string | null }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);

    const distance = Math.hypot(dx, dy);
    const scale = distance > RADIUS ? RADIUS / distance : 1;
    const x = dx * scale;
    const y = dy * scale;

    setKnob({ x, y });
    input.move.x = x / RADIUS;
    // Screen y grows downward; pushing up means walking forward.
    input.move.y = -y / RADIUS;
  };

  const release = (e: React.PointerEvent) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    input.move.x = 0;
    input.move.y = 0;
  };

  return (
    <>
      <div
        ref={base}
        onPointerDown={(e) => {
          if (active.current !== null) return;
          active.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === active.current) update(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        aria-hidden
        className="pointer-events-auto absolute bottom-8 left-6 h-32 w-32 touch-none
                   rounded-full border border-white/25 bg-black/25 backdrop-blur-sm"
      >
        <div
          className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full border border-white/40 bg-white/35"
          style={{
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>

      <button
        type="button"
        disabled={!prompt}
        onPointerDown={(e) => {
          e.preventDefault();
          input.interactQueued = true;
        }}
        className="pointer-events-auto absolute right-6 bottom-12 h-24 w-24 touch-none rounded-full
                   border border-white/30 bg-white/20 text-sm font-medium text-white backdrop-blur-sm
                   transition disabled:opacity-25"
      >
        {prompt ?? "—"}
      </button>
    </>
  );
}
