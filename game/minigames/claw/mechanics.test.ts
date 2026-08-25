/** Run: node --test */
import assert from "node:assert/strict";

import {
  attemptGrab,
  BOUNDS,
  capsuleLayout,
  CHUTE,
  createClaw,
  GRAB_RADIUS,
  GRAB_Y,
  isAiming,
  isFinished,
  PLAY,
  stepClaw,
  wouldGrab,
  type Capsule,
  type ClawInput,
  type ClawPhase,
  type ClawState,
} from "./mechanics.ts";

const dt = 1 / 60;
const still: ClawInput = { move: { x: 0, y: 0 }, drop: false };
const hold = (x: number, y: number): ClawInput => ({ move: { x, y }, drop: false });
const DROP: ClawInput = { move: { x: 0, y: 0 }, drop: true };

/** Park the claw, swing settled, over a given spot. */
function settleAt(x: number, z: number, capsules: readonly Capsule[]): ClawState {
  let s: ClawState = { ...createClaw(), x, z, hangX: x, hangZ: z };
  for (let i = 0; i < 60; i++) s = stepClaw(s, still, dt, capsules);
  return s;
}

/** Run to completion, recording every phase transition. */
function playOut(start: ClawState, capsules: readonly Capsule[]) {
  let state = start;
  const seen: ClawPhase[] = [state.phase];
  const heights: number[] = [];
  for (let i = 0; i < 4000; i++) {
    state = stepClaw(state, still, dt, capsules);
    if (seen[seen.length - 1] !== state.phase) seen.push(state.phase);
    heights.push(state.clawY);
    if (isFinished(state)) return { state, seen, heights };
  }
  throw new Error(`claw never finished; stuck in ${state.phase}`);
}

const capsules: Capsule[] = [
  { x: 0, z: 0 },
  { x: 0.3, z: -0.2 },
];

// --- aiming -----------------------------------------------------------------
const fresh = createClaw();
assert.ok(isAiming(fresh));
assert.equal(fresh.grabbed, null);
assert.equal(fresh.prize, null);
assert.equal(fresh.clawY, PLAY.parkY, "the claw starts parked at the top");

// Right is +x; forward (away from the player) is -z.
assert.ok(stepClaw(fresh, hold(1, 0), dt, []).x > 0);
assert.ok(stepClaw(fresh, hold(-1, 0), dt, []).x < 0);
assert.ok(stepClaw(fresh, hold(0, 1), dt, []).z < 0, "forward must be -z");
assert.ok(stepClaw(fresh, hold(0, -1), dt, []).z > 0);

// The claw can never leave the cabinet, however long you hold.
let pinned = fresh;
for (let i = 0; i < 600; i++) pinned = stepClaw(pinned, hold(1, 1), dt, []);
assert.ok(Math.abs(pinned.x - BOUNDS.x) < 1e-9, `x escaped to ${pinned.x}`);
assert.ok(Math.abs(pinned.z + BOUNDS.z) < 1e-9, `z escaped to ${pinned.z}`);
let pinned2 = fresh;
for (let i = 0; i < 600; i++) pinned2 = stepClaw(pinned2, hold(-1, -1), dt, []);
assert.ok(Math.abs(pinned2.x + BOUNDS.x) < 1e-9);
assert.ok(Math.abs(pinned2.z - BOUNDS.z) < 1e-9);

// Aiming is frame-rate independent.
const oneStep = stepClaw(fresh, hold(1, 0), 1 / 30, []);
let manySteps = fresh;
for (let i = 0; i < 2; i++) manySteps = stepClaw(manySteps, hold(1, 0), 1 / 60, []);
assert.ok(Math.abs(oneStep.x - manySteps.x) < 1e-9);

// --- the swing --------------------------------------------------------------
// The claw trails the gantry. Without this it is a cursor, not a machine.
let swinging = fresh;
for (let i = 0; i < 20; i++) swinging = stepClaw(swinging, hold(1, 0), dt, []);
assert.ok(
  swinging.hangX < swinging.x,
  `the claw should lag behind the gantry (${swinging.hangX} vs ${swinging.x})`,
);
assert.ok(swinging.hangX > 0, "but it should be following, not stuck");

// Let go and it catches up.
let settled = swinging;
for (let i = 0; i < 200; i++) settled = stepClaw(settled, still, dt, []);
assert.ok(
  Math.abs(settled.hangX - settled.x) < 1e-4,
  "the swing must settle when the gantry stops",
);

// Dropping commits from where the claw *hangs*, not where the gantry got to, so
// jabbing the stick then dropping is a genuine miss rather than a free snap.
const jabbed = stepClaw(swinging, DROP, dt, []);
assert.ok(
  Math.abs(jabbed.x - swinging.hangX) < 1e-6,
  "the shot must be taken from the hanging position",
);

