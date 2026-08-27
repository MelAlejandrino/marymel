/** Run: node --test */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  crouchDrop,
  footFromHip,
  hemFrontY,
  kneeY,
  patHandBottom,
  patLook,
  patSkirtReach,
  POSTURE,
  RIG,
  shoeBottomY,
} from "../player/rig.ts";
import { PET, PET_SECONDS, type Pet } from "../player/petting.ts";
import {
  BUSHES,
  HOP_SECONDS,
  hopAt,
  hopTime,
  LOOP_RADIUS,
  petFacing,
  petLayout,
  petSpot,
  pettedHeadTop,
  pettedNose,
  rabbitPose,
  RABBIT,
  rabbitHeight,
  rabbitHomes,
  rearAngle,
} from "./critters.ts";
import { isClear } from "./scatter.ts";

const HOMES = rabbitHomes(5);

// --- where they live --------------------------------------------------------

test("rabbits land in the front garden, not in a bush", () => {
  assert.equal(HOMES.length, 5);

  for (const home of HOMES) {
    // Anywhere on its loop must still be clear of the path and the cottage.
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const x = home.x + Math.cos(a) * LOOP_RADIUS;
      const z = home.z + Math.sin(a) * LOOP_RADIUS;
      assert.ok(isClear(x, z), `loop crosses the path or house at ${x},${z}`);
    }
    for (const bush of BUSHES) {
      const gap = Math.hypot(bush.x - home.x, bush.z - home.z);
      assert.ok(gap > LOOP_RADIUS + bush.scale * 0.55, `rabbit inside a bush (${gap})`);
    }
    // In front of the cottage, where she walks — the whole point is being seen.
    assert.ok(home.z > 1 && home.z < 19, `rabbit hiding at z=${home.z}`);
  }
});

test("rabbits are deterministic", () => {
  assert.deepEqual(rabbitHomes(5), rabbitHomes(5));
});

// --- the hop ---------------------------------------------------------------

test("a hop leaves the ground, lands, and moves forward", () => {
  assert.equal(hopAt(0).height, 0);
  assert.ok(hopAt(0.5).height > 0.99);
  assert.ok(hopAt(3).height < 1e-9);

  // Monotone travel: a rabbit never slides backwards.
  let last = -Infinity;
  for (let t = 0; t < 4; t += 0.01) {
    const { travelled } = hopAt(t);
    assert.ok(travelled >= last, `travel went backwards at ${t}`);
    last = travelled;
  }
  // Ground covered per hop, and a stall at each landing.
  assert.ok(hopAt(1).travelled - hopAt(0).travelled > 0.99);
  assert.ok(hopAt(1.02).travelled - hopAt(0.98).travelled < 0.02);
});

test("it hops a while, then stops to graze with its feet on the ground", () => {
  let grazed = false;
  let hopped = false;
  let last = -Infinity;

  for (let seconds = 0; seconds < 40 * HOP_SECONDS; seconds += 0.02) {
    const { t, graze } = hopTime(seconds, 0);
    assert.ok(t >= last - 1e-9, `the rabbit's clock ran backwards at ${seconds}`);
    last = t;

    if (graze > 0.99) {
      grazed = true;
      // Grazing happens standing still, and standing means on the ground.
      assert.ok(hopAt(t).height < 1e-9, "grazing in mid-air");
    }
    if (graze === 0 && hopAt(t).height > 0.5) hopped = true;
  }

  assert.ok(hopped, "it never hopped");
  assert.ok(grazed, "it never stopped to graze");
});

test("the five of them are not in lockstep", () => {
  // Same time, different phases: their heights must not all match.
  const heights = HOMES.map((_, i) => {
    const phase = (i + 1) / 7;
    return hopAt(hopTime(3.3, phase).t).height;
  });
  const spread = Math.max(...heights) - Math.min(...heights);
  assert.ok(spread > 0.2, `rabbits hopping in sync (spread ${spread})`);
});

// --- the crouch ------------------------------------------------------------

test("she crouches with her feet still on the grass", () => {
  const { thigh, shin } = POSTURE.pat;
  const standing = shoeBottomY();
  const crouched = RIG.hipY - footFromHip(thigh, shin).drop - crouchDrop();

  assert.ok(
    Math.abs(crouched - standing) < 1e-9,
    `her feet leave the ground in the crouch (${crouched} vs ${standing})`,
  );
  assert.ok(crouchDrop() > 0.08, "the crouch is too shallow to read as one");
  // Soles flat: a crouch with the feet pitched over reads as tiptoe.
  assert.ok(Math.abs(thigh + shin) < 1e-9, "her feet are not flat on the ground");
});

test("her knees come out from under the skirt when she crouches", () => {
  const { skirtTilt, skirtTakeUp, thigh } = POSTURE.pat;
  assert.ok(
    hemFrontY(skirtTilt, skirtTakeUp) > kneeY(thigh),
    "the hem swallows her knees, so the crouch is invisible",
  );
});

// --- the two rigs have to meet ---------------------------------------------

