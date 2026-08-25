/** Run: node --test */
import assert from "node:assert/strict";

import {
  azimuth,
  distance,
  dressRadiusAt,
  FACE,
  HAIR,
  handPosition,
  polarAngle,
  RIG,
  shoeBottomY,
  sweepCovers,
  type Point3,
} from "./rig.ts";

const R = RIG.headR;
/** How far a feature may stand off the skin before it reads as floating. */
const MAX_PROUD = 0.05;

function sitsOnHead(p: Point3, r: number, label: string) {
  const d = distance(p);
  assert.ok(d < R, `${label} centre floats off the head (${d.toFixed(3)} > ${R})`);
  assert.ok(d + r > R, `${label} is buried inside the head and invisible`);
  assert.ok(
    d + r - R < MAX_PROUD,
    `${label} stands ${(d + r - R).toFixed(3)} proud — a blob, not a feature`,
  );
}

// --- face -------------------------------------------------------------------
// The old avatar was a dark sphere of radius 0.22 whose centre sat 0.209 from
// the centre of a 0.28 head: it reached 0.43, a featureless mass hanging off
// the front. Every feature now has to sit *on* the skin.
for (const side of [-1, 1]) {
  sitsOnHead({ ...FACE.eye, x: FACE.eye.x * side }, FACE.eye.r, "eye");
  // The catchlight sits on the eye, so it is measured against the eye.
  const off = distance({
    x: FACE.catchlight.dx,
    y: FACE.catchlight.dy,
    z: FACE.catchlight.dz,
  });
  assert.ok(off < FACE.eye.r, `catchlight (${off.toFixed(3)}) floats off the eye`);
  assert.ok(
    off + FACE.catchlight.r > FACE.eye.r,
    "catchlight is buried inside the pupil",
  );
  assert.ok(FACE.catchlight.dz > 0, "catchlight belongs on the front of the eye");
  assert.ok(FACE.catchlight.dy > 0, "catchlight reads best in the upper half");
  sitsOnHead({ ...FACE.blush, x: FACE.blush.x * side }, FACE.blush.r, "blush");
}

// The mouth is a flat ring on a curved head: both the middle of the arc and
// its corners have to graze the surface, or it half-vanishes.
const mouthMid = { x: 0, y: FACE.mouth.y - FACE.mouth.r, z: FACE.mouth.z };
const mouthCorner = { x: FACE.mouth.r, y: FACE.mouth.y, z: FACE.mouth.z };
for (const [label, p] of [
  ["mouth centre", mouthMid],
  ["mouth corner", mouthCorner],
] as const) {
  const d = distance(p);
  assert.ok(d + FACE.mouth.tube > R, `${label} is buried in the head`);
  assert.ok(d - FACE.mouth.tube < R + 0.02, `${label} floats off the face`);
}

// Eyes above the mouth, and the pair symmetrical about the nose.
assert.ok(FACE.eye.y > FACE.mouth.y, "eyes must sit above the mouth");
assert.ok(FACE.eye.x > 0, "eye is mirrored, so it must be off-centre");


// --- hair -------------------------------------------------------------------
// The crown cap must stop above the eyes. A single sphere large enough to read
// as hair would cover them, which is why the hair is built from two shells.
const eyeTheta = polarAngle(FACE.eye);
assert.ok(
  HAIR.crown.thetaLength < eyeTheta,
  `crown reaches ${HAIR.crown.thetaLength.toFixed(2)} rad and covers the eyes at ${eyeTheta.toFixed(2)}`,
);
// ...but still covers the top of the head.
assert.ok(HAIR.crown.thetaLength > Math.PI * 0.25, "crown is a skullcap, too small to read as hair");
assert.ok(HAIR.crown.lift > 0, "hair must sit outside the scalp");

// The back shell must not wrap round onto the face.
for (const side of [-1, 1]) {
  const eyePhi = azimuth({ ...FACE.eye, x: FACE.eye.x * side });
  assert.equal(
    sweepCovers(eyePhi, HAIR.back.phiStart, HAIR.back.phiLength),
    false,
    `back hair covers the eye at phi ${eyePhi.toFixed(2)}`,
  );
}
// Straight ahead (+Z) is the face, and must be clear; straight back must not be.
assert.equal(sweepCovers(Math.PI / 2, HAIR.back.phiStart, HAIR.back.phiLength), false);
assert.equal(sweepCovers(Math.PI * 1.5, HAIR.back.phiStart, HAIR.back.phiLength), true);

// Side locks: below the crown, clear of the back shell, and standing proud of
// the crown cap so they are actually visible.
for (const side of [-1, 1]) {
  const lock = { ...HAIR.sideLock, x: HAIR.sideLock.x * side };
  assert.ok(polarAngle(lock) > HAIR.crown.thetaLength, "side lock hides under the crown");
  assert.equal(
    sweepCovers(azimuth(lock), HAIR.back.phiStart, HAIR.back.phiLength),
    false,
    "side lock is swallowed by the back shell",
  );
  assert.ok(
    distance(lock) + lock.r > R + HAIR.crown.lift,
    "side lock does not reach past the hair it sits on",
  );
}

assert.ok(HAIR.ponytail.z < 0, "the ponytail belongs at the back of the head");

// --- body -------------------------------------------------------------------
// Arms have to clear the flare of the dress, or the forearms vanish into it.
const hand = handPosition();
assert.ok(
  hand.x > dressRadiusAt(hand.y),
  `hand at x=${hand.x.toFixed(3)} is inside the dress (r=${dressRadiusAt(hand.y).toFixed(3)})`,
);
assert.ok(RIG.armOut > 0, "arms angled inward would clip through the skirt");

// The shoulder itself should sit at the edge of the dress, not floating away.
assert.ok(RIG.armX >= dressRadiusAt(RIG.shoulderY) - 0.03, "shoulder sunk into the torso");
assert.ok(RIG.armX < dressRadiusAt(RIG.shoulderY) + 0.12, "arms hang too far out");

// Legs come out from under the hem, and the hips stay hidden by it.
assert.ok(RIG.hipY > RIG.dress.bottomY, "hip joint would be visible below the hem");
assert.ok(RIG.legX + RIG.legRadius < RIG.dress.rBottom, "legs poke through the skirt");

// She stands on the ground: not sunk into it, not hovering above it.
const ground = shoeBottomY();
assert.ok(ground >= -0.02, `feet sink ${(-ground).toFixed(3)} into the ground`);
assert.ok(ground < 0.06, `feet hover ${ground.toFixed(3)} above the ground`);

// The dress joins the torso to the legs with no gap at either end.
assert.ok(RIG.dress.topY > RIG.shoulderY, "shoulders float above the dress");
assert.ok(RIG.dress.rBottom > RIG.dress.rTop, "the skirt should flare, not taper");

// Chibi proportions: a big head is the point, but she still needs a body.
const totalHeight = RIG.headY + RIG.headR;
const headFraction = (RIG.headR * 2) / totalHeight;
assert.ok(headFraction > 0.2 && headFraction < 0.42, `head is ${headFraction.toFixed(2)} of her height`);
assert.ok(totalHeight > 1.2 && totalHeight < 1.8, `she is ${totalHeight.toFixed(2)} tall`);

console.log("rig: all assertions passed");
