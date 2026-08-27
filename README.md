# marymel

A private relationship adventure — see `PLAN.md` for the full design.

**Status: a walkable mini open world.** Auth, NeonDB, a 3D cottage and garden,
a third-person character, and things placed around the world to find.

**This has diverged from `PLAN.md`.** The monthly chapter system (PLAN
sections 7-9, 21) is gone — no levels, no unlock dates, no time gating. In its
place the world is open and filled with *spots*: arcade cabinets, photo frames,
letters and keepsakes, found by exploring. `PLAN.md` still describes the old
design and has not been rewritten.

## Running

```bash
npm run dev
npm test          # date, auth, and level-state self-checks
npm run db:migrate -- migrations/001-open-world.sql   # apply a migration
npm run db:password -- admin@example.com "new password"
npm run db:seed   # idempotent bootstrap (safe to re-run)
npm run db:studio # browse the data
```

## Deploying to Vercel

Set every variable from `.env.example` in **Project → Settings → Environment
Variables**. `.env` is gitignored, so nothing carries over on its own —
`SESSION_SECRET` in particular must be set, or signing in breaks.

The database is Neon and already migrated, so there is nothing to run on deploy.
If the schema changes, apply the migration locally against the same connection
string before pushing.

**Uploads are capped at 3.75MB.** Vercel limits a serverless function's request
body to 4.5MB, so `serverActions.bodySizeLimit` is 4mb and the upload check sits
just under it. Phone photos frequently exceed that; the real fix is to upload
straight from the browser to Cloudinary with a signed request, which never
touches a function body. Not built yet.

## Environment

`.env` (gitignored) needs:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `SESSION_SECRET` | signs the session cookie; rotating it logs everyone out |

Optional, seed-only: `SEED_ADMIN_EMAIL`, `SEED_PLAYER_EMAIL`, `SEED_PASSWORD`.

## Where things live

| Path | Role |
| --- | --- |
| `lib/db/schema.ts` | the whole schema; write a migration after editing |
| `lib/db/seed-content.ts` | the starting layout of the world, checked by its test |
| `lib/world/query.ts` | what the browser is allowed to know about the world |
| `lib/world/actions.ts` | discover a spot, play an arcade cabinet |
| `lib/admin/` | the content editor's queries and actions |
| `lib/media/` | `sniff.ts` identifies an image by its bytes; Cloudinary upload |
| `app/admin/` | `/admin` — server-action forms, no client JS |
| `game/world/spots/` | one visual per kind, plus the kind -> component registry |
| `game/minigames/claw/` | `mechanics.ts` is the whole game as a pure reducer; `geometry.ts` is the cabinet and claw shape, checked by its test |
| `game/ui/MemoryViewer.tsx` | the reveal, styled as a note on paper |
| `game/ui/OpeningCapsule.tsx` | the beat between the capsule landing and the note |
| `app/admin/SaveButton.tsx` | pending state for the admin's forms |
| `app/admin/PlacementField.tsx` | drag-on-a-map placement, drawn from the real layout |
| `game/world/spots/meta.ts` | kind → verb/range/label, free of React and three |
| `lib/auth/` | password hashing, session cookie, data access layer |
| `game/world/layout.ts` | where everything is; renderer and collision both read it |
| `game/world/palette.ts` | every colour in the world, picked as one set |
| `game/world/House.tsx` `Garden.tsx` `Sky.tsx` `Lighting.tsx` | the scene, one concern each |
| `game/world/terrain.ts` | the land beyond the fence: height field, hills, shade — three-free and tested |
| `game/world/terrainMesh.ts` | `buildTerrainGeometry()` turns the field into a polar mesh; split out so it can be tested without three |
| `game/world/Terrain.tsx` | mounts the mesh; also stands in for the lawn the old `Garden` ground plane used to be |
| `game/world/scatter.ts` | deterministic placement for grass, flowers, bushes |
| `game/interaction/` | proximity prompts — doors, NPCs, mini-games all use it |
| `game/input.ts` | one input surface, written by keyboard and touch alike |
| `game/player/movement.ts` | camera-relative movement, steering, follow and fov math |
| `game/player/rig.ts` | the avatar's proportions; every number checked in `rig.test.ts` |
| `game/player/Avatar.tsx` | the character, posed procedurally from `motion.ts` |

## Rules worth keeping

- **Arcade prizes stay on the server.** Everything else is open, so a spot's
  memory ships with the page and the reveal is instant. Prizes are the one
  surprise left, so `getWorld` sends only counts and the server picks the prize.
- **Ids from the browser are never trusted.** `requireSpot` in
  `lib/world/actions.ts` re-checks that the id belongs to this relationship.