test("her hand lands on the rabbit's head", () => {
  for (const home of HOMES) {
    const headTop = pettedHeadTop(home.scale);
    const palm = patHandBottom(1);
    const gap = headTop - palm;
    // Positive is her palm pressing in a little; negative is petting thin air.
    assert.ok(
      gap > -0.015 && gap < 0.05,
      `scale ${home.scale.toFixed(3)}: palm ${palm.toFixed(3)} vs head ` +
        `${headTop.toFixed(3)} — off by ${gap.toFixed(3)}`,
    );
    // And the tip it does to get there stays a tip, not a circus act.
    const tip = rearAngle(home.scale);
    assert.ok(Math.abs(tip) < 0.5, `rabbit rearing too far (${tip})`);
  }
});

test("her hand lifts clear of it between strokes", () => {
  const lift = patHandBottom(-1) - patHandBottom(1);
  assert.ok(lift > 0.03, `the stroke barely moves (${lift})`);
  assert.ok(lift < 0.2, `the stroke is a wave, not a stroke (${lift})`);
});

/**
 * Every part of a petted rabbit, in her own space. The list is the point: the
 * first version of this only checked where the rabbit *stood*, and its nose
 * ended up somewhere it very much should not have been.
 */
function pettedParts(scale: number) {
  const { head, face, origin } = petLayout(scale);
  const along = (from: { x: number; z: number }, distance: number) => ({
    x: from.x + face.x * distance,
    z: from.z + face.z * distance,
  });

  return {
    nose: pettedNose(scale),
    head,
    origin,
    // The rear and the tail sit behind its origin, along its own facing.
    haunch: along(origin, RABBIT.haunch.z * scale),
    tail: along(origin, RABBIT.tail.z * scale),
    chest: along(origin, RABBIT.chest.z * scale),
  };
}

test("she pets it beside her, and no part of it goes near her", () => {
  const reach = patSkirtReach();

  for (const home of HOMES) {
    const parts = pettedParts(home.scale);

    for (const [name, part] of Object.entries(parts)) {
      const away = Math.hypot(part.x, part.z);
      // The one that matters. Her arm is barely longer than her skirt is wide,
      // so an animal that comes at her head-on ends up under the hem — which
      // is how this looked before, and it read exactly as badly as it sounds.
      assert.ok(
        away > reach + 0.1,
        `its ${name} is ${away.toFixed(3)} out, inside her skirt's ${reach.toFixed(3)}`,
      );
      assert.ok(away < 1.1, `its ${name} is out of her reach (${away.toFixed(3)})`);
      // Off to her right, where her hand is — not on her centre line.
      assert.ok(part.x > 0.12, `its ${name} is on her centre line (x=${part.x.toFixed(3)})`);
    }

    // And it is turned side-on, so it is not nosing toward her either way.
    const { face, head } = petLayout(home.scale);
    const toHer = Math.hypot(head.x, head.z);
    const facingHer = -(face.x * head.x + face.z * head.z) / toHer;
    assert.ok(facingHer < 0.3, `it is still pointing at her (${facingHer.toFixed(2)})`);
  }
});

test("she turns her head to look at what she is petting", () => {
  // It is beside her, so a head pointing straight ahead would be looking past
  // it — but no glance may crane past the shoulders either.
  assert.ok(patLook() > 0.3, "she is not looking at it");
  assert.ok(patLook() <= 0.7, "her head turns further than a neck does");
});

test("a rabbit is rabbit-sized", () => {
  for (const home of HOMES) {
    const ears = rabbitHeight(home.scale);
    // Ears up, it should come to about her knee — she is ~1.5 tall.
    assert.ok(ears > 0.5 && ears < 0.85, `rabbit ${ears.toFixed(2)} tall`);
    // The rear is the widest part of it, which is most of the silhouette.
    assert.ok(RABBIT.haunch.r > RABBIT.chest.r, "the rear must be the biggest part");
    assert.ok(RABBIT.ear.length > RABBIT.head.r * 2, "ears shorter than its head");
  }
});

test("the whole gesture is over in a few seconds", () => {
  const total = PET.approach + PET.hold + PET.release;
  assert.ok(total > 2 && total < 6, `${total}s is not a pat`);
  // Her hand is on it well before she stands up again.
  assert.ok(PET.hold > PET.approach, "she stands up before it arrives");
});

test("its head sits on its neck and its eyes sit on its head", () => {
  const { head, eye, muzzle, nose, ear } = RABBIT;
  const eyeOut = Math.hypot(eye.x, eye.y, eye.z);
  assert.ok(eyeOut < head.r, "eye floats off the head");
  assert.ok(eyeOut + eye.r > head.r, "eye buried inside the head");

  const muzzleOut = Math.hypot(muzzle.y, muzzle.z);
  assert.ok(muzzleOut + muzzle.r > head.r, "no muzzle: the face is a ball");
  const noseOut = Math.hypot(nose.y, nose.z);
  assert.ok(noseOut > muzzleOut, "the nose is behind the muzzle");
  assert.ok(noseOut < muzzleOut + muzzle.r, "the nose floats off the muzzle");

  const earBase = Math.hypot(ear.x, ear.y, ear.z);
  assert.ok(earBase < head.r, "the ears are not rooted in the head");
  // The pink inside has to be on the front face of the ear, not inside it.
  assert.ok(ear.inner.z > 0 && ear.inner.r < ear.r, "inner ear is misplaced");
});

