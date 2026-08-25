# PLAN.md — Relationship 3D Adventure Web App

> **Revised.** The monthly chapter system this plan originally described
> — levels, unlock dates, date-gated content — has been removed. The app
> is now a mini open world: one small place, filled with things to find,
> nothing locked. Sections 7-13, 20-22, 25, 33-34 and 36-40 were rewritten
> to match what is built; the rest stood up unchanged.

## 1. Project Overview

Build a private, personalized relationship web application that feels like a small third-person 3D adventure game.

The application is designed specifically for the user and his girlfriend. Instead of functioning as a conventional relationship dashboard, photo gallery, or timeline, it is a small world she can walk around — filled with things to find: photos, letters, keepsakes, and an arcade to play. Nothing is locked and nothing is scheduled; the world simply gets fuller over time.

The core experience is:

**Enter the world → reach the door → answer the anniversary question → explore → find memories → play the arcade → come back whenever, and find what is new.**

The application should feel:

* Romantic
* Playful
* Personal
* Immersive
* Atmospheric
* Modern
* Smooth
* Easy to use
* Polished rather than technically overwhelming

The goal is to create the feeling:

> "I made an entire little world that exists just for us."

---

# 2. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* React Three Fiber
* Three.js
* Drei where useful
* Tailwind CSS or another modern UI styling system
* Modern responsive UI

## Backend

Use Next.js server-side functionality for:

* API routes / server actions
* Authentication
* Authorization
* Level unlocking
* Game progress
* Database operations
* Admin functionality

## Database

Use **NeonDB / PostgreSQL** as the primary persistent database.

Use a type-safe database ORM such as Prisma or Drizzle.

The database must be the source of truth for:

* Relationship configuration
* Users
* Levels
* Unlock dates
* Memories
* Game progress
* Collected items
* Mini-game configuration
* Admin-managed content

## Media

Do not store large images directly inside PostgreSQL.

Use an appropriate object/file storage solution for:

* Photos
* Potentially audio
* Other large media assets

Store only the relevant URLs/identifiers and metadata in NeonDB.

---

# 3. High-Level Architecture

```text
                        ┌─────────────────────────┐
                        │        Next.js          │
                        │                         │
                        │  Pages / API / Auth     │
                        │  Server Actions         │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐     ┌───────────┐   ┌────────────┐
              │ R3F /    │     │ NeonDB    │   │ Media      │
              │ Three.js │     │ PostgreSQL │   │ Storage    │
              └──────────┘     └───────────┘   └────────────┘
                    │
                    ▼
             3D Game World
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
    Player       Levels       Mini-games
```

Keep the 3D client focused on rendering and interaction.

Do not expose database credentials or privileged logic to the browser.

The client should request state from the server and render the world accordingly.

---

# 4. Core User Experience

## 4.1 Entry

The girlfriend opens the application.

The initial experience should immediately feel like entering a game rather than navigating a traditional website.

Possible sequence:

1. Loading screen
2. Short atmospheric transition
3. Third-person character appears
4. Player gains control
5. Player discovers the environment
6. Player finds a large door
7. Door interaction begins the relationship verification sequence

Do not overwhelm the user with dashboards or menus immediately.

The 3D world should be the primary experience.

---

# 5. Anniversary Door

The door is the first major progression gate.

When the player interacts with it, display an in-world or polished UI question:

> **When is our anniversary?**

The player selects/enters:

* Month
* Day

The answer should be validated server-side.

The correct answer is the relationship's configured anniversary month/day stored in NeonDB.

## Correct answer

If correct:

* Play a positive animation
* Open the door
* Unlock access to the main relationship world
* Record the successful verification if desired
* Continue into the game

## Incorrect answer

Do not use a harsh error.

Use playful responses such as:

> "Hmm... I don't think that's it 😭"

or other configurable messages.

Allow another attempt.

Do not reveal the correct answer.

---

# 6. Relationship Configuration

The anniversary should not be hardcoded into the frontend.

Store it in the database.

Example conceptual configuration:

```text
relationship
    id
    anniversary_month
    anniversary_day
    relationship_start_date
    created_at
    updated_at
```

