/** Run: node --test */
import assert from "node:assert/strict";

import {
  azimuth,
  blend,
  blinkScale,
  BLINK,
  ease,
  footFromHip,
  hemFrontY,
  kneeY,
  onSkin,
  POSTURE,
  distance,
  dressRadiusAt,
  FACE,
  HAIR,
  handPosition,
  polarAngle,
  RIG,
  shoeBottomY,
  skirtProfile,
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
// The lash is an arc riding the rim of the eye, so it is measured against the
// eye rather than the head: a hair wider than the eye, or it vanishes inside
// the pupil; not much wider, or it becomes a hoop around it.
assert.ok(
  FACE.lash.r > FACE.eye.r,
  `lash (${FACE.lash.r}) is buried inside the eye (${FACE.eye.r})`,
);
assert.ok(FACE.lash.r < FACE.eye.r * 1.25, "the lash has become a hoop round the eye");
assert.ok(FACE.lash.dz > 0, "the lash belongs on the front of the eye");
assert.ok(FACE.lash.tilt > 0, "the lash lifts at the outer corner");
assert.ok(FACE.lash.arc > 0 && FACE.lash.arc < Math.PI, "the lash is an arc, not a ring");

// The brow is an arc too, drawn with its apex on the brow line. Both the apex
// and the ends have to stay clear of the hair above and the eye below, and
// where the ends land is decided by the arc's own sagitta.
{
  const { brow } = FACE;
  const radius = brow.w / (2 * Math.sin(brow.arc / 2));
  const sagitta = radius * (1 - Math.cos(brow.arc / 2));
  const [ax, ay, az] = onSkin({ x: brow.x, y: brow.y, z: brow.z }, 0.006);
  assert.ok(
    polarAngle({ x: ax, y: ay, z: az }) > HAIR.crown.thetaLength,
    "the crown cap covers the apex of the brow",
  );
  assert.ok(
    brow.y - sagitta > FACE.eye.y + FACE.eye.r * 0.9,
    `the brow arc dips ${sagitta.toFixed(3)} onto the eye`,
  );
  assert.ok(brow.arc > 0 && brow.arc < Math.PI, "the brow is an arc, not a ring");
}

// `onSkin` puts a feature exactly where it says, without swinging it off its
// own normal on the way.
{
  const p = { x: FACE.brow.x, y: FACE.brow.y, z: FACE.brow.z };
  const [x, y, z] = onSkin(p, 0.01);
  assert.ok(
    Math.abs(distance({ x, y, z }) - (RIG.headR + 0.01)) < 1e-9,
    "onSkin missed the surface",
  );
  assert.ok(
    Math.abs(Math.atan2(y, z) - Math.atan2(p.y, p.z)) < 1e-9,
    "onSkin swung the feature off its own normal",
  );
  assert.deepEqual(onSkin({ x: 0, y: 0, z: 0 }, 0.01), [0, 0, 0]);
}

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

// ...and easing the weight is what turns the blend into a movement that settles
// rather than one that stops dead. Both endpoints stay exact, or a finished
// pose is no longer the pose the rest of this file checks.
assert.equal(ease(0), 0, "an eased blend at 0 is where it started");
assert.equal(ease(1), 1, "an eased blend at 1 has arrived");
assert.equal(ease(0.5), 0.5, "smootherstep is symmetric about the middle");
assert.equal(ease(-3), 0, "ease clamps below");
assert.equal(ease(7), 1, "ease clamps above");
let easedPrev = -1;
for (let i = 0; i <= 100; i++) {
  const v = ease(i / 100);
  assert.ok(v >= easedPrev, "ease must not run backwards");
  assert.ok(v >= 0 && v <= 1, `ease left the unit range at ${i / 100}`);
  easedPrev = v;
}
// It leaves and arrives slowly, which is the entire reason it is here.
assert.ok(ease(0.1) < 0.05, "ease does not ease in");
assert.ok(ease(0.9) > 0.95, "ease does not ease out");

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

// --- the shape of the dress -------------------------------------------------
// The skirt is revolved from a curve now rather than tapered along a straight
// line. Two things have to hold: it still meets the bodice and the hem at
// exactly the radii the rest of the rig measures against, and it never bulges
// *past* the old straight taper — everything that used to clear the dress has
// to clear it still.
{
  const { topY, bottomY, rTop, rBottom } = RIG.dress;
  assert.ok(Math.abs(dressRadiusAt(topY) - rTop) < 1e-9, "the bodice has left the collar");
  assert.ok(Math.abs(dressRadiusAt(bottomY) - rBottom) < 1e-9, "the skirt has left the hem");
  assert.equal(dressRadiusAt(topY + 1), rTop, "above the dress, the radius holds");
  assert.equal(dressRadiusAt(bottomY - 1), rBottom, "below the hem, the radius holds");

  for (let i = 0; i <= 100; i++) {
    const y = bottomY + ((topY - bottomY) * i) / 100;
    const straight = rBottom + (rTop - rBottom) * ((y - bottomY) / (topY - bottomY));
    assert.ok(
      dressRadiusAt(y) <= straight + 1e-9,
      `the dress bulges past its old taper at y=${y.toFixed(3)}`,
    );
    assert.ok(dressRadiusAt(y) > 0, "the dress has collapsed to nothing");
  }

  // ...and there is an actual waist in it: drawn in below the bodice, then
  // flared out again well before the hem.
  assert.ok(
    dressRadiusAt(RIG.sash.y - 0.14) > dressRadiusAt(RIG.sash.y) + 0.02,
    "the skirt has stopped flaring below the waist",
  );
  const pinched = Math.min(
    ...Array.from({ length: 40 }, (_, i) => dressRadiusAt(topY - (i / 40) * 0.2)),
  );
  assert.ok(pinched < rTop, "the bodice never draws in — she has no waist");
  assert.ok(pinched > rTop - 0.03, "the waist is a pinch, not a corset");
}

// The lathed profile has to run bottom to top: `LatheGeometry` takes its
// normals from the direction the profile runs, and reversed, the dress renders
// inside out.
{
  const profile = skirtProfile(8);
  assert.equal(profile.length, 9, "skirtProfile dropped a step");
  const [firstR, firstY] = profile[0];
  const [lastR, lastY] = profile[profile.length - 1];
  assert.ok(Math.abs(firstR - RIG.dress.rBottom) < 1e-9, "the profile does not start at the hem");
  assert.ok(Math.abs(lastR - RIG.dress.rTop) < 1e-9, "the profile does not end at the bodice");
  assert.ok(Math.abs(lastY) < 1e-12, "the top of the profile is the skirt group's own origin");
  assert.ok(
    Math.abs(firstY + (RIG.dress.topY - RIG.dress.bottomY)) < 1e-9,
    "the profile is not as long as the skirt",
  );
  for (let i = 1; i < profile.length; i++) {
    assert.ok(profile[i][1] > profile[i - 1][1], "the profile must run bottom to top");
    assert.ok(profile[i][0] > 0, "a lathe point cannot have a negative radius");
  }
}

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

// Every joint that bends has something sitting over it. A figure assembled from
// primitives shows daylight at the seams long before its silhouette gives it
// away, and the knee is the one joint with nothing else covering it.
assert.ok(RIG.knee.r < RIG.legRadius, "the knee ball bulges out of the thigh");
assert.ok(
  RIG.knee.r > RIG.legRadius * 0.92,
  "the knee ball is narrower than the shin, so the joint still gaps",
);

// The neck exists in order to stay hidden: it fills the gap under a tilted
// head, and the collar has to cover it.
assert.ok(RIG.neck.rBottom > RIG.neck.rTop, "a neck widens into the shoulders");
assert.ok(RIG.neck.rBottom < 0.13, "the neck is wider than the collar hiding it");
assert.ok(
  RIG.neck.y + RIG.neck.height / 2 > RIG.headY - RIG.headR,
  "the neck stops short of the head and leaves a gap",
);
assert.ok(
  RIG.neck.y - RIG.neck.height / 2 < RIG.dress.topY - 0.02,
  "the neck stops short of the collar and leaves a gap",
);

// The shoe is a capsule laid on its side and widened, which only reads as a
// shoe while it stays wider than it is tall and longer than it is wide.
assert.ok(RIG.shoe.width > RIG.shoe.height, "the shoe capsule would stand on its edge");
assert.ok(RIG.shoe.depth > RIG.shoe.width, "the shoe is wider than it is long");
assert.ok(RIG.shoe.depth > RIG.shoe.height, "no capsule is left between the two caps");

// Chibi proportions: a big head is the point, but she still needs a body.
const totalHeight = RIG.headY + RIG.headR;
const headFraction = (RIG.headR * 2) / totalHeight;
assert.ok(headFraction > 0.2 && headFraction < 0.42, `head is ${headFraction.toFixed(2)} of her height`);
assert.ok(totalHeight > 1.2 && totalHeight < 1.8, `she is ${totalHeight.toFixed(2)} tall`);

console.log("rig: all assertions passed");
