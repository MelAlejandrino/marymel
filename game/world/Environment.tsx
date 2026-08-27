"use client";

import { Garden } from "./Garden.tsx";
import { House } from "./House.tsx";
import { Lighting } from "./Lighting.tsx";
import { Sky } from "./Sky.tsx";
import { Terrain } from "./Terrain.tsx";

/** Composes the scene. Each piece owns its own geometry and materials. */
export function Environment() {
  return (
    <>
      <Sky />
      <Lighting />
      {/* The ground, all of it: the lawn inside the fence and the hills the
          garden sits in are one surface. `Garden` plants things on it. */}
      <Terrain />
      <Garden />
      <House />
    </>
  );
}