// --- grabbing ---------------------------------------------------------------
assert.equal(attemptGrab(capsules, { x: 0, z: 0 }), 0, "dead on should catch");
assert.equal(attemptGrab(capsules, { x: 0.3, z: -0.2 }), 1);
assert.equal(attemptGrab(capsules, { x: -0.35, z: 0.25 }), null, "a miss is a miss");
assert.equal(attemptGrab([], { x: 0, z: 0 }), null);

// Exactly at the radius still counts; a hair beyond does not.
assert.equal(attemptGrab([{ x: GRAB_RADIUS, z: 0 }], { x: 0, z: 0 }), 0);
assert.equal(attemptGrab([{ x: GRAB_RADIUS + 0.001, z: 0 }], { x: 0, z: 0 }), null);

// An already-won capsule is not there to be grabbed, though it stays in the
// list to keep indices stable.
assert.equal(attemptGrab([{ x: 0, z: 0, taken: true }], { x: 0, z: 0 }), null);
assert.equal(
  attemptGrab([{ x: 0, z: 0, taken: true }, { x: 0.04, z: 0 }], { x: 0, z: 0 }),
  1,
);

// The nearest wins. Equidistant resolves to the lowest index, so the same shot
// always gives the same result.
assert.equal(attemptGrab([{ x: 0.1, z: 0 }, { x: 0.02, z: 0 }], { x: 0, z: 0 }), 1);
const tie: Capsule[] = [{ x: 0.05, z: 0 }, { x: -0.05, z: 0 }];
assert.equal(attemptGrab(tie, { x: 0, z: 0 }), 0);
assert.equal(attemptGrab([...tie].reverse(), { x: 0, z: 0 }), 0);

// The aim ring must agree with what a drop would actually do, or it lies.
for (const p of [{ x: 0, z: 0 }, { x: 0.06, z: 0.04 }, { x: -0.3, z: 0.25 }]) {
  assert.equal(wouldGrab(capsules, p), attemptGrab(capsules, p) !== null);
}

// --- a winning round --------------------------------------------------------
const onTarget = settleAt(0, 0, capsules);
const win = playOut(stepClaw(onTarget, DROP, dt, capsules), capsules);

assert.deepEqual(
  win.seen,
  [
    "dropping",
    "settling",
    "closing",
    "lifting",
    "returning",
    "releasing",
    "falling",
    "done",
  ],
  `unexpected sequence: ${win.seen.join(" -> ")}`,
);
assert.equal(win.state.grabbed, 0, "should have caught the capsule under it");

// The claw goes all the way down and back up — never through the floor, never
// above its rail.
assert.ok(
  Math.min(...win.heights) >= GRAB_Y - 1e-9,
  `claw went below the floor to ${Math.min(...win.heights)}`,
);
assert.ok(Math.max(...win.heights) <= PLAY.parkY + 1e-9, "claw rose above its rail");
assert.ok(
  win.heights.some((h) => Math.abs(h - GRAB_Y) < 1e-6),
  "the claw never actually reached the capsules",
);
assert.equal(win.state.clawY, PLAY.parkY, "it should end parked");

// Delivered over the chute, not dropped where it was picked up.
assert.ok(Math.abs(win.state.x - CHUTE.x) < 1e-6, "did not traverse to the chute");
assert.ok(Math.abs(win.state.z - CHUTE.z) < 1e-6);

// THE FALL: the capsule ends resting in the chute, not vanished mid-air.
assert.ok(win.state.prize, "the prize should still exist at the end");
assert.equal(win.state.prize!.y, PLAY.chuteFloorY, "the prize must land in the chute");
assert.ok(Math.abs(win.state.prize!.x - CHUTE.x) < 0.02, "it fell down the hole");
assert.ok(Math.abs(win.state.prize!.z - CHUTE.z) < 0.02);
// And the prongs opened to let it go.
assert.ok(win.state.grip < 0.4, `claw should be open at the end, grip=${win.state.grip}`);

// --- the fall, frame by frame ----------------------------------------------
let s = stepClaw(onTarget, DROP, dt, capsules);
const carried: number[] = [];
const falling: { x: number; y: number; z: number }[] = [];
for (let i = 0; i < 4000 && !isFinished(s); i++) {
  s = stepClaw(s, still, dt, capsules);
  if (!s.prize) continue;
  if (s.phase === "falling") falling.push({ ...s.prize });
  // Only the phases where the claw is actually holding it. The last frame is
  // "done" with the prize resting in the chute, which is not being carried.
  else if (s.phase !== "done") carried.push(s.prize.y);
}

// While carried it hangs under the claw — never teleported, never on the floor.
assert.ok(carried.length > 10, "the capsule should be visibly carried");
for (const y of carried) {
  assert.ok(y > PLAY.chuteFloorY, `a carried capsule should be up in the claw, not ${y}`);
}

