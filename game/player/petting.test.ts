/** Run: node --test */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approachWeight,
  crouchWeight,
  endPet,
  PET,
  PET_SECONDS,
  petOwner,
  petting,
  startPet,
  strokeOffset,
  strokeWeight,
} from "./petting.ts";

test("the crouch starts and ends at nothing", () => {
  assert.equal(crouchWeight(0), 0);
  assert.equal(crouchWeight(-1), 0);
  assert.equal(crouchWeight(PET_SECONDS), 0);
  assert.equal(crouchWeight(PET_SECONDS + 1), 0);
  // Fully down for the whole middle of the gesture.
  assert.equal(crouchWeight(PET.crouch), 1);
  assert.equal(crouchWeight(PET_SECONDS / 2), 1);
});

test("the crouch goes down once and up once", () => {
  const samples: number[] = [];
  for (let e = 0; e <= PET_SECONDS; e += 0.01) samples.push(crouchWeight(e));

  // Direction changes, ignoring the flat hold in between: up, then down.
  const directions: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const step = samples[i] - samples[i - 1];
    if (Math.abs(step) < 1e-9) continue;
    const sign = Math.sign(step);
    if (directions.at(-1) !== sign) directions.push(sign);
  }
  assert.deepEqual(directions, [1, -1], "she should crouch, hold, and rise — once");
});

test("the animal arrives before she strokes", () => {
  assert.equal(approachWeight(0), 0);
  assert.equal(approachWeight(PET.approach), 1);
  assert.equal(strokeWeight(PET.approach), 0);
  assert.ok(strokeWeight(PET.approach + 0.3) > 0.99);
  assert.equal(strokeWeight(PET_SECONDS), 0);
});

test("the strokes are strokes: a few of them, hand down on contact", () => {
  assert.equal(strokeOffset(0), 0);
  assert.equal(strokeOffset(PET.approach), 0);

  let peaks = 0;
  let previous = 0;
  let rising = true;
  for (let e = 0; e <= PET_SECONDS; e += 0.005) {
    const value = strokeOffset(e);
    assert.ok(Math.abs(value) <= 1.0001, `stroke ran past its range (${value})`);
    if (rising && value < previous) {
      peaks++;
      rising = false;
    }
    if (!rising && value > previous) rising = true;
    previous = value;
  }
  assert.ok(peaks >= 2 && peaks <= 5, `expected a handful of strokes, got ${peaks}`);
});

test("the store hands the animal back", () => {
  assert.equal(petOwner(), null);
  startPet("rabbit-2", 3, 4);
  assert.equal(petOwner(), "rabbit-2");
  assert.equal(petting.current?.x, 3);
  // Initialised to the animal's own spot, so frame one cannot fling it away.
  assert.equal(petting.current?.playerZ, 4);
  endPet();
  assert.equal(petOwner(), null);
});