The application should calculate monthly unlock dates from this configuration.

---

# 7. World Content Model

The world is **open**. There are no chapters, no levels, and nothing is
time-locked. She can find anything in any order, whenever she likes.

Everything findable is a **spot**: something placed in the world that she can
walk up to.

```text
spot
    kind        ARCADE | FRAME | LETTER | KEEPSAKE
    title       reads inside a prompt: "Read the note on the step"
    x, z        where it stands
    rotation    which way it faces
    config      per-kind options (which mini-game, which photo, ...)
    published   staged content stays invisible
```

A spot holds either a **memory** (a photo, a letter, a message) or, for arcade
cabinets, a set of **prizes**.

Adding a new kind of thing to find means one component and one entry in the
registry in `game/world/spots/`. It never means a migration.

---

# 8. Discovery State

There are only two things to track, and both are per-user:

```text
discoveries      (user, spot)         she has found this spot
collected_items  (user, collectible)  she has won this prize
```

Both have a unique constraint on the pair, so recording a find is idempotent —
the server uses `ON CONFLICT DO NOTHING` rather than read-then-write, and
walking back to something twice is not a second discovery.

Nothing is ever "locked". A spot is either found or not yet found, and that
only changes how it looks, never whether she can reach it.

---

# 9. Guiding Exploration

With no chapters there is no schedule to follow, so the world has to invite
being explored.

Anything not yet found wears a **soft pulsing halo**, visible from a distance
and properly occluded by walls. That is the whole navigation system: no map, no
quest log, no waypoint list.

Supporting that:

* A path from the gate leading to the door, so the first destination is obvious
* Keepsakes hover and glow until collected, then settle onto their plinth
* Arcade cabinets light their prize window while prizes remain

Avoid: arrows, minimaps, checklists. Being told where to go is the opposite of
finding something.

---

# 10. Growing the World

The world should grow, but by **accumulation rather than on a schedule**.

When there is something new to say, place a new spot. It appears the next time
she opens the app. No chapter to publish, no date to wait for.

Seasonal change is still worth doing — decorations in December, blossom in
spring — but as a change to the environment, not a gate on content.

```text
something to say  ->  place a spot  ->  she finds it next time
```

---

# 11. The Arcade Corner

Inside the cottage is a small arcade. It is the densest, most playful part of
the world, and where "stuff to interact with" lives.

Cabinets present:

* **The claw machine** — implemented, see section 12
* **The photo booth** — a cabinet holding photo-strip prizes

A cabinet is a spot of kind `ARCADE` whose `config.game` names its mini-game.
Its prizes are `collectibles` rows attached to it.

The arcade is where new mini-games go. It is a room that can hold more
cabinets, not a fixed pair.

---

# 12. Claw Machine Gameplay

Implemented. Walking up to the cabinet hands the camera and the controls to the
machine; the player controller pauses.

```text
Approach cabinet
        v
Interact  ->  camera frames the cabinet, player pauses
        v
Aim        joystick / WASD moves the claw over the prizes
        v
Drop       action button, E or Space
        v
Claw descends, closes, lifts
        v
Caught?  ->  carried to the chute  ->  dropped down the shaft
         ->  lands on the tray  ->  capsule opens  ->  note  ->  saved
Missed?  ->  "So close..."         ->  back to aiming
        v
Step back  ->  control returns to the player
```

## How it is built

All of the game state — aiming, dropping, closing, lifting, delivering — is a
pure reducer in `game/minigames/claw/mechanics.ts`. It knows nothing about
three.js, so the whole game can be driven and checked without a renderer;
`mechanics.test.ts` plays out winning and losing rounds and asserts the phase
sequence. The cabinet component only reads that state.

Deliberate simplifications:

* **No physics engine.** Capsules do not roll and nothing stacks. A grab is
  "was the claw over it", which is the entire feel of a real claw machine.
* **A grab is deterministic**, with a generous radius. A random slip would be
  more authentic and more annoying; this is a gift, not a coin-op.
* **Control locks out once the claw drops.** Steering mid-drop would make
  aiming pointless.
