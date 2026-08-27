/** Run: node --test */
import assert from "node:assert/strict";

import {
  azimuth,
  blend,
  blinkScale,
  BLINK,
  footFromHip,
  hemFrontY,
  kneeY,
  POSTURE,
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

// Brows and nose have to lie on the skin like everything else.
for (const side of [-1, 1]) {
  sitsOnHead({ ...FACE.brow, x: FACE.brow.x * side }, FACE.brow.h / 2, "brow");
}
sitsOnHead({ x: 0, y: FACE.nose.y, z: FACE.nose.z }, FACE.nose.r, "nose");
assert.ok(FACE.brow.y > FACE.eye.y + FACE.eye.r, "brow sits on top of the eye");
assert.ok(
  FACE.nose.y < FACE.eye.y && FACE.nose.y > FACE.mouth.y,
  "the nose belongs between the eyes and the mouth",
);
// The lash rides on the eye, so it is measured against the eye like the
// catchlight is.
const lashOff = distance({ x: FACE.lash.dx, y: FACE.lash.dy, z: FACE.lash.dz });
assert.ok(lashOff < FACE.eye.r, `lash (${lashOff.toFixed(3)}) floats off the eye`);
assert.ok(FACE.lash.dy > 0, "lashes belong on the upper lid");

// Blink: open nearly all the time, shut in the middle of the blink, and never
// inverted (a negative scale turns the eye inside out).
assert.equal(blinkScale(BLINK.duration + 0.01), 1, "eye is open between blinks");
assert.equal(blinkScale(BLINK.period - 0.01), 1, "eye is open just before a blink");
assert.ok(blinkScale(BLINK.duration / 2) < 0.15, "the blink barely closes the eye");
for (let t = 0; t < BLINK.period * 2.5; t += 0.01) {
  const k = blinkScale(t);
  assert.ok(k > 0 && k <= 1, `blink scale ${k.toFixed(3)} out of range at t=${t}`);
}


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

// The flower sits on the crown cap: outside the hair, but not adrift of it.
const flower = HAIR.flower;
const flowerD = distance(flower);
assert.ok(flowerD < R + HAIR.crown.lift, "flower centre floats off the hair");
assert.ok(
  flowerD + flower.r > R + HAIR.crown.lift,
  "flower is buried in the hair",
);
assert.ok(polarAngle(flower) < HAIR.crown.thetaLength, "flower has no crown to pin to");

// --- the knee, and the poses that need it ----------------------------------
// A leg in two segments only earns its keep if the poses actually land. The
// numbers here are the ones the render loop uses, so if a pose puts her feet
// through the floor this fails rather than shipping.
assert.ok(RIG.kneeAt > 0 && RIG.kneeAt < RIG.legLength, "the knee is off the leg");
assert.ok(
  Math.abs(RIG.kneeAt - RIG.legLength / 2) < 0.06,
  "thigh and shin should be roughly the same length",
);

// Standing: both joints at zero, so the foot hangs straight down and the drop
// has to agree with the height `shoeBottomY()` reports.
const standing = footFromHip(0, 0);
assert.ok(Math.abs(standing.forward) < 1e-9, "a straight leg does not reach forward");
assert.ok(
  Math.abs(RIG.hipY - standing.drop - shoeBottomY()) < 1e-9,
  "the two-segment leg disagrees with shoeBottomY()",
);

// Sitting on a seat: hips are lifted to the seat, and from there the foot must
// come down to somewhere near the floor and forward of the hip — that is what
// separates sitting on a chair from sitting in mid-air.
const seated = footFromHip(POSTURE.sit.thigh, POSTURE.sit.shin);
assert.ok(
  seated.forward > 0.14,
  `seated foot only reaches ${seated.forward.toFixed(3)} forward — she is kneeling, not sitting`,
);
for (const seatHeight of [0.5, 0.66]) {
  const footY = seatHeight - seated.drop;
  assert.ok(
    footY > -0.09,
    `sitting on a seat at ${seatHeight} puts her feet ${(-footY).toFixed(3)} through the floor`,
  );
  assert.ok(
    footY < 0.4,
    `sitting on a seat at ${seatHeight} leaves her feet dangling at ${footY.toFixed(3)}`,
  );
}

// The shin has to fold back the other way from the thigh, or it is not a knee.
assert.ok(
  POSTURE.sit.thigh < 0 && POSTURE.sit.shin > 0,
  "the knee must bend, not hyperextend",
);
// A knee cannot bend further than straight.
assert.ok(
  POSTURE.sit.thigh + POSTURE.sit.shin <= 1e-9,
  "the shin has swung past straight — the knee is inside out",
);

// Lying down: essentially straight, so she does not float above the mattress
// in a sitting shape.
const lying = footFromHip(POSTURE.lie.thigh, POSTURE.lie.shin);
assert.ok(lying.drop > RIG.legLength * 0.9, "lying down should leave the legs straight");

// Blending is what makes it a movement rather than a swap.
assert.equal(blend(2, 6, 0), 2, "a blend at 0 is where it started");
assert.equal(blend(2, 6, 1), 6, "a blend at 1 has arrived");
assert.equal(blend(2, 6, 0.5), 4, "a blend halfway is halfway");

// --- the skirt has to get out of the way -----------------------------------
// The skirt is a rigid cone hanging from the waist and her whole folded-up leg
// fits inside it, so a seated pose with the skirt left alone hides the legs
// completely: it reads as standing still with the feet cut off. Sitting tilts
// it forward from the waist and takes it up, and the front lip of the hem then
// has to clear the knee.
const standingHem = hemFrontY(0, 1);
assert.ok(
  Math.abs(standingHem - RIG.dress.bottomY) < 1e-9,
  "standing, the hem is just the hem",
);

const seatedKnee = kneeY(POSTURE.sit.thigh);
const seatedHem = hemFrontY(POSTURE.sit.skirtTilt, POSTURE.sit.skirtTakeUp);
assert.ok(
  seatedHem > seatedKnee + 0.06,
  `seated, the hem sits at ${seatedHem.toFixed(3)} and the knee at ${seatedKnee.toFixed(3)} — the skirt still covers her legs`,
);
// ...but not so far that the skirt has ridden up off her hips entirely.
assert.ok(
  seatedHem < RIG.hipY + 0.24,
  `seated, the hem has climbed to ${seatedHem.toFixed(3)}, above her hips`,
);
// Taking it up is a nudge, not a costume change.
assert.ok(
  POSTURE.sit.skirtTakeUp > 0.8 && POSTURE.sit.skirtTakeUp <= 1,
  "the skirt should be taken up a little, not shrunk",
);
assert.ok(POSTURE.sit.skirtTilt < 0, "the skirt drapes forward over her lap, not back");

// The knee itself has to end up forward of the hip, or there is nothing for the
// hem to clear in the first place.
const seatedKneeForward = Math.sin(-POSTURE.sit.thigh) * RIG.kneeAt;
assert.ok(
  seatedKneeForward > RIG.kneeAt * 0.8,
  "seated, the thigh is barely off vertical — she is standing with bent knees",
);

// Lying down needs none of this, and must not get it.
assert.equal(POSTURE.lie.skirtTilt, 0, "lying down, the skirt is left alone");
assert.equal(POSTURE.lie.skirtTakeUp, 1, "lying down, the skirt is left alone");

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

// The costume: sleeves cap the shoulders, the sash is at the waist, and the
// underskirt hangs below the hem without reaching the ground.
assert.ok(RIG.sleeve.r > RIG.armRadius, "the sleeve must be wider than the arm it caps");
assert.ok(
  RIG.sash.y > RIG.dress.bottomY && RIG.sash.y < RIG.dress.topY,
  "the sash has to be tied somewhere on the dress",
);
assert.ok(RIG.hand.r > RIG.armRadius, "hands narrower than the wrist read as stumps");
const hemY = RIG.dress.bottomY - RIG.petticoat.drop;
assert.ok(hemY > shoeBottomY(), "the underskirt drags on the ground");
assert.ok(RIG.petticoat.flare > 0, "the underskirt must show past the hem");

// The dress joins the torso to the legs with no gap at either end.
assert.ok(RIG.dress.topY > RIG.shoulderY, "shoulders float above the dress");
assert.ok(RIG.dress.rBottom > RIG.dress.rTop, "the skirt should flare, not taper");

// Chibi proportions: a big head is the point, but she still needs a body.
const totalHeight = RIG.headY + RIG.headR;
const headFraction = (RIG.headR * 2) / totalHeight;
assert.ok(headFraction > 0.2 && headFraction < 0.42, `head is ${headFraction.toFixed(2)} of her height`);
assert.ok(totalHeight > 1.2 && totalHeight < 1.8, `she is ${totalHeight.toFixed(2)} tall`);

console.log("rig: all assertions passed");