- **Discover and collect are idempotent.** Unique constraints on
  `(user_id, spot_id)` and `(user_id, collectible_id)` mean the server can
  `ON CONFLICT DO NOTHING` instead of read-then-write.
- **A mini-game owns the camera and the input while it is mounted.** The player
  controller takes a `paused` prop and stands still; the HUD action button can
  be relabelled. That is the entire contract.
- **Heights in the claw are real units, not a 0..1 fraction.** The capsule has
  to fall under gravity and land in the chute, so the reducer works in the same
  units the meshes do. `PLAY.hang` equals the capsule radius for a reason: the
  hub stops at `floorY + 2r` and a resting capsule sits at `floorY + r`, so a
  grabbed capsule does not move at the instant it is grabbed.
- **One mesh for the prize, not two.** Carried, falling and resting are all the
  same sphere positioned from state. Swapping a "floor" copy for a "held" copy
  is what read as a teleport.
- **Splay is a positive *outward* angle, and the transform negates it.** A
  positive rotation about X swings a hanging finger *inward*, so getting this
  wrong left the claw with all three fingers collapsed through its own middle
  when open and standing straight when shut. `geometry.test.ts` asserts the
  claw is wider open than shut and that the fingertips travel inward as it
  closes.
- **The admin says when it is working.** Plain server-action forms submit with
  no feedback at all. `SaveButton` uses `useFormStatus` to read the pending
  state of whatever form it sits in — no props, no wiring.
- **The shaft is real.** The cabinet base is built from blocks *around* the
  chute void, not as one solid box — as a solid box a capsule falling to the
  chute landed inside it and simply vanished. `geometry.test.ts` walks the fall
  from the floor to the tray and asserts every point is inside the void.
- **Spots are placed on a map, not typed.** `PlacementField` draws the garden
  from `game/world/layout.ts` — the same constants the game uses — so the map
  cannot drift from the world. Coordinates survive only as hidden inputs, so
  every server action is unchanged.
- **"Can she reach it" is two checks.** Not inside a wall or tree, *and*
  somewhere within reach is standable. The second alone passes a spot buried in
  a wall, because there is open ground on the far side.
- **`meta.ts` exists so the admin can ask about ranges without importing
  three.js.** Verified: the placement map's chunk carries no renderer.
- **The admin is collapsed by default.** Every spot is one line until opened,
  and its fields group into where it is and what it says. Laying all of them out
  at once was a wall of inputs with no shape. `<details>` does it natively, so
  it still works with JavaScript off.
- **Free play must not repeat.** Every prize is already owned in free play, so a
  random pick can hand back the same one twice running, which reads as the
  machine being broken. The client passes the ids it has been shown this visit
  and the server prefers one it has not, falling back once they are exhausted.
- **Nothing lists her prizes.** There is no collection screen and no counters.
  Finding something shows it once; the record of it is that she remembers.
- **No counters.** The collection is a list of what she has, not a score. No
  "found 3 of 16", no win tallies — a progress bar turns a set of memories into
  a chore.
- **The claw's stopping height follows the finger length**, not the capsule
  size. The other way round forced the fingers to be stubby enough not to clip
  the floor, and they stopped looking like a claw. `geometry.ts` derives
  `GRAB_Y` from `PRONG_REACH`, and its test checks both that the tips graze the
  floor and that the fingers stay long enough relative to the hub to read as a
  claw.
- **Free play, not an empty box.** `playArcade` returns `won` for something new,
  `replay` for a cabinet she has cleared (nothing recorded), and `empty` only
  when the cabinet has no prizes at all. The client never decides which.
- **The claw is client-judged, the prize is server-chosen.** The client decides
  whether it caught something; the server decides *which* prize and refuses a
  duplicate. Worst case a tampered client claims a prize it was getting anyway
  — the alternative is server-rolled odds, which makes the claw theatre.
- **Look-drag only starts on the canvas.** It used to be an opt-out (`data-ui`
  per control), which broke any overlay that forgot the marker: capturing the
  pointer retargets the pointerup, so the click never reaches the button.
- **Adding a kind of thing needs no migration.** `spot_kind` picks a component
  from the registry in `game/world/spots/`; per-kind options live in `config`.
- **Role comes from the database**, re-read per request, not from the cookie.
- **Geometry has one home.** `game/world/layout.ts` feeds both the meshes and
  the colliders, so a wall can't be drawn where you can walk.
- **Nothing hardcodes an interaction.** Objects register with the interaction
  registry; the player controller only asks what's nearby.
- **A prompt is its text, not its id.** The interaction registry compares
  `id|verb|label|enabled`; comparing ids alone left the door reading "open the
  door" while you stood in the open doorway. `registry.test.ts` holds it.