* **The capsule layout is stable**, so a shot that missed by a hair can be
  retried against the same arrangement, and winning removes one capsule rather
  than reshuffling the machine.

## Where the trust sits

The client decides *whether* the claw caught something. The server decides
*which* prize, and refuses to hand over one she already has.

So the worst a tampered client can do is claim a prize it was going to be given
anyway. The alternative — the server rolling the odds — makes the claw theatre,
and this is a private gift with no adversary. Section 23 still holds everywhere
it matters: spot ids are re-checked against the relationship, and prizes never
reach the browser before they are won.

---

# 13. Prizes

A prize is a `collectibles` row attached to an arcade spot.

```text
collectible
    id
    spot_id      the cabinet it is inside
    type         PHOTO | LETTER | MEMORY | MESSAGE | GIFT | SPECIAL
    title
    message
    media_url    object storage, never the database
    media_alt    so it is not image-only (section 32)
    metadata
```

Winning one records it:

```text
collected_items
    user_id
    collectible_id
    collected_at
    unique (user_id, collectible_id)
```

**Prizes are the one thing kept from the client.** Everything else in the world
is open, so a spot's memory ships with the page and its reveal is instant. A
cabinet sends only counts — how many prizes, how many won — and the server
picks. Shipping the prize list would spoil the only surprise left in the model.

---

# 14. Memory Reveal Experience

Collecting an item should not simply display a database record.

Make the reveal feel special.

Example:

```text
Claw retrieves capsule
        ↓
Capsule opens
        ↓
Small animation
        ↓
Photo/message appears
        ↓
Memory title
        ↓
Personal message
        ↓
"Memory Collected"
```

It is styled as a note on paper, not a dialog: warm ruled stock, a torn top
edge, the words in handwriting, a photo taped on at a slight angle, a wax seal
by the button. Finding something she wrote should not look like a system
message — the whole point is that a person left it there.

There is a beat before it opens: the capsule sits in the chute and rocks, then
splits. Without it the note snaps in the instant the server answers, which makes
winning feel like a form submission.

**Nothing lists what she has found.** No collection screen, no counters, no
tallies. Finding something shows it once and that is the whole of it — an
inventory of memories turns them into a set to complete.

---

# 15. Persistent 3D World

It is one place, not a set of separate builds. Everything happens in the same
cottage and garden, and new content arrives as new things standing in it.

Built:

* The cottage, with an enterable interior
* The front door
* The garden: path, fence, trees, flowers
* The arcade corner, inside

Room to grow:

* More of the interior — other rooms behind the arcade
* Somewhere out back, past the house
* Seasonal dressing: lights and snow in December, blossom in spring

Seasonal change is a change to the *environment*. It should never gate content —
see section 10.

---

# 16. Scope Control for the 3D World

Do not build an enormous open world.

Prioritize:

* Small environments
* Good composition
* Strong lighting
* Beautiful materials
* Smooth movement
* Atmospheric audio
* Interesting interactions
* Personal details

The goal is not graphical realism.

A stylized low-poly or semi-stylized environment may be preferable because it allows faster development while maintaining charm.

---

# 17. Third-Person Player

Implement a simple third-person controller.

Required features:

* Character movement
* Camera follow
* Camera rotation
* Collision
* Ground detection
* Interaction detection
* Basic animation states
* Idle
* Walk
* Run if needed
* Interaction animation if available

Do not initially spend excessive time building advanced character mechanics.

The player controller should primarily exist to make exploration enjoyable.

---

# 18. Interaction System

Create a reusable interaction system.

Objects should be able to expose interactions such as:

```text
INTERACT
OPEN
READ
COLLECT
PLAY
ENTER
EXAMINE
```

Example:

```text
Player approaches door
        ↓
Interaction prompt appears
        ↓
Press interaction key
        ↓
Door interaction executes
```

The same system should work for:

* Doors
* NPCs
* Claw machine
* Memory objects
* Letters
* Signs
* Collectibles
* Future mini-games

Avoid hardcoding interaction logic individually into every object.

---

# 19. Game State Architecture

