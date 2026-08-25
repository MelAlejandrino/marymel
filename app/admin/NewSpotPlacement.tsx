"use client";

import { useState } from "react";

import { SPOT_KINDS, type SpotKindName } from "@/game/world/spots/meta";

import { Combobox } from "./Combobox";
import { PlacementField } from "./PlacementField";

/**
 * Choosing what to place and where, together.
 *
 * They have to live in one client component because the kind decides how big
 * the reach ring is on the map — pick "arcade cabinet" and the ring grows, so
 * you can see it needs more room around it before you commit.
 */
export function NewSpotPlacement({
  others,
}: {
  others: { x: number; z: number; title: string; kind: string }[];
}) {
  const [kind, setKind] = useState<SpotKindName>("LETTER");

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] font-medium tracking-wide uppercase opacity-50">
          What is it
        </span>
        <Combobox
          name="kind"
          value={kind}
          onChange={(v) => setKind(v as SpotKindName)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm
                     outline-none transition focus-visible:border-white/30
                     focus-visible:ring-2 focus-visible:ring-rose-400/60"
          options={(Object.keys(SPOT_KINDS) as SpotKindName[]).map((k) => ({
            value: k,
            label: SPOT_KINDS[k].label,
          }))}
        />
      </label>

      {/* Start it just inside the gate, where she comes in. */}
      <PlacementField kind={kind} x={0} z={9} others={others} />
    </div>
  );
}
