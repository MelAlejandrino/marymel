/** Run: node app/admin/typeahead.test.ts */
import assert from "node:assert/strict";

import { nextMatch, type Option } from "./typeahead.ts";

const options: Option[] = [
  { value: "ARCADE", label: "Arcade cabinet" },
  { value: "FRAME", label: "Photo frame" },
  { value: "LETTER", label: "Letter" },
  { value: "KEEPSAKE", label: "Keepsake" },
];

// A letter finds its option, wherever it is in the list.
assert.equal(nextMatch(options, "k", -1), 3);

// Case does not matter: the typed run is lowered, the labels are capitalised.
assert.equal(nextMatch(options, "arc", -1), 0);

// Several letters narrow it — "p" alone would also be wrong for "Photo frame"
// if we matched anywhere in the label rather than the start.
assert.equal(nextMatch(options, "ph", -1), 1);
assert.equal(nextMatch(options, "frame", -1), -1);

// Nothing matches, and that is a -1 rather than a 0 that would move the
// highlight somewhere the typist did not ask for.
assert.equal(nextMatch(options, "zz", -1), -1);

// It searches after the current option first, so repeated letters cycle...
const ls: Option[] = [
  { value: "a", label: "Letter" },
  { value: "b", label: "Locket" },
  { value: "c", label: "Keepsake" },
];
assert.equal(nextMatch(ls, "l", -1), 0);
assert.equal(nextMatch(ls, "l", 0), 1);
// ...and wraps back to the first once past the last match.
assert.equal(nextMatch(ls, "l", 1), 0);

// Sitting on the only match still returns it rather than -1.
assert.equal(nextMatch(ls, "k", 2), 2);

console.log("typeahead ok");