Create a central game-state system.

It should know:

* Current player
* Current level
* Available levels
* Completed levels
* Collected memories
* Current environment state
* Available interactions

Avoid putting all state inside individual Three.js components.

Use a clear separation between:

```text
Persistent server state
        ↓
Application/game state
        ↓
Three.js rendering state
```

---

# 20. Database Schema

```text
users
- id, name, email, password_hash, role (ADMIN | PLAYER), created_at

relationships
- id, anniversary_month, anniversary_day, relationship_start_date
- the door at the entrance checks its question against this

spots                     everything findable in the world
- id, relationship_id, kind (ARCADE | FRAME | LETTER | KEEPSAKE)
- title, x, z, rotation, config (jsonb), published, created_at

memories                  what a spot reveals
- id, spot_id, title, message, media_url, media_alt
- memory_date, type, metadata, created_at

collectibles              prizes inside an arcade cabinet
- id, spot_id, title, type, message, media_url, media_alt, metadata

discoveries               spots she has found
- id, user_id, spot_id, discovered_at
- unique (user_id, spot_id)

collected_items           prizes she has won
- id, user_id, collectible_id, collected_at
- unique (user_id, collectible_id)
```

Foreign keys cascade from `relationships` down through `spots`, so deleting a
spot takes its memories and prizes with it.

There are no `levels` or `level_progress` tables. They were dropped in
`migrations/001-open-world.sql`.

Migrations are hand-written SQL under `migrations/`, applied with
`npm run db:migrate`. `drizzle-kit push` is not used: it needs an interactive
prompt to tell a renamed table from a new one, and a destructive migration is
worth reading before it runs.

---

# 21. Flexible Mini-Game Architecture

Two levels of registry, neither of which needs a migration to extend.

**What kind of thing is it?** `spot.kind` picks a visual and an interaction
verb, in `game/world/spots/`:

```text
ARCADE   -> a cabinet          verb PLAY
FRAME    -> a framed photo     verb EXAMINE
LETTER   -> a folded note      verb READ
KEEPSAKE -> a small keepsake   verb COLLECT
```

**Which mini-game does a cabinet run?** `spot.config.game`:

```text
claw   -> ClawGame
booth  -> (photo booth)
```

Adding a mini-game is a component plus one branch. Per-game options live in
`config`, so the column never changes shape.

A mini-game takes the camera and the movement input for as long as it is
mounted; the player controller accepts a `paused` prop and stands still. That
is the whole contract — a new game needs to know nothing else about the world.

---

# 22. Admin / Creator Dashboard

Built, at `/admin`. Sign in as the ADMIN user; an "Admin" link appears in the
collection panel for that role only. The page is behind `requireAdmin`, which
re-reads the role from the database — a validly signed cookie claiming ADMIN
does not get in.

It is plain server-action forms, no client components, so it works with
JavaScript off and has no state to fall out of sync with the database.

Working now:

* Set the anniversary the door asks about
* **Place a spot by dragging it on a map of the garden** — no coordinates
  anywhere. The map is drawn from `game/world/layout.ts`, the same constants the
  game renders and collides against, so it cannot drift out of step with the
  real garden: the cottage, its doorway, the path, the trees and the fence are
  all where they actually are, to scale.

  The pin carries a soft ring showing how close she has to get, and a line
  showing which way it faces. Facing is eight arrows, not radians. Anything
  already placed shows as a dot for context.

  A placement turns red if she could not reach it. That needs two conditions,
  and the second alone is not enough: the spot must not be *inside* a wall or a
  tree, and somewhere within reach must be standable. A spot buried in a wall
  passes the reach test on its own, because there is open ground on the far side
  — while a frame flush *against* a wall sits at the face rather than in it, and
  is perfectly fine.
* New spots start **unpublished**
* Edit a spot's title, position, facing, published flag
* Delete a spot, taking its memories and prizes with it
* Write a memory: title, message, date, image URL, image description
* Add, edit and remove arcade prizes
* Reset a player's progress