- **Rotating a cylinder is not rotating a plane.** A `planeGeometry` faces +Z
  and needs `rotation-x = -PI/2` to lie flat. A `cylinderGeometry` already has
  its axis on Y, so the same rotation stands it *up* on its edge — which is how
  the stepping stones ended up embedded in the path like wheels.
- **Steer by velocity, never by input.** Releasing a key zeroes the input
  while she is still sliding to a stop, and `atan2(0, 0)` is `0` — which snapped
  her round to face +z on every stop. `steer()` in `movement.ts` owns this, and
  `movement.test.ts` holds the regression.
- **Face features are measured, not eyeballed.** `rig.test.ts` asserts each one
  sits *on* the head — centre inside the skull, surface just proud of it — and
  that the hair shells clear the eyes. A dark blob floating off a blank sphere
  is what makes a low-poly face unsettling.
- **No `Math.random()` in the scene.** The garden is scattered from a hash, so
  it composes identically every load and matches between server and client.
- **Watch the transform order.** three composes a local matrix as `T * R * S`,
  so a non-uniform scale applies *before* rotation. Scaling a shape and then
  rotating it 45° gives a skewed parallelogram, not a rotated rectangle — the
  roof is built from explicitly positioned slabs for exactly this reason, and
  `game/world/layout.test.ts` pins where their ends land.
- **Per-frame state stays out of React.** Input and positions live in refs and
  module state; React re-renders only when a prompt appears or disappears.

## Portrait shell

The app is portrait everywhere. `app/globals.css` puts every page inside a
`.stage` / `.screen` pair: on a phone `.screen` fills the display, and on
anything wider than 3:4 it becomes a phone-shaped column on a dark backdrop,
so the scene keeps the framing it was composed for.

Three things that are easy to get wrong here:

- **`100dvh`, never `100vh`.** `vh` measures the viewport *including* the
  mobile URL bar, which pushes the bottom of the world below the fold.
- **Safe areas are insets, not padding.** `viewport-fit=cover` lets the world
  paint under the notch; `.safe-area` pulls the HUD back out using
  `top/right/bottom/left: env(safe-area-inset-*)`. Padding would not work —
  an absolutely positioned child is offset from the padding box.
- **three's `fov` is vertical.** A tall viewport crops the view *sideways*, so
  `AdaptiveFov` holds the horizontal field steady instead (see `verticalFov`).

## Who can see it

**The world needs no login.** Open the link and walk in. An anonymous visitor is
treated as the player account, so what she finds is remembered without her ever
seeing a password box.

That means **anyone with the URL can read everything in the world** — every
photo, every note. That is deliberate, and it is the trade: no password for her
costs a private link. If it ever needs locking down, `getViewer` in
`lib/auth/dal.ts` is the single place to change.

Editing is unaffected. `/admin` still requires signing in, and `requireAdmin`
re-reads the role from the database.

## Admin

`/admin`, **signed in as the ADMIN account** (`admin@example.com` by default).
An "Admin" link appears in the collection panel for that role.

Signing in as the player and visiting `/admin` will not work — it tells you so
rather than bouncing you. The admin account can also walk the world, so there is
no need to switch back and forth while editing.

Place and edit spots, write memories, manage arcade prizes, reset progress.

**Photos: choose a file.** Uploads go to Cloudinary. Set these in `.env`:

| Variable | |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Settings → API Keys |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |

Until they are set the admin says so and only a direct image URL works. A Google
Drive or Dropbox *share* link is a web page, not an image, and renders as
nothing — the admin previews each URL and flags the ones known to fail.

Uploads are validated by their **magic bytes**, not the declared content type or
the filename, both of which the browser controls. JPEG, PNG, GIF and WebP only:
SVG is refused because it can carry script. 10MB cap.

A prize is recorded once per person. Once she has won everything in a cabinet it
goes into **free play**: it refills, stays playable, and reveals prizes she
already owns without recording anything. Only a cabinet with no prizes at all is
unplayable.

The game routes live under `app/(game)/`, which owns the portrait shell. The
admin sits outside it so it gets a full, scrollable page.

## Controls

In the claw machine, the movement controls aim the claw and the action button
drops it; the player is hidden while a mini-game has the camera.

Desktop: WASD or arrows to walk, drag to look, `E` / `Space` / `Enter` to
interact. Touch: joystick bottom-left, interact button bottom-right, drag
elsewhere to look.

## Seeded content

Placeholder only — no real names, photos, or messages.

Both accounts start on `change-me-please`. `SEED_PASSWORD` only applies the
first time an account is created, so change them with:

```bash
npm run db:password -- admin@example.com "something better"
npm run db:password -- player@example.com "something better"
```
