/** Run: node --test */
import assert from "node:assert/strict";

import { decayBlaze, fireIntensity, hearth, stokeFire } from "./hearth.ts";
import {
  footprint,
  FURNITURE,
  SEAT_FRONT,
  SEAT_SURFACE,
  seatAnchor,
} from "./furniture.ts";
import { HOUSE, HOUSE_BACK_INNER, HOUSE_FRONT_INNER } from "./layout.ts";
import { poseHeight } from "../player/seat.ts";
import { POSTURE, RIG, footFromHip } from "../player/rig.ts";

const close = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} !== ${b}`);

// --- seat anchors -----------------------------------------------------------
// A seat offset is written in the piece's own axes, so it has to turn with the
// piece. Getting this wrong is invisible in the data and very visible in the
// room: she sits down a metre to the left of the sofa.
const dummy = { x: 10, z: -4, hx: 1, hz: 0.5, rotation: 0 };
const seatAt = (rotation: number, seat: { x: number; y: number; z: number }) =>
  seatAnchor({
    ...dummy,
    rotation,
    action: { kind: "seat", verb: "SIT", label: "test", seat },
  })!;

const forward = { x: 0, y: 0.5, z: 0.4 };
const unturned = seatAt(0, forward);
close(unturned.x, dummy.x, "unturned, a forward offset does not move sideways");
close(unturned.z, dummy.z + 0.4, "unturned, forward is +z");
close(unturned.y, 0.5, "the seat height is not affected by turning");
close(unturned.facing, 0, "she faces the way the piece faces");

// A quarter turn: the piece faces +x, so "in front of it" becomes +x.
const quarter = seatAt(Math.PI / 2, forward);
close(quarter.x, dummy.x + 0.4, "turned a quarter, forward is +x");
close(quarter.z, dummy.z, "turned a quarter, forward stops being +z");
close(quarter.facing, Math.PI / 2, "facing turns with the piece");

// A half turn mirrors it, rather than leaving it where it was.
const half = seatAt(Math.PI, forward);
close(half.z, dummy.z - 0.4, "turned around, forward is -z");

// A sideways offset must turn too, or a seat off the centre line drifts.
const sideways = seatAt(Math.PI / 2, { x: 0.3, y: 0.5, z: 0 });
close(sideways.z, dummy.z - 0.3, "a sideways offset turns with the piece");

// Scenery has no seat.
assert.equal(
  seatAnchor({ ...dummy, action: undefined }),
  null,
  "a piece with no action cannot be sat on",
);
assert.equal(
  seatAnchor({
    ...dummy,
    action: { kind: "stoke", verb: "STOKE", label: "the fire" },
  }),
  null,
  "you cannot sit on an action that is not a seat",
);

// --- every real seat in the room -------------------------------------------
const seats = FURNITURE.filter((item) => item.action?.kind === "seat");
assert.ok(seats.length >= 5, "the room should have somewhere to sit");

for (const item of seats) {
  const anchor = seatAnchor(item)!;
  const box = footprint(item);
  const where = `${item.kind} at (${item.x}, ${item.z})`;

  // She has to end up *on* the piece. A seat anchor outside the footprint is
  // someone sitting on thin air beside the chair.
  assert.ok(
    Math.abs(anchor.x - box.x) <= box.hx + 1e-9 &&
      Math.abs(anchor.z - box.z) <= box.hz + 1e-9,
    `${where}: the seat is outside the piece's own footprint`,
  );

  // And inside the room, not through a wall.
  assert.ok(
    Math.abs(anchor.x) < HOUSE.halfWidth &&
      anchor.z > HOUSE_BACK_INNER &&
      anchor.z < HOUSE_FRONT_INNER,
    `${where}: the seat is outside the room`,
  );

  assert.ok(anchor.y > 0.3, `${where}: the seat is on the floor`);
  assert.ok(anchor.y < 1.1, `${where}: the seat is above her head`);
}

// --- she has to land on the seat, not above it -----------------------------
// `seat.y` is the surface she rests on, and the avatar's origin is the point
// her *hip* is measured from — so the two are a whole upper leg apart. Reading
// one as the other put her floating half a metre over the sofa.
for (const item of seats) {
  if (item.action?.kind !== "seat") continue;
  const anchor = seatAnchor(item)!;
  const posture = item.action.verb === "LIE" ? ("lie" as const) : ("sit" as const);
  const origin = poseHeight({
    ...anchor,
    posture,
    ownerId: "test",
  });

  if (posture === "sit") {
    // Her hip has to end up on the cushion, to the millimetre.
    close(
      origin + RIG.hipY,
      anchor.y,
      `${item.kind}: her hip does not land on the seat`,
    );
  } else {
    // Lying down, her back rests on the surface rather than hovering over it
    // or sinking through the mattress.
    const back = origin - RIG.headR;
    assert.ok(
      back < anchor.y + 0.02 && back > anchor.y - 0.12,
      `${item.kind}: she rests ${(back - anchor.y).toFixed(3)} off the surface`,
    );
  }
}

// The seat heights are shared with the meshes, so a chair cannot be drawn at
// one height and sat on at another.
const surfaceFor: Record<string, number> = {
  sofa: SEAT_SURFACE.sofa,
  armchair: SEAT_SURFACE.armchair,
  chair: SEAT_SURFACE.chair,
  bed: SEAT_SURFACE.bed,
};
for (const item of seats) {
  if (item.action?.kind !== "seat") continue;
  close(
    item.action.seat.y,
    surfaceFor[item.kind],
    `${item.kind}: seat height is not the one the mesh is built from`,
  );
}

