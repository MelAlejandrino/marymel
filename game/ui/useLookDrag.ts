"use client";

import { useEffect, type RefObject } from "react";

import { input } from "../input.ts";

const SENSITIVITY = 0.005;

/**
 * Drag the world to swing the camera — the same gesture with a finger or a
 * mouse.
 *
 * Only a gesture that starts on the canvas counts. This used to be an opt-out
 * (`data-ui` on each control), which is the wrong way round: any overlay that
 * forgot the marker had its buttons broken, because capturing the pointer here
 * retargets the pointerup and the click never reaches the button. Checking for
 * the canvas instead excludes every overlay automatically.
 */
export function useLookDrag(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      if (pointerId !== null) return;
      if (!(e.target instanceof HTMLCanvasElement)) return;
      pointerId = e.pointerId;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      // Dragging right turns the camera right, which means decreasing yaw.
      input.look.x -= (e.clientX - lastX) * SENSITIVITY;
      lastX = e.clientX;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [ref]);
}
