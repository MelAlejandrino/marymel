"use client";

import { Garden } from "./Garden.tsx";
import { House } from "./House.tsx";
import { Lighting } from "./Lighting.tsx";
import { Sky } from "./Sky.tsx";

/** Composes the scene. Each piece owns its own geometry and materials. */
export function Environment() {
  return (
    <>
      <Sky />
      <Lighting />
      <Garden />
      <House />
    </>
  );
}