// Her legs are 0.4 long, so adult-height furniture leaves her feet nowhere
// near the floor. The seats have to be scaled to her.
for (const kind of ["sofa", "armchair", "chair"] as const) {
  assert.ok(
    SEAT_SURFACE[kind] < RIG.legLength + 0.06,
    `a ${kind} at ${SEAT_SURFACE[kind]} is taller than her whole leg`,
  );
}

// Sitting: her feet must come down near the floor from every seat in the room.
// This is the whole reason the leg has a knee.
const seated = footFromHip(POSTURE.sit.thigh, POSTURE.sit.shin);
for (const item of seats) {
  if (item.action?.kind !== "seat" || item.action.verb !== "SIT") continue;
  // Her hip lands on the seat surface, so the foot drops from there.
  const footY = seatAnchor(item)!.y - seated.drop;
  assert.ok(
    footY > -0.1,
    `sitting on the ${item.kind} puts her feet ${(-footY).toFixed(3)} through the floor`,
  );
  assert.ok(
    footY < 0.2,
    `sitting on the ${item.kind} leaves her feet dangling ${footY.toFixed(3)} up`,
  );
}

// --- her legs have to end up outside the furniture -------------------------
// The reason this is worth its own block: she can be seated at exactly the
// right height, with the skirt out of the way, and still have no visible legs —
// because her thigh reaches ~0.21 and a conventionally deep seat is 0.48 from
// hip to front edge, so the whole lower leg comes down *inside* the sofa. It
// reads as standing with the legs deleted.
const thighReach = Math.sin(-POSTURE.sit.thigh) * RIG.kneeAt;
const seatedFoot = footFromHip(POSTURE.sit.thigh, POSTURE.sit.shin);
/** Enough that the leg is plainly outside the piece, not grazing it. */
const CLEAR = 0.04;

for (const item of seats) {
  if (item.action?.kind !== "seat" || item.action.verb !== "SIT") continue;
  const front = SEAT_FRONT[item.kind as keyof typeof SEAT_FRONT];
  assert.ok(front, `${item.kind} is sat on but has no front edge declared`);

  const hip = item.action.seat.z;
  const knee = hip + thighReach;
  const foot = hip + seatedFoot.forward;

  assert.ok(
    knee > front + CLEAR,
    `sitting on the ${item.kind}, her knee reaches ${knee.toFixed(3)} against a front edge at ${front} — the leg is inside the furniture`,
  );
  assert.ok(
    foot > front + CLEAR,
    `sitting on the ${item.kind}, her foot reaches ${foot.toFixed(3)} against a front edge at ${front} — her shins are inside the furniture`,
  );

  // The other direction: sitting far enough forward to show the legs must not
  // tip over into perching on the front lip.
  assert.ok(
    hip < front - 0.08,
    `sitting on the ${item.kind}, she is perched ${(front - hip).toFixed(3)} from the edge`,
  );
  assert.ok(hip > 0, `sitting on the ${item.kind}, she is behind the middle of the seat`);
}

// The shins angle forward rather than straight down — that is what carries the
// feet past the front edge, so it is the part most likely to get "tidied" back.
assert.ok(
  POSTURE.sit.thigh + POSTURE.sit.shin < -0.15,
  "the shins hang straight down, so her feet stay under the seat",
);
assert.ok(
  seatedFoot.forward > thighReach + 0.06,
  "the foot must reach further forward than the knee",
);

// Lying down: she is about as long as she is tall, and has to fit on the bed.
const bed = FURNITURE.find((item) => item.kind === "bed")!;
assert.equal(bed.action?.kind, "seat");
if (bed.action?.kind === "seat") {
  assert.equal(bed.action.verb, "LIE", "a bed is for lying on");
  const height = RIG.headY + RIG.headR;
  // Her origin is at her feet and she extends toward the headboard, so the
  // headboard end of the bed has to be at least her own height away.
  const headEnd = bed.action.seat.z - height;
  assert.ok(
    headEnd > -bed.hz - 0.15,
    `lying down puts her head ${Math.abs(headEnd + bed.hz).toFixed(2)} through the headboard`,
  );
  assert.ok(
    bed.action.seat.z <= bed.hz + 1e-9,
    "her feet hang off the end of the bed",
  );
}

// --- the fire ---------------------------------------------------------------
// Stoking has to actually do something, and then stop doing it.
hearth.blaze = 0;
const resting = fireIntensity(0, 0);
stokeFire();
assert.equal(hearth.blaze, 1, "a log should light the fire up");
assert.ok(
  fireIntensity(hearth.blaze, 0) > resting * 1.5,
  "a fresh log barely brightens the fire",
);

// It burns back down, and stops at the resting glow rather than going dark.
let blaze = 1;
for (let i = 0; i < 2000; i++) blaze = decayBlaze(blaze, 1 / 60);
assert.equal(blaze, 0, "the blaze must burn out");
assert.ok(decayBlaze(0, 1) === 0, "an unlit fire cannot go negative");
assert.ok(fireIntensity(0, 0) > 0, "the fire must not go out completely");

// Flicker, or the room reads as lit by a bulb painted orange — but never so
// much that it strobes.
const samples = Array.from({ length: 400 }, (_, i) => fireIntensity(0, i * 0.05));
const min = Math.min(...samples);
const max = Math.max(...samples);
assert.ok(max > min, "the fire must flicker");
assert.ok(max / min < 1.35, "the fire flickers hard enough to read as a strobe");

console.log(
  `actions: ${seats.length} seats, ${FURNITURE.filter((f) => f.action).length} interactive pieces — all assertions passed`,
);