// The fall is a real fall: several frames, only downward, and accelerating.
assert.ok(falling.length > 8, `the fall should be animated, got ${falling.length} frames`);
for (let i = 1; i < falling.length; i++) {
  assert.ok(falling[i].y <= falling[i - 1].y + 1e-9, "a falling capsule must never rise");
  // Frozen horizontally: it fell out of the claw, it does not steer.
  assert.ok(Math.abs(falling[i].x - falling[0].x) < 1e-9, "the fall drifted sideways");
  assert.ok(Math.abs(falling[i].z - falling[0].z) < 1e-9);
}
const firstStep = falling[1].y - falling[0].y;
const lastStep = falling[falling.length - 1].y - falling[falling.length - 2].y;
assert.ok(lastStep < firstStep, "the fall should accelerate under gravity, not glide");

// --- a losing round --------------------------------------------------------
const offTarget = settleAt(-0.35, 0.25, capsules);
const miss = playOut(stepClaw(offTarget, DROP, dt, capsules), capsules);
assert.equal(miss.state.grabbed, null);
assert.equal(miss.state.prize, null, "a miss must not produce a prize");
assert.deepEqual(
  miss.seen,
  ["dropping", "settling", "closing", "lifting", "done"],
  `a miss should not visit the chute: ${miss.seen.join(" -> ")}`,
);
assert.ok(
  Math.abs(miss.state.x - offTarget.x) < 1e-6,
  "a miss stays put, no walk of shame to the chute",
);

// --- control is locked out mid-round ----------------------------------------
let dropping = stepClaw(onTarget, DROP, dt, capsules);
const xWhenDropped = dropping.x;
for (let i = 0; i < 5; i++) dropping = stepClaw(dropping, hold(1, 1), dt, capsules);
assert.ok(
  Math.abs(dropping.x - xWhenDropped) < 1e-9,
  "the claw must not steer once dropping",
);
assert.notEqual(dropping.phase, "aiming");
// Mashing drop mid-round changes nothing.
assert.equal(stepClaw(dropping, DROP, dt, capsules).phase, dropping.phase);

// Finished is terminal, and the landed prize stays where it fell.
const after = stepClaw(win.state, DROP, dt, capsules);
assert.equal(after.phase, "done");
assert.deepEqual(after.prize, win.state.prize, "the landed prize must not move");
assert.ok(isFinished(win.state) && !isAiming(win.state));

// --- capsule layout --------------------------------------------------------
for (const n of [1, 2, 4, 8]) {
  const layout = capsuleLayout(n);
  assert.equal(layout.length, n, `wanted ${n} capsules`);
  for (const c of layout) {
    assert.ok(Math.abs(c.x) <= BOUNDS.x, `capsule outside the cabinet: x=${c.x}`);
    assert.ok(Math.abs(c.z) <= BOUNDS.z, `capsule outside the cabinet: z=${c.z}`);
    // Nothing may sit in the hole it is supposed to fall through.
    assert.ok(
      Math.hypot(c.x - CHUTE.x, c.z - CHUTE.z) > 0.15,
      `capsule at ${c.x.toFixed(2)},${c.z.toFixed(2)} is parked in the chute`,
    );
  }
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const gap = Math.hypot(layout[i].x - layout[j].x, layout[i].z - layout[j].z);
      assert.ok(gap > 0.12, `capsules ${i} and ${j} overlap (${gap.toFixed(3)})`);
    }
  }
}
assert.deepEqual(capsuleLayout(0), []);
assert.deepEqual(capsuleLayout(4), capsuleLayout(4));
assert.notDeepEqual(capsuleLayout(4, 1), capsuleLayout(4, 9));

// Prefix-stable: winning leaves the same capsules minus one.
for (let n = 1; n <= 7; n++) {
  assert.deepEqual(
    capsuleLayout(n),
    capsuleLayout(n + 1).slice(0, n),
    `layout(${n}) should be the start of layout(${n + 1})`,
  );
}

// --- every capsule is winnable ---------------------------------------------
// Catching one is no use if the claw cannot then carry it to the chute.
for (const c of capsuleLayout(6)) {
  assert.ok(wouldGrab([c], { x: c.x, z: c.z }), "a capsule sits out of reach");
  const round = playOut(stepClaw(settleAt(c.x, c.z, [c]), DROP, dt, [c]), [c]);
  assert.equal(round.state.grabbed, 0, `never caught the capsule at ${c.x},${c.z}`);
  assert.equal(
    round.state.prize?.y,
    PLAY.chuteFloorY,
    `the capsule at ${c.x},${c.z} never reached the chute`,
  );
}

console.log("claw: all assertions passed");
