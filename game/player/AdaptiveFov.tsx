"use client";

import { useFrame } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";

import { verticalFov } from "./movement.ts";

/**
 * Keeps the *horizontal* field of view steady as the viewport changes shape.
 * Without this a portrait screen crops the world sideways, because three's
 * `fov` is the vertical angle. See `verticalFov`.
 *
 * ponytail: checked per frame rather than in an effect on `size`. It is one
 * float comparison, it needs no dependency list, and it picks up anything that
 * resizes the canvas — rotating a phone, dragging a window, the URL bar
 * sliding away — without caring which.
 */
export function AdaptiveFov({ horizontal = 60 }: { horizontal?: number }) {
  useFrame((state) => {
    // R3F types the camera as the union of perspective and orthographic.
    const camera = state.camera as PerspectiveCamera;
    if (!camera.isPerspectiveCamera) return;

    const { width, height } = state.size;
    const next = verticalFov(horizontal, width / height);
    if (Math.abs(camera.fov - next) < 0.01) return;

    camera.fov = next;
    camera.updateProjectionMatrix();
  });

  return null;
}