**Photos are uploaded**, to Cloudinary, from the admin. Pasting a direct image
URL still works as an alternative; a Drive or Dropbox *share* link does not,
because it is a web page rather than an image, and the admin says so.

Uploads are checked by their magic bytes rather than the declared content type
or the filename, since the browser controls both. JPEG, PNG, GIF and WebP only —
SVG is refused because it can carry script — with a 10MB cap.

**A cabinet she has emptied goes into free play.** A prize is only recorded once
per person, so once she has won everything in a machine it refills itself and
stays playable: she still works the claw, still gets a capsule out, still gets to
read what is in it — nothing new is recorded. That keeps the arcade a toy rather
than an ornament. Only a cabinet with *no* prizes in it at all is unplayable;
that one dims itself and its prompt softens to "Look at".

**There are no counters anywhere.** No "3 of 16 found", no win tallies. The
collection is a list of what she has, not a score — a progress bar turns a set
of memories into a chore.

Still wanted:

## Relationship

* Configure the anniversary date

* **Media upload.** So a photo can be chosen from a phone rather than hosted
  elsewhere first.
* Per-kind options in the UI (a frame's tint, a cabinet's game)
* Reordering prizes

---

# 23. Security

This is a private relationship application.

Implement:

* Authentication
* Authorization
* Server-side date validation
* Server-side level validation
* Protected admin routes
* Protected API endpoints
* Database access only through server-side code
* Input validation
* File upload validation
* Secure media access where appropriate

Never trust the client for:

* Unlock dates
* Completion state
* Collection state
* Admin permissions
* Anniversary answer
* Database IDs without validation

The client is untrusted.

---

# 24. Authentication

Keep authentication simple.

There should be at least two logical roles:

### Player

Your girlfriend — and she does not sign in. The world is open: she opens the
link and walks in, and an anonymous visitor is treated as the player account so
that what she finds is still remembered.

The cost is that anyone holding the URL can read the whole world. That is a
deliberate trade — no password for her, in exchange for a private link — and
`getViewer` in `lib/auth/dal.ts` is the one place to change if it stops being
the right one.

Can:

* Enter the world
* Play levels
* View unlocked memories
* Collect items
* View progress

Cannot:

* Modify relationship data
* Edit levels
* Upload/change content
* Unlock future levels manually

### Admin

The user.

Can:

* Manage all relationship content
* Place and move spots
* Configure cabinets and their mini-games
* Upload memories and prizes
* Manage player progress
* Preview unpublished content

Use a reliable authentication system compatible with Next.js.

Do not implement custom password hashing/authentication unnecessarily.

---

# 25. Date Logic

Almost all of this went away with the chapter system. There are no unlock
dates, so there is no scheduling to get wrong.

What remains:

* **The anniversary answer.** Two integers, `anniversary_month` and
  `anniversary_day`, compared server-side against what she types at the door.
  No calendar maths.
* **Displaying a memory's date.** A plain `YYYY-MM-DD` formatted with
  `Intl.DateTimeFormat`, pinned to UTC — a calendar day has no timezone, and
  letting the browser shift it would show the day before for anyone west of it.

There is no date library and no `lib/dates`. If time-gating ever comes back, it
should arrive as an optional `available_from` on a spot, and the comparison must
happen on the server against a configured timezone — never the browser clock.

---

# 26. UX Outside the 3D World

Although the 3D world is the primary interface, normal web UI is still necessary.

Use conventional UI for:

* Authentication
* Settings
* Loading states
* Level information
* Memory viewer
* Collection screen
* Admin dashboard
* Error handling
* Accessibility
* Mobile controls

The UI should complement the game rather than compete with it.

---

# 27. Mobile Experience

The project is specifically a **mobile web app**, so mobile should be treated as a first-class platform.

Do not simply make a desktop Three.js game and shrink it.

Design specifically for:

* Touch controls
* Small screens
* Portrait orientation where practical
* Landscape orientation where required by gameplay
* Mobile performance
* Limited GPU resources
* Variable network quality

Potential mobile controls:

```text
Virtual joystick
+
Interaction button
+
Optional action button
```

For mini-games, use touch-native interactions when possible.

---

# 28. Performance