// --- the gesture, frame by frame -------------------------------------------

/**
 * Replays a whole pet at 60fps and hands back every frame. The player
 * controller is what advances `elapsed` and writes her position, so this
 * stands in for it: she is at the origin facing +z and does not move.
 */
function replayPet(home: (typeof HOMES)[number], startSeconds = 4.2) {
  const scale = home.scale;
  const pet: Pet = {
    ownerId: "rabbit-0",
    x: home.x,
    z: home.z,
    playerX: 0,
    playerZ: 0,
    playerFacing: 0,
    elapsed: 0,
  };
  // Where it was standing when she reached out.
  const before = rabbitPose({
    home,
    scale,
    phase: 0.3,
    seconds: startSeconds,
    pet: null,
    anchor: null,
  });
  const anchor = { x: before.x, z: before.z };
  // Put her within reach of it, as she would have to be to get the prompt.
  pet.playerX = anchor.x - 0.6;
  pet.playerZ = anchor.z - 0.9;

  const frames = [before];
  const step = 1 / 60;
  for (let f = 1; pet.elapsed < PET_SECONDS; f++) {
    pet.elapsed += step;
    frames.push(
      rabbitPose({
        home,
        scale,
        phase: 0.3,
        seconds: startSeconds + f * step,
        pet,
        anchor,
      }),
    );
  }
  return { frames, pet, scale };
}

test("she reaches out, it comes over, and its head lands under her hand", () => {
  for (const home of HOMES) {
    const { frames, pet, scale } = replayPet(home);
    const arrived = frames[Math.round(PET.approach * 60)];
    const spot = petSpot(pet, scale);

    assert.ok(
      Math.hypot(arrived.x - spot.x, arrived.z - spot.z) < 0.01,
      "it has not reached her by the time she starts stroking",
    );
    // On the grass, tipped back, head at her palm.
    assert.ok(arrived.lift <= RABBIT.rearLift * scale + 1e-9, "it arrived mid-air");
    assert.ok(
      Math.abs(arrived.pitch - rearAngle(scale)) < 1e-6,
      "it did not tip back to meet her",
    );
    // Side-on, within a whisker of the wiggle.
    assert.ok(
      Math.abs(arrived.yaw - petFacing(pet, scale)) < 0.1,
      "it arrived facing the wrong way",
    );
  }
});

test("nothing teleports: the whole gesture is continuous", () => {
  for (const home of HOMES) {
    const { frames } = replayPet(home);
    // A hop covers ~0.7 units in 0.85s, so a 60fps frame is well under 0.05.
    for (let i = 1; i < frames.length; i++) {
      const jump = Math.hypot(frames[i].x - frames[i - 1].x, frames[i].z - frames[i - 1].z);
      assert.ok(jump < 0.05, `it teleported ${jump.toFixed(3)} units at frame ${i}`);
      const drop = Math.abs(frames[i].lift - frames[i - 1].lift);
      assert.ok(drop < 0.03, `its height jumped ${drop.toFixed(3)} at frame ${i}`);
    }
  }
});

test("it stays on the ground while she strokes it", () => {
  const home = HOMES[0];
  const { frames, scale } = replayPet(home);
  // After the stroke has faded in and before she starts standing up.
  const contact = frames.slice(
    Math.round((PET.approach + 0.35) * 60),
    -Math.round(PET.release * 60),
  );

  for (const frame of contact) {
    assert.ok(frame.lift <= RABBIT.rearLift * scale + 1e-9, "it floated off mid-pet");
    assert.ok(frame.petted > 0.5, "it stopped reacting to being stroked");
    assert.equal(frame.graze, 0, "it grazed while being petted");
  }
  // Its ears go back and its body reacts to each stroke rather than holding a
  // single frozen pose.
  const strokes = contact.map((f) => f.stroke);
  assert.ok(Math.max(...strokes) > 0.9 && Math.min(...strokes) < -0.9, "no strokes landed");
});

test("it goes back to hopping afterwards", () => {
  const home = HOMES[0];
  const after = rabbitPose({
    home,
    scale: home.scale,
    phase: 0.3,
    seconds: 4.2 + PET_SECONDS + 2,
    pet: null,
    anchor: null,
  });
  assert.equal(after.petted, 0);
  assert.equal(after.stroke, 0);
  // And it is back on its own loop, not stranded where she left it.
  const fromHome = Math.hypot(after.x - home.x, after.z - home.z);
  assert.ok(Math.abs(fromHome - LOOP_RADIUS) < 1e-9, "it never rejoined its loop");
});
