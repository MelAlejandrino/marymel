"use client";

/**
 * The beat between the capsule landing in the chute and the note opening.
 *
 * Without it the reveal snaps in the instant the server answers, which makes
 * winning feel like a form submission. This fills the gap on purpose: the
 * capsule sits there, rocks, then splits.
 */
export function OpeningCapsule({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div
      // Not a dialog: it is a moment, not something to interact with. Announced
      // politely so it is not silence for a screen reader either.
      aria-live="polite"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5
                 bg-[#1a1119]/75 backdrop-blur-sm"
    >
      <div className="relative size-24">
        {/* A halo, breathing. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-300/25" />

        {/* Two halves of a capsule, rocking then parting. */}
        <span
          className="absolute inset-x-0 top-0 h-1/2 origin-bottom rounded-t-full
                     bg-gradient-to-b from-rose-200 to-rose-400
                     shadow-[inset_0_2px_6px_rgba(255,255,255,0.5)]
                     animate-[capsule-top_1.5s_ease-in-out_infinite]"
        />
        <span
          className="absolute inset-x-0 bottom-0 h-1/2 origin-top rounded-b-full
                     bg-gradient-to-b from-amber-100 to-amber-300
                     shadow-[inset_0_-2px_6px_rgba(0,0,0,0.15)]
                     animate-[capsule-bottom_1.5s_ease-in-out_infinite]"
        />
      </div>

      <p
        className="text-lg text-white/80"
        style={{ fontFamily: "var(--font-hand), cursive" }}
      >
        opening it&hellip;
      </p>
    </div>
  );
}