Three.js performance is critical.

Prioritize:

* Low-poly models where possible
* Optimized textures
* Compressed assets
* Lazy loading
* Level-based asset loading
* Avoiding unnecessary React re-renders
* Efficient animation loops
* Object reuse where appropriate
* Proper disposal of Three.js resources
* Limited real-time physics
* Mobile GPU optimization

Do not load every future level's assets when the application starts.

For example:

August's level should not need to download October's entire environment.

---

# 29. Loading Experience

3D assets may take time to load.

Create an attractive loading screen.

Possible presentation:

```text
❤️

Preparing your little world...

[progress]

"Loading our memories..."
```

Avoid displaying a generic technical loading screen unless necessary.

The loading screen can itself contribute to the emotional tone.

---

# 30. Audio

Audio can significantly improve the experience.

Consider:

* Ambient background music
* Footsteps
* Door sounds
* UI interaction sounds
* Claw machine sounds
* Collectible reveal sounds
* Level unlock sound
* Success/failure sounds

Audio should be optional/mutable.

Do not automatically blast audio on mobile without respecting browser autoplay restrictions.

---

# 31. Responsive Presentation

The application should adapt to:

* Mobile portrait
* Mobile landscape
* Tablet
* Desktop

The 3D world can remain the primary experience while UI overlays adapt to screen size.

Do not allow important UI elements to become inaccessible on small screens.

---

# 32. Accessibility

Even though this is a game-like application, maintain reasonable accessibility.

Support:

* Readable text
* High enough contrast
* Reduced-motion option where practical
* Audio mute
* Touch controls
* Keyboard interaction on desktop
* Clear interaction prompts
* Alternative descriptions for important memory content

Important relationship content should not exist exclusively as tiny text or audio.

---

# 33. Project Structure

What is actually there:

```text
app/
    layout.tsx           the portrait shell
    page.tsx             loads the world, renders it
    login/
game/
    World.tsx            canvas, mode switching, reveals
    collision.ts         circle-vs-AABB, camera pull-in
    input.ts             one input surface, keyboard + touch
    interaction/         proximity prompts, the registry
    player/              controller, avatar, rig, camera maths
    minigames/
        claw/            mechanics (pure) + cabinet + game mode
    world/
        layout.ts        all geometry; renderer and collision share it
        palette.ts       every colour in the world
        House / Garden / Sky / Lighting / Door
        spots/           one visual per kind + the kind registry
    ui/                  HUD, touch controls, reveal, collection
lib/
    auth/                password, session, data access layer
    db/                  schema, seed, migrate
    world/               queries and server actions
migrations/              hand-written SQL
```

Two rules that have earned their place:

* **Geometry has one home.** `game/world/layout.ts` feeds both the meshes and
  the colliders, so a wall cannot be drawn where you can walk.
* **Game logic is pure where it can be.** Movement, collision, claw mechanics
  and the avatar rig are plain functions with tests. The three.js components
  only read them.

---

# 34. Reusable Game Systems

Built:

### Player controller
Movement, camera follow, and camera pull-in when a wall gets between. Accepts
`paused` so a mini-game can take over.

### Interaction system
Objects register position, range, verb and label; the controller asks what is
nearby. Prompts re-render only when the text would change, so walking around
costs nothing.

### Spot system
Placement, the kind registry, and the undiscovered halo.

### Reveal
One overlay for anything found, whether a spot's memory or an arcade prize.

### Collection
What she has found, and how much is left.

### Mini-game contract
Mounted, it owns the camera and the movement input, and reports its outcome.

Not built:

### Audio
Nothing yet. Section 30 still stands.

### Admin
Section 22.

---

# 35. Error Handling

Handle failures gracefully.

Examples:

* Database unavailable
* Network lost
* Media fails to load
* Level doesn't exist
* Player attempts to access locked level
* Authentication expires
* Invalid collectible
* Server/client date mismatch

Never allow a client-side error to expose sensitive server information.

Use friendly messages appropriate to the relationship experience where possible.

---

# 36. Development Phases

## Done

