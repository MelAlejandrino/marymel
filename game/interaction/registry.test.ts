/** Run: node --test */
import assert from "node:assert/strict";

import type { Interactable } from "./nearest.ts";
import {
  getActive,
  registerInteractable,
  resetRegistry,
  subscribeToActive,
  triggerActive,
  updateNearest,
} from "./registry.ts";

let notifications = 0;
const door = (over: Partial<Interactable> = {}): Interactable => ({
  id: "front-door",
  x: 0,
  z: 0,
  range: 3,
  verb: "OPEN",
  label: "the door",
  enabled: true,
  onInteract: () => {},
  ...over,
});

resetRegistry();
subscribeToActive(() => notifications++);

const near = { x: 0, z: 1 };
const far = { x: 0, z: 40 };

// Walking up to something raises a prompt, exactly once.
registerInteractable(door());
updateNearest(near);
assert.equal(getActive()?.verb, "OPEN");
assert.equal(notifications, 1);

// Standing still costs nothing — no re-render per frame.
updateNearest(near);
updateNearest(near);
assert.equal(notifications, 1, "an unchanged prompt must not notify");

// THE REGRESSION: the door opens without moving. Comparing ids alone meant the
// prompt kept reading "open the door" while standing in the open doorway.
registerInteractable(door({ verb: "CLOSE" }));
updateNearest(near);
assert.equal(getActive()?.verb, "CLOSE", "prompt did not follow the door's state");
assert.equal(notifications, 2, "a changed prompt must notify exactly once");

// A changed label propagates too, not just the verb.
registerInteractable(door({ verb: "CLOSE", label: "the front door" }));
updateNearest(near);
assert.equal(getActive()?.label, "the front door");
assert.equal(notifications, 3);

// Becoming unavailable clears the prompt.
registerInteractable(door({ enabled: false }));
updateNearest(near);
assert.equal(getActive(), null, "a disabled object must drop its prompt");
assert.equal(notifications, 4);

// Walking away clears it, and staying away stays quiet.
registerInteractable(door());
updateNearest(near);
const beforeLeaving = notifications;
updateNearest(far);
assert.equal(getActive(), null);
assert.equal(notifications, beforeLeaving + 1);
updateNearest(far);
assert.equal(notifications, beforeLeaving + 1, "staying away must not notify");

// Interacting runs the callback that is registered *now*, not the one captured
// when the prompt first appeared.
let opened = 0;
let closed = 0;
resetRegistry();
registerInteractable(door({ onInteract: () => opened++ }));
updateNearest(near);
registerInteractable(door({ verb: "CLOSE", onInteract: () => closed++ }));
updateNearest(near);
assert.equal(triggerActive(), true);
assert.equal(opened, 0, "fired a stale callback");
assert.equal(closed, 1);

// Nothing nearby: triggering is a no-op rather than a crash.
resetRegistry();
updateNearest(near);
assert.equal(triggerActive(), false);

console.log("registry: all assertions passed");