**Foundation.** Next.js, TypeScript, React Three Fiber, NeonDB with Drizzle,
session auth with scrypt and a signed cookie, and a data access layer that
re-reads the role from the database on every request.

**The world.** A stylized cottage and garden: gabled roof, mullioned windows,
picket fence, stepping-stone path, instanced grass and flowers, gradient sky and
golden-hour lighting.

**The player.** Third-person controller with camera-relative movement, collision
against static boxes, camera pull-in, and a chibi avatar posed procedurally —
walk cycle, idle breathing, head turning toward the camera.

**Portrait shell.** Fullscreen on a phone, a phone-shaped column on a desktop,
safe-area insets, and a horizontal-hold field of view.

**Open world content.** Spots, four kinds, discovery and collection persisted.

**The claw machine.** Playable, persistent, pure-reducer mechanics.

## Next

**The anniversary door.** The question at the entrance is still just a door that
opens. Section 5.

**Admin.** Drag-to-place, and per-kind options in the UI. Section 22.

**Audio.** Section 30.

**More cabinets.** The registry is ready for them.

---

# 37. MVP Definition

Reached, except where noted:

1. Authentication — done
2. NeonDB — done
3. 3D world — done
4. Third-person movement — done
5. Door — opens; the anniversary question is **not** built
6. Server-side validation of spot ids and prizes — done
7. Open world with things to find — done
8. Claw machine — done
9. Persistent discoveries and collection — done
10. Mobile controls, portrait — done
11. Letters and messages — done, editable in the admin
12. Photos — uploaded from the admin to Cloudinary

The app is playable end to end and its content is editable at `/admin`. What
stands between it and being a real gift is now mostly writing the content —
plus media upload, so photos do not have to be hosted elsewhere first.

---

# 38. Important Product Rule

Build the room before the furniture.

The claw machine is the **first implementation of the mini-game contract**, not
a one-off. Anything added later plugs into the same path:

```text
Spot
 v
Kind / mini-game registry
 v
Interaction
 v
Prizes or memory
 v
Discovery and collection
```

If a new idea needs that chain changed, change the chain — do not special-case
it. And if it needs a migration to add a new kind of thing, the registry has
been built wrong.

---

# 39. Content Philosophy

The content should feel personal rather than algorithmically generated.

Prioritize:

* Real photos
* Real memories
* Real dates
* Inside jokes
* Personal messages
* Shared experiences
* Small details only the two of you understand

The technical system exists to present those things in memorable ways.

---

# 40. Long-Term Vision

A small world that fills up.

Every time there is something to say, it becomes something standing in the
world: a note by the gate, a photo on the wall, a new cabinet in the arcade.
Nothing is scheduled and nothing is gated. The world simply gets denser.

```text
something to say
       v
a thing standing in the world
       v
she finds it, whenever she happens to
```

After a year, the point is not that she has worked through a calendar. It is
that the place is full — that she cannot walk across the garden without passing
three things she remembers.

> **A place, rather than a timeline.**

Not a history to scroll, and not a schedule to keep up with. Somewhere to go
back to.

---

# 41. Claude Implementation Instructions

When implementing this project:

* Prioritize architecture before visual polish.
* Keep the 3D game system modular.
* Do not hardcode the August 26 date into gameplay logic.
* Do not hardcode future levels.
* Use NeonDB as the persistent source of truth.
* Validate important state server-side.
* Never trust client-side unlock/completion state.
* Design mobile-first.
* Avoid unnecessary dependencies.
* Keep Three.js components modular.
* Create reusable interaction/game systems.
* Keep database access server-side.
* Use TypeScript strictly.
* Validate API inputs.
* Keep secrets in environment variables.
* Do not expose database credentials to the client.
* Optimize assets for mobile.
* Avoid overengineering the first version.
* Build the MVP completely before adding advanced features.
* Prefer simple, maintainable systems over clever abstractions.

Most importantly:

**Do not turn this into a generic CRUD relationship app with a 3D background.**

The 3D world, exploration, date-based progression, mini-games, and personalized memories are the core product.

The final experience should feel like a **small romantic adventure game made specifically for one person**.
